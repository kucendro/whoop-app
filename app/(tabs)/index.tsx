import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';
import { useDeviceStore } from '@/lib/store/device-store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BatteryIndicator } from '@/components/device/battery-indicator';
import { HeartRateChart } from '@/components/charts/heart-rate-chart';
// import { AISummary } from '@/components/insights/ai-summary';
import {
  getLast24HoursHourlyStats,
  getLast24HoursHourlyRRIntervals,
  getStats,
  HourlyStats,
} from '@/lib/storage/database';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  radius,
} from '@/constants/theme';

// ─── HR color mapping (teal → coral based on BPM) ─────────────────────────────
function hrColor(bpm: number): string {
  if (bpm <= 0) return colors.textTertiary;
  if (bpm < 60) return colors.hrRest;      // teal — resting
  if (bpm < 80) return colors.hrLight;      // green — light
  if (bpm < 100) return colors.hrModerate;  // amber — moderate
  if (bpm < 140) return colors.hrHard;      // orange — hard
  return colors.hrMax;                       // coral — max
}

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

  // 24h overview data
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [hourlyRR, setHourlyRR] = useState<{ hour: number; rrIntervals: number[] }[]>([]);
  const [overviewStats, setOverviewStats] = useState<{
    avgHR: number;
    minHR: number;
    maxHR: number;
    totalRecords: number;
  } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Load 24h data when tab gets focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        setLoadingOverview(true);
        try {
          const now = Math.floor(Date.now() / 1000);
          const twentyFourHoursAgo = now - 24 * 60 * 60;

          const [stats, hourly, rr] = await Promise.all([
            getStats(twentyFourHoursAgo, now),
            getLast24HoursHourlyStats(),
            getLast24HoursHourlyRRIntervals(),
          ]);

          if (!cancelled) {
            setOverviewStats(stats);
            setHourlyStats(hourly);
            setHourlyRR(rr);
          }
        } catch (err) {
          console.error('Failed to load 24h overview:', err);
        } finally {
          if (!cancelled) setLoadingOverview(false);
        }
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // ─── Sparkline data ────────────────────────────────────────────────────────
  const screenWidth = Dimensions.get('window').width;
  const sparklineWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2;

  const sparklineData = useMemo(() => {
    const statsMap = new Map(hourlyStats.map((s) => [s.hour, s]));
    const points: { value: number; frontColor: string; label: string }[] = [];

    for (let h = 0; h < 24; h++) {
      const stats = statsMap.get(h);
      const avg = stats ? stats.avgHR : 0;
      points.push({
        value: avg,
        frontColor: hrColor(avg),
        label: '',
      });
    }
    return points;
  }, [hourlyStats]);

  const sparklineRange = useMemo(() => {
    const valid = sparklineData.map((p) => p.value).filter((v) => v > 0);
    return {
      min: valid.length ? Math.max(30, Math.min(...valid) - 10) : 40,
      max: valid.length ? Math.min(200, Math.max(...valid) + 10) : 120,
    };
  }, [sparklineData]);

  const has24hData = overviewStats !== null && overviewStats.totalRecords > 0;

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

        {/* ── Last 24 Hours: minimal sparkline ─────────────────────────────── */}
        <Card style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewLabel}>Last 24 Hours</Text>
            {loadingOverview && (
              <ActivityIndicator size="small" color={colors.accent} />
            )}
          </View>

          {!loadingOverview && has24hData && (
            <>
              {/* Average BPM — large prominent number */}
              <View style={styles.avgRow}>
                <Text style={styles.avgValue}>{overviewStats!.avgHR}</Text>
                <Text style={styles.avgUnit}>avg bpm</Text>
              </View>

              {/* Tiny sparkline — no axes, color-coded */}
              <View style={styles.sparklineWrap}>
                <LineChart
                  data={sparklineData}
                  height={50}
                  width={sparklineWidth}
                  adjustToWidth
                  color={colors.accent}
                  thickness={2}
                  hideDataPoints
                  curved
                  hideYAxisText
                  yAxisColor={colors.transparent}
                  xAxisColor={colors.transparent}
                  hideRules
                  maxValue={sparklineRange.max}
                  yAxisOffset={sparklineRange.min}
                  startFillColor={colors.accent}
                  endFillColor={colors.bg}
                  startOpacity={0.15}
                  endOpacity={0}
                  areaChart
                  isAnimated={false}
                />
              </View>
            </>
          )}

          {!loadingOverview && !has24hData && (
            <Text style={styles.overviewEmpty}>
              No data — download history from your WHOOP
            </Text>
          )}
        </Card>

        {/* ── Real-time Heart Rate ─────────────────────────────────────────── */}
        <Card style={styles.hrCard}>
          <View style={styles.hrHeader}>
            <Text style={styles.sectionTitle}>Heart Rate</Text>
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

          <HeartRateChart data={heartRateHistory} scrollable />
        </Card>

        {/* ── AI Summary (temporarily disabled) ─────────────────────────── */}
        {/* <AISummary /> */}

        {/* Not connected message */}
        {!isConnected && (
          <Button
            title="Connect WHOOP"
            onPress={() => router.push('/connect')}
            variant="primary"
            style={styles.connectButton}
          />
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

  // ── 24h Overview (minimal) ─────────────────────────────────────────────────
  overviewCard: {
    marginBottom: spacing.lg,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  overviewLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  avgValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  avgUnit: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginLeft: spacing.sm,
  },
  sparklineWrap: {
    marginHorizontal: -spacing.lg, // bleed to card edges
    overflow: 'hidden',
  },
  overviewEmpty: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    paddingVertical: spacing.md,
  },

  // ── Heart Rate Card ────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  hrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
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
  connectButton: {
    width: '100%',
  },
});
