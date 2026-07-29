/**
 * 🩺 ur-ads 헬스체크 — `src/worker-ads/index.ts` 에서 분리 (2026-07-29, god 파일 래칫 600줄).
 *
 *   분리 이유는 `enrich.routes.ts`·`public-data.routes.ts` 와 같다: 래칫을 리베이스라인으로 우회하지 않고
 *   성격이 같은 핸들러를 모듈로 뺀다. 이 파일의 관심사는 하나 — **이 워커의 env 가 진실이라는 것**.
 *
 *   ⚠️ 게이트/튜닝값은 **이 워커(ur-ads) env** 로만 읽는다. 메인(어드민)이 자기 env 를 읽어 표시하면
 *   실제 cron 과 어긋난다(2026-07-28 실측: 어드민이 전부 OFF 로 보였는데 실제 가동 여부 불명).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const healthRoutes = new Hono<{ Bindings: Env }>()

// 헬스체크 — 배포/서비스바인딩 검증용. gates: 자동수집/시트동기화가 **이 워커(ur-ads) env** 기준으로 켜졌는지
//   (2026-07-23 전수조사: 어드민 배너가 메인 워커 env 를 읽어 실제 cron 게이트와 어긋나던 것 — 메인이 이걸 물어 표시).
healthRoutes.get('/__ads/health', (c) => {
  const e = c.env as unknown as Record<string, string | undefined>
  const on = (k: string) => e[k] === 'true'
  return c.json({
    ok: true, service: 'ur-ads',
    // ⚠️ 게이트는 **이 워커 env** 가 진실 — 메인(어드민)이 자기 env 를 읽어 표시하면 실제 cron 과 어긋난다
    //   (2026-07-28 실측: 어드민이 전부 OFF 로 보였는데 실제 가동 여부 불명). 파트너 트랙 게이트 전부 노출.
    gates: {
      auto_collect: on('ADS_AUTO_COLLECT_ENABLED'), sheets_sync: on('ADS_SHEETS_SYNC_ENABLED'),
      company_collect: on('ADS_COMPANY_COLLECT_ENABLED'), storeinfo: on('ADS_STOREINFO_ENABLED'),
      commerce: on('ADS_COMMERCE_ENABLED'), franchise: on('ADS_FRANCHISE_ENABLED'),
      nps: on('ADS_NPS_ENABLED'), work24: on('ADS_WORK24_ENABLED'), localdata: on('ADS_LOCALDATA_ENABLED'),
      neis: on('ADS_NEIS_ENABLED'), hira: on('ADS_HIRA_ENABLED'), store_kakao: on('ADS_STORE_KAKAO_ENABLED'),
      enrich_disabled: on('ADS_ENRICH_DISABLED'),
    },
    // 🎛️ 튜닝값(비밀 아님) — 2026-07-29 신설. 게이트는 켜졌는지만 보여 주는데, 대표가 대시보드에서
    //   라운드·카페 스위치를 바꿔도 **적용됐는지 밖에서 확인할 방법이 없었다**(실제로 오늘 그 질문에 답을
    //   못 했다). 미설정이면 코드 기본값이 무엇인지까지 같이 보여 준다.
    tuning: {
      collect_rounds: e.ADS_COLLECT_ROUNDS ?? '(미설정 → 기본 4)',
      influencer_enrich_rounds: e.ADS_INFLUENCER_ENRICH_ROUNDS ?? '(미설정 → 기본 12)',
      collect_cafe: e.ADS_COLLECT_CAFE_ENABLED ?? '(미설정 → 켜짐)',
      subrequest_budget: e.ADS_SUBREQUEST_BUDGET ?? '(미설정 → 기본 300, 실효는 학습 상한과 min)',
      yt_search_budget: e.ADS_YT_SEARCH_BUDGET ?? '(미설정 → 기본 90)',
      enrich_rounds: e.ADS_ENRICH_ROUNDS ?? '(미설정 → 기본 8)',
      // 🔬 인허가 요청 형태 — 비우면 라이브가 후보를 찔러 스스로 고른다(license-url.ts). 값을 넣으면 고정.
      localdata_variant: e.ADS_LOCALDATA_VARIANT ?? '(미설정 → 자동 탐색)',
      localdata_page_size: e.ADS_LOCALDATA_PAGE_SIZE ?? '(미설정 → 형태별 기본값)',
      localdata_backfill_days: e.ADS_LOCALDATA_BACKFILL_DAYS ?? '(미설정 → 0=OFF)',
    },
  })
})

export default healthRoutes
