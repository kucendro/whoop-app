import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';
import { HourlyStats } from '@/lib/storage/database';
import { calculateHRV } from '@/lib/utils/hrv';

interface OverviewChartProps {
  hourlyStats: HourlyStats[];
  hourlyRR: { hour: number; rrIntervals: number[] }[];
  height?: number;
}

const HOUR_LABELS = [
  '12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a',
  '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p',
];

export function OverviewChart({
  hourlyStats,
  hourlyRR,
  height = 180,
}: OverviewChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2 - 40;

  const { hrData, hrvData, hrRange, hrvRange, hasHRV } = useMemo(() => {
    // Build lookup maps
    const statsMap = new Map(hourlyStats.map((s) => [s.hour, s]));
    const rrMap = new Map(hourlyRR.map((r) => [r.hour, r.rrIntervals]));

    // Generate data for all 24 hours
    const hrPoints: { value: number; label: string; dataPointText: string; textShiftY: number; textShiftX: number }[] = [];
    const hrvPoints: { value: number }[] = [];
    let hasAnyHRV = false;

    for (let h = 0; h < 24; h++) {
      const stats = statsMap.get(h);
      const rr = rrMap.get(h);
      const hrv = rr && rr.length >= 2 ? calculateHRV(rr) : 0;
      if (hrv > 0) hasAnyHRV = true;

      hrPoints.push({
        value: stats ? stats.avgHR : 0,
        label: '', // No x-axis labels — shown via tooltip only
        dataPointText: HOUR_LABELS[h],
        textShiftY: -999,
        textShiftX: -999,
      });
      hrvPoints.push({ value: hrv });
    }

    // Calculate ranges
    const validHR = hrPoints.map((p) => p.value).filter((v) => v > 0);
    const validHRV = hrvPoints.map((p) => p.value).filter((v) => v > 0);

    return {
      hrData: hrPoints,
      hrvData: hrvPoints,
      hrRange: {
        min: validHR.length ? Math.max(30, Math.min(...validHR) - 10) : 40,
        max: validHR.length ? Math.min(200, Math.max(...validHR) + 10) : 120,
      },
      hrvRange: {
        min: 0,
        max: validHRV.length ? Math.min(100, Math.max(...validHRV) + 10) : 100,
      },
      hasHRV: hasAnyHRV,
    };
  }, [hourlyStats, hourlyRR]);

  if (hourlyStats.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data for last 24 hours</Text>
        <Text style={styles.emptySubtext}>
          Download historical data from your WHOOP
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Heart Rate</Text>
        </View>
        {hasHRV && (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.info }]} />
            <Text style={styles.legendText}>HRV Score</Text>
          </View>
        )}
      </View>

      <LineChart
        data={hrData}
        height={height}
        width={chartWidth}
        adjustToWidth
        color={colors.accent}
        thickness={2}
        hideDataPoints
        curved
        yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
        yAxisColor={colors.transparent}
        xAxisColor={colors.transparent}
        rulesColor={colors.borderSubtle}
        rulesType="dashed"
        noOfSections={4}
        maxValue={hrRange.max}
        yAxisOffset={hrRange.min}
        startFillColor={colors.accent}
        endFillColor={colors.bg}
        startOpacity={0.1}
        endOpacity={0}
        areaChart
        isAnimated={false}
        // Secondary data: HRV line (different Y axis scale)
        secondaryData={hasHRV ? hrvData : undefined}
        secondaryLineConfig={
          hasHRV
            ? {
                color: colors.info,
                thickness: 1.5,
                curved: true,
                hideDataPoints: true,
              }
            : undefined
        }
        secondaryYAxis={
          hasHRV
            ? {
                maxValue: hrvRange.max,
                yAxisOffset: hrvRange.min,
                noOfSections: 4,
                yAxisColor: colors.transparent,
                yAxisTextStyle: { color: colors.info, fontSize: 10 },
              }
            : undefined
        }
        pointerConfig={{
          pointerStripColor: colors.textTertiary,
          pointerStripWidth: 1,
          pointerColor: colors.accent,
          radius: 4,
          pointerLabelWidth: 110,
          pointerLabelHeight: hasHRV ? 58 : 44,
          pointerLabelComponent: (items: any) => {
            const hrVal = items[0]?.value ?? 0;
            const hrvVal = items[1]?.value ?? 0;
            const timeStr = items[0]?.dataPointText ?? '';
            return (
              <View style={styles.tooltip}>
                {timeStr ? (
                  <Text style={styles.tooltipTime}>{timeStr}</Text>
                ) : null}
                {hrVal > 0 && (
                  <Text style={styles.tooltipHR}>{hrVal} bpm</Text>
                )}
                {hasHRV && hrvVal > 0 && (
                  <Text style={styles.tooltipHRV}>HRV {hrvVal.toFixed(0)}</Text>
                )}
                {hrVal === 0 && (!hasHRV || hrvVal === 0) && (
                  <Text style={styles.tooltipEmpty}>No data</Text>
                )}
              </View>
            );
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  tooltip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tooltipTime: {
    fontSize: 9,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: 2,
  },
  tooltipHR: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
    textAlign: 'center',
  },
  tooltipHRV: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.info,
    textAlign: 'center',
    marginTop: 2,
  },
  tooltipEmpty: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
