/**
 * 🏡 숙소를 이용권과 같은 뼈대로 — 산 뒤의 처리(기록·지갑 QR·사용 처리·정산 원장·환불)를 하나로.
 *
 * ## 왜 (2026-10-25 대표 *"1번. 지금 이게 숙소랑 다른 이용권이랑 좀 로직이 다른 것 같은데 통일하는게
 *   낫지 않아? 굳이 분리를 할 이유가 있나? 물론 객실같은 옵션, 날짜 선택이 필요는 하겠지만.."* →
 *   *"숙소를 이용권 방식으로 합치는 안으로 진행하자. 끝까지."*)
 * 숙소는 `stay_bookings` 하나로 기록·코드·사용·취소를 따로 하고 있었고, 그래서
 *   ① '내 이용권' 지갑에 안 뜨고 QR 도 없었다 ② 사장님이 손으로 체크인했다
 *   ③ **사용 순간 정산 원장 기록이 없었다**(이용권은 `recordVoucherUsedLedger` 가 남긴다 —
 *      쇼핑 원장은 이용권 카테고리를 건너뛰므로 숙소 매출이 자동 정산에서 빠진다).
 * 분리할 이유가 있는 것은 **사기 전** 둘뿐이다 — 객실·날짜 고르기, 남은 방(달력). 그 둘은
 * 숙소 쪽에 그대로 두고, **결제가 확정되면 이용권 행을 하나 더 만든다**(`vouchers.stay_booking_id`).
 * 그러면 지갑·QR·스캔·원장은 이용권 경로가 그대로 맡는다. 이 파일은 그 이음매다.
 *
 * ## 게이트
 * `platform_settings.stay_voucher_unify_enabled === 'true'` 일 때만 **새로 발급**한다(기본 OFF).
 * 이미 발급된 숙소 이용권에 대한 판정(사용 조건·취소 동기화)은 게이트와 **무관하게** 돈다 —
 * 게이트를 끈 뒤에도 지갑에 남은 이용권이 숙소 규칙을 우회하면 안 되기 때문이다.
 *
 * ## 불변식
 * - 숙소 이용권은 **숙소 취소 경로로만** 환불된다(날짜별 환불율 + 달력 풀기). 이용권 셀프 취소는 거절.
 * - 숙소 이용권은 **사장님 스캔으로만** 쓴다(손님 셀프·매장 확인코드 거절) — 체크인은 사람이 본다.
 * - 날짜 예약은 체크인 날 ~ 체크아웃 전날(한국 날짜)에만 쓸 수 있다.
 * - 취소와 사용이 겹치면 **이용권 CAS 가 먼저 이긴 쪽**이 이긴다(취소가 먼저 이용권을 잡는다).
 */

import { generateUniqueVoucherCodes } from './helpers'

export const STAY_VOUCHER_UNIFY_KEY = 'stay_voucher_unify_enabled'

export const STAY_VOUCHER_SELF_USE_BLOCKED = '숙소 이용권은 체크인할 때 숙소 직원이 QR 을 스캔해 처리해요'
export const STAY_VOUCHER_CANCEL_ELSEWHERE = '숙소 이용권은 내 숙소에서 예약 취소로 환불돼요'

const colReady = new WeakSet<object>()

/** `vouchers.stay_booking_id` + 예약당 1장 UNIQUE. 요청마다 DDL 을 돌리지 않게 D1 당 1회. */
export async function ensureStayVoucherColumn(DB: D1Database): Promise<void> {
  if (colReady.has(DB as unknown as object)) return
  try { await DB.prepare('ALTER TABLE vouchers ADD COLUMN stay_booking_id INTEGER').run() } catch { /* 이미 있다 */ }
  try {
    await DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_stay_booking_unique ON vouchers(stay_booking_id) WHERE stay_booking_id IS NOT NULL',
    ).run()
  } catch { /* best-effort */ }
  colReady.add(DB as unknown as object)
}

export async function stayVoucherUnifyEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(STAY_VOUCHER_UNIFY_KEY).first<{ value: string | null }>()
    return String(row?.value ?? '').trim() === 'true'
  } catch { return false }
}

/** 한국 날짜 YYYY-MM-DD. 워커는 UTC 라 `toISOString()` 을 그대로 쓰면 0~9시에 어제가 된다. */
export function kstToday(now: number = Date.now()): string {
  return new Date(now + 9 * 3600000).toISOString().slice(0, 10)
}

export function addDays(ymd: string, n: number): string {
  const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

/** 이용권 만료 시각 — 날짜 예약은 체크아웃 날 끝(한국 23:59:59 = UTC 14:59:59), 숙박권은 예약의 만료. */
export function stayVoucherExpiresAt(b: { sale_mode: string | null; check_out_date: string | null; voucher_expires_at: string | null }): string | null {
  if (b.sale_mode === 'voucher') return b.voucher_expires_at || null
  if (b.check_out_date && /^\d{4}-\d{2}-\d{2}$/.test(b.check_out_date)) return `${b.check_out_date} 14:59:59`
  return null
}

export interface StayBookingForVoucher {
  id: number
  product_id: number | null
  user_id: number | string
  total_amount: number | null
  sale_mode: string | null
  check_out_date: string | null
  voucher_expires_at: string | null
}

/**
 * 결제 확정된 예약마다 이용권 1장(멱등 — 예약당 UNIQUE + INSERT OR IGNORE).
 * 게이트가 꺼져 있으면 아무것도 안 한다. 실패는 삼킨다 — 결제 확정을 되돌리지 않는다
 * (그때는 종전처럼 숙소 코드로 수동 체크인된다).
 */
export async function issueStayVouchers(
  DB: D1Database,
  opts: { orderId: number; userId: number | string; bookingIds: number[] },
): Promise<number> {
  if (!opts.bookingIds.length) return 0
  if (!(await stayVoucherUnifyEnabled(DB))) return 0
  try {
    await ensureStayVoucherColumn(DB)
    const marks = opts.bookingIds.map(() => '?').join(',')
    const rows = await DB.prepare(
      `SELECT id, product_id, user_id, total_amount, sale_mode, check_out_date, voucher_expires_at
         FROM stay_bookings WHERE id IN (${marks}) AND status = 'confirmed'`,
    ).bind(...opts.bookingIds).all<StayBookingForVoucher>()
    const list = (rows.results || []).filter((b) => b.product_id)
    if (!list.length) return 0
    const codes = await generateUniqueVoucherCodes(DB, list.length)
    const res = await DB.batch(list.map((b, i) => DB.prepare(
      `INSERT OR IGNORE INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price, stay_booking_id)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    ).bind(opts.orderId, b.product_id, String(opts.userId), codes[i], stayVoucherExpiresAt(b), Math.max(0, Number(b.total_amount) || 0), b.id)))
    return res.reduce((n, r) => n + (r.meta?.changes ?? 0), 0)
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[stay-voucher] issue failed', e)
    return 0
  }
}

export interface StayVoucherLink {
  booking_id: number
  status: string
  sale_mode: string | null
  check_in_date: string | null
  check_out_date: string | null
  nights: number | null
}

/** 이 이용권이 숙소 예약에 묶여 있으면 그 예약. 컬럼이 아직 없으면(옛 DB) null. */
export async function stayLinkForVoucher(DB: D1Database, by: { id?: number; code?: string }): Promise<StayVoucherLink | null> {
  try {
    const where = by.id != null ? 'v.id = ?' : 'v.code = ?'
    const row = await DB.prepare(
      `SELECT b.id AS booking_id, b.status, b.sale_mode, b.check_in_date, b.check_out_date, b.nights
         FROM vouchers v JOIN stay_bookings b ON b.id = v.stay_booking_id
        WHERE ${where} AND v.stay_booking_id IS NOT NULL`,
    ).bind(by.id != null ? by.id : by.code).first<StayVoucherLink>()
    return row || null
  } catch { return null }
}

/**
 * 사장님 스캔 **전** 검사. null = 쓸 수 있다, 문자열 = 거절 사유.
 * `afterManual` 은 사장님이 숙소 관리 화면에서 이미 체크인을 누른 뒤 같은 이용권을 정리하는 경우다.
 */
export function stayRedeemBlock(link: StayVoucherLink, opts: { today?: string; afterManual?: boolean } = {}): string | null {
  const okStatus = opts.afterManual ? ['confirmed', 'checked_in', 'checked_out'] : ['confirmed']
  if (!okStatus.includes(link.status)) {
    if (link.status === 'checked_in' || link.status === 'checked_out') return '이미 체크인된 예약이에요'
    return '취소되었거나 확정되지 않은 예약이에요'
  }
  if (opts.afterManual || link.sale_mode === 'voucher') return null
  const today = opts.today || kstToday()
  if (link.check_in_date && today < link.check_in_date) return `체크인 날짜(${link.check_in_date})부터 쓸 수 있어요`
  if (link.check_out_date && today >= link.check_out_date) return '체크아웃 날짜가 지난 예약이에요'
  return null
}

/**
 * 이용권 사용이 끝난 뒤 예약을 체크인으로 옮긴다(이미 옮겨졌으면 no-op — CAS).
 * 날짜 예약: confirmed → checked_in. 숙박권: 오늘부터 1박을 쓴 것으로 적고 checked_out
 * (종전 사장님 수동 처리 `use-voucher` 와 같은 끝 상태).
 */
export async function markStayBookingUsed(DB: D1Database, link: StayVoucherLink, actorSellerId: number | null, today: string = kstToday()): Promise<void> {
  try {
    const res = link.sale_mode === 'voucher'
      ? await DB.prepare(
        `UPDATE stay_bookings
            SET voucher_used_at = datetime('now'), voucher_used_check_in = ?, voucher_used_check_out = ?,
                status = 'checked_out', checked_in_at = COALESCE(checked_in_at, datetime('now')),
                checked_in_by = COALESCE(checked_in_by, ?), checked_out_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ? AND status = 'confirmed' AND voucher_used_at IS NULL`,
      ).bind(today, addDays(today, Math.max(1, Number(link.nights) || 1)), actorSellerId, link.booking_id).run()
      : await DB.prepare(
        `UPDATE stay_bookings SET status = 'checked_in', checked_in_at = datetime('now'),
                checked_in_by = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'confirmed'`,
      ).bind(actorSellerId, link.booking_id).run()
    if ((res.meta?.changes ?? 0) > 0) {
      await DB.prepare(
        `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, changed_by_id, reason)
         VALUES (?, 'confirmed', ?, 'seller', ?, '이용권 QR 스캔')`,
      ).bind(link.booking_id, link.sale_mode === 'voucher' ? 'checked_out' : 'checked_in', actorSellerId).run().catch(() => { /* noop */ })
    }
  } catch (e) { if (import.meta.env?.DEV) console.warn('[stay-voucher] mark used failed', e) }
}

/**
 * 숙소 취소가 이용권을 **먼저** 잡는다(unused → refunded). 반환:
 *   'none'  — 묶인 이용권 없음(종전 예약 · 게이트 OFF 때 발급분) → 취소 계속
 *   'held'  — 잡았다 → 취소 계속, 실패하면 `releaseStayVoucherHold` 로 되돌린다
 *   'used'  — 이미 썼다(사장님이 스캔함) → 취소 거절
 *   'gone'  — 이미 환불 상태(앞선 취소가 잡았다) → 예약 CAS 가 409 를 낸다. **되돌리지 않는다**
 *             (되돌리면 취소된 예약의 이용권이 다시 쓸 수 있게 살아난다).
 */
export async function holdStayVoucherForCancel(DB: D1Database, bookingId: number): Promise<'none' | 'held' | 'used' | 'gone'> {
  try {
    const v = await DB.prepare('SELECT id, status FROM vouchers WHERE stay_booking_id = ?')
      .bind(bookingId).first<{ id: number; status: string }>()
    if (!v) return 'none'
    const claim = await DB.prepare(
      "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status IN ('unused', 'expired')",
    ).bind(v.id).run()
    if ((claim.meta?.changes ?? 0) > 0) return 'held'
    const now = await DB.prepare('SELECT status FROM vouchers WHERE id = ?').bind(v.id).first<{ status: string }>()
    return now?.status === 'used' ? 'used' : 'gone'
  } catch { return 'none' }
}

export async function releaseStayVoucherHold(DB: D1Database, bookingId: number): Promise<void> {
  try {
    await DB.prepare("UPDATE vouchers SET status = 'unused' WHERE stay_booking_id = ? AND status = 'refunded'").bind(bookingId).run()
  } catch { /* noop */ }
}

/**
 * 사장님이 숙소 관리 화면에서 직접 체크인·숙박권 사용을 눌렀을 때 — 묶인 이용권도 같은 순간 사용 처리한다.
 * 안 하면 ① 지갑에 이용권이 '사용 가능'으로 남아 다시 스캔될 수 있고 ② 원장이 안 남는다(정산 구멍).
 * 사용 처리는 스캔과 **같은 함수**(redeemVoucherForStore)를 지나 원장도 그 경로가 남긴다.
 */
export async function settleStayVoucherAfterManual(
  DB: D1Database,
  opts: { bookingId: number; sellerId: number; waitUntil: (p: Promise<unknown>) => void },
): Promise<void> {
  try {
    const v = await DB.prepare("SELECT code FROM vouchers WHERE stay_booking_id = ? AND status = 'unused'")
      .bind(opts.bookingId).first<{ code: string }>()
    if (!v?.code) return
    const { redeemVoucherForStore } = await import('../../../worker/utils/voucher-seller-redeem')
    await redeemVoucherForStore(DB, {
      code: v.code, actorSellerId: opts.sellerId, path: 'seller_scan', waitUntil: opts.waitUntil, stayAfterManual: true,
    })
  } catch (e) { if (import.meta.env?.DEV) console.warn('[stay-voucher] manual settle failed', e) }
}
