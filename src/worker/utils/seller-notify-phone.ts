/**
 * 📱 사장님에게 문자를 보낼 번호 — **한 곳에서 고른다** (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * 그동안 모든 사장님 알림톡이 `sellers.phone` 을 읽었다. 그런데 그 칸은 **매장 대표번호**다 —
 * 매장 등록 폼이 카카오 플레이스의 가게 전화(유선)를 거기 넣고, 사장님 휴대폰은
 * `seller_meta.manager_phone`(담당자 휴대폰)에 따로 넣는다. 알림톡 함수는 `^01` 이 아니면 조용히
 * 건너뛰므로, **라이브 13곳 중 12곳이 판매·사용·승인 알림을 한 번도 못 받고 있었다**(에러 0).
 *
 * ⇒ 담당자 휴대폰이 휴대폰 형식이면 그것, 아니면 매장 번호가 휴대폰일 때만 그것, 둘 다 아니면 null.
 *   유선 번호를 돌려주지 않는다 — 문자를 받을 수 없는 번호를 "있다" 고 하면 호출측이 성공으로 센다.
 */

const MOBILE = /^01\d{8,9}$/

/** 숫자만 남겨 휴대폰 형식이면 그 숫자열, 아니면 null. */
export function toMobile(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '')
  return MOBILE.test(digits) ? digits : null
}

/** 후보 중 처음 나오는 휴대폰. 순서가 곧 우선순위다(담당자 → 매장). */
export function pickNotifyPhone(managerPhone: unknown, storePhone: unknown): string | null {
  return toMobile(managerPhone) ?? toMobile(storePhone)
}

export interface SellerNotifyTarget {
  phone: string | null
  name: string | null
  businessName: string | null
  firstVoucherNotified: boolean
}

/** 매장 한 곳의 알림 대상. 매장이 없으면 null. 조회 실패도 null(알림이 본 흐름을 막지 않는다). */
export async function resolveSellerNotifyTarget(DB: D1Database, sellerId: unknown): Promise<SellerNotifyTarget | null> {
  const id = Number(sellerId)
  if (!Number.isFinite(id) || id <= 0) return null
  const row = await DB.prepare(
    `SELECT s.phone AS phone, s.name AS name, s.business_name AS business_name,
            COALESCE(s.first_voucher_notified, 0) AS notified,
            (SELECT m.value FROM seller_meta m WHERE m.seller_id = s.id AND m.key = 'manager_phone') AS manager_phone
       FROM sellers s WHERE s.id = ?`,
  ).bind(id).first<{ phone: string | null; name: string | null; business_name: string | null; notified: number; manager_phone: string | null }>()
    // seller_meta 가 아직 없는 환경이면 매장 번호만으로 — 담당자 번호가 없다고 알림 전체를 잃지 않는다.
    .catch(() => DB.prepare('SELECT phone, name, business_name, 0 AS notified, NULL AS manager_phone FROM sellers WHERE id = ?')
      .bind(id).first<{ phone: string | null; name: string | null; business_name: string | null; notified: number; manager_phone: string | null }>()
      .catch(() => null))
  if (!row) return null
  return {
    phone: pickNotifyPhone(row.manager_phone, row.phone),
    name: row.name ?? null,
    businessName: row.business_name ?? null,
    firstVoucherNotified: Number(row.notified) === 1,
  }
}
