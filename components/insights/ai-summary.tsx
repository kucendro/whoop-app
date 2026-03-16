import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/insights/score-ring';
import {
  analyzeHealth,
  buildPayload,
  hasApiKey,
  HealthInsight,
} from '@/lib/services/ai';
import {
  getLast24HoursRRIntervals,
  getSleepPeriodStats,
  getDayPeriodStats,
  getStats,
} from '@/lib/storage/database';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

type AnalysisState = 'idle' | 'loading' | 'done' | 'error';

export function AISummary() {
  const [state, setState] = useState<AnalysisState>('idle');
  const [insight, setInsight] = useState<HealthInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  // Check if API key exists on mount
  useEffect(() => {
    hasApiKey().then(setKeyConfigured);
  }, []);

  const runAnalysis = useCallback(async () => {
    setState('loading');
    setError(null);
    setIsFallback(false);

    try {
      // Gather data from database
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHoursAgo = now - 24 * 60 * 60;

      const [last24hStats, last24hRR, sleepStats, dayStats] = await Promise.all([
        getStats(twentyFourHoursAgo, now),
        getLast24HoursRRIntervals(),
        getSleepPeriodStats(),
        getDayPeriodStats(),
      ]);

      if (last24hStats.totalRecords === 0) {
        setError('No heart rate data available for the last 24 hours. Download data from your WHOOP first.');
        setState('error');
        return;
      }

      const payload = buildPayload(last24hStats, last24hRR, sleepStats, dayStats);

      // Check for API key
      const hasKey = await hasApiKey();
      if (!hasKey) {
        setIsFallback(true);
      }

      const result = await analyzeHealth(payload, { useFallback: true });
      setInsight(result);
      setState('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setState('error');
    }
  }, []);

  // Idle state: show analyze button
  if (state === 'idle') {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>AI Health Insights</Text>
        <Text style={styles.subtitle}>
          Analyze your last 24 hours of heart rate and HRV data
        </Text>
        <Button
          title="Analyze"
          onPress={runAnalysis}
          variant="primary"
          style={styles.analyzeButton}
        />
        {!keyConfigured && (
          <Text style={styles.keyHint}>
            Add a HuggingFace API key in Device settings for AI-powered analysis
          </Text>
        )}
      </Card>
    );
  }

  // Loading state
  if (state === 'loading') {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>AI Health Insights</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        </View>
      </Card>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>AI Health Insights</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Try Again"
          onPress={runAnalysis}
          variant="secondary"
          style={styles.analyzeButton}
        />
      </Card>
    );
  }

  // Done state: show results
  if (state === 'done' && insight) {
    return (
      <Card style={styles.card}>
        <View style={styles.resultHeader}>
          <Text style={styles.title}>AI Health Insights</Text>
          {isFallback && (
            <Text style={styles.fallbackBadge}>HEURISTIC</Text>
          )}
        </View>

        <View style={styles.scoresRow}>
          <ScoreRing
            score={insight.sleepIndex}
            label="Sleep"
            size={90}
            strokeWidth={7}
          />
          <ScoreRing
            score={100 - insight.stressScore}
            label="Recovery"
            size={90}
            strokeWidth={7}
          />
          <ScoreRing
            score={insight.stressScore}
            label="Stress"
            size={90}
            strokeWidth={7}
            color={
              insight.stressScore >= 67
                ? colors.error
                : insight.stressScore >= 34
                  ? colors.warning
                  : colors.success
            }
          />
        </View>

        <Text style={styles.summaryText}>{insight.summary}</Text>

        <Button
          title="Re-analyze"
          onPress={() => {
            setState('idle');
            setInsight(null);
          }}
          variant="ghost"
          size="sm"
          style={styles.reanalyzeButton}
        />
      </Card>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  analyzeButton: {
    marginTop: spacing.sm,
  },
  keyHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginBottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  fallbackBadge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
    letterSpacing: 1,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  summaryText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  reanalyzeButton: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
});
