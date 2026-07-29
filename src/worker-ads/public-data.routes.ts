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
import { runDetachable } from './detach'

export const publicDataRoutes = new Hono<{ Bindings: Env }>()

/**
 * 얇은 위임 핸들러 공통 — 실패는 500 + 'FAILED'(원문은 각 러너가 stats.diag.error 로 남긴다).
 *
 * 🚀 2026-07-29: cron(`?detach=1`)이면 **즉시 응답**하고 작업은 이 인보케이션의 waitUntil 에서 계속한다.
 *   부모 `scheduled()` 의 `kick` 은 응답을 기다리므로, 레인이 20초를 붙들면 목록 뒷부분이 **디스패치조차
 *   안 된다**(라이브 하트비트가 6시간 계단을 보여줬다 — 근거는 `detach.ts` 헤더).
 *   ⚠️ 어드민 수동 버튼은 detach 하지 않는다 — 눌렀는데 결과가 안 뜨면 UX 후퇴다.
 */
const lane = (run: (env: Env) => Promise<unknown>) => async (c: {
  env: Env
  req: { query: (k: string) => string | undefined; path: string }
  executionCtx?: { waitUntil: (p: Promise<unknown>) => void }
  json: (b: unknown, s?: number) => Response
}) => {
  try {
    // 🔔 완료 하트비트 이름 = 라우트 경로(부모 kick 의 기본 beat 와 같은 이름) → 부모의 '던지기 성공'을
    //   레인의 **실제 결과**가 덮어쓴다. detach 가 만드는 관측 사각지대의 처방(detach.ts 주석).
    const r = await runDetachable(c, () => run(c.env), c.req.path.replace(/^\/__ads\//, ''))
    return r.detached ? c.json({ ok: true, detached: true }) : c.json({ ok: true, stats: r.result })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
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

// 🏪 매장 후보(인허가) — 전일 변동분 + (백필 설정 시) 과거 1청크도 함께(버튼 누를수록 축적 가속).
//
//   🧮 2026-07-29 `mode` 추가: cron 은 **둘을 각자의 인보케이션에서** 돌려야 한다. 두 러너는 각각
//   자기 서브리퀘스트 예산(collect-budget 학습 상한)을 잡으므로 한 인보케이션에서 둘 다 돌리면
//   예산 2배 = 플랫폼 천장 초과 — 이 레인이 `total_saved: 0` 이던 원인을 그대로 재현하게 된다.
//   기본(=파라미터 없음)은 **수동 버튼의 기존 동작 그대로**(collect+backfill) 유지.
publicDataRoutes.post('/__ads/collect-localdata', async (c) => {
  try {
    const mode = c.req.query('mode') // 'collect' | 'backfill' | (없음)=둘 다
    const { runLocalDataCollect, runLocalDataBackfill } = await import('@/features/marketing/api/localdata-collect')
    // 🚀 cron 은 즉시 응답(위 lane 주석과 같은 이유) — 이 레인은 20초 예산을 다 쓰므로 부모를 가장 오래 붙든다.
    const r = await runDetachable(c, async () => {
      if (mode === 'backfill') return { backfill: await runLocalDataBackfill(c.env, 2) }
      const stats = await runLocalDataCollect(c.env)
      if (mode === 'collect') return { stats }
      return { stats, backfill: await runLocalDataBackfill(c.env, 2).catch(() => null) }
    // 부모 kick 의 beat 와 **같은 이름**(쿼리 포함)이어야 덮어쓰기가 성립한다.
    }, mode === 'backfill' ? 'collect-localdata?mode=backfill' : 'collect-localdata')
    return r.detached ? c.json({ ok: true, detached: true }) : c.json({ ok: true, ...r.result })
  } catch { return c.json({ ok: false, error: 'FAILED' }, 500) }
})

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
