import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDeviceStore } from '@/lib/store/device-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusRow } from '@/components/device/status-row';
import { BatteryIndicator } from '@/components/device/battery-indicator';
import { clearAllData } from '@/lib/storage/database';
// import { hasApiKey, setApiKey, clearApiKey, getApiKey } from '@/lib/services/ai';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

export default function DeviceScreen() {
  const {
    connectionState,
    deviceInfo,
    batteryLevel,
    isCharging,
    isWorn,
    disconnect,
    runAlarm,
    runHaptics,
    reboot,
  } = useDeviceStore();
  const router = useRouter();

  const isConnected = connectionState === 'connected';
  const [clearingData, setClearingData] = useState(false);

  // ── API Key state (temporarily disabled) ────────────────────────────────
  // const [keyConfigured, setKeyConfigured] = useState(false);
  // const [showKeyInput, setShowKeyInput] = useState(false);
  // const [keyInput, setKeyInput] = useState('');
  // const [maskedKey, setMaskedKey] = useState('');

  // useEffect(() => {
  //   loadKeyState();
  // }, []);

  // async function loadKeyState() {
  //   const has = await hasApiKey();
  //   setKeyConfigured(has);
  //   if (has) {
  //     const key = await getApiKey();
  //     if (key) {
  //       // Mask all but last 4 chars
  //       setMaskedKey('hf_...' + key.slice(-4));
  //     }
  //   } else {
  //     setMaskedKey('');
  //   }
  // }

  // const handleSaveKey = async () => {
  //   const trimmed = keyInput.trim();
  //   if (!trimmed) {
  //     Alert.alert('Error', 'Please enter a valid API key');
  //     return;
  //   }
  //   await setApiKey(trimmed);
  //   setKeyInput('');
  //   setShowKeyInput(false);
  //   await loadKeyState();
  //   Alert.alert('Saved', 'HuggingFace API key saved.');
  // };

  // const handleClearKey = () => {
  //   Alert.alert(
  //     'Remove API Key',
  //     'AI insights will fall back to heuristic analysis.',
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       {
  //         text: 'Remove',
  //         style: 'destructive',
  //         onPress: async () => {
  //           await clearApiKey();
  //           await loadKeyState();
  //         },
  //       },
  //     ]
  //   );
  // };

  // ── Device actions ─────────────────────────────────────────────────────────
  const handleReboot = () => {
    Alert.alert(
      'Reboot WHOOP',
      'Are you sure you want to reboot your WHOOP strap?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reboot',
          style: 'destructive',
          onPress: reboot,
        },
      ]
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all stored heart rate history and HRV data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingData(true);
            await clearAllData();
            // Reset history-related store state so the history tab refreshes
            useDeviceStore.setState({
              historicalRecords: [],
              historyStatus: 'idle',
            });
            setClearingData(false);
            Alert.alert('Done', 'All stored data has been cleared.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Device</Text>
        </View>

        {/* Connection Status */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
          <StatusRow
            label="Connection"
            value={isConnected ? 'Connected' : 'Disconnected'}
            valueColor={isConnected ? colors.success : colors.error}
          />
          {isConnected && (
            <>
              <StatusRow
                label="Wrist"
                value={isWorn ? 'On' : 'Off'}
                valueColor={isWorn ? colors.success : colors.warning}
              />
              <StatusRow
                label="Charging"
                value={isCharging ? 'Yes' : 'No'}
                valueColor={isCharging ? colors.success : colors.textSecondary}
              />
              <View style={styles.batteryRow}>
                <Text style={styles.rowLabel}>Battery</Text>
                <BatteryIndicator level={batteryLevel} isCharging={isCharging} />
              </View>
            </>
          )}
        </Card>

        {/* Device Info */}
        {isConnected && deviceInfo && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Firmware</Text>
            <StatusRow label="Harvard" value={deviceInfo.harvardVersion} />
            <StatusRow label="Boylston" value={deviceInfo.boylstonVersion} />
          </Card>
        )}

        {/* Controls */}
        {isConnected && (
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Controls</Text>
            <View style={styles.controlsGrid}>
              <Button
                title="Vibrate"
                onPress={runAlarm}
                variant="secondary"
                size="sm"
                style={styles.controlBtn}
              />
              <Button
                title="Haptics"
                onPress={runHaptics}
                variant="secondary"
                size="sm"
                style={styles.controlBtn}
              />
              <Button
                title="Reboot"
                onPress={handleReboot}
                variant="danger"
                size="sm"
                style={styles.controlBtn}
              />
            </View>
          </Card>
        )}

        {/* AI Settings (temporarily disabled)
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>AI Settings</Text>
          <Text style={styles.aiDescription}>
            HuggingFace API key for AI-powered health insights. Without a key,
            analysis falls back to heuristic scoring.
          </Text>

          {keyConfigured && !showKeyInput && (
            <View style={styles.keyRow}>
              <Text style={styles.keyMasked}>{maskedKey}</Text>
              <View style={styles.keyActions}>
                <Button
                  title="Change"
                  onPress={() => setShowKeyInput(true)}
                  variant="ghost"
                  size="sm"
                />
                <Button
                  title="Remove"
                  onPress={handleClearKey}
                  variant="danger"
                  size="sm"
                />
              </View>
            </View>
          )}

          {!keyConfigured && !showKeyInput && (
            <Button
              title="Add API Key"
              onPress={() => setShowKeyInput(true)}
              variant="secondary"
              style={styles.addKeyButton}
            />
          )}

          {showKeyInput && (
            <View style={styles.keyInputContainer}>
              <TextInput
                style={styles.keyInput}
                placeholder="hf_..."
                placeholderTextColor={colors.textTertiary}
                value={keyInput}
                onChangeText={setKeyInput}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <View style={styles.keyInputActions}>
                <Button
                  title="Save"
                  onPress={handleSaveKey}
                  variant="primary"
                  size="sm"
                />
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowKeyInput(false);
                    setKeyInput('');
                  }}
                  variant="ghost"
                  size="sm"
                />
              </View>
            </View>
          )}
        </Card>
        */}

        {/* Connection Action */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Connection</Text>
          {isConnected ? (
            <Button
              title="Disconnect"
              onPress={disconnect}
              variant="danger"
            />
          ) : (
            <Button
              title="Connect WHOOP"
              onPress={() => router.push('/connect')}
              variant="primary"
            />
          )}
        </Card>

        {/* Data Management */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Data</Text>
          <Button
            title="Clear All Stored Data"
            onPress={handleClearData}
            variant="ghost"
            loading={clearingData}
          />
        </Card>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>WHOOP v1.0.0</Text>
          <Text style={styles.appInfoText}>
            Reverse-engineered WHOOP 4.0 BLE protocol
          </Text>
          <Text style={styles.appInfoTextSmall}>
            Inspired by github.com/jogolden/whoomp
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 1,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  batteryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
  },
  controlsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlBtn: {
    flex: 1,
  },

  // ── AI Settings ────────────────────────────────────────────────────────────
  aiDescription: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keyMasked: {
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },
  keyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addKeyButton: {
    alignSelf: 'flex-start',
  },
  keyInputContainer: {
    gap: spacing.sm,
  },
  keyInput: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: fontSize.sm,
    fontFamily: 'monospace',
  },
  keyInputActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },

  // ── App Info ───────────────────────────────────────────────────────────────
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  appInfoText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  appInfoTextSmall: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    opacity: 0.6,
    marginTop: spacing.xs,
  },
});
