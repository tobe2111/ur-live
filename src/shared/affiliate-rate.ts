/**
 * 담아 팔면 몇 % 적립되나 — **단일 진실원천(SSOT)**
 *
 * 🩸 2026-09-05 (대표 "모두 다 봐줘" — 라이브 실측으로 드러남): 같은 컬럼
 *   `products.referral_commission_rate` 를 화면마다 **다른 단위·다른 기본값**으로 읽고 있었다.
 *
 *   | 자리 | 읽던 방식 | 결과 |
 *   |---|---|---|
 *   | 유어샵 담기 picker | `Math.round(rate)` = 퍼센트로 오해 | 0.05 → **0** → 배지가 아예 안 뜸 |
 *   | 유어샵 핀 관리 | `price * rate / 100` = 퍼센트로 오해 | 실제의 **1/100** (₩5,000 → ₩50) |
 *   | 상품 상세 공유 문구 | 분수(맞음) + 기본값 하드코딩 `0.05` | **5%** 라고 말함(실제 2%) |
 *   | 어드민 정책 표 | `AFFILIATE_COMMISSION_PCT: 5` | 같은 이유로 **5%** 라고 보여줌 |
 *
 *   서버의 진짜 규칙은 `worker/utils/affiliate-credit.ts resolveCommissionRate` 하나다:
 *     ① `referral_enabled !== 1` → 적립 없음(null)
 *     ② `referral_commission_rate` 가 있으면 **그 분수**(0.05 = 5%)
 *     ③ 없으면 `platform_settings.affiliate_commission_rate / 100`, 그것도 없으면 **2%**
 *
 *   라이브 실측(2026-09-05): 활성 상품 2,606개 **전부** `referral_enabled=1` · rate 는 **전부 NULL** ·
 *   `affiliate_commission_rate` 설정 **없음** ⇒ 지금 모든 상품은 **2%** 인데, 유어샵 두 화면은
 *   그걸 **한 글자도 안 보여주고 있었다**(rate 가 NULL/0 이라 배지 조건 `> 0` 이 영원히 거짓).
 *   사람을 모으라고 만든 화면이 정작 "담으면 얼마 버는지"를 안 말하던 셈.
 *
 * ⚠️ **이 파일이 못 하는 것**: 클라이언트는 `platform_settings.affiliate_commission_rate`(어드민 override)를
 *   모른다. 그래서 `platformRate` 를 안 넘기면 코드 기본값(2%)을 쓴다 — 어드민이 그 값을 바꾸면
 *   **화면 표시만** 옛 기본값에 머문다(실제 적립은 서버가 맞게 준다). 서버가 내려주는 자리
 *   (curator 핀/추천)는 이미 해석된 값을 받으므로 이 한계에 안 걸린다.
 */

/** 상품별 rate 도 어드민 설정도 없을 때의 적립률. worker `affiliate-credit.ts` 와 **같은 값이어야 한다**. */
export const DEFAULT_AFFILIATE_RATE = 0.02

export interface AffiliateRateSource {
  /** 0/1. `undefined` = 서버가 안 내려준 것 → 켜진 것으로 본다(목록 API 는 이미 활성만 담는 경우가 있다). */
  referral_enabled?: number | null
  /** **분수**(0.05 = 5%). NULL = 상품별 설정 없음 → 플랫폼 기본값. */
  referral_commission_rate?: number | null
}

/**
 * 이 상품을 담아 팔면 실제로 붙는 적립률(분수). 적립이 아예 없으면 `null`.
 * @param platformRate 서버가 알려준 플랫폼 기본 분수(모르면 생략 — 코드 기본값 2%)
 */
export function effectiveAffiliateRate(
  p: AffiliateRateSource | null | undefined,
  platformRate: number = DEFAULT_AFFILIATE_RATE,
): number | null {
  if (!p) return null
  // referral_enabled 는 명시적으로 0 일 때만 차단(미전달 = 모름 ≠ 꺼짐).
  if (p.referral_enabled != null && Number(p.referral_enabled) !== 1) return null
  const own = p.referral_commission_rate
  if (own != null && Number.isFinite(Number(own))) {
    // 서버 resolveCommissionRate 와 동일 클램프.
    return Math.max(0, Math.min(1, Number(own)))
  }
  return Number.isFinite(platformRate) ? Math.max(0, Math.min(1, platformRate)) : DEFAULT_AFFILIATE_RATE
}

/** 화면용 퍼센트(소수점 1자리, 정수면 정수). 적립 없으면 `null`. */
export function affiliateRatePct(
  p: AffiliateRateSource | null | undefined,
  platformRate?: number,
): number | null {
  const r = effectiveAffiliateRate(p, platformRate)
  if (r == null || r <= 0) return null
  return Math.round(r * 1000) / 10
}
