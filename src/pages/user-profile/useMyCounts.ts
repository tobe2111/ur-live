/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 의 카운트 훅.
 *
 * 🛡️ 2026-05-27: 이전엔 `/api/vouchers/my` 를 별도로 호출했고, RQ cache 와 동기화 안 돼
 *   /user/profile 카운트와 /my-vouchers 목록이 어긋나는 사고 발생. useMyVouchers 로 통합.
 *
 * 🩸 2026-09-15: 그 통합이 **이용권에만** 적용돼 있었다. 위시리스트·쿠폰은 여기서 `api.get` 으로
 *   다시 받고 있어서 ① `/user/profile` 진입 때 `/api/wishlists` 가 **두 번** 나갔고(이 훅 +
 *   `useWishlist`, 실측 30ms 간격) ② 같은 값이 두 캐시에 따로 살아 /wishlist 목록과 어긋날
 *   수 있었다 — 2026-05-27 에 이용권에서 겪은 그 사고와 같은 구조다. 셋 다 RQ 훅으로 통일.
 *
 * ⚠️ **없음(0)과 모름(null)을 구분한다.** 아직 안 받았거나 못 받았으면 `null` → 배지 미표시.
 *   훅이 실패하면 `data` 가 `undefined` 로 오므로 그대로 null 이 된다(2026-07-02 규칙 승계 —
 *   네트워크 오류를 "0개"로 위장하지 않는다).
 */
import type { MyCounts } from './types'
import { useMyVouchers } from '@/hooks/queries'
import { useWishlist } from '@/hooks/queries/useWishlist'
import { useMyCoupons } from '@/hooks/queries/useMyCoupons'
import { isFailedGifticon, isGifticonVoucher, isStoreVoucher } from '@/shared/voucher-wallet'

export function useMyCounts(): MyCounts {
  const { data: vouchers } = useMyVouchers()
  const { data: wishlist } = useWishlist()
  const { data: coupons } = useMyCoupons()

  // 🎟️ 2026-08-31 (지갑 분리): 한 배열에 섞여 오는 것을 지갑별로 나눠 센다 — 마이의 두 행이
  //   각자 목적지(/my-vouchers · /my-gifticons)의 실제 개수와 일치해야 한다.
  // 🩸 2026-09-04 (대표 결정): 발송 실패분은 **안 센다** — 문자조차 못 받은 것을 "내 교환권 1" 로
  //   말하면 거짓이다. 카드는 지갑에 '발송 실패' 로 계속 보인다(숨기는 게 아니라 안 세는 것).
  return {
    wish: wishlist ? wishlist.length : null,
    coupon: coupons ? coupons.length : null,
    voucher: vouchers ? vouchers.filter(isStoreVoucher).length : null,
    gifticon: vouchers ? vouchers.filter(v => isGifticonVoucher(v) && !isFailedGifticon(v)).length : null,
  }
}
