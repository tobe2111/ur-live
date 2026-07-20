/**
 * 유어애즈(/api/ads) 인플루언서 발굴 라우터 — /influencers/* (2026-07-13).
 *   YouTube Data API 로 키워드 채널 발굴 + 공개 설명에서 이메일·인스타·틱톡 링크 추출 → 계정 DB 저장.
 *   베타 액세스 게이트 적용(데이터 엔드포인트 — requireAdsUnlocked 가 부모에서 강제).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from '../ads-account'
import {
  discoverYouTubeInfluencers, discoverNaverBloggers, discoverNaverCafes, saveInfluencerLeads,
  listInfluencerLeads, updateInfluencerLead, deleteInfluencerLead,
} from '../influencer-discovery'
import { providerAvailable } from '../provider-discovery'
import { naverOpenId, naverOpenSecret } from './helpers'

const adsInfluencersRoutes = new Hono<{ Bindings: Env }>()

const acctId = (c: { req: { header: (k: string) => string | undefined }; env: Env }) => adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)

// GET /api/ads/influencers — 내 리드 목록(?status= / ?has_contact=1)
adsInfluencersRoutes.get('/influencers', async (c) => {
  const id = await acctId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const leads = await listInfluencerLeads(c.env.DB, id, {
    status: c.req.query('status') || undefined,
    hasContact: c.req.query('has_contact') === '1',
  })
  // 어떤 플랫폼이 지금 수집 가능한지 클라에 알림(유튜브=키 보유 시 항상, 인스타/틱톡=제공사 키 있을 때).
  return c.json({
    success: true, leads,
    sources: { youtube: !!c.env.YOUTUBE_API_KEY, naver_blog: !!(naverOpenId(c.env) && naverOpenSecret(c.env)), naver_cafe: !!(naverOpenId(c.env) && naverOpenSecret(c.env)), instagram: providerAvailable(c.env), tiktok: providerAvailable(c.env) },
  })
})

// GET /api/ads/influencers/pool-stats — 🎯 공용 풀(자동 수집) 집계 + 마지막 실행 기록 (2026-07-20).
//   읽기 전용 집계(개별 리드/연락처 미노출). 로그인(베타) 사용자에게 풀 신선도 표시 + 자동수집 cron 외부 검증용.
adsInfluencersRoutes.get('/influencers/pool-stats', async (c) => {
  const id = await acctId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const agg = await c.env.DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN platform='youtube' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN platform='naver_blog' THEN 1 ELSE 0 END) AS naver_blog,
      SUM(CASE WHEN collected_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS recent24h
    FROM ad_influencer_leads WHERE account_id = 0`).first().catch(() => null)
  const row = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_autocollect_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = row?.value ? JSON.parse(row.value) : null } catch { run = null }
  return c.json({ success: true, pool: agg || {}, run, gate: c.env.ADS_AUTO_COLLECT_ENABLED === 'true' })
})

// POST /api/ads/influencers/discover { keyword, platform?, max? } — 발굴 + 저장
adsInfluencersRoutes.post('/influencers/discover', rateLimit({ action: 'ads-inf-discover', max: 40, windowSec: 3600 }), async (c) => {
  const id = await acctId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const keyword = String(b.keyword || '')
  const platform = String(b.platform || 'youtube')
  const max = b.max != null ? Number(b.max) : 15

  if (platform === 'youtube') {
    const r = await discoverYouTubeInfluencers(c.env, keyword, { maxResults: max })
    if (!r.ok) {
      const status = r.error === 'NOT_CONFIGURED' ? 503 : r.error === 'QUOTA' ? 429 : 400
      return c.json({ success: false, error: r.message || (r.error === 'NOT_CONFIGURED' ? 'YouTube 수집이 설정되지 않았습니다 (YOUTUBE_API_KEY)' : '발굴 실패'), code: r.error }, status)
    }
    const saved = await saveInfluencerLeads(c.env.DB, id, r.leads)
    return c.json({ success: true, found: r.leads.length, saved, leads: await listInfluencerLeads(c.env.DB, id) })
  }

  // 네이버 블로거 — 네이버 검색 오픈API(무료, 보유 키).
  if (platform === 'naver_blog') {
    const r = await discoverNaverBloggers(naverOpenId(c.env), naverOpenSecret(c.env), keyword, { display: 50 })
    if (!r.ok) {
      const status = r.error === 'NOT_CONFIGURED' ? 503 : 400
      return c.json({ success: false, error: r.message || (r.error === 'NOT_CONFIGURED' ? '네이버 검색 API가 설정되지 않았습니다' : '발굴 실패'), code: r.error }, status)
    }
    const saved = await saveInfluencerLeads(c.env.DB, id, r.leads)
    return c.json({ success: true, found: r.leads.length, saved, leads: await listInfluencerLeads(c.env.DB, id) })
  }

  // 네이버 카페 — 커뮤니티(카페) 단위 발굴(동일 네이버 키).
  if (platform === 'naver_cafe') {
    const r = await discoverNaverCafes(naverOpenId(c.env), naverOpenSecret(c.env), keyword, { display: 50 })
    if (!r.ok) {
      const status = r.error === 'NOT_CONFIGURED' ? 503 : 400
      return c.json({ success: false, error: r.message || (r.error === 'NOT_CONFIGURED' ? '네이버 검색 API가 설정되지 않았습니다' : '발굴 실패'), code: r.error }, status)
    }
    const saved = await saveInfluencerLeads(c.env.DB, id, r.leads)
    return c.json({ success: true, found: r.leads.length, saved, leads: await listInfluencerLeads(c.env.DB, id) })
  }

  // 인스타/틱톡 직접 발굴 = 데이터 제공사 API 필요(자체 스크래핑은 Workers 불가 + ToS/법 리스크).
  if (platform === 'instagram' || platform === 'tiktok') {
    if (!providerAvailable(c.env)) {
      return c.json({
        success: false, code: 'PROVIDER_NOT_CONFIGURED',
        error: `${platform === 'instagram' ? '인스타그램' : '틱톡'} 직접 수집은 데이터 제공사 API 연동이 필요합니다. 유튜브 수집 결과의 인스타/틱톡 링크는 지금도 함께 수집됩니다.`,
      }, 503)
    }
    // 제공사 연동 시 여기서 위임(별도 작업에서 staging 검증 후 활성).
    return c.json({ success: false, code: 'PROVIDER_PENDING', error: '제공사 연동 검증 후 활성화됩니다.' }, 503)
  }

  return c.json({ success: false, error: '지원하지 않는 플랫폼입니다' }, 400)
})

// PATCH /api/ads/influencers/:id — 상태(new/contacted/rejected)/메모
adsInfluencersRoutes.patch('/influencers/:id', rateLimit({ action: 'ads-inf-patch', max: 60, windowSec: 60 }), async (c) => {
  const id = await acctId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const leadId = Number(c.req.param('id'))
  if (!Number.isFinite(leadId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await updateInfluencerLead(c.env.DB, id, leadId, {
    status: b.status !== undefined ? String(b.status) : undefined,
    memo: b.memo !== undefined ? String(b.memo) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// DELETE /api/ads/influencers/:id
adsInfluencersRoutes.delete('/influencers/:id', rateLimit({ action: 'ads-inf-del', max: 60, windowSec: 60 }), async (c) => {
  const id = await acctId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const leadId = Number(c.req.param('id'))
  if (!Number.isFinite(leadId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await deleteInfluencerLead(c.env.DB, id, leadId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 404)
  return c.json({ success: true })
})

export { adsInfluencersRoutes }
