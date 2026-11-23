/**
 * 📞 **전화 예약형 이용권** — 방문 계획(1단계) (2026-11-23 대표 *"응 다 해줘"*)
 *
 * 숙소·헬스·뷰티처럼 일정을 잡아야 가는 이용권의 흐름(대표가 영업에서 말한 그대로):
 *   구매(QR 발급) → **손님이 매장에 전화해 날짜를 정한다** → 현장에서 사장님이 QR 스캔 → 사용 시점 정산.
 * 유어딜은 빈자리를 알지 못하므로 자리를 약속하지 않는다 — 날짜는 **통화로 정하고 여기엔 적어만 둔다.**
 * 앱 안 예약 요청(11-04 확정 시안 `docs/design/voucher-booking-request-2026-11.md`)은 2단계다.
 *
 * ## 저장
 *   - 상품: `product_supply_meta.call_booking = '1'` (products 컬럼 추가 금지 — 예산제)
 *   - 이용권별 계획: `voucher_visit_plans` — 방문 날짜·시간(선택) + **손님 번호 공개 동의**
 *
 * ## 손님 번호 (대표 확정: 동의한 손님만 · 방문 다음 날까지만)
 * 동의는 **손님이 직접 켠 때만**(행이 없으면 비공개 — 기본 꺼짐). `phoneVisible` 이 유일한 판정이고
 * 사장님 목록은 그 판정을 통과한 행에만 번호를 싣는다. 사용 처리된 이용권은 목록에서 빠진다.
 *
 * ## 머니 경로
 * 없음. 결제·정산·환불은 그대로다(사용 시점 정산 · 못 가면 이용권은 남고 손님이 요청하면 환불 — 11-04 대표 확정).
 */
import type { D1Database } from '@cloudflare/workers-types'

export const CALL_BOOKING_META_KEY = 'call_booking'
/** 방문 날짜를 이만큼 뒤까지만 받는다(이용권 유효기간 12개월 + 여유). */
export const VISIT_DATE_MAX_DAYS = 400

export interface VisitPlan {
  voucherId: number
  visitDate: string | null
  visitTime: string | null
  sharePhone: boolean
  setBy: string | null
}

const _ensured = new WeakSet<object>()
export async function ensureVisitPlanTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS voucher_visit_plans (
    voucher_id INTEGER PRIMARY KEY,
    visit_date TEXT,
    visit_time TEXT,
    share_phone INTEGER NOT NULL DEFAULT 0,
    set_by TEXT,
    eve_notified_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_voucher_visit_plans_date ON voucher_visit_plans(visit_date)').run().catch(() => null)
}

/** KST 오늘(YYYY-MM-DD). */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
}
export function addDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`)
  return new Date(t + days * 86400_000).toISOString().slice(0, 10)
}

/** 날짜 검증 — 오늘 ~ 400일 뒤. 실패면 사람이 읽을 문장. */
export function visitDateError(raw: unknown, today: string = kstToday()): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return '날짜를 다시 골라 주세요'
  if (raw < today) return '지난 날짜는 고를 수 없어요'
  if (raw > addDays(today, VISIT_DATE_MAX_DAYS)) return '너무 먼 날짜예요'
  return null
}
export const isVisitTime = (raw: unknown): raw is string => typeof raw === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw)

/**
 * 손님 번호를 사장님에게 보여도 되나 — **동의 + 방문 다음 날까지**.
 * 날짜가 아직 없으면(통화 전) 동의만으로 보인다 — 그 통화를 하려고 켠 동의다.
 */
export function phoneVisible(plan: Pick<VisitPlan, 'sharePhone' | 'visitDate'> | null | undefined, today: string = kstToday()): boolean {
  if (!plan || !plan.sharePhone) return false
  if (!plan.visitDate) return true
  return today <= addDays(plan.visitDate, 1)
}

export async function isCallBookingProduct(DB: D1Database, productId: number): Promise<boolean> {
  const row = await DB.prepare('SELECT value FROM product_supply_meta WHERE product_id = ? AND key = ? LIMIT 1')
    .bind(productId, CALL_BOOKING_META_KEY).first<{ value: string | null }>().catch(() => null)
  return row?.value === '1'
}

export async function readVisitPlan(DB: D1Database, voucherId: number): Promise<VisitPlan | null> {
  await ensureVisitPlanTable(DB)
  const r = await DB.prepare('SELECT voucher_id, visit_date, visit_time, share_phone, set_by FROM voucher_visit_plans WHERE voucher_id = ?')
    .bind(voucherId).first<{ voucher_id: number; visit_date: string | null; visit_time: string | null; share_phone: number; set_by: string | null }>().catch(() => null)
  return r ? { voucherId: r.voucher_id, visitDate: r.visit_date, visitTime: r.visit_time, sharePhone: r.share_phone === 1, setBy: r.set_by } : null
}

/**
 * 부분 저장 — 넘긴 값만 바꾼다. 날짜가 바뀌면 전날 알림 표시를 지운다(새 날짜에 다시 알린다).
 * 사장님(`by:'seller'`)은 **동의를 못 바꾼다** — 호출부가 `sharePhone` 을 넘기지 않는다.
 */
export async function saveVisitPlan(
  DB: D1Database, voucherId: number,
  patch: { visitDate?: string | null; visitTime?: string | null; sharePhone?: boolean }, by: 'user' | 'seller',
): Promise<VisitPlan> {
  const cur = await readVisitPlan(DB, voucherId)
  const next: VisitPlan = {
    voucherId,
    visitDate: patch.visitDate !== undefined ? patch.visitDate : cur?.visitDate ?? null,
    visitTime: patch.visitTime !== undefined ? patch.visitTime : cur?.visitTime ?? null,
    sharePhone: patch.sharePhone !== undefined ? patch.sharePhone : cur?.sharePhone ?? false,
    setBy: patch.visitDate !== undefined || patch.visitTime !== undefined ? by : cur?.setBy ?? null,
  }
  const dateChanged = (cur?.visitDate ?? null) !== next.visitDate
  await DB.prepare(
    `INSERT INTO voucher_visit_plans (voucher_id, visit_date, visit_time, share_phone, set_by, eve_notified_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, datetime('now'))
     ON CONFLICT(voucher_id) DO UPDATE SET visit_date = excluded.visit_date, visit_time = excluded.visit_time,
       share_phone = excluded.share_phone, set_by = excluded.set_by,
       eve_notified_at = CASE WHEN ? = 1 THEN NULL ELSE voucher_visit_plans.eve_notified_at END,
       updated_at = datetime('now')`,
  ).bind(voucherId, next.visitDate, next.visitTime, next.sharePhone ? 1 : 0, next.setBy, dateChanged ? 1 : 0).run()
  return next
}

/** "11월 30일(토) 14:00" — 알림 문구용. */
export function visitWhenLabel(date: string, time: string | null): string {
  const d = new Date(`${date}T00:00:00Z`)
  const day = ['일', '월', '화', '수', '목', '금', '토'][d.getUTCDay()]
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${day})${time ? ` ${time}` : ''}`
}
