/**
 * 🆕 2026-07-13 유어애즈 — 인스타그램/틱톡 인플루언서 수집 제공사 어댑터(seam).
 *
 *   왜 제공사인가: 인스타/틱톡은 ① 공식 API 가 타인 프로필/연락처를 안 줌 ② 자체 스크래핑은
 *   Cloudflare Workers 런타임에서 불가(고정IP·브라우저 자동화 없음)이고 ToS 위반·안티봇·법 리스크가 큼.
 *   → 실무 정답은 **데이터 제공사 API**(예: Apify actor · EnsembleData · Modash) — 이들이 수집/유지보수/
 *   법적 리스크를 지고, 우리는 API 로 호출만 한다(토스 게이트웨이와 동일 철학: 직접 fetch 산개 금지).
 *
 *   ⚠️ 활성 전제: `INFLUENCER_PROVIDER`(provider 이름) + `INFLUENCER_PROVIDER_KEY`(API 키) env 설정 +
 *   staging 실호출 검증. 키 없으면 `providerAvailable=false` → 라우트가 명확히 안내(무음 실패 없음).
 *   구체 provider 응답 파싱은 계약(어떤 벤더) 확정 후 이 파일에 추가 — 미검증 추측 구현은 넣지 않는다.
 */

// env: INFLUENCER_PROVIDER(벤더명) + INFLUENCER_PROVIDER_KEY(키). 유튜브 발굴은 이와 무관하게
//   YOUTUBE_API_KEY 만으로 동작(무료) — 이 seam 은 인스타/틱톡 직접 발굴 확장용.
export function providerAvailable(env: { INFLUENCER_PROVIDER_KEY?: string }): boolean {
  return !!(env as { INFLUENCER_PROVIDER_KEY?: string }).INFLUENCER_PROVIDER_KEY
}
