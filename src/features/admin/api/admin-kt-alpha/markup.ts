/**
 * 💰 KT-Alpha 교환권 **소비자 마진율 SSOT** (2026-09-02 대표 "교환권도 제 가격으로 안 되어 있어").
 *
 * ## 무엇이 잘못돼 있었나
 * 소비자 판매가 = `real_price × (1 + kt_alpha_consumer_markup_pct/100)`. 설정값은 2026-08-26 부터 **20** 이라
 * 라이브 교환권 2,260개가 액면가의 1.19배(최대 1.20)로 팔리고 있었다(D1 실측). 그런데 그걸 끄려고 어드민에서
 * 0 을 넣어도 **`Number(value) || 20`** 이 0 을 거짓으로 삼켜 도로 20% 가 됐다 — 세 곳(가져오기·재계산·표시)이
 * 같은 식이라 어드민 화면으로는 0% 를 만들 방법이 없었다.
 *
 * ⇒ 한 함수로: 설정이 **없거나 숫자가 아닐 때만** 기본 20, `0` 은 0 이다(0~100 클램프).
 * ⚠️ 이 값은 가격에 직접 곱해진다(머니 경로 표시값). 기본값을 바꾸려면 대표 확인 후.
 */
export const KT_CONSUMER_MARKUP_DEFAULT_PCT = 20

export function resolveKtConsumerMarkupPct(raw: unknown): number {
  if (raw === null || raw === undefined) return KT_CONSUMER_MARKUP_DEFAULT_PCT
  const s = String(raw).trim()
  if (s === '') return KT_CONSUMER_MARKUP_DEFAULT_PCT
  const n = Number(s)
  if (!Number.isFinite(n)) return KT_CONSUMER_MARKUP_DEFAULT_PCT
  return Math.min(100, Math.max(0, n))
}

/**
 * 🧑‍💼 **셀러 축 마진율** — 위와 같은 함정, 다른 기본값(5).
 *
 * 2026-09-02 에 소비자 축만 고치고 셀러 축 두 자리(`seller-settlements.routes.ts` 354·437)는
 * `Number(...) || 5` 로 남았다. 당시 라이브 값이 `5` 라 **영향이 0 이어서 눈에 안 띄었다** —
 * 그게 이 결함의 성질이다. 어드민에서 0 을 저장하면 저장은 되고(`Number.isFinite` 검증)
 * 읽는 쪽이 5 로 되돌린다. 에러가 없어 "슬라이더를 0 으로 내렸는데 가격이 그대로"로만 보인다.
 *
 * ⚠️ 현재 값(5)에서는 이 함수와 옛 `|| 5` 의 결과가 **같다**. 달라지는 것은 0 을 넣었을 때뿐이다.
 */
export const KT_SELLER_MARKUP_DEFAULT_PCT = 5

export function resolveKtSellerMarkupPct(raw: unknown): number {
  if (raw === null || raw === undefined) return KT_SELLER_MARKUP_DEFAULT_PCT
  const s = String(raw).trim()
  if (s === '') return KT_SELLER_MARKUP_DEFAULT_PCT
  const n = Number(s)
  if (!Number.isFinite(n)) return KT_SELLER_MARKUP_DEFAULT_PCT
  return Math.min(100, Math.max(0, n))
}
