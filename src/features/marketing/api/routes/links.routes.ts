/**
 * 유어애즈(/api/ads) 단축 링크 라우터 — /links/* (2026-07-12).
 *
 *   🔓 베타 액세스 코드 **면제**(helpers.ts unlockExempt 등재): 단축 링크는 무료 리드 마그넷 —
 *   유어애즈 가입(무료)만이 유일한 장벽이어야 함(액세스 코드까지 요구하면 무료 서비스가 아님).
 *   단, 유효 토큰 + active 계정은 필수(익명 생성 금지 — 살포 방어) — 아래 requireLinkAccount.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom, getAdsAccount } from '../ads-account'
import { createShortLink, listMyLinks, updateShortLink, deleteShortLink, shortLinkStats } from '../short-links'

const adsLinksRoutes = new Hono<{ Bindings: Env }>()

/** 토큰 → 계정 id (+ 정지 계정 차단). 액세스 코드(access_unlocked)는 요구하지 않음 — 무료 서비스. */
async function requireLinkAccount(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<number | null> {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return null
  const acc = await getAdsAccount(c.env.DB, id).catch(() => null)
  if (!acc || (acc.status && acc.status !== 'active')) return null
  return id
}

// GET /api/ads/links — 내 링크 목록
adsLinksRoutes.get('/links', async (c) => {
  const id = await requireLinkAccount(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, links: await listMyLinks(c.env.DB, id) })
})

// POST /api/ads/links — 생성 { target_url, title?, custom_code? }
adsLinksRoutes.post('/links', rateLimit({ action: 'ads-link-create', max: 20, windowSec: 60 }), async (c) => {
  const id = await requireLinkAccount(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await createShortLink(c.env.DB, id, {
    target_url: String(b.target_url || ''),
    title: b.title ? String(b.title) : undefined,
    custom_code: b.custom_code ? String(b.custom_code) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, link: r.link, links: await listMyLinks(c.env.DB, id) })
})

// PATCH /api/ads/links/:id — 활성 토글/제목
adsLinksRoutes.patch('/links/:id', rateLimit({ action: 'ads-link-patch', max: 30, windowSec: 60 }), async (c) => {
  const id = await requireLinkAccount(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const linkId = Number(c.req.param('id'))
  if (!Number.isFinite(linkId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await updateShortLink(c.env.DB, id, linkId, {
    active: b.active !== undefined ? !!b.active : undefined,
    title: b.title !== undefined ? String(b.title) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// DELETE /api/ads/links/:id
adsLinksRoutes.delete('/links/:id', rateLimit({ action: 'ads-link-del', max: 30, windowSec: 60 }), async (c) => {
  const id = await requireLinkAccount(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const linkId = Number(c.req.param('id'))
  if (!Number.isFinite(linkId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await deleteShortLink(c.env.DB, id, linkId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 404)
  return c.json({ success: true })
})

// GET /api/ads/links/:id/stats — 최근 30일 일별 클릭
adsLinksRoutes.get('/links/:id/stats', async (c) => {
  const id = await requireLinkAccount(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const linkId = Number(c.req.param('id'))
  if (!Number.isFinite(linkId)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const r = await shortLinkStats(c.env.DB, id, linkId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 404)
  return c.json({ success: true, daily: r.daily })
})

export { adsLinksRoutes }
