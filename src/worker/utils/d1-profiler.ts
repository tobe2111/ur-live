/**
 * 📊 2026-07-22 (대표 "D1 읽기 프로파일링 — 무비용으로"): 어떤 쿼리가 D1 행을 많이 읽는지 실측.
 *
 *   목적: 서버비용의 실질 축(D1 rows_read)을 **추측 없이 데이터로** 파악 → 비싼 쿼리만 골라 캐싱/인덱스.
 *
 * 🛡️ 무비용·안전 설계:
 *   - **저장 쓰기 0** (KV/D1 write 없음). 집계는 워커 isolate 메모리(모듈 Map) + 콘솔 로그(Logpush/tail).
 *   - **기본 OFF**: `D1_PROFILE_ENABLED='true'` 일 때만 index.ts 가 env.DB 를 이 프록시로 감쌈.
 *     플래그 꺼져 있으면 프록시 자체가 안 걸려 **오버헤드 0**. 프로파일링할 때만 켜고 끄면 됨.
 *   - **완전 pass-through 프록시**: prepare→statement 의 all()/run() 결과 `meta.rows_read` 만 읽어 집계.
 *     batch/exec/first/raw/dump 등 나머지는 원본 그대로 위임(동작 불변). 집계 실패는 삼킴(쿼리 영향 0).
 *
 *   조회: 어드민 `GET /api/admin/d1-profile` (isolate-로컬 top-N) + rows≥2000 쿼리는 콘솔 경고(전 isolate).
 */

interface QueryStat { sql: string; count: number; totalRows: number; maxRows: number; samplePath: string }

const agg = new Map<string, QueryStat>()
const HEAVY_LOG_THRESHOLD = 2000  // 단일 쿼리 rows_read 이 이상이면 콘솔 경고(전 isolate 포착).
const MAX_KEYS = 500              // 메모리 캡.

/** SQL 정규화 — 리터럴/공백 제거로 같은 쿼리 패턴을 한 키로 묶음. */
function normalizeSql(sql: string): string {
  return sql
    .replace(/'[^']*'/g, '?')         // 문자열 리터럴
    .replace(/\b\d+\b/g, '?')         // 숫자 리터럴
    .replace(/\s+/g, ' ')             // 공백 collapse
    .trim()
    .slice(0, 300)
}

function record(sql: string, rows: number, path: string): void {
  try {
    const key = normalizeSql(sql)
    let e = agg.get(key)
    if (!e) {
      if (agg.size >= MAX_KEYS) return  // 캡 초과 — 신규 키 무시(기존 집계는 유지).
      e = { sql: key, count: 0, totalRows: 0, maxRows: 0, samplePath: path }
      agg.set(key, e)
    }
    e.count++
    e.totalRows += rows
    if (rows > e.maxRows) { e.maxRows = rows; e.samplePath = path }
    if (rows >= HEAVY_LOG_THRESHOLD) {
      // Logpush/wrangler tail 로 전 isolate 포착(무저장).
      console.warn(`[d1-profile] rows_read=${rows} path=${path} sql=${key.slice(0, 160)}`)
    }
  } catch { /* 집계 실패는 절대 쿼리에 영향 주지 않음 */ }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function wrapStmt(stmt: any, sql: string, path: string): any {
  return new Proxy(stmt, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver)
      if (typeof orig !== 'function') return orig
      if (prop === 'bind') return (...args: unknown[]) => wrapStmt(orig.apply(target, args), sql, path)
      if (prop === 'all' || prop === 'run') {
        return async (...args: unknown[]) => {
          const r = await orig.apply(target, args)
          try { const rr = Number(r?.meta?.rows_read || 0); if (rr > 0) record(sql, rr, path) } catch { /* noop */ }
          return r
        }
      }
      return orig.bind(target)  // first/raw/columnNames 등 — 원본 그대로.
    },
  })
}

/** env.DB 를 감싸 rows_read 를 집계하는 pass-through 프록시. index.ts 진입점에서 플래그 ON 일 때만 사용. */
export function profileD1<T extends object>(db: T, path: string): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const orig = Reflect.get(target, prop, receiver)
      if (prop === 'prepare' && typeof orig === 'function') {
        return (sql: string) => wrapStmt((orig as (s: string) => unknown).call(target, sql), sql, path)
      }
      return typeof orig === 'function' ? (orig as (...a: unknown[]) => unknown).bind(target) : orig
    },
  }) as T
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** top-N (rows 총합 내림차순) — 어드민 조회용. */
export function getD1Profile(limit = 30): QueryStat[] {
  return [...agg.values()].sort((a, b) => b.totalRows - a.totalRows).slice(0, limit)
}

export function resetD1Profile(): void { agg.clear() }
