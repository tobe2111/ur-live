/**
 * 🔗 2026-07-12 유어애즈 무료 단축 링크 — 공개 리다이렉트 /l/{code}.
 *   worker/index.ts 에 blogSeoRoutes 패턴으로 마운트(SPA HTML 폴백 전 등록).
 *   생성은 /api/ads/links(유어애즈 가입자, links.routes.ts) — 여기는 무인증 302 만.
 *   302 + no-store: 매 클릭 서버 도달(집계 정확) + 어드민 비활성 처리 즉시 반영.
 *   집계는 waitUntil fail-soft — 집계 실패가 리다이렉트를 못 막음.
 *   ⚠️ /s/* 는 셀러 공개페이지가 선점이라 /l/ 사용(SSR inject 규칙과 무충돌).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { resolveShortLink, recordShortLinkClick } from '../short-links'

const shortLinkRedirectRoutes = new Hono<{ Bindings: Env }>()

shortLinkRedirectRoutes.get('/l/:code', async (c) => {
  const code = c.req.param('code') || ''
  const link = await resolveShortLink(c.env.DB, code)
  if (!link) {
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>링크를 찾을 수 없습니다</title><div style="font-family:system-ui,sans-serif;text-align:center;padding:64px 24px;color:#0B0E14"><p style="font-size:15px;font-weight:700;margin:0">만료되었거나 없는 링크입니다</p><p style="font-size:13px;color:#565E6C;margin:10px 0 18px">주소를 다시 확인해주세요.</p><a href="/ads" style="font-size:13px;font-weight:700;color:#2A56D4">유어애즈 무료 단축링크 만들기 →</a></div>'
    return c.html(html, 404)
  }
  if (c.executionCtx) c.executionCtx.waitUntil(recordShortLinkClick(c.env.DB, link.id).catch(() => null))
  else await recordShortLinkClick(c.env.DB, link.id).catch(() => null)
  c.header('Cache-Control', 'no-store')
  return c.redirect(link.target_url, 302)
})

export { shortLinkRedirectRoutes }
