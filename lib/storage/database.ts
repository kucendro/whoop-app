import * as SQLite from 'expo-sqlite';
import { HistoricalRecord } from '@/lib/ble/constants';

let db: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initDb(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync('whoop.db');
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS heart_rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unix INTEGER NOT NULL,
      heart_rate INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS rr_intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      history_id INTEGER NOT NULL,
      interval_ms INTEGER NOT NULL,
      FOREIGN KEY (history_id) REFERENCES heart_rate_history(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hr_unix ON heart_rate_history(unix);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_unix_unique ON heart_rate_history(unix, heart_rate);
  `);
  db = database;
  return database;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  // All concurrent callers share the same initialization promise
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((err) => {
      // Reset so next call retries instead of returning the rejected promise forever
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

// ─── Query Serialization ──────────────────────────────────────────────────────
// expo-sqlite on Android cannot handle concurrent prepareAsync calls on the same
// native database handle — the native layer mixes up arguments between statements,
// producing "Cannot use shared object that was already released" crashes.
// This queue ensures only one statement is prepared/executed at a time.

let _queryQueue: Promise<void> = Promise.resolve();

async function serializedQuery<T>(fn: () => Promise<T>): Promise<T> {
  const prev = _queryQueue;
  let release!: () => void;
  _queryQueue = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

// ─── Transaction Serialization ────────────────────────────────────────────────
// expo-sqlite v16's withTransactionAsync is not safe with concurrent callers —
// a second BEGIN TRANSACTION fires while the first is still open.
// Transactions go through the query queue so they hold the lock for their
// entire duration (BEGIN → statements → COMMIT/ROLLBACK).

async function withTransaction<T>(
  database: SQLite.SQLiteDatabase,
  fn: () => Promise<T>
): Promise<T> {
  const prev = _queryQueue;
  let release!: () => void;
  _queryQueue = new Promise<void>((r) => {
    release = r;
  });
  await prev;

  try {
    await database.execAsync('BEGIN TRANSACTION');
    try {
      const result = await fn();
      await database.execAsync('COMMIT');
      return result;
    } catch (err) {
      try {
        await database.execAsync('ROLLBACK');
      } catch {
        // Rollback may fail if BEGIN never succeeded — safe to ignore
      }
      throw err;
    }
  } finally {
    release();
  }
}

/**
 * Save historical records to the database in a single serialized transaction.
 */
export async function saveHistoricalRecords(
  records: HistoricalRecord[]
): Promise<void> {
  const database = await getDb();

  await withTransaction(database, async () => {
    for (const record of records) {
      const result = await database.runAsync(
        'INSERT OR IGNORE INTO heart_rate_history (unix, heart_rate) VALUES (?, ?)',
        [record.unix, record.heartRate]
      );

      // Only insert RR intervals if the HR record was actually inserted (not a duplicate)
      if (result.changes > 0 && record.rrIntervals.length > 0) {
        for (const rr of record.rrIntervals) {
          await database.runAsync(
            'INSERT INTO rr_intervals (history_id, interval_ms) VALUES (?, ?)',
            [result.lastInsertRowId, rr]
          );
        }
      }
    }
  });
}

/**
 * Get heart rate records for a time range
 */
export async function getHeartRateRecords(
  startUnix: number,
  endUnix: number
): Promise<{ unix: number; heartRate: number }[]> {
  const database = await getDb();
  return serializedQuery(async () => {
    const rows = await database.getAllAsync<{ unix: number; heart_rate: number }>(
      'SELECT unix, heart_rate FROM heart_rate_history WHERE unix >= ? AND unix <= ? ORDER BY unix ASC',
      [startUnix, endUnix]
    );
    return rows.map((row) => ({ unix: row.unix, heartRate: row.heart_rate }));
  });
}

/**
 * Get RR intervals for a time range
 */
export async function getRRIntervals(
  startUnix: number,
  endUnix: number
): Promise<number[]> {
  const database = await getDb();
  return serializedQuery(async () => {
    const rows = await database.getAllAsync<{ interval_ms: number }>(
      `SELECT rr.interval_ms FROM rr_intervals rr 
       JOIN heart_rate_history hr ON rr.history_id = hr.id 
       WHERE hr.unix >= ? AND hr.unix <= ? 
       ORDER BY hr.unix ASC`,
      [startUnix, endUnix]
    );
    return rows.map((row) => row.interval_ms);
  });
}

/**
 * Get all unique dates that have data
 */
export async function getAvailableDates(): Promise<string[]> {
  const database = await getDb();
  return serializedQuery(async () => {
    const rows = await database.getAllAsync<{ date: string }>(
      `SELECT DISTINCT date(unix, 'unixepoch', 'localtime') as date 
       FROM heart_rate_history 
       ORDER BY date DESC`
    );
    return rows.map((row) => row.date);
  });
}

/**
 * Get summary stats for a date range
 */
export async function getStats(
  startUnix: number,
  endUnix: number
): Promise<{
  avgHR: number;
  minHR: number;
  maxHR: number;
  totalRecords: number;
}> {
  const database = await getDb();
  return serializedQuery(async () => {
    const row = await database.getFirstAsync<{
      avg_hr: number;
      min_hr: number;
      max_hr: number;
      total: number;
    }>(
      `SELECT AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr, 
       MAX(heart_rate) as max_hr, COUNT(*) as total 
       FROM heart_rate_history 
       WHERE unix >= ? AND unix <= ? AND heart_rate >= 20`,
      [startUnix, endUnix]
    );

    return {
      avgHR: Math.round(row?.avg_hr || 0),
      minHR: row?.min_hr || 0,
      maxHR: row?.max_hr || 0,
      totalRecords: row?.total || 0,
    };
  });
}

/**
 * Get the total record count
 */
export async function getTotalRecordCount(): Promise<number> {
  const database = await getDb();
  return serializedQuery(async () => {
    const row = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM heart_rate_history'
    );
    return row?.count || 0;
  });
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  const database = await getDb();
  return serializedQuery(async () => {
    await database.execAsync(`
      DELETE FROM rr_intervals;
      DELETE FROM heart_rate_history;
    `);
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * Get a setting value by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  return serializedQuery(async () => {
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  });
}

/**
 * Set a setting value (upsert)
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  return serializedQuery(async () => {
    await database.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  });
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string): Promise<void> {
  const database = await getDb();
  return serializedQuery(async () => {
    await database.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  });
}

// ─── Last 24 Hours Queries ────────────────────────────────────────────────────

export interface HourlyStats {
  hour: number; // 0-23
  avgHR: number;
  minHR: number;
  maxHR: number;
  recordCount: number;
}

export interface PeriodStats {
  avgHR: number;
  minHR: number;
  maxHR: number;
  totalRecords: number;
  rrIntervals: number[];
}

/**
 * Get hourly heart rate stats for the last 24 hours.
 * Returns up to 24 entries, one per hour that has data.
 */
export async function getLast24HoursHourlyStats(): Promise<HourlyStats[]> {
  const database = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 60 * 60;

  return serializedQuery(async () => {
    const rows = await database.getAllAsync<{
      hour: number;
      avg_hr: number;
      min_hr: number;
      max_hr: number;
      cnt: number;
    }>(
      `SELECT 
         CAST(strftime('%H', unix, 'unixepoch', 'localtime') AS INTEGER) as hour,
         AVG(heart_rate) as avg_hr,
         MIN(heart_rate) as min_hr,
         MAX(heart_rate) as max_hr,
         COUNT(*) as cnt
       FROM heart_rate_history 
       WHERE unix >= ? AND unix <= ? AND heart_rate >= 20
       GROUP BY hour
       ORDER BY hour ASC`,
      [twentyFourHoursAgo, now]
    );

    return rows.map((row) => ({
      hour: row.hour,
      avgHR: Math.round(row.avg_hr),
      minHR: row.min_hr,
      maxHR: row.max_hr,
      recordCount: row.cnt,
    }));
  });
}

/**
 * Get heart rate records for the last 24 hours (for charting).
 */
export async function getLast24HoursRecords(): Promise<
  { unix: number; heartRate: number }[]
> {
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 60 * 60;
  return getHeartRateRecords(twentyFourHoursAgo, now);
}

/**
 * Get RR intervals for the last 24 hours (for HRV calculation).
 */
export async function getLast24HoursRRIntervals(): Promise<number[]> {
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 60 * 60;
  return getRRIntervals(twentyFourHoursAgo, now);
}

/**
 * Get stats for a typical sleep period (22:00 previous day to 07:00 today).
 * If it's before 07:00, uses last night. If after, uses the most recent completed night.
 */
export async function getSleepPeriodStats(): Promise<PeriodStats> {
  const database = await getDb();
  const now = new Date();
  const currentHour = now.getHours();

  // Determine sleep window
  let sleepStart: Date;
  let sleepEnd: Date;

  if (currentHour < 7) {
    // Before 7am: sleep period is yesterday 22:00 to now
    sleepStart = new Date(now);
    sleepStart.setDate(sleepStart.getDate() - 1);
    sleepStart.setHours(22, 0, 0, 0);
    sleepEnd = now;
  } else {
    // After 7am: sleep period is yesterday 22:00 to today 07:00
    sleepStart = new Date(now);
    sleepStart.setDate(sleepStart.getDate() - 1);
    sleepStart.setHours(22, 0, 0, 0);
    sleepEnd = new Date(now);
    sleepEnd.setHours(7, 0, 0, 0);
  }

  const startUnix = Math.floor(sleepStart.getTime() / 1000);
  const endUnix = Math.floor(sleepEnd.getTime() / 1000);

  const statsRow = await serializedQuery(() =>
    database.getFirstAsync<{
      avg_hr: number;
      min_hr: number;
      max_hr: number;
      total: number;
    }>(
      `SELECT AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr,
       MAX(heart_rate) as max_hr, COUNT(*) as total
       FROM heart_rate_history
       WHERE unix >= ? AND unix <= ? AND heart_rate >= 20`,
      [startUnix, endUnix]
    )
  );

  const rrIntervals = await getRRIntervals(startUnix, endUnix);

  return {
    avgHR: Math.round(statsRow?.avg_hr || 0),
    minHR: statsRow?.min_hr || 0,
    maxHR: statsRow?.max_hr || 0,
    totalRecords: statsRow?.total || 0,
    rrIntervals,
  };
}

/**
 * Get stats for the day period (07:00 to 22:00 today, or 07:00 to now if before 22:00).
 */
export async function getDayPeriodStats(): Promise<PeriodStats> {
  const database = await getDb();
  const now = new Date();
  const currentHour = now.getHours();

  let dayStart: Date;
  let dayEnd: Date;

  if (currentHour < 7) {
    // Before 7am: use yesterday's day period
    dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - 1);
    dayStart.setHours(7, 0, 0, 0);
    dayEnd = new Date(now);
    dayEnd.setDate(dayEnd.getDate() - 1);
    dayEnd.setHours(22, 0, 0, 0);
  } else if (currentHour < 22) {
    // During the day: 7am to now
    dayStart = new Date(now);
    dayStart.setHours(7, 0, 0, 0);
    dayEnd = now;
  } else {
    // After 10pm: full day period
    dayStart = new Date(now);
    dayStart.setHours(7, 0, 0, 0);
    dayEnd = new Date(now);
    dayEnd.setHours(22, 0, 0, 0);
  }

  const startUnix = Math.floor(dayStart.getTime() / 1000);
  const endUnix = Math.floor(dayEnd.getTime() / 1000);

  const statsRow = await serializedQuery(() =>
    database.getFirstAsync<{
      avg_hr: number;
      min_hr: number;
      max_hr: number;
      total: number;
    }>(
      `SELECT AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr,
       MAX(heart_rate) as max_hr, COUNT(*) as total
       FROM heart_rate_history
       WHERE unix >= ? AND unix <= ? AND heart_rate >= 20`,
      [startUnix, endUnix]
    )
  );

  const rrIntervals = await getRRIntervals(startUnix, endUnix);

  return {
    avgHR: Math.round(statsRow?.avg_hr || 0),
    minHR: statsRow?.min_hr || 0,
    maxHR: statsRow?.max_hr || 0,
    totalRecords: statsRow?.total || 0,
    rrIntervals,
  };
}

/**
 * Get hourly HRV values for the last 24 hours.
 * Calculates RMSSD from RR intervals grouped by hour.
 */
export async function getLast24HoursHourlyRRIntervals(): Promise<
  { hour: number; rrIntervals: number[] }[]
> {
  const database = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 60 * 60;

  return serializedQuery(async () => {
    const rows = await database.getAllAsync<{
      hour: number;
      interval_ms: number;
    }>(
      `SELECT 
         CAST(strftime('%H', hr.unix, 'unixepoch', 'localtime') AS INTEGER) as hour,
         rr.interval_ms
       FROM rr_intervals rr
       JOIN heart_rate_history hr ON rr.history_id = hr.id
       WHERE hr.unix >= ? AND hr.unix <= ?
       ORDER BY hour ASC, hr.unix ASC`,
      [twentyFourHoursAgo, now]
    );

    // Group by hour
    const grouped = new Map<number, number[]>();
    for (const row of rows) {
      const existing = grouped.get(row.hour) || [];
      existing.push(row.interval_ms);
      grouped.set(row.hour, existing);
    }

    return Array.from(grouped.entries())
      .map(([hour, rrIntervals]) => ({ hour, rrIntervals }))
      .sort((a, b) => a.hour - b.hour);
  });
}
