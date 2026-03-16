import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  radius,
} from "@/constants/theme";
import { downsample, interpolateAnomalies } from "@/lib/utils/hrv";

interface HistoryChartProps {
  data: { unix: number; heartRate: number }[];
  height?: number;
  title?: string;
}

export function HistoryChart({
  data,
  height = 200,
  title = "Heart Rate",
}: HistoryChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2 - 40;

  const { chartData, stats } = useMemo(() => {
    if (data.length === 0) {
      return { chartData: [], stats: { avg: 0, min: 0, max: 0 } };
    }

    // Interpolate anomalies and downsample
    const cleaned = interpolateAnomalies(data);
    const downsampled = downsample(cleaned, 30); // 30 second intervals

    const bpms = downsampled.map((d) => d.heartRate).filter((b) => b >= 20);

    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const min = Math.min(...bpms);
    const max = Math.max(...bpms);

    const maxPoints = 80;
    const step = Math.max(1, Math.floor(downsampled.length / maxPoints));
    const sampled = downsampled.filter((_, i) => i % step === 0);

    const points = sampled.map((point, index) => {
      const date = new Date(point.unix * 1000);
      const showLabel =
        index % Math.max(1, Math.floor(sampled.length / 6)) === 0;
      return {
        value: point.heartRate,
        label: showLabel
          ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
        labelTextStyle: {
          color: colors.textTertiary,
          fontSize: 9,
          width: 40,
        },
      };
    });

    return { chartData: points, stats: { avg, min, max } };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No historical data</Text>
        <Text style={styles.emptySubtext}>
          Download data from your WHOOP to see history
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>AVG</Text>
          <Text style={styles.statValue}>{stats.avg}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>MIN</Text>
          <Text style={[styles.statValue, { color: colors.hrRest }]}>
            {stats.min}
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>MAX</Text>
          <Text style={[styles.statValue, { color: colors.hrMax }]}>
            {stats.max}
          </Text>
        </View>
      </View>
      <LineChart
        data={chartData}
        height={height}
        width={chartWidth}
        adjustToWidth
        color={colors.accent}
        thickness={1.5}
        hideDataPoints
        curved
        yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
        yAxisColor={colors.transparent}
        xAxisColor={colors.border}
        rulesColor={colors.borderSubtle}
        rulesType="dashed"
        noOfSections={4}
        maxValue={Math.min(220, stats.max + 15)}
        yAxisOffset={Math.max(30, stats.min - 15)}
        startFillColor={colors.accent}
        endFillColor={colors.bg}
        startOpacity={0.15}
        endOpacity={0}
        areaChart
        isAnimated={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  empty: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
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
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});
