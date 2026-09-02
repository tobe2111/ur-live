/**
 * 🎁 KT-Alpha 교환권 소비자 마진 해석 SSOT.
 *
 * 배경 (2026-08-31 대표 지시 "원가로 되돌려줘. 다 정가로"):
 *   교환권 소비자 판매가 = `gift_catalog.real_price × (1 + kt_alpha_consumer_markup_pct/100)`.
 *   마진을 **0%** 로 두려 했는데 되지 않았다. 세 자리가 전부 `Number(x) || 20` 이라
 *   **`0` 이 falsy 라서 기본값 20 으로 튕겼다**:
 *     · `admin-kt-alpha/settings.ts` 재계산  → 0 을 저장해도 20% 로 재계산
 *     · `admin-kt-alpha/catalog.ts` 상품 담기 → 새로 담는 상품에도 20% 가 붙음
 *     · `AdminKtAlphaPage.tsx` 화면          → 0 인데 20 으로 표시
 *   저장(PATCH)은 `Number.isFinite` 라 0 을 통과시킨다. 즉 **저장은 되는데 아무도 안 읽는**
 *   조용한 실패였다. 에러가 없어서 "슬라이더를 0으로 내렸는데 가격이 그대로"로만 보인다.
 *
 * ⚠️ 이건 이 레포가 반복해 당한 클래스다 — CLAUDE.md 의 pagination 룰이 같은 이유로
 *   `parseInt(...) || N` 을 금지한다("0 을 삼켜 min-클램프를 깬다"). 여기선 요청 파라미터가
 *   아니라 **설정값**이라 `intParam` 이 안 맞아 별도 SSOT 로 둔다.
 *
 * 실측 근거 (2026-08-31 라이브): 활성 교환권 2,260개 중 **2,257개가 정가보다 비쌌다**.
 *   KT 가 주는 할인은 2,065개가 0%, 195개만 평균 9.5% → 마진 20% 는 사실상 전부
 *   소비자 가격 인상이었다(5,000원 쿠팡캐시 교환권이 6,000딜).
 */

/** 마진 미설정/오염 시의 기본값. 과거 동작과 동일 — 바꾸면 라이브 가격이 움직인다. */
export const KT_CONSUMER_MARKUP_DEFAULT_PCT = 20
/** 셀러 축(`kt_alpha_markup_pct`) 기본값. 소비자 축과 **다른 설정**이다. */
export const KT_SELLER_MARKUP_DEFAULT_PCT = 5

/** 마진 허용 범위 (PATCH 검증과 동일 규약). */
export const KT_CONSUMER_MARKUP_MIN_PCT = 0
export const KT_CONSUMER_MARKUP_MAX_PCT = 100

/**
 * 저장된 설정값(문자열 · 숫자 · null · undefined)을 실제로 쓸 마진 %로 해석한다.
 *
 * - **`0` 은 유효한 값이다** — 원가 판매(정가)를 뜻하며 기본값으로 튕기지 않는다.
 * - 숫자가 아니거나 비어 있으면 `defaultPct`.
 * - 범위 밖은 clamp (음수 → 0, 100 초과 → 100).
 */
export function resolveMarkupPct(raw: unknown, defaultPct: number): number {
  if (raw === null || raw === undefined || raw === '') return defaultPct
  const n = Number(raw)
  if (!Number.isFinite(n)) return defaultPct
  return Math.min(KT_CONSUMER_MARKUP_MAX_PCT, Math.max(KT_CONSUMER_MARKUP_MIN_PCT, n))
}

/** 소비자 직판 마진 (`kt_alpha_consumer_markup_pct`, 기본 20%). */
export function resolveConsumerMarkupPct(raw: unknown): number {
  return resolveMarkupPct(raw, KT_CONSUMER_MARKUP_DEFAULT_PCT)
}

/**
 * 셀러 발송 차감 마진 (`kt_alpha_markup_pct`, 기본 5%). 소비자 축과 **별개 설정**이다.
 *
 * ⚠️ **아직 배선 안 됨.** `seller-settlements.routes.ts` 에도 같은 `Number(x) || 5` 결함이
 *   있지만(0 을 삼킨다), 그 파일이 파일크기 래칫 baseline(1,076줄)에 걸려 있어 임포트 한 줄도
 *   못 늘린다. 처방은 리베이스라인이 아니라 분리인데, 그건 이 PR 의 범위 밖이다.
 *   현재 저장값이 5 라 **라이브 영향은 0** 이고, 그 축을 0 으로 내리려는 순간 조용히 5 로 튕긴다.
 *   → 별도 작업으로 분리 후 배선할 것.
 */
export function resolveSellerMarkupPct(raw: unknown): number {
  return resolveMarkupPct(raw, KT_SELLER_MARKUP_DEFAULT_PCT)
}

/** 마진 %를 판매가 배수로. 0% → 1.0 (원가 = 판매가). */
export function consumerPriceMultiplier(markupPct: number): number {
  return 1 + markupPct / 100
}
