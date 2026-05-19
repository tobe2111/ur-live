import { swallow } from './swallow';
/**
 * Slow Query Logger
 *
 * D1 쿼리 실행 시간 측정 → THRESHOLD 초과 시 자동 기록.
 * 1인 운영자가 "왜 사이트 느려?" 를 알게 해주는 장치.
 *
 * 사용:
 *   const row = await loggedQuery(DB, 'slow-query-label', 'SELECT ... WHERE id = ?', [id]);
 *
 * THRESHOLD 초과 시 isolate 메모리 버퍼에 쌓고, FLUSH_INTERVAL마다 batch INSERT.
 * 직전: 슬로우 쿼리마다 D1 write 2회 (CREATE TABLE + INSERT) → KV 쓰기 낭비.
 */

const SLOW_THRESHOLD_MS = 200;
const FLUSH_INTERVAL_MS = 60_000; // 1분마다 flush
const MAX_BUFFER = 50; // 최대 50개 버퍼 (넘으면 즉시 flush)

interface SlowQueryEntry {
  label: string;
  sql_snippet: string;
  duration_ms: number;
}

// isolate-level 버퍼 (module 상태, 요청 간 공유)
const buffer: SlowQueryEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let tableEnsured = false;

async function ensureTable(DB: D1Database): Promise<void> {
  if (_done_ensureTable) return
  _done_ensureTable = true
  if (tableEnsured) return;
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS slow_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT,
      sql_snippet TEXT,
      duration_ms INTEGER,
      logged_at TEXT DEFAULT (datetime('now'))
    )
  `).run().catch(swallow('worker:utils:slow-query-logger'));
  tableEnsured = true;
}

async function flushBuffer(DB: D1Database): Promise<void> {
  if (buffer.length === 0) return;
  const toFlush = buffer.splice(0, buffer.length);
  try {
    await ensureTable(DB);
    const stmts = toFlush.map(entry =>
      DB.prepare(`INSERT INTO slow_queries (label, sql_snippet, duration_ms) VALUES (?, ?, ?)`)
        .bind(entry.label, entry.sql_snippet, entry.duration_ms)
    );
    if (stmts.length > 0) {
      await DB.batch(stmts).catch(swallow('worker:utils:slow-query-logger:flush'));
    }
  } catch { /* noop */ }
}

function scheduleFlush(DB: D1Database): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBuffer(DB);
  }, FLUSH_INTERVAL_MS);
}

export async function loggedQuery<T = unknown>(
  DB: D1Database,
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const start = Date.now();
  try {
    const stmt = DB.prepare(sql);
    const result = params.length > 0
      ? await stmt.bind(...params).all<T>()
      : await stmt.all<T>();
    const duration = Date.now() - start;

    if (duration >= SLOW_THRESHOLD_MS) {
      buffer.push({ label, sql_snippet: sql.slice(0, 200), duration_ms: duration });
      if (buffer.length >= MAX_BUFFER) {
        // 즉시 flush (fire-and-forget)
        flushBuffer(DB).catch(swallow('worker:utils:slow-query-logger:immediate-flush'));
      } else {
        scheduleFlush(DB);
      }
    }

    return result.results || [];
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`[slow-query-logger] ${label} failed after ${duration}ms:`, err);
    throw err;
  }
}

/**
 * 슬로우 쿼리 통계 조회 (운영자 대시보드용)
 */
export async function getSlowQueryStats(DB: D1Database, hours = 24) {
  try {
    const rows = await DB.prepare(`
      SELECT label, COUNT(*) as count, AVG(duration_ms) as avg_ms, MAX(duration_ms) as max_ms
      FROM slow_queries
      WHERE logged_at >= datetime('now', ?)
      GROUP BY label
      ORDER BY avg_ms DESC
      LIMIT 20
    `).bind(`-${hours} hours`).all<{
      label: string;
      count: number;
      avg_ms: number;
      max_ms: number;
    }>();
    return rows.results || [];
  } catch {
    return [];
  }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTable = false
