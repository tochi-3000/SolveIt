/**
 * Turso (libSQL) Database Client for SolvAm
 * Production Safeguards:
 * - Edge-ready: Uses @libsql/client
 * - Graceful Fallback: Defaults to local SQLite file:local.db when TURSO_DATABASE_URL is not provided
 * - Auto-migration on first call (idempotent CREATE TABLE IF NOT EXISTS)
 */

import { createClient, Client } from '@libsql/client';

let dbInstance: Client | null = null;
let isInitialized = false;
let isUsingLocalFallback = false;

export function getDb(): Client {
  if (dbInstance) return dbInstance;

  if (isUsingLocalFallback) {
    dbInstance = createClient({ url: 'file:local.db' });
    return dbInstance;
  }

  const url = process.env.TURSO_DATABASE_URL?.trim() || 'file:local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

  dbInstance = createClient({
    url,
    authToken,
  });

  return dbInstance;
}

async function runSchemaMigrations(client: Client): Promise<void> {
  // 1. Users table (Clerk user ID or anonymous guest ID)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      is_guest INTEGER DEFAULT 1,
      credits INTEGER DEFAULT 50,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Camera pairing sessions table (desktop <-> mobile QR sync)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS camera_sessions (
      id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'pending',
      image_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );
  `);

  // 3. Scan & diagnosis history
  await client.execute(`
    CREATE TABLE IF NOT EXISTS scan_history (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      raw_equation TEXT,
      latex_equation TEXT,
      topic TEXT,
      waec_marks_earned INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

export async function initDb(): Promise<void> {
  if (isInitialized) return;
  const db = getDb();

  try {
    await runSchemaMigrations(db);
    isInitialized = true;
    console.log(
      `[DB] ${isUsingLocalFallback ? 'Local SQLite (offline fallback)' : 'Turso / libSQL'} tables verified and ready.`
    );
  } catch (err) {
    console.warn(
      '[DB] Remote Turso connection failed or offline. Failing over to local SQLite (file:local.db):',
      err instanceof Error ? err.message : err
    );
    isUsingLocalFallback = true;
    dbInstance = createClient({ url: 'file:local.db' });
    await runSchemaMigrations(dbInstance);
    isInitialized = true;
    console.log('[DB] Local SQLite (file:local.db) failover ready.');
  }
}

// ---------------------------------------------------------------------------
// Camera Session Helpers (For Desktop-to-Mobile Realtime QR Sync)
// ---------------------------------------------------------------------------

export interface CameraSessionRecord {
  id: string;
  status: 'pending' | 'connected' | 'completed' | 'expired';
  image_data?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export async function createCameraSession(sessionId: string): Promise<CameraSessionRecord> {
  await initDb();
  const db = getDb();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  await db.execute({
    sql: `INSERT INTO camera_sessions (id, status, expires_at) VALUES (?, 'pending', ?)`,
    args: [sessionId, expiresAt],
  });

  return {
    id: sessionId,
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };
}

export async function getCameraSession(sessionId: string): Promise<CameraSessionRecord | null> {
  await initDb();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT id, status, image_data, created_at, expires_at FROM camera_sessions WHERE id = ?`,
    args: [sessionId],
  });

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  return {
    id: row.id as string,
    status: row.status as any,
    image_data: (row.image_data as string) || null,
    created_at: row.created_at as string,
    expires_at: (row.expires_at as string) || null,
  };
}

export async function updateCameraSessionStatus(
  sessionId: string,
  status: 'connected' | 'completed' | 'expired',
  imageData?: string
): Promise<void> {
  await initDb();
  const db = getDb();

  if (imageData) {
    await db.execute({
      sql: `UPDATE camera_sessions SET status = ?, image_data = ? WHERE id = ?`,
      args: [status, imageData, sessionId],
    });
  } else {
    await db.execute({
      sql: `UPDATE camera_sessions SET status = ? WHERE id = ?`,
      args: [status, sessionId],
    });
  }
}

// ---------------------------------------------------------------------------
// User & Credits Helpers
// ---------------------------------------------------------------------------

export interface UserRecord {
  id: string;
  email?: string | null;
  name?: string | null;
  is_guest: boolean;
  credits: number;
}

export async function getOrCreateUser(
  userId: string,
  isGuest: boolean = true,
  name?: string,
  email?: string
): Promise<UserRecord> {
  await initDb();
  const db = getDb();

  const existing = await db.execute({
    sql: `SELECT id, email, name, is_guest, credits FROM users WHERE id = ?`,
    args: [userId],
  });

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id as string,
      email: (row.email as string) || null,
      name: (row.name as string) || null,
      is_guest: Boolean(row.is_guest),
      credits: Number(row.credits),
    };
  }

  // Create new user with 50 default free credits
  await db.execute({
    sql: `INSERT INTO users (id, email, name, is_guest, credits) VALUES (?, ?, ?, ?, 50)`,
    args: [userId, email || null, name || null, isGuest ? 1 : 0],
  });

  return {
    id: userId,
    email: email || null,
    name: name || null,
    is_guest: isGuest,
    credits: 50,
  };
}

export async function deductUserCredits(userId: string, amount: number = 1): Promise<number> {
  await initDb();
  const db = getDb();

  await db.execute({
    sql: `UPDATE users SET credits = MAX(0, credits - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [amount, userId],
  });

  const res = await db.execute({
    sql: `SELECT credits FROM users WHERE id = ?`,
    args: [userId],
  });

  if (res.rows.length === 0) return 0;
  return Number(res.rows[0].credits);
}
