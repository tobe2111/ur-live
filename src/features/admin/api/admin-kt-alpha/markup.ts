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
