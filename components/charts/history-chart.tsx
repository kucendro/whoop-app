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
  scrollable?: boolean;
}

export function HistoryChart({
  data,
  height = 200,
  title = "Heart Rate",
  scrollable = true,
}: HistoryChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.lg * 2 - 40;

  const { chartData, stats } = useMemo(() => {
    if (data.length === 0) {
      return { chartData: [], stats: { avg: 0, min: 0, max: 0 } };
    }

    const cleaned = interpolateAnomalies(data);
    const downsampled = downsample(cleaned, 30);

    const bpms = downsampled.map((d) => d.heartRate).filter((b) => b >= 20);
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const min = Math.min(...bpms);
    const max = Math.max(...bpms);

    const maxPoints = scrollable ? 200 : 80;
    const step = Math.max(1, Math.floor(downsampled.length / maxPoints));
    const sampled = downsampled.filter((_, i) => i % step === 0);

    const points = sampled.map((point) => {
      const date = new Date(point.unix * 1000);
      return {
        value: point.heartRate,
        label: "", // No x-axis labels — shown via tooltip only
        dataPointText: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        textShiftY: -999,
        textShiftX: -999,
      };
    });

    return { chartData: points, stats: { avg, min, max } };
  }, [data, scrollable]);

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

  const pointSpacing = scrollable
    ? Math.max(4, Math.min(8, chartWidth / chartData.length))
    : undefined;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
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
        spacing={pointSpacing}
        adjustToWidth={!scrollable}
        scrollToEnd={scrollable}
        color={colors.accent}
        thickness={1.5}
        hideDataPoints
        curved
        yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
        yAxisColor={colors.transparent}
        xAxisColor={colors.transparent}
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
        pointerConfig={{
          pointerStripColor: colors.textTertiary,
          pointerStripWidth: 1,
          pointerColor: colors.accent,
          radius: 4,
          pointerLabelWidth: 100,
          pointerLabelHeight: 44,
          pointerLabelComponent: (items: any) => {
            const val = items[0]?.value ?? 0;
            const timeStr = items[0]?.dataPointText ?? "";
            return (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipValue}>{val} bpm</Text>
                {timeStr ? (
                  <Text style={styles.tooltipTime}>{timeStr}</Text>
                ) : null}
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
  tooltip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tooltipValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accent,
    textAlign: "center",
  },
  tooltipTime: {
    fontSize: 9,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 2,
  },
});
