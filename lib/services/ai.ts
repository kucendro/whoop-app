/**
 * AI Service for health insights using HuggingFace Inference API.
 *
 * Architecture: This module abstracts the AI provider behind a simple interface.
 * Currently uses HuggingFace's serverless Inference API with Meditron (medical LLM).
 * Can be replaced with a dedicated backend by swapping the `callModel` implementation.
 */

import { getSetting, setSetting, deleteSetting } from '@/lib/storage/database';
import { PeriodStats } from '@/lib/storage/database';
import { calculateRMSSD, calculateHRV } from '@/lib/utils/hrv';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthInsight {
  sleepIndex: number; // 0-100
  stressScore: number; // 0-100
  summary: string; // 2-3 sentence plain text summary
}

export interface HealthDataPayload {
  last24h: {
    avgHR: number;
    minHR: number;
    maxHR: number;
    hrv: number;
    totalRecords: number;
  };
  sleep: {
    avgHR: number;
    minHR: number;
    maxHR: number;
    hrv: number;
    totalRecords: number;
  };
  day: {
    avgHR: number;
    minHR: number;
    maxHR: number;
    hrv: number;
    totalRecords: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'hf_api_key';

/**
 * Models available on HuggingFace's serverless Inference API.
 * Ordered by preference: medical/instruction-tuned first, general-purpose fallback.
 * Note: Only models hosted on HF's free inference tier work here.
 */
const MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.2',
  'HuggingFaceH4/zephyr-7b-beta',
  'google/gemma-2-2b-it',
] as const;

const HF_INFERENCE_URL = 'https://router.huggingface.co/hf-inference/models';

// ─── API Key Management ───────────────────────────────────────────────────────

export async function getApiKey(): Promise<string | null> {
  return getSetting(SETTINGS_KEY);
}

export async function setApiKey(key: string): Promise<void> {
  await setSetting(SETTINGS_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await deleteSetting(SETTINGS_KEY);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

// ─── Prompt Engineering ───────────────────────────────────────────────────────

function buildPrompt(data: HealthDataPayload): string {
  return `You are a medical health analysis AI. Analyze the following heart rate and HRV data from a wearable fitness device and provide a structured health assessment.

DATA:
Last 24 Hours Overview:
- Average HR: ${data.last24h.avgHR} bpm
- Min HR: ${data.last24h.minHR} bpm
- Max HR: ${data.last24h.maxHR} bpm
- HRV (RMSSD-based score): ${data.last24h.hrv.toFixed(1)}
- Total samples: ${data.last24h.totalRecords}

Sleep Period (22:00-07:00):
- Average HR: ${data.sleep.avgHR} bpm
- Min HR: ${data.sleep.minHR} bpm
- Max HR: ${data.sleep.maxHR} bpm
- HRV (RMSSD-based score): ${data.sleep.hrv.toFixed(1)}
- Total samples: ${data.sleep.totalRecords}

Day Period (07:00-22:00):
- Average HR: ${data.day.avgHR} bpm
- Min HR: ${data.day.minHR} bpm
- Max HR: ${data.day.maxHR} bpm
- HRV (RMSSD-based score): ${data.day.hrv.toFixed(1)}
- Total samples: ${data.day.totalRecords}

INSTRUCTIONS:
Based on this data, provide your analysis in the following JSON format ONLY. Do not include any text outside the JSON object.

Key medical guidelines for scoring:
- Sleep Index (0-100): Higher is better. Consider: low resting HR during sleep (good), high HRV during sleep (good), HR dropping significantly from day to sleep (good), min HR during sleep below 60 (good).
- Stress Score (0-100): Higher means MORE stressed. Consider: elevated resting HR, low HRV, small difference between sleep and day HR (indicates poor recovery), high minimum HR.

Respond with ONLY this JSON:
{"sleepIndex": <number 0-100>, "stressScore": <number 0-100>, "summary": "<2-3 sentences analyzing the data>"}`;
}

// ─── Model Interaction ────────────────────────────────────────────────────────

/**
 * Call the HuggingFace Inference API with the given prompt.
 * Tries Meditron first, falls back to Mistral if unavailable.
 */
async function callModel(
  prompt: string,
  apiKey: string
): Promise<string> {
  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const response = await fetch(`${HF_INFERENCE_URL}/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 300,
            temperature: 0.3,
            top_p: 0.9,
            return_full_text: false,
            do_sample: true,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        // Model might be loading, unavailable, or not inference-capable - try next
        if (response.status === 503 || response.status === 404 || response.status === 422) {
          lastError = new Error(
            `Model ${model} unavailable (${response.status}): ${errorBody}`
          );
          continue;
        }
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your HuggingFace token.');
        }
        throw new Error(`API error (${response.status}): ${errorBody}`);
      }

      const result = await response.json();

      // HF Inference API returns array of generated text objects
      if (Array.isArray(result) && result.length > 0) {
        return result[0].generated_text ?? '';
      }

      throw new Error('Unexpected response format from model');
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Invalid API key')
      ) {
        throw error; // Don't retry auth errors
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('All models failed');
}

// ─── Response Parsing ─────────────────────────────────────────────────────────

/**
 * Extract and validate JSON from the model's response.
 * The model may include extra text around the JSON.
 */
function parseInsightResponse(raw: string): HealthInsight {
  // Try to find JSON in the response
  const jsonMatch = raw.match(/\{[\s\S]*?"sleepIndex"[\s\S]*?"stressScore"[\s\S]*?"summary"[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error('Could not find valid JSON in model response');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    const sleepIndex = Number(parsed.sleepIndex);
    const stressScore = Number(parsed.stressScore);
    const summary = String(parsed.summary || '');

    if (isNaN(sleepIndex) || isNaN(stressScore) || !summary) {
      throw new Error('Missing or invalid fields in response');
    }

    return {
      sleepIndex: Math.max(0, Math.min(100, Math.round(sleepIndex))),
      stressScore: Math.max(0, Math.min(100, Math.round(stressScore))),
      summary: summary.slice(0, 500), // Safety cap
    };
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('Model returned invalid JSON');
    }
    throw e;
  }
}

// ─── Fallback (Heuristic) Analysis ───────────────────────────────────────────

/**
 * Generate a heuristic-based insight when the AI model is unavailable.
 * Uses simple rules based on HR and HRV ranges.
 */
export function generateHeuristicInsight(data: HealthDataPayload): HealthInsight {
  let sleepIndex = 50;
  let stressScore = 50;

  // Sleep index factors
  if (data.sleep.totalRecords > 0) {
    // Lower sleep HR is better
    if (data.sleep.avgHR < 55) sleepIndex += 15;
    else if (data.sleep.avgHR < 65) sleepIndex += 5;
    else if (data.sleep.avgHR > 75) sleepIndex -= 15;

    // Higher HRV during sleep is better
    if (data.sleep.hrv > 70) sleepIndex += 15;
    else if (data.sleep.hrv > 50) sleepIndex += 5;
    else if (data.sleep.hrv < 30) sleepIndex -= 10;

    // Good HR drop from day to sleep
    const hrDrop = data.day.avgHR - data.sleep.avgHR;
    if (hrDrop > 15) sleepIndex += 10;
    else if (hrDrop < 5) sleepIndex -= 10;
  } else {
    sleepIndex = 0; // No sleep data
  }

  // Stress score factors
  if (data.last24h.totalRecords > 0) {
    // Higher resting HR = more stress
    if (data.last24h.avgHR > 80) stressScore += 15;
    else if (data.last24h.avgHR < 65) stressScore -= 15;

    // Lower HRV = more stress
    if (data.last24h.hrv < 30) stressScore += 15;
    else if (data.last24h.hrv > 60) stressScore -= 15;

    // Small day/sleep HR difference = poor recovery = stress
    if (data.sleep.totalRecords > 0) {
      const hrDrop = data.day.avgHR - data.sleep.avgHR;
      if (hrDrop < 5) stressScore += 10;
      else if (hrDrop > 15) stressScore -= 10;
    }
  }

  sleepIndex = Math.max(0, Math.min(100, Math.round(sleepIndex)));
  stressScore = Math.max(0, Math.min(100, Math.round(stressScore)));

  // Build summary
  const parts: string[] = [];
  if (data.last24h.totalRecords > 0) {
    parts.push(
      `Your average heart rate over the last 24 hours was ${data.last24h.avgHR} bpm with an HRV score of ${data.last24h.hrv.toFixed(0)}.`
    );
  }
  if (data.sleep.totalRecords > 0) {
    const quality =
      sleepIndex >= 67 ? 'good' : sleepIndex >= 34 ? 'moderate' : 'poor';
    parts.push(
      `Sleep quality appears ${quality} with an average sleeping HR of ${data.sleep.avgHR} bpm.`
    );
  }
  const stressLevel =
    stressScore >= 67 ? 'elevated' : stressScore >= 34 ? 'moderate' : 'low';
  parts.push(`Overall stress level appears ${stressLevel}.`);

  return {
    sleepIndex,
    stressScore,
    summary: parts.join(' '),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prepare the health data payload from database stats.
 */
export function buildPayload(
  last24hStats: { avgHR: number; minHR: number; maxHR: number; totalRecords: number },
  last24hRR: number[],
  sleepStats: PeriodStats,
  dayStats: PeriodStats
): HealthDataPayload {
  return {
    last24h: {
      avgHR: last24hStats.avgHR,
      minHR: last24hStats.minHR,
      maxHR: last24hStats.maxHR,
      hrv: calculateHRV(last24hRR),
      totalRecords: last24hStats.totalRecords,
    },
    sleep: {
      avgHR: sleepStats.avgHR,
      minHR: sleepStats.minHR,
      maxHR: sleepStats.maxHR,
      hrv: calculateHRV(sleepStats.rrIntervals),
      totalRecords: sleepStats.totalRecords,
    },
    day: {
      avgHR: dayStats.avgHR,
      minHR: dayStats.minHR,
      maxHR: dayStats.maxHR,
      hrv: calculateHRV(dayStats.rrIntervals),
      totalRecords: dayStats.totalRecords,
    },
  };
}

/**
 * Analyze health data using AI.
 * Calls the HuggingFace Inference API with Meditron, with fallback to heuristic analysis.
 *
 * @throws Error if API key is missing and no fallback
 */
export async function analyzeHealth(
  data: HealthDataPayload,
  options?: { useFallback?: boolean }
): Promise<HealthInsight> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    if (options?.useFallback !== false) {
      return generateHeuristicInsight(data);
    }
    throw new Error('API key not configured. Go to settings to add your HuggingFace token.');
  }

  try {
    const prompt = buildPrompt(data);
    const raw = await callModel(prompt, apiKey);
    return parseInsightResponse(raw);
  } catch (error) {
    // If AI fails and fallback is allowed, use heuristic
    if (options?.useFallback !== false) {
      console.warn('AI analysis failed, using heuristic fallback:', error);
      return generateHeuristicInsight(data);
    }
    throw error;
  }
}
