/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 공유 타입.
 */

export interface MyCounts {
  wish: number | null
  coupon: number | null
  /** 이용권(매장 QR/PIN) 보유 장수 — 교환권은 gifticon 으로 따로 센다(2026-08-31 지갑 분리). */
  voucher: number | null
  gifticon: number | null
}
