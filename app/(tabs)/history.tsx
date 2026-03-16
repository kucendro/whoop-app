import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDeviceStore } from '@/lib/store/device-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HistoryChart } from '@/components/charts/history-chart';
import {
  saveHistoricalRecords,
  getHeartRateRecords,
  getAvailableDates,
  getStats,
  getTotalRecordCount,
  getRRIntervals,
} from '@/lib/storage/database';
import { calculateHRV, calculateRMSSD, calculateSDNN } from '@/lib/utils/hrv';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

export default function HistoryScreen() {
  const {
    connectionState,
    historicalRecords,
    historyStatus,
    downloadHistory,
  } = useDeviceStore();

  const isConnected = connectionState === 'connected';

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ unix: number; heartRate: number }[]>([]);
  const [stats, setStats] = useState<{
    avgHR: number;
    minHR: number;
    maxHR: number;
    totalRecords: number;
  } | null>(null);
  const [hrvData, setHrvData] = useState<{
    hrv: number;
    rmssd: number;
    sdnn: number;
  } | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [saving, setSaving] = useState(false);

  // Load available dates
  const loadDates = useCallback(async () => {
    const dates = await getAvailableDates();
    setAvailableDates(dates);
    const count = await getTotalRecordCount();
    setTotalRecords(count);
    if (dates.length > 0 && !selectedDate) {
      setSelectedDate(dates[0]);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDates();
  }, [loadDates]);

  // Load data for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const loadData = async () => {
      const startOfDay = new Date(selectedDate + 'T00:00:00').getTime() / 1000;
      const endOfDay = startOfDay + 86400;

      const records = await getHeartRateRecords(startOfDay, endOfDay);
      setChartData(records);

      const dateStats = await getStats(startOfDay, endOfDay);
      setStats(dateStats);

      // Load RR intervals for HRV
      const rrIntervals = await getRRIntervals(startOfDay, endOfDay);
      if (rrIntervals.length > 10) {
        const hrv = calculateHRV(rrIntervals);
        const rmssd = calculateRMSSD(rrIntervals);
        const sdnn = calculateSDNN(rrIntervals);
        setHrvData({ hrv: Math.round(hrv), rmssd: Math.round(rmssd), sdnn: Math.round(sdnn) });
      } else {
        setHrvData(null);
      }
    };

    loadData();
  }, [selectedDate]);

  // Save new records when history download completes
  useEffect(() => {
    if (historyStatus === 'complete' && historicalRecords.length > 0) {
      const save = async () => {
        setSaving(true);
        await saveHistoricalRecords(historicalRecords);
        setSaving(false);
        await loadDates();
      };
      save();
    }
  }, [historyStatus, historicalRecords.length]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>
            {totalRecords > 0
              ? `${totalRecords.toLocaleString()} records stored`
              : 'No data stored yet'}
          </Text>
        </View>

        {/* Download Section */}
        {isConnected && (
          <Card style={styles.downloadCard}>
            <View style={styles.downloadHeader}>
              <View>
                <Text style={styles.downloadTitle}>Download from WHOOP</Text>
                <Text style={styles.downloadSubtitle}>
                  Sync historical heart rate data
                </Text>
              </View>
              {historyStatus === 'downloading' && (
                <Badge label={`${historicalRecords.length} records`} variant="info" />
              )}
            </View>

            <Button
              title={
                historyStatus === 'downloading'
                  ? `Downloading... (${historicalRecords.length})`
                  : saving
                  ? 'Saving...'
                  : 'Download History'
              }
              onPress={downloadHistory}
              variant="secondary"
              loading={historyStatus === 'downloading' || saving}
              disabled={historyStatus === 'downloading' || saving}
            />

            {historyStatus === 'complete' && (
              <Text style={styles.successText}>
                Download complete - {historicalRecords.length} records saved
              </Text>
            )}
            {historyStatus === 'error' && (
              <Text style={styles.errorText}>Download failed. Try again.</Text>
            )}
          </Card>
        )}

        {/* Date Selector */}
        {availableDates.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateScroll}
            contentContainerStyle={styles.dateScrollContent}
          >
            {availableDates.map((date) => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dateChip,
                  selectedDate === date && styles.dateChipActive,
                ]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    selectedDate === date && styles.dateChipTextActive,
                  ]}
                >
                  {formatDate(date)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Chart */}
        {selectedDate && (
          <Card style={styles.chartCard}>
            <HistoryChart data={chartData} title={`Heart Rate - ${formatDate(selectedDate)}`} />
          </Card>
        )}

        {/* Stats */}
        {stats && stats.totalRecords > 0 && (
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Avg HR</Text>
              <Text style={styles.statValue}>{stats.avgHR}</Text>
              <Text style={styles.statUnit}>bpm</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Min HR</Text>
              <Text style={[styles.statValue, { color: colors.hrRest }]}>{stats.minHR}</Text>
              <Text style={styles.statUnit}>bpm</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Max HR</Text>
              <Text style={[styles.statValue, { color: colors.hrMax }]}>{stats.maxHR}</Text>
              <Text style={styles.statUnit}>bpm</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Records</Text>
              <Text style={styles.statValue}>{stats.totalRecords.toLocaleString()}</Text>
              <Text style={styles.statUnit}>samples</Text>
            </Card>
          </View>
        )}

        {/* HRV Section */}
        {hrvData && (
          <Card style={styles.hrvCard}>
            <Text style={styles.hrvTitle}>HRV Analysis</Text>
            <View style={styles.hrvMain}>
              <Text style={styles.hrvScore}>{hrvData.hrv}</Text>
              <Text style={styles.hrvScoreLabel}>HRV Score</Text>
            </View>
            <View style={styles.hrvDetails}>
              <View style={styles.hrvDetail}>
                <Text style={styles.hrvDetailLabel}>RMSSD</Text>
                <Text style={styles.hrvDetailValue}>{hrvData.rmssd} ms</Text>
              </View>
              <View style={styles.hrvDivider} />
              <View style={styles.hrvDetail}>
                <Text style={styles.hrvDetailLabel}>SDNN</Text>
                <Text style={styles.hrvDetailValue}>{hrvData.sdnn} ms</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Empty State */}
        {availableDates.length === 0 && (
          <Card variant="outlined" style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptyText}>
              {isConnected
                ? 'Download historical data from your WHOOP to see charts and analysis'
                : 'Connect your WHOOP to download historical data'}
            </Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  downloadCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  downloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  downloadTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  downloadSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  successText: {
    fontSize: fontSize.sm,
    color: colors.success,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
  },
  dateScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  dateScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dateChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  dateChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  dateChipTextActive: {
    color: colors.accent,
  },
  chartCard: {
    marginBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  statUnit: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  hrvCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  hrvTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  hrvMain: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  hrvScore: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    lineHeight: 70,
  },
  hrvScoreLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  hrvDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  hrvDetail: {
    flex: 1,
    alignItems: 'center',
  },
  hrvDetailLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  hrvDetailValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  hrvDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
});
