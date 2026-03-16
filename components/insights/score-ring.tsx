import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fontSize, fontWeight, spacing } from '@/constants/theme';

interface ScoreRingProps {
  /** Score value 0-100 */
  score: number;
  /** Label below the score */
  label: string;
  /** Ring size in pixels */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Color of the filled portion (defaults to accent) */
  color?: string;
  /** Track color (defaults to borderSubtle) */
  trackColor?: string;
}

export function ScoreRing({
  score,
  label,
  size = 100,
  strokeWidth = 8,
  color,
  trackColor = colors.borderSubtle,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const progress = (clampedScore / 100) * circumference;
  const strokeDashoffset = circumference - progress;

  // Color based on score ranges if not explicitly provided
  const ringColor =
    color ?? (clampedScore >= 67 ? colors.success : clampedScore >= 34 ? colors.warning : colors.error);

  return (
    <View style={styles.container}>
      <View style={[styles.ringContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress arc */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        {/* Score text centered in ring */}
        <View style={styles.scoreOverlay}>
          <Text
            style={[
              styles.scoreText,
              {
                fontSize: size > 80 ? fontSize.xl : fontSize.md,
                color: ringColor,
              },
            ]}
          >
            {Math.round(clampedScore)}
          </Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontWeight: fontWeight.bold,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
});
