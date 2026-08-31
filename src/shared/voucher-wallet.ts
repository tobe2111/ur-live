/**
 * 🎟️ 2026-08-31 (대표 지시 — "교환권은 교환권 페이지에서 보고, 이용권은 이용권 페이지에서"):
 *   지갑 분리 SSOT.
 *
 * 배경: `/api/vouchers/my` 는 두 상품축을 **한 배열**로 돌려준다 —
 *   ① 내부 이용권(`vouchers` 테이블, 매장 QR/PIN) ② KT-Alpha 교환권(`voucher_orders`, 문자 발송).
 *   그동안 한 페이지(`/my-vouchers`)가 둘을 세그먼트 탭으로 얹어 보여 줬는데, 교환권을 산 사람이
 *   '이용권' 탭에서 자기 기프티콘을 찾아야 했다(구매 흐름과 보관 위치가 어긋남).
 *   이제 화면이 둘로 갈라지므로 **어느 지갑에 놓을지는 여기서만 판정**한다.
 *
 * 판정: 교환권 = KT 발송분(`source='kt_alpha'`) **또는** 딜 전용 상품(`deal_only=1`) 발급분.
 *   - `deal_only=1` 은 결제 흐름 SSOT(`src/shared/product-flow.ts` `getProductFlow`)가 교환권을
 *     정의하는 바로 그 기준이라, 두 기준을 맞춰 두면 "딜로 샀는데 이용권 지갑에 있다"가 구조적으로 안 난다.
 *   - 라이브 실측(2026-08-31): `deal_only=1` 상품 2,260개가 **전부** KT 교환권이고 그 반대도 참 →
 *     오늘은 두 조건이 정확히 일치한다. `deal_only` 는 컬럼 누락 환경의 폴백 SELECT 에선 안 오므로
 *     (`group-buy-public.routes.ts /my`), 없으면 `source` 만으로 판정한다.
 *
 * ⚠️ 카테고리로 판정하지 말 것 — `meal_voucher` 는 **이용권**(카드 결제)이다.
 *    (`scripts/check-payment-flow-ssot.mjs` 가 지키는 그 혼동.)
 */
/** 판정에 실제로 쓰는 두 필드. 호출자마다 타입이 달라(느슨한 RQ 훅 타입 / 지갑 페이지 타입) unknown 으로 둔다. */
export interface VoucherWalletItem {
  source?: unknown
  deal_only?: unknown
}

/** 인덱스 시그니처만 가진 느슨한 레코드(`useMyVouchers` 의 MyVoucher)도 그대로 받기 위한 입력 타입. */
type WalletItemLike = VoucherWalletItem | Readonly<Record<string, unknown>>

/** 이 발급분이 '교환권 지갑'(`/my-gifticons`)에 놓일 것인가. false 면 이용권 지갑(`/my-vouchers`). */
export function isGifticonVoucher(v: WalletItemLike): boolean {
  const item = v as VoucherWalletItem
  if (item.source === 'kt_alpha') return true
  return Number(item.deal_only ?? 0) === 1
}

/** 반대편 — 이용권 지갑(`/my-vouchers`)에 놓일 것인가. */
export function isStoreVoucher(v: WalletItemLike): boolean {
  return !isGifticonVoucher(v)
}
