/**
 * Slow Query Logger
 *
 * D1 쿼리 실행 시간 측정 → THRESHOLD 초과 시 자동 기록.
 * 1인 운영자가 "왜 사이트 느려?" 를 알게 해주는 장치.
 *
 * 사용:
 *   const row = await loggedQuery(DB, 'slow-query-label', 'SELECT ... WHERE id = ?', [id]);
 *
 * THRESHOLD 초과 시 slow_queries 테이블에 기록.
 */

const SLOW_THRESHOLD_MS = 200;

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
      // 백그라운드 기록 (fire-and-forget)
      DB.prepare(`
        CREATE TABLE IF NOT EXISTS slow_queries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT,
          sql_snippet TEXT,
          duration_ms INTEGER,
          logged_at TEXT DEFAULT (datetime('now'))
        )
      `).run().catch(() => {});

      DB.prepare(
        `INSERT INTO slow_queries (label, sql_snippet, duration_ms) VALUES (?, ?, ?)`
      ).bind(label, sql.slice(0, 200), duration).run().catch(() => {});
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
