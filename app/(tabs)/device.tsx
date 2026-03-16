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
import { colors, spacing, fontSize, fontWeight } from '@/constants/theme';

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
            setClearingData(false);
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
