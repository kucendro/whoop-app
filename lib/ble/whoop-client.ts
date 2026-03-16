import { BleManager, Device, Characteristic, Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { WhoopPacket, buildCommand } from './packet';
import { AsyncQueue } from './async-queue';
import {
  WHOOP_SERVICE,
  WHOOP_CHAR_CMD_TO_STRAP,
  WHOOP_CHAR_CMD_FROM_STRAP,
  WHOOP_CHAR_EVENTS_FROM_STRAP,
  WHOOP_CHAR_DATA_FROM_STRAP,
  PacketType,
  MetadataType,
  EventNumber,
  CommandNumber,
  HistoricalRecord,
  DeviceInfo,
} from './constants';

// Decode base64 to Uint8Array (BLE-PLX returns base64)
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of base64) {
    if (char === '=') break;
    const val = chars.indexOf(char);
    if (val === -1) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// Encode Uint8Array to base64 (BLE-PLX expects base64)
function uint8ArrayToBase64(data: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < data.length) {
    const a = data[i++] || 0;
    const b = data[i++] || 0;
    const c = data[i++] || 0;
    const triplet = (a << 16) | (b << 8) | c;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i - 2 <= data.length ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i - 1 <= data.length ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

export type ConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface WhoopCallbacks {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onHeartRate?: (bpm: number) => void;
  onBatteryLevel?: (level: number) => void;
  onDeviceInfo?: (info: DeviceInfo) => void;
  onChargingStatus?: (charging: boolean) => void;
  onWristStatus?: (isWorn: boolean) => void;
  onHistoricalData?: (record: HistoricalRecord) => void;
  onHistoryProgress?: (status: 'downloading' | 'complete' | 'error') => void;
  onDoubleTap?: () => void;
  onError?: (error: string) => void;
}

class WhoopClient {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private subscriptions: Subscription[] = [];
  private batteryInterval: ReturnType<typeof setInterval> | null = null;
  private metaQueue = new AsyncQueue<WhoopPacket>();
  private callbacks: WhoopCallbacks = {};
  private _isRealtimeActive = false;
  private _connectionState: ConnectionState = 'disconnected';
  private historicalDataBuffer: Uint8Array[] = [];

  /**
   * Lazily create the BleManager so the app doesn't crash at import
   * time when the native module isn't available (e.g. Expo Go).
   */
  private getManager(): BleManager {
    if (!this.manager) {
      try {
        this.manager = new BleManager();
      } catch (e) {
        throw new Error(
          'BLE native module not available. This app requires a development build — it cannot run in Expo Go. Run "npx expo prebuild" then build with Android Studio or Xcode.'
        );
      }
    }
    return this.manager;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get isRealtimeActive(): boolean {
    return this._isRealtimeActive;
  }

  setCallbacks(callbacks: WhoopCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private setConnectionState(state: ConnectionState) {
    this._connectionState = state;
    this.callbacks.onConnectionStateChange?.(state);
  }

  /**
   * Request BLE permissions (Android)
   * Returns: 'granted' | 'denied' | 'blocked' (blocked = never_ask_again)
   */
  async requestPermissions(): Promise<'granted' | 'denied' | 'blocked'> {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.Version;
      if (apiLevel >= 31) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        console.log('BLE permission results:', JSON.stringify(result));
        const values = Object.values(result);
        if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) {
          return 'granted';
        }
        if (values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
          return 'blocked';
        }
        return 'denied';
      } else {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        console.log('BLE location permission result:', result);
        if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
        return 'denied';
      }
    }
    return 'granted';
  }

  /**
   * Scan for and connect to a WHOOP device
   */
  async connect(): Promise<boolean> {
    try {
      const permissionStatus = await this.requestPermissions();
      if (permissionStatus === 'blocked') {
        this.callbacks.onError?.('Bluetooth permissions permanently denied. Please enable them in Settings > Apps > WHOOP > Permissions.');
        // Try to open app settings automatically
        Linking.openSettings().catch(() => {});
        return false;
      }
      if (permissionStatus === 'denied') {
        this.callbacks.onError?.('Bluetooth permissions not granted. Please allow Bluetooth and Location access.');
        return false;
      }

      this.setConnectionState('scanning');

      return new Promise<boolean>((resolve) => {
        const manager = this.getManager();
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          this.setConnectionState('disconnected');
          this.callbacks.onError?.('Scan timed out. Make sure your WHOOP is nearby.');
          resolve(false);
        }, 15000);

        manager.startDeviceScan(
          [WHOOP_SERVICE],
          { allowDuplicates: false },
          async (error, scannedDevice) => {
            if (error) {
              clearTimeout(timeout);
              this.setConnectionState('disconnected');
              this.callbacks.onError?.(error.message);
              resolve(false);
              return;
            }

            if (scannedDevice) {
              clearTimeout(timeout);
              manager.stopDeviceScan();
              this.setConnectionState('connecting');

              try {
                const connected = await scannedDevice.connect({
                  requestMTU: 512,
                });
                const discovered =
                  await connected.discoverAllServicesAndCharacteristics();
                this.device = discovered;

                // Set up notification handlers
                await this.setupNotifications();

                // Monitor disconnect
                this.device.onDisconnected(() => {
                  this.handleDisconnect();
                });

                this.setConnectionState('connected');

                // Initial commands
                await this.sendCommand(CommandNumber.REPORT_VERSION_INFO);
                await this.sendCommand(CommandNumber.GET_HELLO_HARVARD);
                this.startBatteryPolling();

                resolve(true);
              } catch (connectError: any) {
                this.setConnectionState('disconnected');
                this.callbacks.onError?.(
                  connectError?.message || 'Failed to connect'
                );
                resolve(false);
              }
            }
          }
        );
      });
    } catch (error: any) {
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(error?.message || 'Connection failed');
      return false;
    }
  }

  /**
   * Disconnect from the WHOOP
   */
  async disconnect(): Promise<void> {
    this.stopBatteryPolling();
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];

    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch {
        // Ignore disconnect errors
      }
      this.device = null;
    }

    this._isRealtimeActive = false;
    this.setConnectionState('disconnected');
  }

  private handleDisconnect() {
    this.stopBatteryPolling();
    this.subscriptions.forEach((s) => s.remove());
    this.subscriptions = [];
    this.device = null;
    this._isRealtimeActive = false;
    this.setConnectionState('disconnected');
  }

  /**
   * Set up BLE notification handlers for all WHOOP characteristics
   */
  private async setupNotifications(): Promise<void> {
    if (!this.device) return;

    // CMD_FROM_STRAP - command responses
    const cmdSub = this.device.monitorCharacteristicForService(
      WHOOP_SERVICE,
      WHOOP_CHAR_CMD_FROM_STRAP,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        this.handleCmdNotification(characteristic);
      }
    );
    this.subscriptions.push(cmdSub);

    // EVENTS_FROM_STRAP - device events
    const eventSub = this.device.monitorCharacteristicForService(
      WHOOP_SERVICE,
      WHOOP_CHAR_EVENTS_FROM_STRAP,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        this.handleEventsNotification(characteristic);
      }
    );
    this.subscriptions.push(eventSub);

    // DATA_FROM_STRAP - realtime data + historical data + metadata
    const dataSub = this.device.monitorCharacteristicForService(
      WHOOP_SERVICE,
      WHOOP_CHAR_DATA_FROM_STRAP,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        this.handleDataNotification(characteristic);
      }
    );
    this.subscriptions.push(dataSub);
  }

  /**
   * Handle command responses (battery, version, device status)
   */
  private handleCmdNotification(characteristic: Characteristic) {
    try {
      const value = base64ToUint8Array(characteristic.value!);
      const packet = WhoopPacket.fromData(value);
      const dataView = new DataView(
        packet.data.buffer,
        packet.data.byteOffset,
        packet.data.byteLength
      );

      if (packet.cmd === CommandNumber.GET_BATTERY_LEVEL) {
        const raw = dataView.getUint16(2, true);
        this.callbacks.onBatteryLevel?.(raw / 10.0);
      } else if (packet.cmd === CommandNumber.REPORT_VERSION_INFO) {
        const info = this.parseVersionData(dataView);
        this.callbacks.onDeviceInfo?.(info);
      } else if (packet.cmd === CommandNumber.GET_HELLO_HARVARD) {
        const charging = dataView.getUint8(7) !== 0;
        this.callbacks.onChargingStatus?.(charging);
        if (packet.data.length > 116) {
          const isWorn = dataView.getUint8(116) !== 0;
          this.callbacks.onWristStatus?.(isWorn);
        }
      }
    } catch (e: any) {
      console.warn('CMD parse error:', e?.message);
    }
  }

  /**
   * Handle device events (wrist on/off, charging, double tap)
   */
  private handleEventsNotification(characteristic: Characteristic) {
    try {
      const value = base64ToUint8Array(characteristic.value!);
      const packet = WhoopPacket.fromData(value);

      switch (packet.cmd) {
        case EventNumber.WRIST_ON:
          this.callbacks.onWristStatus?.(true);
          break;
        case EventNumber.WRIST_OFF:
          this.callbacks.onWristStatus?.(false);
          break;
        case EventNumber.CHARGING_ON:
          this.callbacks.onChargingStatus?.(true);
          break;
        case EventNumber.CHARGING_OFF:
          this.callbacks.onChargingStatus?.(false);
          break;
        case EventNumber.DOUBLE_TAP:
          this.callbacks.onDoubleTap?.();
          break;
      }
    } catch (e: any) {
      console.warn('Event parse error:', e?.message);
    }
  }

  /**
   * Handle data notifications (realtime HR, historical data, metadata)
   */
  private handleDataNotification(characteristic: Characteristic) {
    try {
      const value = base64ToUint8Array(characteristic.value!);
      const packet = WhoopPacket.fromData(value);

      if (packet.type === PacketType.REALTIME_DATA) {
        const heartRate = packet.data[5];
        if (heartRate > 0 && heartRate < 250) {
          this.callbacks.onHeartRate?.(heartRate);
        }
      } else if (packet.type === PacketType.METADATA) {
        this.metaQueue.enqueue(packet);
      } else if (packet.type === PacketType.HISTORICAL_DATA) {
        this.historicalDataBuffer.push(value);
        this.parseHistoricalPacket(packet);
      }
    } catch (e: any) {
      console.warn('Data parse error:', e?.message);
    }
  }

  /**
   * Parse a historical data packet into a HistoricalRecord
   */
  private parseHistoricalPacket(packet: WhoopPacket) {
    try {
      const dataView = new DataView(
        packet.data.buffer,
        packet.data.byteOffset,
        packet.data.byteLength
      );

      const unix = dataView.getUint32(4, true);
      // offset 8: subsec (2), offset 10: unknown (2), offset 12: unknown
      const heartRate = dataView.getUint8(14);

      // RR intervals
      const rrNum = packet.data[15];
      const rrIntervals: number[] = [];
      if (rrNum >= 1 && rrNum <= 4) {
        for (let i = 0; i < rrNum; i++) {
          rrIntervals.push(dataView.getUint16(16 + i * 2, true));
        }
      }

      const record: HistoricalRecord = { unix, heartRate, rrIntervals };
      this.callbacks.onHistoricalData?.(record);
    } catch (e: any) {
      console.warn('Historical parse error:', e?.message);
    }
  }

  /**
   * Parse firmware version info
   */
  private parseVersionData(dataView: DataView): DeviceInfo {
    let offset = 3; // Skip 3 header bytes
    const values: number[] = [];
    for (let i = 0; i < 16; i++) {
      values.push(dataView.getUint32(offset, true));
      offset += 4;
    }

    return {
      harvardVersion: `${values[0]}.${values[1]}.${values[2]}.${values[3]}`,
      boylstonVersion: `${values[4]}.${values[5]}.${values[6]}.${values[7]}`,
    };
  }

  /**
   * Send a command to the WHOOP strap
   */
  async sendCommand(
    cmd: number,
    data: Uint8Array = new Uint8Array([0x00])
  ): Promise<void> {
    if (!this.device) {
      throw new Error('Not connected');
    }

    const packet = buildCommand(cmd, data);
    const base64Data = uint8ArrayToBase64(packet);

    await this.device.writeCharacteristicWithResponseForService(
      WHOOP_SERVICE,
      WHOOP_CHAR_CMD_TO_STRAP,
      base64Data
    );
  }

  /**
   * Toggle real-time heart rate streaming
   */
  async toggleRealtimeHR(): Promise<void> {
    this._isRealtimeActive = !this._isRealtimeActive;
    await this.sendCommand(
      CommandNumber.TOGGLE_REALTIME_HR,
      new Uint8Array([this._isRealtimeActive ? 0x01 : 0x00])
    );
  }

  /**
   * Start real-time heart rate streaming
   */
  async startRealtimeHR(): Promise<void> {
    if (!this._isRealtimeActive) {
      this._isRealtimeActive = true;
      await this.sendCommand(
        CommandNumber.TOGGLE_REALTIME_HR,
        new Uint8Array([0x01])
      );
    }
  }

  /**
   * Stop real-time heart rate streaming
   */
  async stopRealtimeHR(): Promise<void> {
    if (this._isRealtimeActive) {
      this._isRealtimeActive = false;
      await this.sendCommand(
        CommandNumber.TOGGLE_REALTIME_HR,
        new Uint8Array([0x00])
      );
    }
  }

  /**
   * Download historical data from the WHOOP
   */
  async downloadHistory(): Promise<void> {
    if (!this.device) {
      throw new Error('Not connected');
    }

    this.callbacks.onHistoryProgress?.('downloading');
    this.historicalDataBuffer = [];
    this.metaQueue.clear();

    try {
      // Initiate history download
      await this.sendCommand(CommandNumber.SEND_HISTORICAL_DATA);

      while (true) {
        let metapkt = await this.metaQueue.dequeue();

        // Wait for HISTORY_END or HISTORY_COMPLETE
        while (
          metapkt.cmd !== MetadataType.HISTORY_END &&
          metapkt.cmd !== MetadataType.HISTORY_COMPLETE
        ) {
          metapkt = await this.metaQueue.dequeue();
        }

        if (metapkt.cmd === MetadataType.HISTORY_COMPLETE) {
          this.callbacks.onHistoryProgress?.('complete');
          break;
        }

        // Extract trim value and request next batch
        const dataView = new DataView(metapkt.data.buffer);
        const trim = dataView.getUint32(10, true);

        const responseData = new Uint8Array(9);
        const responseView = new DataView(responseData.buffer);
        responseView.setUint8(0, 1);
        responseView.setUint32(1, trim, true);
        responseView.setUint32(5, 0, true);

        await this.sendCommand(CommandNumber.HISTORICAL_DATA_RESULT, responseData);
      }
    } catch (error: any) {
      this.callbacks.onHistoryProgress?.('error');
      throw error;
    }
  }

  /**
   * Trigger alarm vibration
   */
  async runAlarm(): Promise<void> {
    await this.sendCommand(CommandNumber.RUN_ALARM);
  }

  /**
   * Trigger haptic feedback
   */
  async runHaptics(): Promise<void> {
    await this.sendCommand(CommandNumber.RUN_HAPTICS_PATTERN);
  }

  /**
   * Reboot the strap
   */
  async reboot(): Promise<void> {
    await this.sendCommand(CommandNumber.REBOOT_STRAP);
  }

  /**
   * Request battery level
   */
  async requestBattery(): Promise<void> {
    await this.sendCommand(CommandNumber.GET_BATTERY_LEVEL);
  }

  private startBatteryPolling() {
    this.requestBattery().catch(() => {});
    this.batteryInterval = setInterval(() => {
      this.requestBattery().catch(() => {});
    }, 30000);
  }

  private stopBatteryPolling() {
    if (this.batteryInterval) {
      clearInterval(this.batteryInterval);
      this.batteryInterval = null;
    }
  }

  /**
   * Destroy the BLE manager
   */
  destroy() {
    this.disconnect();
    this.manager?.destroy();
    this.manager = null;
  }
}

// Singleton instance
export const whoopClient = new WhoopClient();
