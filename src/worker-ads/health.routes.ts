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
      nps: on('ADS_NPS_ENABLED'), localdata: on('ADS_LOCALDATA_ENABLED'),
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
    /**
     * 🔔 **경보 채널** — 없으면 경보가 *꺼지는* 게 아니라 **조용히 무음**이 된다.
     *
     *   경보 코드는 전부 `if (env.DISCORD_WEBHOOK_URL && …)` 형태라, 값이 없으면 아무 흔적 없이
     *   건너뛴다. 즉 **경보가 무음이라는 사실 자체가 무음**이었다 — 이 파일이 게이트·튜닝을 보여 주면서
     *   정작 "알림이 갈 곳이 있는가"는 안 보여 줬다.
     *
     *   2026-08-03 실측: `ur-ads` 에 미설정이라 **시트 미러가 이틀 멈춘 동안 디스코드 알림 0건**.
     *   같은 시점 메인(`ur-live` Pages)엔 설정돼 있어 유어딜 머니 경보(정산·원장)는 정상이었다 —
     *   즉 **유어애즈만 어두웠고**, 두 워커의 env 가 갈렸다는 걸 밖에서 확인할 방법이 없었다.
     *
     *   ⚠️ 이건 오늘 고친 것들과 **같은 클래스**다(코드는 있는데 안 돎). 값 설정은 대표 몫이지만,
     *   비어 있다는 사실이 보이는 것까지는 코드의 몫이다.
     */
    alerts: {
      discord: e.DISCORD_WEBHOOK_URL ? '설정됨' : '🔴 미설정 — 아래 경보가 전부 무음',
      muted_when_unset: ['구글시트 동기화 실패', '인플루언서 수집 침묵/회복', '팔로업 리마인더'],
      // 채널이 없어도 기록은 남는다 — 다만 **pull**(대표가 들어가 봐야 보임)이지 push 가 아니다.
      always_recorded: 'cron_failures + dashboard_notifications → /admin/system-monitoring',
    },
  })
})

/**
 * 🔔 **경보 채널 실발사 확인** — "설정됨"과 "실제로 도착함"은 다르다.
 *
 *   env 에 값이 있어도 URL 이 오타거나 채널이 지워졌으면 경보는 **조용히 실패**한다
 *   (`sendDiscordAlert` 은 내부에서 삼킨다 — 경보가 경보 실패를 못 알리는 건 당연하고 옳다).
 *   그래서 그걸 확인할 길이 아예 없었다. 2026-08-03: `ur-ads` 에 웹훅이 미설정이라 시트 미러가
 *   이틀 멈추는 동안 알림 0건이었는데, **설정한 뒤에도 "정말 가는가"를 물을 방법이 없었다.**
 *
 *   ⚠️ **여기서는 절대 삼키지 않는다** — 이 라우트의 존재 이유가 그것이다. Discord 의 HTTP 상태를
 *   그대로 돌려준다(204 = 도착). `ok: true` 만 주면 이 라우트도 같은 병에 걸린다.
 *   ⚠️ 응답에 웹훅 URL 을 **싣지 않는다**(노출되면 누구나 그 채널에 글을 쓸 수 있다).
 *
 *   호출: 메인 어드민이 서비스바인딩(`env.ADS`)으로만 — `/__ads/*` 는 외부에서 도달 불가.
 */
healthRoutes.post('/__ads/alert-test', async (c) => {
  const url = (c.env as unknown as { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
  if (!url) return c.json({ ok: false, error: 'NOT_CONFIGURED: ur-ads 에 DISCORD_WEBHOOK_URL 미설정 — 유어애즈 경보 전부 무음' }, 400)
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'ℹ️ 유어애즈 경보 채널 연결 확인',
          description: '이 메시지가 보이면 ur-ads 의 경보 경로가 살아 있습니다.\n(시트 동기화 실패 · 수집 침묵/회복 · 팔로업 리마인더가 이 채널로 옵니다.)',
          color: 0x3498db, timestamp: new Date().toISOString(),
        }],
      }),
    })
    // 204 No Content 가 Discord 의 정상 응답이다. 2xx 가 아니면 **그대로 알린다**.
    return c.json({ ok: res.ok, status: res.status, ms: Date.now() - t0, hint: res.ok ? '전송됨 — 채널에 도착했는지 눈으로 확인' : '웹훅 URL/채널 확인 필요' })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    return c.json({ ok: false, status: 0, ms: Date.now() - t0, error: `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }, 502)
  }
})

export default healthRoutes
