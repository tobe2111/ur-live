/**
 * 🏛️ 공공데이터 수집·스윕 수동 트리거 — `src/worker-ads/index.ts` 에서 분리 (2026-07-28).
 *
 *   분리 이유: index.ts 가 600줄(god 파일 래칫)에 닿았다. CLAUDE.md "새 페이지 체크리스트" 대로
 *   **우회하지 않고 핸들러群을 모듈로 추출**한다. 여기 모인 것들은 성격이 하나다 —
 *   *공공데이터 원부를 긁어오거나(수집), 이미 가진 값을 원부로 재검증하는(스윕)* 얇은 위임 핸들러.
 *   로직은 전부 `features/marketing/api/*` 에 있고 이 파일은 라우팅만 한다.
 *
 *   ⚠️ 경로는 모두 `/__ads/*` — 메인 프록시는 `/api/ads/*` · `/l/*` 만 위임하므로 **외부에서 도달 불가**하고,
 *   호출자는 메인 어드민(서비스바인딩 `env.ADS`)과 크론(SELF)뿐이다. 그래서 게이트 무관(수동=의도).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const publicDataRoutes = new Hono<{ Bindings: Env }>()

/** 얇은 위임 핸들러 공통 — 실패는 500 + 'FAILED'(원문은 각 러너가 stats.diag.error 로 남긴다). */
const lane = (run: (env: Env) => Promise<unknown>) => async (c: { env: Env; json: (b: unknown, s?: number) => Response }) => {
  try { return c.json({ ok: true, stats: await run(c.env) }) } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
}

// 🏪 상가정보(공공데이터) 수집.
publicDataRoutes.post('/__ads/collect-storeinfo', lane(async (env) => {
  const { runStoreInfoCollect } = await import('@/features/marketing/api/store-info-collect'); return runStoreInfoCollect(env)
}))

// 🛒 통신판매사업자 · 🏢 공정위 가맹정보 · 📢 공고 스캐너.
publicDataRoutes.post('/__ads/collect-commerce', lane(async (env) => {
  const { runCommerceCollect } = await import('@/features/marketing/api/commerce-notify-collect'); return runCommerceCollect(env)
}))
publicDataRoutes.post('/__ads/collect-franchise', lane(async (env) => {
  const { runFranchiseCollect } = await import('@/features/marketing/api/franchise-collect'); return runFranchiseCollect(env)
}))
publicDataRoutes.post('/__ads/scan-notices', lane(async (env) => {
  const { runNoticeScan } = await import('@/features/marketing/api/notice-scan'); return runNoticeScan(env)
}))

// 🏪 매장 후보(인허가) 전일 변동분.
//   ⚠️ 2026-07-28 분리: 예전엔 여기서 **백필까지 같은 인보케이션**에 돌렸다. 업종 16개 × 페이지에
//   백필 청크까지 얹히면 서브리퀘스트 한도(≈50)를 확실히 넘겨, 라이브가 실제로
//   `⛔ 플랫폼 요청한도 도달(업종×페이지 과다)` 를 뱉으며 `found:0` 에 고착했다.
//   → 백필은 아래 별도 라우트(=별도 인보케이션 = 새 예산)로 뗀다.
publicDataRoutes.post('/__ads/collect-localdata', lane(async (env) => {
  const { runLocalDataCollect } = await import('@/features/marketing/api/localdata-collect'); return runLocalDataCollect(env)
}))

// 📦 인허가 과거 백필 1청크 — **수집과 별도 인보케이션**(위 주석 참조).
publicDataRoutes.post('/__ads/backfill-localdata', lane(async (env) => {
  const { runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect'); return runLocalDataBackfill(env, 2)
}))

// 📧 매장 후보(인허가) 이메일 우선 연락처 보강.
publicDataRoutes.post('/__ads/enrich-prospects', lane(async (env) => {
  const { enrichProspectContacts } = await import('@/features/marketing/api/prospect-enrich'); return enrichProspectContacts(env)
}))

// 📑 나라장터 조달업체(대행사 계열).
publicDataRoutes.post('/__ads/collect-nara-vendor', lane(async (env) => {
  const { runNaraVendorCollect } = await import('@/features/marketing/api/nara-vendor-collect'); return runNaraVendorCollect(env, 5)
}))

// 🎓 나이스 학원·교습소 · 🏥 심평원 병원.
publicDataRoutes.post('/__ads/collect-neis', lane(async (env) => {
  const { runNeisAcademyCollect } = await import('@/features/marketing/api/neis-academy-collect'); return runNeisAcademyCollect(env, 6)
}))
publicDataRoutes.post('/__ads/collect-hira', lane(async (env) => {
  const { runHiraHospitalCollect } = await import('@/features/marketing/api/hira-hospital-collect'); return runHiraHospitalCollect(env, 6)
}))

// 🏪 무인매장(아이스크림 할인점·무인판매점) — 카카오 로컬 키워드 검색. 인허가와 달리 **전화가 함께 온다**.
publicDataRoutes.post('/__ads/collect-store-kakao', lane(async (env) => {
  const { runStoreKakaoCollect } = await import('@/features/marketing/api/store-kakao-collect'); return runStoreKakaoCollect(env)
}))

// 📮 이메일 재검증 스윕 — 기존 저장 이메일의 죽은 도메인(반송 확정) 정리.
publicDataRoutes.post('/__ads/sweep-mx', lane(async (env) => {
  const { sweepEmailMx } = await import('@/features/marketing/api/email-mx-sweep'); return sweepEmailMx(env)
}))

// 🏛️ 사업자 폐업 스윕 — 국세청 상태조회 활용신청 검증 겸.
publicDataRoutes.post('/__ads/sweep-nts', lane(async (env) => {
  const { sweepBusinessStatus } = await import('@/features/marketing/api/business-status-sweep'); return sweepBusinessStatus(env)
}))

export default publicDataRoutes
