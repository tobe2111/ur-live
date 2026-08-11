/**
 * 🎛️ **수집 트랙 원클릭 게이트 (어드민)** — 2026-08-11 대표 지시 *"원클릭으로 카페도 켤 수 있게"*.
 *
 *   그전엔 카페 트랙을 되켜려면 **Cloudflare 대시보드에서 워커 바인딩을 편집 → 재배포**해야 했다.
 *   판단은 대표 것인데 실행 수단이 대표 손에 없었고, 세션은 플랫폼 쓰기 금지 규약이라 도울 수도 없었다.
 *   ⇒ `platform_settings` 를 스위치로 쓴다(env 무접촉 — 미설정이면 종전 env 규칙 그대로).
 *
 *   판정 규칙 SSOT 는 `collect-track-gates.ts` `cafeCollectEnabled` — 이 파일은 **읽기/쓰기 입구**일
 *   뿐이다. 두 곳에서 각자 판정하면 화면과 실행이 갈라진다(이 레포가 반복해 만난 형태).
 *
 *   ⚠️ 서비스 분리: `platform_settings` 의 유어애즈 키만 접촉(소비자/도매 무관).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { CAFE_GATE_KEY, cafeCollectEnabled } from './collect-track-gates'

export const adminAdsCollectGatesRoutes = new Hono<{ Bindings: Env }>()

/** 화면이 "켜면 무엇을 얻고 무엇을 잃는가"를 추측 없이 보여주도록, 스위치와 **실측을 함께** 준다. */
adminAdsCollectGatesRoutes.get('/influencer-pool/collect-gates', async (c) => {
  const { DB } = c.env
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(CAFE_GATE_KEY).first<{ value: string }>().catch(() => null)
  const setting = row?.value ?? null
  // 🏘️ 카페 리드의 연락 가능성 — 이 숫자가 곧 "켤 가치"다(라이브 실측: 3,141명 이메일 0명).
  //   ⚠️ 표본이 아니라 전수로 센다. 표본 200건으로 판단했던 2026-07-29 와 달리 이제 전량이 있다.
  const stat = await DB.prepare(`SELECT COUNT(*) AS n,
      SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS emails,
      SUM(CASE WHEN perf_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS measured
    FROM ad_influencer_leads WHERE platform = 'naver_cafe'`)
    .first<{ n: number; emails: number; measured: number }>().catch(() => null)
  return c.json({
    success: true,
    data: {
      cafe: {
        /** 지금 실제로 도는가(설정 > env 폴백 — 실행부와 같은 함수로 판정). */
        enabled: cafeCollectEnabled(setting, c.env),
        /** 스위치가 명시 설정됐나. null 이면 env 폴백 중(= 대표가 아직 안 만짐). */
        setting,
        /** env 폴백 값 — 화면이 "설정을 지우면 무엇으로 돌아가는지" 보여줄 수 있게. */
        env_fallback: (c.env as unknown as { ADS_COLLECT_CAFE_ENABLED?: string }).ADS_COLLECT_CAFE_ENABLED ?? null,
        leads: stat?.n ?? 0,
        emails: stat?.emails ?? 0,
        measured: stat?.measured ?? 0,
      },
    },
  })
})

adminAdsCollectGatesRoutes.patch('/influencer-pool/collect-gates', async (c) => {
  const body = await c.req.json().catch(() => null) as { cafe?: unknown } | null
  if (typeof body?.cafe !== 'boolean') return c.json({ success: false, error: 'cafe(boolean) 필요' }, 400)
  const value = body.cafe ? 'on' : 'off'
  await c.env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CAFE_GATE_KEY, value).run().catch(() => null)
  // 저장된 값으로 **다시 판정해서** 반환한다 — 보낸 값을 그대로 믿고 그리면 화면과 실제가 갈라진다
  //   (`CollectConfigPanel` 이 서버 clamp 결과를 반영하는 것과 같은 이유).
  return c.json({ success: true, data: { cafe: { enabled: cafeCollectEnabled(value, c.env), setting: value } } })
})
