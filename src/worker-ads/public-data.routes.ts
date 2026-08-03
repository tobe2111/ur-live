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

/** 얇은 위임 핸들러 공통 — 실패는 500 + 'FAILED'(원문은 각 러너가 stats.diag.error 로 남긴다).
 *
 *  ⚠️ 2026-07-29: 한때 cron 호출을 "즉시 응답 + waitUntil" 로 바꿨다가 **되돌렸다.**
 *  서비스 바인딩 피호출자는 **호출자보다 오래 살 수 없다** — 즉시 응답하면 부모의 await 이 풀리고
 *  부모 인보케이션이 끝나면서 이쪽 waitUntil 작업이 **취소**된다(#874 라이브 실측: 라운드 0회).
 *  ⇒ 작업은 **응답 전에**, 호출자가 살아 있는 동안 한다.
 */
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
// 🏪 상권 축 — 전국전통시장표준데이터(연락처가 붙어 오는 유일한 상권 소스). 수동=게이트 무관.
publicDataRoutes.post('/__ads/collect-market', lane(async (env) => {
  const { runMarketCollect } = await import('@/features/marketing/api/market-collect'); return runMarketCollect(env)
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
    if (mode === 'backfill') return c.json({ ok: true, backfill: await runLocalDataBackfill(c.env, 2) })
    const stats = await runLocalDataCollect(c.env)
    if (mode === 'collect') return c.json({ ok: true, stats })
    const backfill = await runLocalDataBackfill(c.env, 2).catch(() => null)
    return c.json({ ok: true, stats, backfill })
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

// 🔬 공공 API **한 방 프로브** — 레인을 거치지 않고 상대의 원문을 그 자리에서 돌려준다.
//   `lane()` 을 쓰지 않는 이유가 핵심이다: 저 헬퍼는 결과를 D1 스탬프에 의존하는 레인용이고,
//   지금 문제는 바로 **그 스탬프에 도달하기 전에 죽는다**는 것이다(08-01 수동 트리거 실측:
//   `started:true` 인데 72초 뒤에도 `last_run` 이 07-29 그대로였다). 여기서는 fetch 1회 결과를
//   **응답 본문으로 즉시** 준다 — 죽을 자리가 없다.
//   🔐 URL·본문 모두 서비스키가 가려진 채로 나간다(public repo + 어드민 화면).
publicDataRoutes.post('/__ads/probe-public-data', async (c) => {
  const target = c.req.query('target') || 'all'
  const num = (v: string | undefined): number | undefined => {
    const n = Math.trunc(Number(v)); return Number.isFinite(n) && n > 0 ? n : undefined
  }
  const rows = num(c.req.query('rows'))
  const page = num(c.req.query('page'))
  // 🪜 `ladder=1,10,100,500` — 같은 대상에 rows 를 키워 가며 **첫 실패 지점**을 찾는다.
  //   08-01 실측이 이걸 요구했다: 프로브(rows=1)는 200/JSON 인데 레인(rows=500)만 "비JSON" 이었다.
  const ladder = (c.req.query('ladder') || '').split(',').map(x => num(x)).filter((x): x is number => !!x)
  try {
    const m = await import('@/features/marketing/api/public-data-probe')
    const results = ladder.length && target !== 'all'
      ? await m.probeLadder(c.env, target, ladder, page || 1)
      : target === 'all'
        ? await m.probeAllPublicData(c.env, { rows, page })
        : [await m.probePublicData(c.env, target, undefined, { rows, page, path: c.req.query('path'), host: c.req.query('host'), params: c.req.query('params') })]
    return c.json({ ok: true, targets: m.probeTargetNames(), results })
  } catch (e) {
    return c.json({ ok: false, error: String((e as Error)?.message || e || '').slice(0, 200) }, 500)
  }
})

export default publicDataRoutes

// 💼 고용24 채용기업 수집 — 채용 중(성장 신호) 광고·마케팅·판촉 계열 기업 발굴. 수동=게이트 무관.
//   🧹 2026-07-29 엔트리(600줄 캡)에서 이 모듈로 이동 — **동작 불변, 위치만**(둘 다 공공데이터 계열 레인).
publicDataRoutes.post('/__ads/collect-work24', lane(async (env) => {
  const { runWork24JobsCollect } = await import('@/features/marketing/api/work24-jobs-collect'); return runWork24JobsCollect(env)
}))

// 👥 국민연금 규모 검증 — 기존 리드(대행사 우선)의 직원수(가입자수) 조회(엄격 매칭, 허위 0).
//   40→100(2026-07-27 대표 "더 정확히" — data.go.kr 쿼터 여유). 이동 사유는 위와 동일.
publicDataRoutes.post('/__ads/collect-nps', lane(async (env) => {
  const { runNpsWorkplaceEnrich } = await import('@/features/marketing/api/nps-workplace-enrich'); return runNpsWorkplaceEnrich(env, 100)
}))
