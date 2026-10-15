/**
 * 🩹 **딜 잔액 정합 수리** — 원장 정합 검사가 잡아낸 것을 사람이 눌러서 고치는 도구 (2026-08-31).
 *
 * ## 왜 여기 있나
 *
 * `ledger-integrity-check` cron 은 **감지만** 한다(그리고 그건 옳다 — 잔액은 돈이라 자동으로 고치면 안 된다).
 * 그 결과 `/admin/errors` 에 매일 알림이 쌓였고, 원인을 규명해도 **고칠 손이 없었다.**
 * 이 모듈이 그 손이다. 두 가지만 한다:
 *
 *   ① **고아 잔액 병합** — 같은 사람의 잔액 행이 둘로 쪼개진 것을 합친다.
 *   ② **레거시 정합 보정** — 설명되지 않는 잔액에 *출처 불명*이라고 원장에 명시적으로 적는다.
 *
 * ## 안전 설계 (CLAUDE.md 머니 룰)
 *
 * - **기본 dry-run.** `apply:true` 를 줘야 쓴다. 무엇을 쓸지 먼저 눈으로 본다.
 * - **멱등.** ①은 병합 후 고아 행이 사라져 다시 안 잡히고, ②는 이미 보정행이 있으면 건너뛴다.
 * - **claim 순서.** ①은 *적립 → 삭제* 순이다. 중간에 죽어도 재실행이 원장 dedup 으로 이중적립을 막고
 *   고아 행만 정리한다. (*삭제 → 적립* 이면 그 사이에 죽을 때 돈이 사라진다.)
 * - **②는 잔액을 바꾸지 않는다.** 원장에 설명 행을 더할 뿐이다.
 *
 * ⚠️ ②는 "덮는" 도구다. 그래서 보정행에 **원래 숫자(balance/computed/diff)를 그대로 적는다** —
 *   나중에 누가 봐도 무엇을 덮었는지 알 수 있어야 한다. 그리고 한 번 돌고 나면 그 다음부터의
 *   불일치는 **진짜 새 사건**이라 알림이 다시 의미를 갖는다. 그게 이걸 하는 이유다.
 */

import type { D1Database } from '@cloudflare/workers-types'
import { findBalanceMismatches, type BalanceMismatchRow } from './ledger-integrity-checks'

/** 오늘 날짜(KST, YYYY-MM-DD). 보정행에 박는 날짜 — 🩸 2026-10-15 전엔 `2026-08-31` 로 고정돼 있어
 *  10-15 에 쓴 행도 8월에 쓴 것처럼 읽혔다. */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 병합 원장 타입 — 이 문자열이 곧 멱등 키다. */
export const ORPHAN_MERGE_TYPE = 'orphan_merge'
/** 레거시 보정 원장 타입 — 〃 */
export const LEGACY_RECONCILE_TYPE = 'legacy_reconcile'

export interface OrphanRow {
  /** 고아 잔액 행의 user_id (예: `kakao_4791707822`). */
  orphan_id: string
  /** 합쳐 들어갈 숫자 user_id. */
  target_id: string
  balance: number
  free_balance: number
  name: string | null
}

/**
 * 같은 사람인데 잔액 행이 둘인 경우를 찾는다.
 *
 * `users.firebase_uid` 가 옛 키(`kakao_…`)를 그대로 들고 있어서 이 대응이 가능하다 —
 * `user-id-backfill.ts` 가 쓰는 것과 **같은 대응**이고, 그 백필은 숫자 행이 이미 있으면
 * 충돌로 보고만 하고 **건드리지 않는다**(설계상 의도 — 잔액 합산은 사람이 판단).
 */
export async function findOrphanBalances(DB: D1Database): Promise<OrphanRow[]> {
  const r = await DB.prepare(`
    SELECT o.user_id AS orphan_id,
           CAST(u.id AS TEXT) AS target_id,
           COALESCE(o.balance, 0) AS balance,
           COALESCE(o.free_balance, 0) AS free_balance,
           u.name AS name
      FROM user_points o
      JOIN users u ON u.firebase_uid = o.user_id
      JOIN user_points t ON t.user_id = CAST(u.id AS TEXT)
     WHERE o.user_id <> CAST(u.id AS TEXT)
  `).all<OrphanRow>().catch(() => ({ results: [] as OrphanRow[] }))
  return r.results ?? []
}

export interface MergeResult {
  orphan_id: string
  target_id: string
  amount: number
  /** 'merged' 적립+삭제 완료 · 'already' 원장에 이미 있음(삭제만) · 'skipped' 금액 0 · 'failed' */
  outcome: 'merged' | 'already' | 'skipped' | 'failed'
}

/**
 * 고아 잔액을 대상 계정으로 합친다.
 *
 * 순서: 원장 dedup 확인 → `adjustUserPoints`(잔액+원장) → 고아 행 삭제.
 */
export async function mergeOrphanBalances(
  DB: D1Database,
  apply: boolean,
): Promise<{ found: OrphanRow[]; results: MergeResult[]; applied: boolean }> {
  const found = await findOrphanBalances(DB)
  const results: MergeResult[] = []
  if (!apply) return { found, results, applied: false }

  const { adjustUserPoints } = await import('./point-ledger')
  for (const o of found) {
    const amount = Math.round(Number(o.balance) || 0)
    // 이미 이 고아를 합친 적이 있나 — description 에 고아 id 를 박아 두므로 그것이 멱등 키다.
    const dup = await DB.prepare(
      `SELECT 1 FROM point_transactions WHERE user_id = ? AND type = ? AND description LIKE ? LIMIT 1`,
    ).bind(o.target_id, ORPHAN_MERGE_TYPE, `%${o.orphan_id}%`).first().catch(() => null)

    let outcome: MergeResult['outcome'] = 'skipped'
    if (amount > 0 && !dup) {
      const r = await adjustUserPoints(DB, {
        userId: o.target_id,
        delta: amount,
        type: ORPHAN_MERGE_TYPE,
        description: `분리된 잔액 행 병합: ${o.orphan_id} → ${o.target_id} (${amount}딜)`,
      })
      outcome = r.ok ? 'merged' : 'failed'
    } else if (dup) {
      outcome = 'already'
    }

    // 적립이 실패했으면 고아 행을 지우지 않는다 — 돈이 사라진다.
    if (outcome !== 'failed') {
      await DB.prepare(`DELETE FROM user_points WHERE user_id = ?`).bind(o.orphan_id).run().catch(() => null)
    }
    results.push({ orphan_id: o.orphan_id, target_id: o.target_id, amount, outcome })
  }
  return { found, results, applied: true }
}

export interface ReconcileResult {
  user_id: string
  balance: number
  computed: number
  /** 원장에 적을 보정 금액(= balance − computed). */
  adjust: number
  outcome: 'written' | 'already' | 'failed'
}

/**
 * 설명되지 않는 잔액에 **출처 불명 보정행**을 남긴다. **잔액은 건드리지 않는다.**
 *
 * 이걸 돌리고 나면 원장 정합 알림이 조용해지고, 그 뒤에 뜨는 불일치는 **진짜 새 사건**이다.
 */
export async function reconcileLegacyBalances(
  DB: D1Database,
  apply: boolean,
  limit = 50,
): Promise<{ found: BalanceMismatchRow[]; results: ReconcileResult[]; applied: boolean }> {
  const { rows } = await findBalanceMismatches(DB, limit)
  const results: ReconcileResult[] = []
  if (!apply) return { found: rows, results, applied: false }

  const { recordPointTransaction } = await import('./point-ledger')
  for (const m of rows) {
    const adjust = Math.round(Number(m.diff) || 0)
    if (adjust === 0) continue
    const dup = await DB.prepare(
      `SELECT 1 FROM point_transactions WHERE user_id = ? AND type = ? LIMIT 1`,
    ).bind(String(m.user_id), LEGACY_RECONCILE_TYPE).first().catch(() => null)
    if (dup) { results.push({ user_id: String(m.user_id), balance: m.balance, computed: m.computed, adjust, outcome: 'already' }); continue }

    const ok = await recordPointTransaction(DB, {
      userId: String(m.user_id),
      delta: adjust,
      type: LEGACY_RECONCILE_TYPE,
      // 🔎 원래 숫자를 그대로 남긴다 — 나중에 누가 봐도 무엇을 덮었는지 알아야 한다.
      description: `정합 보정(출처 불명) ${kstToday()}: 잔액 ${m.balance} · 원장합 ${m.computed} · 차이 ${adjust}`,
    }).catch(() => false)
    results.push({ user_id: String(m.user_id), balance: m.balance, computed: m.computed, adjust, outcome: ok ? 'written' : 'failed' })
  }
  return { found: rows, results, applied: true }
}

// ── ③ 버킷 재분류 — 실제 돈을 낸 적 없는데 유상(환급 가능) 잔액이 있는 계정 ─────────────────────
/**
 * 🩸 2026-10-15 실측: 유상/무상 버킷(`free_balance`)은 2026-07-05 에 생겼다. 그 **전에** 받은 리워드
 * (가입 보너스 3,000 · 광고 시청 등)는 컬럼 기본값 0 때문에 **유상**으로 남았다 — 32번(06-30 가입)은
 * 3,000 이 유상, 같은 보너스를 07-09 에 받은 33번은 무상이었다. 유상은 딜 환급(현금)의 한도라
 * 그대로 두면 **보너스가 현금으로 나간다.**
 *
 * 판정은 보수적으로: **충전 기록이 한 번도 없고(`total_charged = 0` 이고 금액 있는 `charge` 원장 0)**
 * 유상 잔액이 0 보다 큰 계정만. 돈을 낸 적이 있으면 건드리지 않는다(나눌 근거가 없다).
 *
 * - 기본 dry-run. 잔액(`balance`)은 바꾸지 않는다 — 버킷만 옮긴다.
 * - CAS: 같은 조건을 UPDATE 의 WHERE 에 다시 걸어 그 사이 충전이 들어오면 건너뛴다.
 * - 원장에 `bucket_reclass` 행(금액 0 · free_delta=+옮긴 양)을 남겨 무엇을 옮겼는지 보인다.
 * - 멱등: 옮기고 나면 유상이 0 이라 다시 안 잡힌다.
 */
export const BUCKET_RECLASS_TYPE = 'bucket_reclass'

export interface ReclassRow { user_id: string; balance: number; free_balance: number; paid: number }
export interface ReclassResult extends ReclassRow { outcome: 'moved' | 'skipped' | 'failed' }

const UNPAID_WITH_PAID_BALANCE = `
  COALESCE(up.total_charged, 0) = 0
  AND up.balance - COALESCE(up.free_balance, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM point_transactions pt
                   WHERE pt.user_id = up.user_id AND pt.type = 'charge' AND COALESCE(pt.amount, 0) > 0)`

export async function findUnpaidPaidBalances(DB: D1Database): Promise<ReclassRow[]> {
  const r = await DB.prepare(`
    SELECT up.user_id AS user_id, up.balance AS balance, COALESCE(up.free_balance, 0) AS free_balance,
           up.balance - COALESCE(up.free_balance, 0) AS paid
      FROM user_points up
     WHERE ${UNPAID_WITH_PAID_BALANCE}
     ORDER BY paid DESC`).all<ReclassRow>()
  return r.results ?? []
}

export async function reclassifyUnpaidToFree(
  DB: D1Database,
  apply: boolean,
): Promise<{ found: ReclassRow[]; results: ReclassResult[]; applied: boolean }> {
  const found = await findUnpaidPaidBalances(DB)
  const results: ReclassResult[] = []
  if (!apply) return { found, results, applied: false }
  for (const row of found) {
    const r = await DB.prepare(`
      UPDATE user_points SET free_balance = balance, updated_at = datetime('now')
       WHERE user_id = ? AND user_id IN (SELECT up.user_id FROM user_points up WHERE ${UNPAID_WITH_PAID_BALANCE})`,
    ).bind(row.user_id).run().catch(() => null)
    const changed = Number(r?.meta?.changes ?? 0)
    if (!r) { results.push({ ...row, outcome: 'failed' }); continue }
    if (changed === 0) { results.push({ ...row, outcome: 'skipped' }); continue }
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, free_delta, description) VALUES (?, ?, 0, ?, ?)`,
    ).bind(row.user_id, BUCKET_RECLASS_TYPE, row.paid,
      `버킷 재분류 ${kstToday()}: 충전 기록 없는 유상 잔액 ${row.paid} → 무상 (잔액 ${row.balance} 불변)`,
    ).run().catch(() => null)
    results.push({ ...row, outcome: 'moved' })
  }
  return { found, results, applied: true }
}
