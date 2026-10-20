/**
 * 🔓 **원장 테이블의 옛 CHECK 제약 제거** — 이 레포에서 가장 오래 조용히 살아 있던 고장 (2026-08-31).
 *
 * ## 무엇이 있었나
 *
 * 라이브 `point_transactions` 는 아직 이렇게 생겼다:
 *
 * ```sql
 * type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund'))
 * ```
 *
 * 그런데 코드는 `signup_bonus` · `referral_bonus` · `influencer_payout` · `kakao_review_bonus` ·
 * `invite_reward` … 를 쓴다. **전부 제약에 걸려 INSERT 가 거부된다.** 그리고 원장 기록은
 * *fail-soft* 다(돈 흐름을 막으면 안 되니까 — 그 자체는 옳은 설계) ⇒ **잔액은 움직이고 기록만 사라진다.**
 * 에러도 알림도 없다. 이것이 "잔액만 있고 거래 기록이 0 인 유저" 의 진짜 원인이다.
 *
 * ## 🩸 그리고 이 고장은 **이미 진단돼 있었다**
 *
 * `migrations/0253_expand_point_transactions_type.sql`(2026-05-17)이 같은 원인을 정확히 짚고
 * 같은 처방을 적어 뒀다. **그 마이그레이션이 라이브에 적용된 적이 없다** — 이 레포의 알려진
 * 부채(`TECHNICAL_DEBT.md`: "DB Migration CI 미작동 → repair-schema 로 응급 처치")가
 * 3개월 반 동안 그대로 값을 치른 것이다.
 * ⇒ 그래서 여기(**실제로 라이브에서 도는 경로**)에 같은 처방을 옮겨 놓는다.
 *
 * ## 안전
 *
 * - **기본 dry-run.** 무엇을 할지 먼저 보고한다.
 * - **멱등**: CHECK 가 없으면 아무것도 안 한다(재실행 no-op).
 * - **되돌릴 수 없는 DDL 이므로 전후를 검증한다** — 행 수와 타입 분포를 찍어 두고 끝난 뒤
 *   대조해서 결과에 담는다. 다르면 `verified:false` 로 **드러낸다**(조용히 넘어가지 않는다).
 */

import type { D1Database } from '@cloudflare/workers-types'

/** 이 문자열이 스키마에 있으면 옛 제약이 살아 있는 것이다. */
const CHECK_MARKER = 'CHECK (type IN'

export interface LedgerUnlockResult {
  /** 제약이 있었나. false 면 이미 풀려 있다(할 일 없음). */
  had_check: boolean
  applied: boolean
  rows_before: number
  rows_after: number | null
  /** 타입별 개수 — 전후가 같아야 한다. */
  types_before: Record<string, number>
  types_after: Record<string, number> | null
  /** 전후 대조 결과. dry-run 이면 null. */
  verified: boolean | null
  /** `type` 을 쓰던 인덱스 — 컬럼을 갈아끼우려고 떼었다가 다시 단 것. */
  recreated_indexes?: string[]
  /** 실패했을 때 손으로 되살릴 수 있게 원래 SQL 을 돌려준다. */
  index_sql?: string[]
  error?: string
}

async function snapshot(DB: D1Database): Promise<{ n: number; types: Record<string, number> }> {
  const r = await DB.prepare(`SELECT type, COUNT(*) AS n FROM point_transactions GROUP BY type ORDER BY type`)
    .all<{ type: string; n: number }>().catch(() => ({ results: [] as { type: string; n: number }[] }))
  const types: Record<string, number> = {}
  let n = 0
  for (const row of r.results ?? []) { types[String(row.type)] = Number(row.n); n += Number(row.n) }
  return { n, types }
}

async function columns(DB: D1Database): Promise<Set<string>> {
  const r = await DB.prepare(`PRAGMA table_info(point_transactions)`).all<{ name: string }>()
  return new Set((r.results ?? []).map(c => String(c.name)))
}

/** `type` 컬럼을 쓰는 인덱스(자동 인덱스 제외 — sql 이 있는 것만). */
async function typeIndexes(DB: D1Database): Promise<{ name: string; sql: string }[]> {
  const r = await DB.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='point_transactions' AND sql IS NOT NULL`,
  ).all<{ name: string; sql: string }>()
  return (r.results ?? []).filter(i => {
    const cols = /\(([^)]*)\)\s*(WHERE[\s\S]*)?$/i.exec(i.sql)
    return !!cols && /(^|[\s,"`(])type([\s,"`)]|$)/i.test(cols[1] + (cols[2] ?? ''))
  })
}

/** 원래 CREATE INDEX 를 재실행 안전하게. */
function ifNotExists(sql: string): string {
  return /IF NOT EXISTS/i.test(sql) ? sql : sql.replace(/^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+/i, (m, u) => `CREATE ${u ?? ''}INDEX IF NOT EXISTS `)
}

/** 현재 스키마에 옛 CHECK 가 남아 있나. */
export async function hasLegacyTypeCheck(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='point_transactions' LIMIT 1`,
  ).first<{ sql: string }>().catch(() => null)
  return typeof row?.sql === 'string' && row.sql.includes(CHECK_MARKER)
}

/**
 * 옛 CHECK 를 제거한다. 순서는 migration 0253 과 같다 —
 * 백업 컬럼에 타입을 옮기고, 컬럼을 갈아끼운 뒤, 되돌려 놓는다.
 */
export async function unlockPointLedgerTypes(DB: D1Database, apply: boolean): Promise<LedgerUnlockResult> {
  const had = await hasLegacyTypeCheck(DB)
  const before = await snapshot(DB)
  const base: LedgerUnlockResult = {
    had_check: had, applied: false,
    rows_before: before.n, rows_after: null,
    types_before: before.types, types_after: null, verified: null,
  }
  if (!had || !apply) return base

  // 🩸 2026-10-15 — **라이브에는 `type` 을 쓰는 인덱스가 있다**(`idx_point_tx_user_type(user_id, type)`).
  //   SQLite 는 인덱스가 걸린 컬럼을 DROP 하지 못한다 → 종전 절차는 3번째 문장에서 멈추고
  //   `_type_bak` 만 남긴 채 실패했을 것이다. 시험의 스키마가 그 인덱스를 빠뜨려 아무도 몰랐다.
  //   ⇒ 그 인덱스를 **먼저 떼고, 컬럼을 갈아끼운 뒤, 원래 SQL 그대로 다시 단다.**
  const deps = await typeIndexes(DB)
  base.recreated_indexes = deps.map(d => d.name)
  try {
    // ⚠️ 한 문장씩. batch 로 묶으면 중간 실패 시 어디까지 갔는지 알 수 없다.
    // 🔁 상태 기반 — 전에 중간에서 멈췄으면 남은 단계부터 이어서 한다(같은 단계를 두 번 하지 않는다).
    let cols = await columns(DB)
    if (!cols.has('_type_bak')) await DB.prepare(`ALTER TABLE point_transactions ADD COLUMN _type_bak TEXT`).run()
    if (cols.has('type')) await DB.prepare(`UPDATE point_transactions SET _type_bak = type`).run()
    for (const d of deps) await DB.prepare(`DROP INDEX IF EXISTS "${d.name}"`).run()
    if (cols.has('type')) await DB.prepare(`ALTER TABLE point_transactions DROP COLUMN type`).run()
    await DB.prepare(`ALTER TABLE point_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'charge'`).run()
    await DB.prepare(`UPDATE point_transactions SET type = COALESCE(_type_bak, 'charge')`).run()
    await DB.prepare(`ALTER TABLE point_transactions DROP COLUMN _type_bak`).run()
    for (const d of deps) await DB.prepare(ifNotExists(d.sql)).run()
    // 0253 이 함께 만들던 인덱스 — 컬럼을 갈아끼웠으니 다시 확인해 준다.
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id)`).run().catch(() => null)
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_point_tx_type ON point_transactions(type)`).run().catch(() => null)
    cols = await columns(DB)
    if (cols.has('_type_bak')) throw new Error('_type_bak 가 남았다')
  } catch (err) {
    // 떼어 둔 인덱스는 컬럼이 살아 있으면 되붙인다(실패해도 원 SQL 을 결과로 돌려준다).
    for (const d of deps) await DB.prepare(ifNotExists(d.sql)).run().catch(() => null)
    return {
      ...base, applied: true, verified: false,
      error: (err as Error)?.message || String(err),
      index_sql: deps.map(d => d.sql),
    }
  }

  const after = await snapshot(DB)
  const stillLocked = await hasLegacyTypeCheck(DB)
  // 🔎 **전후가 같아야 한다.** 타입이 전부 'charge' 로 뭉개지는 것이 이 절차의 유일한 실패 모양이다.
  const sameTypes = JSON.stringify(before.types) === JSON.stringify(after.types)
  // 떼어 냈던 인덱스가 전부 다시 있어야 한다 — 없으면 조회가 조용히 느려진다.
  const nowIdx = new Set((await typeIndexes(DB)).map(d => d.name))
  const indexesBack = deps.every(d => nowIdx.has(d.name))
  return {
    ...base, applied: true,
    rows_after: after.n, types_after: after.types,
    verified: !stillLocked && after.n === before.n && sameTypes && indexesBack,
  }
}
