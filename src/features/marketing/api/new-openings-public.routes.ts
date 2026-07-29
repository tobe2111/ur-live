/**
 * 🎉 소비자 공개 API — 우리 동네 새 가게(신규 개업) (2026-07-27 대표 "모두 진행" 승인).
 *   store_prospects 의 개업 감지분(공공 인허가 데이터)을 소비자에게 노출 — 동네 새 가게 발견 가치 +
 *   영업 시 "이미 유어딜에 노출 중" 세일즈 포인트.
 *
 *   ⚠️ 공개 필드 최소화: 상호·업종·지역·도로명주소·인허가일만 — **전화/이메일/좌표는 미노출**
 *   (그건 내부 아웃리치용. 공개 API 로 연락처를 재배포하지 않는다).
 *   무인증 + 캐시(브라우저 60s / CDN 15분 — 기존 공개 리스트 패턴) — D1 부하 0에 수렴.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { intParam } from '@/shared/pagination'
import { ensureProspectSchema } from './store-prospects'

const app = new Hono<{ Bindings: Env }>()

// GET /api/public/new-openings?region=&days=30&limit=60
app.get('/', async (c) => {
  await ensureProspectSchema(c.env.DB)
  const days = Math.min(60, Math.max(3, intParam(c.req.query('days'), 30)))
  const limit = Math.min(120, Math.max(6, intParam(c.req.query('limit'), 60)))
  const region = (c.req.query('region') || '').trim().slice(0, 20)
  const d = new Date(Date.now() - days * 86400_000)
  const cutoff = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  const where: string[] = ['active = 1', 'is_new_open = 1', 'apv_perm_ymd >= ?']
  const binds: (string | number)[] = [cutoff]
  if (region) { where.push('region LIKE ?'); binds.push(`%${region}%`) }
  const rows = (await c.env.DB.prepare(
    `SELECT biz_name, category, uptae, region, addr_road, apv_perm_ymd FROM store_prospects
     WHERE ${where.join(' AND ')} ORDER BY apv_perm_ymd DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all<Record<string, unknown>>().catch(() => null))?.results || []
  const regions = (await c.env.DB.prepare(
    `SELECT COALESCE(region,'') AS k, COUNT(*) AS n FROM store_prospects
     WHERE active = 1 AND is_new_open = 1 AND apv_perm_ymd >= ? AND region IS NOT NULL AND region != ''
     GROUP BY region ORDER BY n DESC LIMIT 20`)
    .bind(cutoff).all<{ k: string; n: number }>().catch(() => null))?.results || []
  // 공개 리스트 캐시 패턴(브라우저 짧게 / CDN 길게) — 익명 트래픽이 D1 에 닿지 않게.
  c.header('Cache-Control', 'public, max-age=60')
  c.header('CDN-Cache-Control', 'public, max-age=900')
  return c.json({ success: true, days, region: region || null, openings: rows, regions })
})

export const newOpeningsPublicRoutes = app
