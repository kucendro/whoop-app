import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

interface BatteryIndicatorProps {
  level: number | null;
  isCharging: boolean;
}

export function BatteryIndicator({ level, isCharging }: BatteryIndicatorProps) {
  const displayLevel = level !== null ? Math.round(level) : null;

  const getColor = () => {
    if (level === null) return colors.textTertiary;
    if (level < 20) return colors.error;
    if (level < 50) return colors.warning;
    return colors.success;
  };

  return (
    <View style={styles.container}>
      <View style={styles.batteryOutline}>
        <View style={styles.batteryInner}>
          <View
            style={[
              styles.batteryFill,
              {
                width: `${displayLevel ?? 0}%`,
                backgroundColor: getColor(),
              },
            ]}
          />
        </View>
        <View style={styles.batteryTip} />
      </View>
      <Text style={[styles.label, { color: getColor() }]}>
        {displayLevel !== null ? `${displayLevel}%` : '--'}
        {isCharging ? '  charging' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  batteryOutline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryInner: {
    width: 28,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.textTertiary,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: 1,
  },
  batteryFill: {
    height: '100%',
    borderRadius: 1,
    minWidth: 1,
  },
  batteryTip: {
    width: 3,
    height: 6,
    backgroundColor: colors.textTertiary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    marginLeft: 1,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});
