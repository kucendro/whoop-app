/**
 * HRV utility functions ported from whoomp/scripts/hrv.py
 */

/**
 * Calculate RMSSD (Root Mean Square of Successive Differences)
 */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  const diffs = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    diffs.push(rrIntervals[i] - rrIntervals[i - 1]);
  }

  const squaredDiffs = diffs.map((d) => d * d);
  const mean = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.sqrt(mean);
}

/**
 * Calculate SDNN (Standard Deviation of NN intervals)
 */
export function calculateSDNN(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const squaredDiffs = rrIntervals.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.sqrt(variance);
}

/**
 * Calculate HRV score from RR intervals.
 * Uses the formula: HRV = (ln(RMSSD) / 6.5) * 100
 * Reference: https://help.elitehrv.com/article/54-how-do-you-calculate-the-hrv-score
 */
export function calculateHRV(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;

  const rmssd = calculateRMSSD(rrIntervals);
  if (rmssd <= 0) return 0;

  const lnRmssd = Math.log(rmssd);
  const hrv = (lnRmssd / 6.5) * 100;

  return Math.max(0, Math.min(100, hrv));
}

/**
 * Interpolate anomalous heart rate values (< 20 bpm)
 */
export function interpolateAnomalies(
  heartRates: { unix: number; heartRate: number }[]
): { unix: number; heartRate: number }[] {
  const records = [...heartRates];

  for (let i = 1; i < records.length - 1; i++) {
    if (records[i].heartRate < 20) {
      const prev = records[i - 1];
      const next = records[i + 1];

      if (prev.heartRate >= 20 && next.heartRate >= 20) {
        records[i] = {
          ...records[i],
          heartRate: Math.round((prev.heartRate + next.heartRate) / 2),
        };
      } else {
        // Find nearest valid
        let forward = i + 1;
        while (forward < records.length && records[forward].heartRate < 20)
          forward++;
        let backward = i - 1;
        while (backward >= 0 && records[backward].heartRate < 20) backward--;

        if (forward < records.length) {
          records[i] = { ...records[i], heartRate: records[forward].heartRate };
        } else if (backward >= 0) {
          records[i] = { ...records[i], heartRate: records[backward].heartRate };
        } else {
          records[i] = { ...records[i], heartRate: 60 };
        }
      }
    }
  }

  return records;
}

/**
 * Downsample records by averaging over intervals
 */
export function downsample(
  records: { unix: number; heartRate: number }[],
  intervalSeconds: number = 5
): { unix: number; heartRate: number }[] {
  if (records.length === 0) return [];

  const result: { unix: number; heartRate: number }[] = [];
  let intervalStart = records[0].unix;
  let values: number[] = [];

  for (const record of records) {
    if (record.unix < intervalStart + intervalSeconds) {
      values.push(record.heartRate);
    } else {
      if (values.length > 0) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        result.push({ unix: intervalStart, heartRate: Math.round(avg) });
      }
      values = [record.heartRate];
      intervalStart = record.unix;
    }
  }

  if (values.length > 0) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    result.push({ unix: intervalStart, heartRate: Math.round(avg) });
  }

  return result;
}
