/**
 * 💸 2026-06-12 (4차 감사 D배치 — 포인트 장부 수렴): 유저 딜 포인트 잔액변경 + 장부 동시 기록 SSOT.
 *
 * 배경: 감사에서 user_points.balance 만 바꾸고 point_transactions(장부) 를 안 남기는 지점이
 * ~14곳 발견 — 유저 '딜 이용내역' 과 실제 잔액이 안 맞는 구조적 원인. 이 헬퍼는
 * ① user_points UPSERT(차감은 `balance >= ?` CAS 가드 옵션) ② point_transactions INSERT
 * (balance_after 는 서브쿼리로 변경 직후 잔액 캡처) 를 한 호출로 묶는다.
 *
 * 설계 원칙:
 *  - 잔액(돈)이 우선, 장부는 audit — 장부 INSERT 는 fail-soft (레거시 DB 의
 *    point_transactions.type CHECK 잔존 가능성 — migration 0253 이 제거했지만
 *    repair-schema 미실행 환경 방어). 장부 실패가 적립/차감을 절대 막지 않음.
 *  - point_transactions.type CHECK 는 0253 에서 제거됨 — 신규 type 자유.
 *  - 멱등은 호출자 책임 (claim-before-credit / UNIQUE claim — CLAUDE.md 머니 룰 1·3).
 *
 * 사용:
 *   await adjustUserPoints(DB, { userId, delta: +1000, type: 'invite_reward', description: '…' })
 *   await adjustUserPoints(DB, { userId, delta: -500, type: 'usage', guardBalance: true })
 *   // 기존 DB.batch 에 합류해야 하는 호출자(원자성 보존)는 upsert 문만 받아서 batch 에 넣고,
 *   // batch 성공 후 recordPointTransaction() 으로 장부만 추가:
 *   statements.push(pointCreditUpsertStatement(DB, { userId, delta }))
 *   await DB.batch(statements)
 *   await recordPointTransaction(DB, { userId, delta, type: 'referral_bonus' })
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { ensurePointsTables } from './ensure-tables'

export interface PointAdjustInput {
  userId: string | number
  /** 양수 = 적립, 음수 = 차감. 0 비허용. */
  delta: number
  /** point_transactions.type — 예: 'refund' | 'invite_reward' | 'affiliate_commission' | 'referral_bonus' */
  type: string
  description?: string | null
  orderId?: string | number | null
  /** true 면 적립 시 total_charged 도 delta 만큼 증가 (보상 적립 관례 — 호출처별 기존 동작 보존용) */
  bumpTotalCharged?: boolean
  /** 차감(delta<0) 시 balance >= |delta| 일 때만 차감 (원자 CAS 가드). 부족하면 ok:false. */
  guardBalance?: boolean
}

export type PointAdjustResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'insufficient' | 'error' }

const MAX_ABS = 100_000_000_000

function normalize(input: PointAdjustInput): { uid: string; delta: number } | null {
  const uid = input.userId == null ? '' : String(input.userId)
  const delta = Math.round(Number(input.delta))
  if (!uid || !Number.isFinite(delta) || delta === 0 || Math.abs(delta) > MAX_ABS) return null
  return { uid, delta }
}

/**
 * user_points 적립 UPSERT 준비문 (delta > 0 전용).
 * 기존 DB.batch 원자성에 합류해야 하는 호출자용 — adjustUserPoints 내부도 이걸 사용.
 */
export function pointCreditUpsertStatement(
  DB: D1Database,
  input: { userId: string | number; delta: number; bumpTotalCharged?: boolean },
): D1PreparedStatement {
  const uid = String(input.userId)
  const amount = Math.round(input.delta)
  const charged = input.bumpTotalCharged ? amount : 0
  return DB.prepare(
    `INSERT INTO user_points (user_id, balance, total_charged)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       balance = balance + excluded.balance,
       total_charged = total_charged + excluded.total_charged,
       updated_at = datetime('now')`,
  ).bind(uid, amount, charged)
}

/**
 * point_transactions 장부 INSERT — balance_after 는 서브쿼리로 현재 잔액 캡처.
 * fail-soft: 절대 throw 하지 않음 (장부는 audit — 돈 흐름을 막으면 안 됨).
 */
export async function recordPointTransaction(
  DB: D1Database,
  input: Pick<PointAdjustInput, 'userId' | 'delta' | 'type' | 'description' | 'orderId'>,
): Promise<boolean> {
  const n = normalize({ ...input, type: input.type })
  if (!n || !input.type) return false
  try {
    await ensurePointsTables(DB)
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, balance_after, description, order_id)
       VALUES (?, ?, ?, COALESCE((SELECT balance FROM user_points WHERE user_id = ?), 0), ?, ?)`,
    ).bind(
      n.uid,
      String(input.type).slice(0, 50),
      n.delta,
      n.uid,
      input.description ? String(input.description).slice(0, 300) : null,
      input.orderId != null ? String(input.orderId) : null,
    ).run()
    return true
  } catch {
    // 레거시 CHECK 제약 / 테이블 부재 — 잔액 변경은 이미 보존됨. audit 만 누락.
    return false
  }
}

/**
 * 잔액 변경 + 장부 기록 동시 수행.
 *  - delta > 0: UPSERT 적립
 *  - delta < 0: guardBalance ? 원자 CAS 차감(부족 시 insufficient) : UPSERT 차감(음수 허용 — 레거시 동작)
 */
export async function adjustUserPoints(
  DB: D1Database,
  input: PointAdjustInput,
): Promise<PointAdjustResult> {
  const n = normalize(input)
  if (!n || !input.type) return { ok: false, reason: 'invalid' }
  try {
    await ensurePointsTables(DB)
    if (n.delta > 0) {
      await pointCreditUpsertStatement(DB, { userId: n.uid, delta: n.delta, bumpTotalCharged: input.bumpTotalCharged }).run()
    } else if (input.guardBalance) {
      const abs = Math.abs(n.delta)
      const r = await DB.prepare(
        `UPDATE user_points SET balance = balance - ?, updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`,
      ).bind(abs, n.uid, abs).run()
      if (((r as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) {
        return { ok: false, reason: 'insufficient' }
      }
    } else {
      await pointCreditUpsertStatement(DB, { userId: n.uid, delta: n.delta }).run()
    }
    await recordPointTransaction(DB, input) // fail-soft
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/**
 * 회원 탈퇴 등 잔액 전체 소멸 — balance=0 + 장부에 -잔액 기록.
 * 잔액 0 이면 장부 기록 생략 (no-op 도배 방지). 절대 throw 하지 않음.
 */
export async function zeroOutUserPoints(
  DB: D1Database,
  userId: string | number,
  type = 'account_deleted',
  description = '회원 탈퇴 — 딜 잔액 소멸',
): Promise<void> {
  const uid = String(userId || '')
  if (!uid) return
  try {
    await ensurePointsTables(DB)
    const row = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
      .bind(uid).first<{ balance: number }>().catch(() => null)
    const bal = Number(row?.balance ?? 0)
    await DB.prepare("UPDATE user_points SET balance = 0, updated_at = datetime('now') WHERE user_id = ?")
      .bind(uid).run()
    if (bal !== 0 && Number.isFinite(bal)) {
      await recordPointTransaction(DB, { userId: uid, delta: -bal, type, description })
    }
  } catch {
    /* fail-soft — 탈퇴 cleanup 흐름 보호 */
  }
}
