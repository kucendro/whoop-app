import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDeviceStore } from '@/lib/store/device-store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BatteryIndicator } from '@/components/device/battery-indicator';
import { HeartRateChart } from '@/components/charts/heart-rate-chart';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

export default function DashboardScreen() {
  const {
    connectionState,
    currentHR,
    heartRateHistory,
    batteryLevel,
    isCharging,
    isWorn,
    isRealtimeActive,
    toggleRealtimeHR,
  } = useDeviceStore();
  const router = useRouter();

  const isConnected = connectionState === 'connected';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>WHOOP</Text>
            <View style={styles.statusRow}>
              <Badge
                label={isConnected ? 'Connected' : 'Disconnected'}
                variant={isConnected ? 'success' : 'error'}
              />
              {isConnected && (
                <Badge
                  label={isWorn ? 'On Wrist' : 'Off Wrist'}
                  variant={isWorn ? 'success' : 'warning'}
                />
              )}
            </View>
          </View>
          {isConnected && (
            <BatteryIndicator level={batteryLevel} isCharging={isCharging} />
          )}
        </View>

        {/* Heart Rate Display */}
        <Card style={styles.hrCard}>
          <View style={styles.hrHeader}>
            <Text style={styles.hrLabel}>Heart Rate</Text>
            {isConnected && (
              <TouchableOpacity
                onPress={toggleRealtimeHR}
                style={[
                  styles.hrToggle,
                  isRealtimeActive && styles.hrToggleActive,
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.hrToggleDot,
                    isRealtimeActive && styles.hrToggleDotActive,
                  ]}
                />
                <Text
                  style={[
                    styles.hrToggleText,
                    isRealtimeActive && styles.hrToggleTextActive,
                  ]}
                >
                  {isRealtimeActive ? 'LIVE' : 'START'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.hrValueContainer}>
            <Text style={styles.hrValue}>
              {currentHR !== null ? currentHR : '--'}
            </Text>
            <Text style={styles.hrUnit}>bpm</Text>
          </View>

          {/* Heart Rate Chart */}
          <HeartRateChart data={heartRateHistory} />
        </Card>

        {/* Quick Stats */}
        {heartRateHistory.length > 0 && (
          <View style={styles.quickStats}>
            <Card style={styles.quickStatCard}>
              <Text style={styles.quickStatLabel}>Session</Text>
              <Text style={styles.quickStatValue}>
                {Math.floor(heartRateHistory.length / 60)}m{' '}
                {heartRateHistory.length % 60}s
              </Text>
            </Card>
            <Card style={styles.quickStatCard}>
              <Text style={styles.quickStatLabel}>Samples</Text>
              <Text style={styles.quickStatValue}>
                {heartRateHistory.length}
              </Text>
            </Card>
          </View>
        )}

        {/* Not connected message */}
        {!isConnected && (
          <Card variant="outlined" style={styles.disconnectedCard}>
            <Text style={styles.disconnectedText}>
              Connect to your WHOOP to start monitoring
            </Text>
            <Button
              title="Connect WHOOP"
              onPress={() => router.push('/connect')}
              variant="primary"
              style={styles.connectButton}
            />
          </Card>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hrCard: {
    marginBottom: spacing.lg,
  },
  hrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  hrLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgCardHover,
    gap: spacing.xs,
  },
  hrToggleActive: {
    backgroundColor: colors.accentDim,
  },
  hrToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textTertiary,
  },
  hrToggleDotActive: {
    backgroundColor: colors.accent,
  },
  hrToggleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  hrToggleTextActive: {
    color: colors.accent,
  },
  hrValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.lg,
  },
  hrValue: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.text,
    lineHeight: 70,
  },
  hrUnit: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  quickStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  quickStatCard: {
    flex: 1,
  },
  quickStatLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  quickStatValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  disconnectedCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  disconnectedText: {
    fontSize: fontSize.md,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  connectButton: {
    width: '100%',
  },
});
