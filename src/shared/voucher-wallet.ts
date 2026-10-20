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
/** 판정에 실제로 쓰는 세 필드. 호출자마다 타입이 달라(느슨한 RQ 훅 타입 / 지갑 페이지 타입) unknown 으로 둔다. */
export interface VoucherWalletItem {
  source?: unknown
  deal_only?: unknown
  /** KT 원본 상태. 병합이 `status` 를 'unused' 로 눌러 담기 때문에 실패 판정은 이 필드로만 가능하다. */
  kt_status?: unknown
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

/**
 * 🩸 2026-09-04 (대표 — *"재발송은 안 해도 돼"* + 발송 실패분을 숫자에서 빼기로 결정):
 *   **문자조차 못 받은 교환권**인가.
 *
 * `/api/vouchers/my` 의 KT 병합은 발송 실패를 `status:'unused'` + `kt_status:'failed'` 로 실어 보낸다
 * (2026-06-17 — 카드가 실패 UI 를 그려 *"결제됐는데 안 왔다"* 를 알리라고). 그래서 `status` 만 보면
 * **실패한 것이 '사용 가능' 으로 세어진다** — 실제로 마이의 "이용권 현황"(#1345)과 교환권 지갑의
 * "사용 가능 N장"·상단 딜 합계가 전부 그렇게 세고 있었다.
 *
 * ⇒ **세지는 않되 숨기지도 않는다.** 카드는 '발송 실패' 그룹으로 계속 보이고(그래야 문의할 수 있다),
 *   개수·금액에서만 빠진다.
 */
export function isFailedGifticon(v: WalletItemLike): boolean {
  return (v as VoucherWalletItem).kt_status === 'failed'
}

/**
 * 🎟️ **지금 쓸 수 있는 발급분인가** — 지갑의 "사용 가능" 과 마이 상단 카운트의 **공통 기준**.
 *
 * ## 왜 생겼나 (2026-10-07 대표 신고 — *"이용권 2개라고 해서 들어갔더니 없어"*)
 * 마이 상단은 `이용권 2`, 들어간 지갑은 `사용 가능 0장`. **둘 다 맞는 숫자인데 세는 집합이
 * 달랐다** — 상단은 `isStoreVoucher` 로 **전부**(이미 다 쓴 것까지) 셌고, 지갑의 첫 탭은
 * `status === 'unused'` 만 센다. 대표 화면의 `이용권 현황`이 그대로 말해 줬다:
 * *구매완료 2 · 사용가능 0 · 사용완료 2*.
 *
 * 🩸 **같은 자리에서 두 번째다.** 2026-05-27 에 *"/user/profile 카운트 ↔ /my-vouchers 목록
 * 불일치"* 사고가 나서 잠금표에 올랐고, 그때 처방은 *"같은 훅(`useMyVouchers`)을 쓰라"* 였다.
 * 그런데 **훅이 같아도 세는 기준이 다르면 또 어긋난다** — 그게 이번이다.
 * ⇒ 처방을 한 칸 더 내린다: **같은 훅을 쓰는 것으로 부족하고, 같은 술어를 써야 한다.**
 *
 * 🔑 **상단 줄의 뜻은 "지금 쓸 수 있는 것"이다** — 그 줄은 `내 딜 / 이용권 / 교환권 / 쿠폰` 이고
 *   딜도 쿠폰도 *쓸 수 있는 양*을 센다. 이용권만 "평생 산 것" 을 세면 혼자 다른 말을 한다.
 *
 * ⚠️ 발송 실패한 교환권은 제외한다 — 문자조차 못 받은 것을 "쓸 수 있다" 고 셀 수 없다
 *   (2026-09-04 대표 결정, `isFailedGifticon` 주석).
 */
export function isUsableWalletItem(v: WalletItemLike): boolean {
  if (isFailedGifticon(v)) return false
  return (v as { status?: unknown }).status === 'unused'
}
