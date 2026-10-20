/**
 * 🎛️ **수집 트랙 게이트** — `influencer-keyword-rotation.ts` 에서 분리(2026-08-11, 600줄 래칫).
 *
 *   "어떤 매체를 이번 회차에 돌 것인가"는 **키워드를 어떤 순서로 돌 것인가**(회전)와 다른 관심사다.
 *   회전 파일이 614줄로 캡을 넘어선 김에 제자리로 옮긴다 — 트랙이 늘면(카페 외) 여기에 모인다.
 *   판정은 순수함수라 전량 유닛으로 고정된다(`ads-collect-gates.test.ts`).
 */
/**
 * 🏘️ **카페 트랙 원클릭 게이트** (2026-08-11 대표 지시 *"원클릭으로 카페도 켤 수 있게"*).
 *
 * ## 왜 필요했나
 * 카페 수집은 `ADS_COLLECT_CAFE_ENABLED='false'`(Cloudflare env)로 꺼져 있다. 되켜려면 **대시보드에
 * 들어가 워커 바인딩을 편집 → 재배포**를 거쳐야 한다 — 대표가 판단 즉시 못 켜고, 세션도 못 켠다
 * (플랫폼 쓰기는 세션 금지 규약). ⇒ 어드민에서 누를 수 있는 자리를 만든다.
 *
 * ## 우선순위 (env 를 건드리지 않는다)
 *   `platform_settings.ads_collect_cafe` = 'on' | 'off'  ← **설정돼 있으면 이게 이긴다**(원클릭)
 *   미설정  → 기존 env 규칙 그대로(`ADS_COLLECT_CAFE_ENABLED !== 'false'`)
 * 라이브는 env 가 'false' 이므로 **설정이 비어 있는 동안 동작은 지금과 완전히 동일하다**
 * (게이트를 추가하면서 조용히 켜 버리는 사고가 이 레포의 반복 클래스다 — 그래서 폴백을 보존한다).
 *
 * ## ⚠️ 켜기 전에 알아야 하는 실측 (2026-08-11 라이브)
 * ```
 *   naver_cafe 리드 3,141명  →  이메일 0명 · 측정된 사람 0명
 * ```
 * 카페는 보강 경로 자체가 없다(`enrichNaverActivity` 는 `platform='naver_blog'` 만 본다) —
 * **영원히 연락 불가인 행**을 쌓는다. 게다가 지금은 회차 예산(56)이 캡이라, 카페를 켜면 키워드당
 * 1 서브리퀘스트를 먹어 **그만큼 키워드 폭이 줄어든다**(발굴량 직접 감소).
 * ⇒ 이 스위치는 "언제든 되켤 수 있게" 하는 것이 목적이고, 켜는 판단은 대표 것이다.
 *   화면(`CollectDiagPanel`)이 이 수치를 함께 보여주므로 추측으로 켜지 않는다.
 */
export const CAFE_GATE_KEY = 'ads_collect_cafe'

export function cafeCollectEnabled(setting: string | null | undefined, env: unknown): boolean {
  const s = (setting ?? '').trim().toLowerCase()
  if (s === 'on' || s === 'true' || s === '1') return true
  if (s === 'off' || s === 'false' || s === '0') return false
  // 미설정 → 기존 env 규칙(기본 ON, 'false' 면 OFF) 보존
  return (env as { ADS_COLLECT_CAFE_ENABLED?: string } | undefined)?.ADS_COLLECT_CAFE_ENABLED !== 'false'
}
