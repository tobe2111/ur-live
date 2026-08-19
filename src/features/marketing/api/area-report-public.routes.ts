/**
 * 📊 소비자 공개 API — 우리 동네 상권 리포트 (2026-07-27 대표 "다음 구현" — 이메일 아웃리치 미끼 자료).
 *   store_prospects(공공 인허가 수집분) 지역 집계: 업종별 영업중/90일 개업/폐업 + 최근 개업 목록.
 *   아웃리치 이메일에 "사장님 동네 리포트" 링크로 첨부 → 열어보면 유어딜 입점 CTA — lead magnet.
 *
 *   ⚠️ 공개 필드 최소화(new-openings 와 동일 원칙): 상호·업종·지역·인허가일만, 연락처/좌표 미노출.
 *   무인증 + 캐시(브라우저 60s/CDN 15분). 수치는 전부 자체 수집분 SQL 집계 — 추정치 0(허위 0).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { ensureProspectSchema } from './store-prospects'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

const app = new Hono<{ Bindings: Env }>()

const ymdDaysAgo = (days: number): string => {
  const d = new Date(Date.now() - days * 86400_000)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

// GET /api/public/area-report?region=서초구 — region 없으면 지역 목록만(선택 화면용).
app.get('/', async (c) => {
  await ensureProspectSchema(adsLeadsDb(c.env))
  const region = (c.req.query('region') || '').trim().slice(0, 20)
  const cut90 = ymdDaysAgo(90)
  c.header('Cache-Control', 'public, max-age=60')
  c.header('CDN-Cache-Control', 'public, max-age=900')

  const regions = (await adsLeadsDb(c.env).prepare(
    `SELECT region AS k, COUNT(*) AS n FROM store_prospects
     WHERE active = 1 AND region IS NOT NULL AND region != '' GROUP BY region ORDER BY n DESC LIMIT 40`)
    .all<{ k: string; n: number }>().catch(() => null))?.results || []
  if (!region) return c.json({ success: true, regions })

  // 업종별 집계 — 영업중 / 90일 개업 / 90일 폐업(인허가 변동 감지 기준).
  const byCategory = (await adsLeadsDb(c.env).prepare(
    `SELECT COALESCE(category,'기타') AS k,
       SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_n,
       SUM(CASE WHEN active = 1 AND apv_perm_ymd >= ? THEN 1 ELSE 0 END) AS opened_90d,
       SUM(CASE WHEN active = 0 AND COALESCE(replace(substr(last_mod_ts,1,10),'-',''), '') >= ? THEN 1 ELSE 0 END) AS closed_90d
     FROM store_prospects WHERE region = ? GROUP BY category HAVING active_n > 0 ORDER BY active_n DESC LIMIT 20`)
    .bind(cut90, cut90, region).all<{ k: string; active_n: number; opened_90d: number; closed_90d: number }>().catch(() => null))?.results || []

  const recent = (await adsLeadsDb(c.env).prepare(
    `SELECT biz_name, category, uptae, addr_road, apv_perm_ymd FROM store_prospects
     WHERE region = ? AND active = 1 AND is_new_open = 1 ORDER BY apv_perm_ymd DESC, id DESC LIMIT 10`)
    .bind(region).all<Record<string, unknown>>().catch(() => null))?.results || []

  const totals = byCategory.reduce((a, r) => ({
    active_n: a.active_n + Number(r.active_n || 0),
    opened_90d: a.opened_90d + Number(r.opened_90d || 0),
    closed_90d: a.closed_90d + Number(r.closed_90d || 0),
  }), { active_n: 0, opened_90d: 0, closed_90d: 0 })

  return c.json({ success: true, region, totals, byCategory, recent, regions })
})

export const areaReportPublicRoutes = app
