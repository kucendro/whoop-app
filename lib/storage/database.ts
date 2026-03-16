import * as SQLite from 'expo-sqlite';
import { HistoricalRecord } from '@/lib/ble/constants';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('whoop.db');
    await db.execAsync(`
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
      CREATE INDEX IF NOT EXISTS idx_hr_unix ON heart_rate_history(unix);
    `);
  }
  return db;
}

/**
 * Save historical records to the database
 */
export async function saveHistoricalRecords(
  records: HistoricalRecord[]
): Promise<void> {
  const database = await getDb();

  await database.withTransactionAsync(async () => {
    for (const record of records) {
      const result = await database.runAsync(
        'INSERT INTO heart_rate_history (unix, heart_rate) VALUES (?, ?)',
        [record.unix, record.heartRate]
      );

      if (record.rrIntervals.length > 0) {
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
  const rows = await database.getAllAsync<{ unix: number; heart_rate: number }>(
    'SELECT unix, heart_rate FROM heart_rate_history WHERE unix >= ? AND unix <= ? ORDER BY unix ASC',
    [startUnix, endUnix]
  );
  return rows.map((row) => ({ unix: row.unix, heartRate: row.heart_rate }));
}

/**
 * Get RR intervals for a time range
 */
export async function getRRIntervals(
  startUnix: number,
  endUnix: number
): Promise<number[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ interval_ms: number }>(
    `SELECT rr.interval_ms FROM rr_intervals rr 
     JOIN heart_rate_history hr ON rr.history_id = hr.id 
     WHERE hr.unix >= ? AND hr.unix <= ? 
     ORDER BY hr.unix ASC`,
    [startUnix, endUnix]
  );
  return rows.map((row) => row.interval_ms);
}

/**
 * Get all unique dates that have data
 */
export async function getAvailableDates(): Promise<string[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ date: string }>(
    `SELECT DISTINCT date(unix, 'unixepoch', 'localtime') as date 
     FROM heart_rate_history 
     ORDER BY date DESC`
  );
  return rows.map((row) => row.date);
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
}

/**
 * Get the total record count
 */
export async function getTotalRecordCount(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM heart_rate_history'
  );
  return row?.count || 0;
}

/**
 * Clear all data
 */
export async function clearAllData(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    DELETE FROM rr_intervals;
    DELETE FROM heart_rate_history;
  `);
}
