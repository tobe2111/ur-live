/**
 * 🔁 cron 위임 — 2026-11-17 대표 "2번으로 해줘"(비밀값을 cron 워커로 옮길 수 없으니, 그 일을 웹사이트 서버에 맡긴다).
 *
 * 왜: cron 워커(ur-live Workers)와 웹사이트(ur-live Pages)는 **환경변수가 따로**다. Pages 에는 있는데
 *   워커에는 없는 비밀값(secret_text — Cloudflare API 가 값을 돌려주지 않아 복사할 수 없다) 때문에
 *   아래 일들이 cron 에서 매번 조용히 건너뛰어지고 있었다(2026-11-17 전수 대조):
 *     - restaurant-geocode      : KAKAO_REST_API_KEY 없음 → 새 가게 좌표·동 태깅 안 됨
 *     - kt-alpha-catalog-sync   : KT_ALPHA_AUTH_CODE 없음 → KT 교환권 목록 갱신 skip
 *     - channel-watchdog        : FIREBASE_* 없음 → 앱 푸시 채널을 워커 기준으로 잘못 판정
 * ⇒ 워커에 그 비밀값이 없을 때만, cron 이 이 엔드포인트를 불러 **Pages 의 env 로 같은 함수를** 돌린다.
 *   워커에 값이 생기면 종전처럼 워커에서 직접 돈다(dual-mode 유지 — `scheduled.ts` 의 분기).
 *
 * 보안: `X-Internal-Token` = INTERNAL_CRON_TOKEN(fail-closed: 미설정 500 · 불일치 401) · 작업은 허용목록만.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { secretEquals } from '../utils/secret-compare'
import { CRON_DELEGATE_JOBS, type CronDelegateJob } from '../utils/cron-delegate'

const cronDelegateRoutes = new Hono<{ Bindings: Env }>()

cronDelegateRoutes.post('/api/_internal/cron-delegate/:job', async (c) => {
  const expected = (c.env as { INTERNAL_CRON_TOKEN?: string }).INTERNAL_CRON_TOKEN
  if (!expected) return c.json({ success: false, error: 'Server misconfiguration' }, 500)
  if (!secretEquals(expected, c.req.header('X-Internal-Token'))) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const job = c.req.param('job') as CronDelegateJob
  if (!(CRON_DELEGATE_JOBS as readonly string[]).includes(job)) return c.json({ success: false, error: 'Unknown job' }, 404)
  try {
    let result: unknown
    if (job === 'restaurant-geocode') {
      const { runRestaurantGeocode } = await import('../cron/restaurant-geocode')
      result = await runRestaurantGeocode(c.env as unknown as { DB: D1Database; KAKAO_REST_API_KEY?: string })
    } else if (job === 'kt-alpha-catalog-sync') {
      // 2026-11-17: 조각 갱신(회차당 몇 페이지) — 한 요청이 100초를 넘기지 않게. 전체 갱신은 어드민 수동 버튼에 남았다.
      const { runKtAlphaCatalogChunk } = await import('../cron/kt-alpha-catalog-chunk')
      result = await runKtAlphaCatalogChunk(c.env as never)
    } else {
      const { handleChannelWatchdog } = await import('../cron/channel-watchdog')
      await handleChannelWatchdog(c.env as never)
      result = { ok: true }
    }
    return c.json({ success: true, job, result })
  } catch (err) {
    console.error('[cron-delegate]', job, (err as Error).message)
    return c.json({ success: false, error: '위임 작업 실패' }, 500)
  }
})

export { cronDelegateRoutes }
