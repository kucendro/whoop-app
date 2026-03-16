import { create } from 'zustand';
import { whoopClient, ConnectionState } from '@/lib/ble/whoop-client';
import { DeviceInfo, HistoricalRecord } from '@/lib/ble/constants';

interface HeartRatePoint {
  timestamp: number;
  bpm: number;
}

interface DeviceState {
  // Connection
  connectionState: ConnectionState;
  isRealtimeActive: boolean;
  error: string | null;

  // Device info
  batteryLevel: number | null;
  isCharging: boolean;
  isWorn: boolean;
  deviceInfo: DeviceInfo | null;

  // Real-time heart rate
  currentHR: number | null;
  heartRateHistory: HeartRatePoint[];
  maxHistoryPoints: number;

  // History download
  historyStatus: 'idle' | 'downloading' | 'complete' | 'error';
  historicalRecords: HistoricalRecord[];

  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  toggleRealtimeHR: () => Promise<void>;
  downloadHistory: () => Promise<void>;
  runAlarm: () => Promise<void>;
  runHaptics: () => Promise<void>;
  reboot: () => Promise<void>;
  clearHeartRateHistory: () => void;
  setMaxHistoryPoints: (points: number) => void;
  clearError: () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => {
  // Register callbacks with the WHOOP client
  whoopClient.setCallbacks({
    onConnectionStateChange: (connectionState) => {
      set({ connectionState });
      if (connectionState === 'disconnected') {
        set({
          isRealtimeActive: false,
          currentHR: null,
          batteryLevel: null,
          isCharging: false,
          isWorn: false,
          deviceInfo: null,
        });
      }
    },
    onHeartRate: (bpm) => {
      const { heartRateHistory, maxHistoryPoints } = get();
      const point: HeartRatePoint = { timestamp: Date.now(), bpm };
      const history = [...heartRateHistory, point];
      if (history.length > maxHistoryPoints) {
        history.splice(0, history.length - maxHistoryPoints);
      }
      set({ currentHR: bpm, heartRateHistory: history });
    },
    onBatteryLevel: (level) => {
      set({ batteryLevel: level });
    },
    onDeviceInfo: (info) => {
      set({ deviceInfo: info });
    },
    onChargingStatus: (charging) => {
      set({ isCharging: charging });
    },
    onWristStatus: (isWorn) => {
      set({ isWorn });
    },
    onHistoricalData: (record) => {
      const { historicalRecords } = get();
      set({ historicalRecords: [...historicalRecords, record] });
    },
    onHistoryProgress: (status) => {
      set({ historyStatus: status === 'downloading' ? 'downloading' : status === 'complete' ? 'complete' : 'error' });
    },
    onError: (error) => {
      console.error('WHOOP error:', error);
      set({ error });
    },
  });

  return {
    // Initial state
    connectionState: 'disconnected',
    isRealtimeActive: false,
    error: null,
    batteryLevel: null,
    isCharging: false,
    isWorn: false,
    deviceInfo: null,
    currentHR: null,
    heartRateHistory: [],
    maxHistoryPoints: 600, // 10 minutes at 1 sample/sec
    historyStatus: 'idle',
    historicalRecords: [],

    // Actions
    connect: async () => {
      set({ error: null });
      return await whoopClient.connect();
    },

    disconnect: async () => {
      await whoopClient.disconnect();
    },

    toggleRealtimeHR: async () => {
      await whoopClient.toggleRealtimeHR();
      set({ isRealtimeActive: whoopClient.isRealtimeActive });
    },

    downloadHistory: async () => {
      set({ historicalRecords: [], historyStatus: 'downloading' });
      try {
        await whoopClient.downloadHistory();
      } catch {
        set({ historyStatus: 'error' });
      }
    },

    runAlarm: async () => {
      await whoopClient.runAlarm();
    },

    runHaptics: async () => {
      await whoopClient.runHaptics();
    },

    reboot: async () => {
      await whoopClient.reboot();
    },

    clearHeartRateHistory: () => {
      set({ heartRateHistory: [], currentHR: null });
    },

    setMaxHistoryPoints: (points) => {
      set({ maxHistoryPoints: points });
    },

    clearError: () => {
      set({ error: null });
    },
  };
});
