import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '@/constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', size = 'sm', style }: BadgeProps) {
  return (
    <View style={[styles.base, sizeStyles[size], badgeVariants[variant], style]}>
      <View style={[styles.dot, dotVariants[variant]]} />
      <Text style={[styles.text, textSizes[size], textVariants[variant]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    fontWeight: fontWeight.medium,
  },
});

const sizeStyles: Record<string, ViewStyle> = {
  sm: { paddingVertical: 3, paddingHorizontal: spacing.sm },
  md: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
};

const textSizes: Record<string, { fontSize: number }> = {
  sm: { fontSize: fontSize.xs },
  md: { fontSize: fontSize.sm },
};

const badgeVariants: Record<string, ViewStyle> = {
  default: { backgroundColor: colors.bgElevated },
  success: { backgroundColor: colors.success + '18' },
  warning: { backgroundColor: colors.warning + '18' },
  error: { backgroundColor: colors.error + '18' },
  info: { backgroundColor: colors.info + '18' },
};

const dotVariants: Record<string, ViewStyle> = {
  default: { backgroundColor: colors.textSecondary },
  success: { backgroundColor: colors.success },
  warning: { backgroundColor: colors.warning },
  error: { backgroundColor: colors.error },
  info: { backgroundColor: colors.info },
};

const textVariants: Record<string, { color: string }> = {
  default: { color: colors.textSecondary },
  success: { color: colors.success },
  warning: { color: colors.warning },
  error: { color: colors.error },
  info: { color: colors.info },
};
