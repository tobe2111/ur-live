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

  try {
    // ⚠️ 한 문장씩. batch 로 묶으면 중간 실패 시 어디까지 갔는지 알 수 없다.
    await DB.prepare(`ALTER TABLE point_transactions ADD COLUMN _type_bak TEXT`).run()
    await DB.prepare(`UPDATE point_transactions SET _type_bak = type`).run()
    await DB.prepare(`ALTER TABLE point_transactions DROP COLUMN type`).run()
    await DB.prepare(`ALTER TABLE point_transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'charge'`).run()
    await DB.prepare(`UPDATE point_transactions SET type = COALESCE(_type_bak, 'charge')`).run()
    await DB.prepare(`ALTER TABLE point_transactions DROP COLUMN _type_bak`).run()
    // 0253 이 함께 만들던 인덱스 — 컬럼을 갈아끼웠으니 다시 확인해 준다.
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id)`).run().catch(() => null)
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_point_tx_type ON point_transactions(type)`).run().catch(() => null)
  } catch (err) {
    return { ...base, applied: true, error: (err as Error)?.message || String(err), verified: false }
  }

  const after = await snapshot(DB)
  const stillLocked = await hasLegacyTypeCheck(DB)
  // 🔎 **전후가 같아야 한다.** 타입이 전부 'charge' 로 뭉개지는 것이 이 절차의 유일한 실패 모양이다.
  const sameTypes = JSON.stringify(before.types) === JSON.stringify(after.types)
  return {
    ...base, applied: true,
    rows_after: after.n, types_after: after.types,
    verified: !stillLocked && after.n === before.n && sameTypes,
  }
}
