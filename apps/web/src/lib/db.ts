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
// Uses an in-memory globalThis cache as primary store so LAN phone-to-laptop
// beaming completes in <2ms even when internet/Turso Cloud is slow or offline.
// ---------------------------------------------------------------------------

export interface CameraSessionRecord {
  id: string;
  status: 'pending' | 'connected' | 'completed' | 'expired';
  image_data?: string | null;
  created_at: string;
  expires_at?: string | null;
}

const globalForSessions = globalThis as unknown as {
  __solvamCameraSessions?: Map<string, CameraSessionRecord>;
};

function getMemorySessionStore(): Map<string, CameraSessionRecord> {
  if (!globalForSessions.__solvamCameraSessions) {
    globalForSessions.__solvamCameraSessions = new Map<string, CameraSessionRecord>();
  }
  return globalForSessions.__solvamCameraSessions;
}

/**
 * Executes a DB operation with a strict 3.5-second timeout so a slow remote Turso link
 * never stalls real-time LAN operations.
 */
async function executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs = 3500): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DB operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export async function createCameraSession(sessionId: string): Promise<CameraSessionRecord> {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  const record: CameraSessionRecord = {
    id: sessionId,
    status: 'pending',
    image_data: null,
    created_at: now,
    expires_at: expiresAt,
  };

  // 1. Store immediately in memory for instant LAN access
  getMemorySessionStore().set(sessionId, record);

  // 2. Persist asynchronously to DB with timeout guard
  try {
    await executeWithTimeout(async () => {
      await initDb();
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO camera_sessions (id, status, expires_at) VALUES (?, 'pending', ?)`,
        args: [sessionId, expiresAt],
      });
    });
  } catch (err) {
    console.warn('[DB] Camera session persisted in memory (DB write skipped/timed out):', err);
  }

  return record;
}

export async function getCameraSession(sessionId: string): Promise<CameraSessionRecord | null> {
  // 1. Fast-path: Check in-memory store first (<1ms latency for SSE & polling)
  const memStore = getMemorySessionStore();
  const cached = memStore.get(sessionId);
  if (cached) {
    return cached;
  }

  // 2. Fallback to DB if not in memory
  try {
    return await executeWithTimeout(async () => {
      await initDb();
      const db = getDb();
      const res = await db.execute({
        sql: `SELECT id, status, image_data, created_at, expires_at FROM camera_sessions WHERE id = ?`,
        args: [sessionId],
      });

      if (res.rows.length === 0) return null;
      const row = res.rows[0];

      const record: CameraSessionRecord = {
        id: row.id as string,
        status: row.status as any,
        image_data: (row.image_data as string) || null,
        created_at: row.created_at as string,
        expires_at: (row.expires_at as string) || null,
      };
      memStore.set(sessionId, record);
      return record;
    });
  } catch (err) {
    console.warn('[DB] getCameraSession DB lookup timed out:', err);
    return null;
  }
}

export async function updateCameraSessionStatus(
  sessionId: string,
  status: 'connected' | 'completed' | 'expired',
  imageData?: string
): Promise<void> {
  const memStore = getMemorySessionStore();
  const existing = memStore.get(sessionId) || {
    id: sessionId,
    status: 'pending',
    image_data: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const updated: CameraSessionRecord = {
    ...existing,
    status,
    image_data: imageData !== undefined ? imageData : existing.image_data,
  };

  // 1. Update memory store synchronously so desktop SSE stream receives the photo in <1ms!
  memStore.set(sessionId, updated);

  // 2. Persist to DB in the background (non-blocking so large base64 uploads never hang the phone)
  void executeWithTimeout(async () => {
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
  }).catch((err) => {
    console.warn('[DB] Non-blocking camera session DB sync skipped:', err instanceof Error ? err.message : err);
  });
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

export async function upsertAuthenticatedUser(
  userId: string,
  name: string,
  email: string
): Promise<UserRecord> {
  await initDb();
  const db = getDb();

  const existing = await db.execute({
    sql: `SELECT id, credits FROM users WHERE id = ?`,
    args: [userId],
  });

  if (existing.rows.length > 0) {
    const currentCredits = Number(existing.rows[0].credits);
    const upgradedCredits = Math.max(currentCredits, 100);
    await db.execute({
      sql: `UPDATE users SET name = ?, email = ?, is_guest = 0, credits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [name, email, upgradedCredits, userId],
    });
    return {
      id: userId,
      name,
      email,
      is_guest: false,
      credits: upgradedCredits,
    };
  }

  await db.execute({
    sql: `INSERT INTO users (id, email, name, is_guest, credits) VALUES (?, ?, ?, 0, 100)`,
    args: [userId, email, name],
  });

  return {
    id: userId,
    name,
    email,
    is_guest: false,
    credits: 100,
  };
}
