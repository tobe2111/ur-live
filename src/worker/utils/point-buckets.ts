/**
 * 💸 2026-07-05 딜 포인트 유상/무상 이중 버킷 SSOT (약관 "무상 딜 우선 차감·무상 딜 환급 제외" 시스템 강제).
 *
 * 모델:
 *   - user_points.balance      = 총 잔액 (기존 — 모든 기존 리더 무영향)
 *   - user_points.free_balance = 무상(리워드·이벤트·초대 등) 잔액. 불변식: 0 ≤ free_balance ≤ balance
 *   - 유상(paid) 잔액 = balance - free_balance (파생값 — 별도 컬럼 없음)
 *   - point_transactions.free_delta = 해당 거래가 무상 버킷에 적용된 부분(적립 +, 차감 -). audit + 환불 대칭 복원용.
 *
 * 규칙 (CLAUDE.md 머니 룰과 동일 철학):
 *   1. 적립: 충전/커미션(추천·어필리에이트 수익 = 출금 가능한 소득) → paid(기본, free 무변경).
 *      프로모션 리워드(가입/초대/광고/리뷰/이벤트/방문 리워드) → free (`creditFreePoints` 또는 free 절 추가).
 *   2. 차감(소비): 항상 free 우선 소진 — `free_balance = MAX(0, COALESCE(free_balance,0) - ?)` 를
 *      기존 balance 차감 UPDATE 에 같은 문장으로 추가(원자·CAS 가드 불변).
 *   3. 출금(현금 환급): 유상 한도 — WHERE `(balance - COALESCE(free_balance,0)) >= ?` (free 무변경).
 *   4. 환불(소비 역전): 원거래에서 무상으로 차감된 만큼 무상으로 복원 — 원장(free_delta)을 ref(order_id)로
 *      역산(`refundDealPoints`). ref 미보유 레거시는 paid 복원(free_delta 기록이 없으면 무상 차감분도 0).
 *   5. 무상 적립의 회수(리워드 역전)는 free 에서 회수 (`free_balance = MAX(0, ... - ?)`).
 *
 * ⚠️ 이 파일은 ensure-tables.ts 를 import 하지 않는다 (ensurePointsTables 가 이쪽을 부르는 단방향).
 */

import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'

/** 출금 가드 등에서 쓰는 유상 잔액 SQL 식 (컬럼 부재 환경 방어 COALESCE). */
export const PAID_BALANCE_SQL = '(balance - COALESCE(free_balance, 0))'

// per-isolate 메모이즈 (핸들러 안 inline ALTER 금지 룰 — ensureXxx + WeakSet 패턴)
const _done_ensureDealBuckets = new WeakSet<D1Database>()

/**
 * user_points.free_balance / point_transactions.free_delta 컬럼 보장 (멱등).
 * repair-schema 에도 동일 ALTER 등록 — 이 함수는 콜드 배포 직후 첫 호출 방어용.
 */
export async function ensureDealBuckets(DB: D1Database): Promise<void> {
  if (_done_ensureDealBuckets.has(DB)) return
  _done_ensureDealBuckets.add(DB)
  try {
    await DB.prepare('ALTER TABLE user_points ADD COLUMN free_balance INTEGER NOT NULL DEFAULT 0').run()
  } catch { /* duplicate column / table 부재 — base CREATE(ensure-tables)가 커버 */ }
  try {
    await DB.prepare('ALTER TABLE point_transactions ADD COLUMN free_delta INTEGER DEFAULT 0').run()
  } catch { /* duplicate column — fine */ }
}

/** 현재 무상 잔액 조회 (행/컬럼 부재 → 0). */
export async function getFreeBalance(DB: D1Database, userId: string | number): Promise<number> {
  try {
    const row = await DB.prepare('SELECT COALESCE(free_balance, 0) AS fb FROM user_points WHERE user_id = ?')
      .bind(String(userId)).first<{ fb: number }>()
    const fb = Number(row?.fb ?? 0)
    return Number.isFinite(fb) && fb > 0 ? fb : 0
  } catch {
    return 0
  }
}

/**
 * 무상 적립 UPSERT 준비문 (balance 와 free_balance 동시 증가).
 * DB.batch 합류용 — point-ledger 의 pointCreditUpsertStatement(paid) 와 대칭.
 */
export function freeCreditUpsertStatement(
  DB: D1Database,
  input: { userId: string | number; amount: number; bumpTotalCharged?: boolean },
): D1PreparedStatement {
  const uid = String(input.userId)
  const amount = Math.round(input.amount)
  const charged = input.bumpTotalCharged ? amount : 0
  return DB.prepare(
    `INSERT INTO user_points (user_id, balance, free_balance, total_charged)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       balance = balance + excluded.balance,
       free_balance = COALESCE(free_balance, 0) + excluded.free_balance,
       total_charged = total_charged + excluded.total_charged,
       updated_at = datetime('now')`,
  ).bind(uid, amount, amount, charged)
}

/**
 * 환불(소비 역전) 복원 준비문 — balance 는 전액, free 는 산출된 무상분만 복원.
 * DB.batch 컨텍스트(disputes/appointments)용으로 statement 분리 제공.
 */
export function bucketRestoreUpsertStatement(
  DB: D1Database,
  input: { userId: string | number; amount: number; freePortion: number },
): D1PreparedStatement {
  const uid = String(input.userId)
  const amount = Math.round(input.amount)
  const free = Math.min(Math.max(0, Math.round(input.freePortion)), amount)
  return DB.prepare(
    `INSERT INTO user_points (user_id, balance, free_balance)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       balance = balance + excluded.balance,
       free_balance = COALESCE(free_balance, 0) + excluded.free_balance,
       updated_at = datetime('now')`,
  ).bind(uid, amount, free)
}

/**
 * ref(point_transactions.order_id)로 "원거래에서 무상으로 차감됐고 아직 복원 안 된" 금액 역산.
 *   무상 차감 누계(free_delta < 0) - 무상 복원 누계(free_delta > 0), refundAmount 로 clamp.
 * 원장이 없거나(레거시) 컬럼 부재면 0 → paid 복원 (무상 세탁 방지 방향으로 안전).
 */
export async function computeFreeRestorePortion(
  DB: D1Database,
  ref: string | null | undefined | Array<string | null | undefined>,
  refundAmount: number,
  /** ref 가 여러 유저를 묶는 공유 키(예: cgb:{groupId})일 수 있어 항상 유저로 한정 (타 유저 무상분 오염 방지). */
  userId?: string | number | null,
): Promise<number> {
  const refs = (Array.isArray(ref) ? ref : [ref])
    .filter((r): r is string => r != null && String(r).length > 0)
    .map(String)
  if (refs.length === 0 || !Number.isFinite(refundAmount) || refundAmount <= 0) return 0
  try {
    const placeholders = refs.map(() => '?').join(', ')
    const userClause = userId != null ? ' AND user_id = ?' : ''
    const binds: string[] = [...refs]
    if (userId != null) binds.push(String(userId))
    const row = await DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN COALESCE(free_delta, 0) < 0 THEN -free_delta ELSE 0 END), 0) AS spent,
         COALESCE(SUM(CASE WHEN COALESCE(free_delta, 0) > 0 THEN free_delta ELSE 0 END), 0) AS restored
       FROM point_transactions WHERE order_id IN (${placeholders})${userClause}`,
    ).bind(...binds).first<{ spent: number; restored: number }>()
    const outstanding = Math.max(0, Number(row?.spent ?? 0) - Number(row?.restored ?? 0))
    return Math.min(Math.round(refundAmount), outstanding)
  } catch {
    return 0
  }
}

export interface RefundDealPointsInput {
  userId: string | number
  amount: number
  /** 원거래 원장 매칭 키 (point_transactions.order_id — 단일 또는 후보 복수). 없으면 paid 복원. */
  ref?: string | null | Array<string | null | undefined>
  type?: string
  description?: string | null
}

/**
 * 딜 소비 환불 SSOT — 버킷 대칭 복원 + 원장 기록(free_delta) 한 번에.
 * fail-soft 아님: 잔액 복원 실패는 false 반환 (호출자 기존 에러 처리 유지). 원장 기록만 fail-soft.
 */
export async function refundDealPoints(
  DB: D1Database,
  input: RefundDealPointsInput,
): Promise<{ ok: boolean; freePortion: number }> {
  const uid = String(input.userId ?? '')
  const amount = Math.round(Number(input.amount))
  if (!uid || !Number.isFinite(amount) || amount <= 0) return { ok: false, freePortion: 0 }
  await ensureDealBuckets(DB)
  const freePortion = await computeFreeRestorePortion(DB, input.ref, amount, uid)
  const primaryRef = (Array.isArray(input.ref) ? input.ref.find((r) => r != null && String(r).length > 0) : input.ref) ?? null
  try {
    await bucketRestoreUpsertStatement(DB, { userId: uid, amount, freePortion }).run()
  } catch {
    return { ok: false, freePortion }
  }
  try {
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id, free_delta)
       VALUES (?, ?, ?, ?, COALESCE((SELECT balance FROM user_points WHERE user_id = ?), 0), ?, ?, ?)`,
    ).bind(
      uid,
      String(input.type || 'refund').slice(0, 50),
      amount,
      amount,
      uid,
      input.description ? String(input.description).slice(0, 300) : null,
      primaryRef != null ? String(primaryRef) : null,
      freePortion,
    ).run()
  } catch { /* 원장은 audit — 잔액 복원은 이미 완료 */ }
  return { ok: true, freePortion }
}

export interface CreditFreePointsInput {
  userId: string | number
  amount: number
  type: string
  description?: string | null
  orderId?: string | null
  bumpTotalCharged?: boolean
}

/**
 * 무상 딜 적립 SSOT — free 버킷 적립 + 원장(free_delta=+amount) 기록.
 * 멱등은 호출자 책임 (기존 point-ledger 관례와 동일).
 */
export async function creditFreePoints(
  DB: D1Database,
  input: CreditFreePointsInput,
): Promise<boolean> {
  const uid = String(input.userId ?? '')
  const amount = Math.round(Number(input.amount))
  if (!uid || !Number.isFinite(amount) || amount <= 0 || !input.type) return false
  await ensureDealBuckets(DB)
  try {
    await freeCreditUpsertStatement(DB, { userId: uid, amount, bumpTotalCharged: input.bumpTotalCharged }).run()
  } catch {
    return false
  }
  try {
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id, free_delta)
       VALUES (?, ?, ?, ?, COALESCE((SELECT balance FROM user_points WHERE user_id = ?), 0), ?, ?, ?)`,
    ).bind(
      uid,
      String(input.type).slice(0, 50),
      amount,
      amount,
      uid,
      input.description ? String(input.description).slice(0, 300) : null,
      input.orderId != null ? String(input.orderId) : null,
      amount,
    ).run()
  } catch { /* audit fail-soft */ }
  return true
}
