import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

interface HeartRatePoint {
  timestamp: number;
  bpm: number;
}

interface HeartRateChartProps {
  data: HeartRatePoint[];
  height?: number;
  showLabels?: boolean;
}

export function HeartRateChart({
  data,
  height = 180,
  showLabels = true,
}: HeartRateChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2 - 40;

  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Downsample if too many points
    const maxPoints = 60;
    const step = Math.max(1, Math.floor(data.length / maxPoints));
    const sampled = data.filter((_, i) => i % step === 0);

    return sampled.map((point, index) => {
      const date = new Date(point.timestamp);
      const showLabel = index % Math.max(1, Math.floor(sampled.length / 5)) === 0;
      return {
        value: point.bpm,
        label: showLabel
          ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        labelTextStyle: {
          color: colors.textTertiary,
          fontSize: 9,
          width: 40,
        },
      };
    });
  }, [data]);

  const { minValue, maxValue, avgValue } = useMemo(() => {
    if (data.length === 0) return { minValue: 50, maxValue: 120, avgValue: 0 };
    const bpms = data.map((d) => d.bpm).filter((b) => b > 0);
    const min = Math.min(...bpms);
    const max = Math.max(...bpms);
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    return {
      minValue: Math.max(30, min - 10),
      maxValue: Math.min(220, max + 10),
      avgValue: avg,
    };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data yet</Text>
        <Text style={styles.emptySubtext}>Start heart rate monitoring to see data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showLabels && (
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>AVG</Text>
            <Text style={styles.statValue}>{avgValue}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>MIN</Text>
            <Text style={[styles.statValue, { color: colors.hrRest }]}>
              {Math.min(...data.map((d) => d.bpm).filter((b) => b > 0))}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>MAX</Text>
            <Text style={[styles.statValue, { color: colors.hrMax }]}>
              {Math.max(...data.map((d) => d.bpm))}
            </Text>
          </View>
        </View>
      )}
      <LineChart
        data={chartData}
        height={height}
        width={chartWidth}
        adjustToWidth
        color={colors.accent}
        thickness={2}
        hideDataPoints
        curved
        yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
        yAxisColor={colors.transparent}
        xAxisColor={colors.border}
        rulesColor={colors.borderSubtle}
        rulesType="dashed"
        noOfSections={4}
        maxValue={maxValue}
        yAxisOffset={minValue}
        startFillColor={colors.accent}
        endFillColor={colors.bg}
        startOpacity={0.2}
        endOpacity={0}
        areaChart
        isAnimated={false}
        pointerConfig={{
          pointerStripColor: colors.textTertiary,
          pointerStripWidth: 1,
          pointerColor: colors.accent,
          radius: 4,
          pointerLabelWidth: 80,
          pointerLabelHeight: 30,
          pointerLabelComponent: (items: any) => {
            return (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipText}>{items[0]?.value} bpm</Text>
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
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
  },
  tooltip: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tooltipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
    textAlign: 'center',
  },
});
