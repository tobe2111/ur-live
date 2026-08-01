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
import { freeCreditUpsertStatement } from './point-buckets'

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
  /**
   * 💸 2026-07-05 유상/무상 버킷 (point-buckets.ts SSOT):
   *  - 적립: 'free' 면 free_balance 도 동시 증가 (프로모션 리워드). 미지정 = paid (충전/커미션 소득 — 기존 동작).
   *  - 차감: 버킷 무관 항상 free 우선 소진 (free_balance = MAX(0, free - |delta|)) — 약관 강제.
   */
  bucket?: 'paid' | 'free'
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
  input: Pick<PointAdjustInput, 'userId' | 'delta' | 'type' | 'description' | 'orderId'> & {
    /** 이 거래가 무상 버킷에 적용된 부분 (적립 +, 차감 -). 환불 대칭 복원(free_delta 역산)의 근거. */
    freeDelta?: number
  },
): Promise<boolean> {
  const n = normalize({ ...input, type: input.type })
  if (!n || !input.type) return false
  const freeDelta = Math.round(Number(input.freeDelta ?? 0)) || 0
  try {
    await ensurePointsTables(DB)
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, balance_after, description, order_id, free_delta)
       VALUES (?, ?, ?, COALESCE((SELECT balance FROM user_points WHERE user_id = ?), 0), ?, ?, ?)`,
    ).bind(
      n.uid,
      String(input.type).slice(0, 50),
      n.delta,
      n.uid,
      input.description ? String(input.description).slice(0, 300) : null,
      input.orderId != null ? String(input.orderId) : null,
      freeDelta,
    ).run()
    return true
  } catch {
    // 🔴 2026-08-01: 여기서 그냥 포기하면 **잔액만 움직이고 원장 행이 없는 유저**가 남는다.
    //   라이브 실측으로 정확히 그 모양인 유저 3명을 확인했다(원장 정합 검사가 몇 주째 잡아냈지만
    //   원인이 로그조차 안 남아 조사가 시작되지 못했다). 최소 컬럼으로 반드시 한 번 더 남긴다.
    return recordPointTxMinimal(DB, n.uid, String(input.type), n.delta, input.description)
  }
}

/**
 * 원장 행 최소 기록 — base CREATE 가 보장하는 컬럼만 쓴다(user_id·type·amount·description).
 *
 * 전체 INSERT 는 확장 컬럼(points_amount·balance_after·order_id·free_delta)을 쓰는데, 그 컬럼이
 * 아직 없는 배포 창에서는 통째로 실패한다. 그때 **행이 아예 없는 것보다 열이 덜 채워진 행이 낫다** —
 * 정합 검사는 `amount`·`type` 만으로 계산하기 때문이다.
 */
export async function recordPointTxMinimal(
  DB: D1Database,
  userId: string | number,
  type: string,
  amount: number,
  description?: string | null,
): Promise<boolean> {
  try {
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)`,
    ).bind(String(userId), String(type).slice(0, 50), Math.round(Number(amount)),
      description ? String(description).slice(0, 300) : null).run()
    return true
  } catch {
    return false // 테이블 자체가 없다 — repair-schema 소관
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
    let freeDelta = 0
    if (n.delta > 0) {
      if (input.bucket === 'free') {
        await freeCreditUpsertStatement(DB, { userId: n.uid, amount: n.delta, bumpTotalCharged: input.bumpTotalCharged }).run()
        freeDelta = n.delta
      } else {
        await pointCreditUpsertStatement(DB, { userId: n.uid, delta: n.delta, bumpTotalCharged: input.bumpTotalCharged }).run()
      }
    } else if (input.guardBalance) {
      const abs = Math.abs(n.delta)
      // 💸 무상 우선 차감 — 사전 free 조회는 원장 free_delta 기록용 (잔액 정합은 아래 원자 UPDATE 가 보장).
      const freeBefore = await getFreeBefore(DB, n.uid)
      const r = await DB.prepare(
        `UPDATE user_points SET balance = balance - ?,
           free_balance = MAX(0, COALESCE(free_balance, 0) - ?),
           updated_at = datetime('now')
         WHERE user_id = ? AND balance >= ?`,
      ).bind(abs, abs, n.uid, abs).run()
      if (((r as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 0) {
        return { ok: false, reason: 'insufficient' }
      }
      freeDelta = -Math.min(freeBefore, abs)
    } else {
      const abs = Math.abs(n.delta)
      const freeBefore = await getFreeBefore(DB, n.uid)
      await DB.prepare(
        `INSERT INTO user_points (user_id, balance)
         VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           balance = balance + excluded.balance,
           free_balance = MAX(0, COALESCE(free_balance, 0) - ?),
           updated_at = datetime('now')`,
      ).bind(n.uid, n.delta, abs).run()
      freeDelta = -Math.min(freeBefore, abs)
    }
    await recordPointTransaction(DB, { ...input, freeDelta }) // fail-soft
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** 차감 직전 무상 잔액 (원장 split 기록용 — 행/컬럼 부재 → 0). */
async function getFreeBefore(DB: D1Database, uid: string): Promise<number> {
  try {
    const row = await DB.prepare('SELECT COALESCE(free_balance, 0) AS fb FROM user_points WHERE user_id = ?')
      .bind(uid).first<{ fb: number }>()
    const fb = Number(row?.fb ?? 0)
    return Number.isFinite(fb) && fb > 0 ? fb : 0
  } catch {
    return 0
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
    await DB.prepare("UPDATE user_points SET balance = 0, free_balance = 0, updated_at = datetime('now') WHERE user_id = ?")
      .bind(uid).run().catch(async () => {
        // free_balance 컬럼 부재 레거시 환경 폴백
        await DB.prepare("UPDATE user_points SET balance = 0, updated_at = datetime('now') WHERE user_id = ?")
          .bind(uid).run()
      })
    if (bal !== 0 && Number.isFinite(bal)) {
      await recordPointTransaction(DB, { userId: uid, delta: -bal, type, description })
    }
  } catch {
    /* fail-soft — 탈퇴 cleanup 흐름 보호 */
  }
}
