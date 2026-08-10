/**
 * 📣 2026-08-09 캠페인 신청자 어드민 API (마운트: /api/admin/campaign-applications).
 *
 *   campaign_applications(캠페인 신청 SSOT — campaign-apply.routes) 를 캠페인 코드로 필터 조회 + CSV.
 *   읽기 전용(머니 무접촉). CSV 는 수식 인젝션 가드(csv-injection 룰 — 선행 =+-@ 무력화) 적용.
 */
import { Hono } from 'hono'
import { requireAdmin } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import type { Env } from '@/worker/types/env'
import { ensureCampaignApplicationsTable } from '../../marketing/api/campaign-apply.routes'

const adminApp = new Hono<{ Bindings: Env }>()
adminApp.use('*', requireAdmin())

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,39}$/
const codeFilter = (raw: string | undefined): string | null => {
  const v = String(raw ?? '').trim().toLowerCase()
  return CODE_RE.test(v) ? v : null
}

interface AppRow {
  id: number; campaign_code: string; user_id: string; name: string | null; phone: string | null
  email: string | null; contact: string | null; platform: string | null; account_url: string
  category: string | null; region: string | null; follower_size: string | null; collab_terms: string | null
  privacy_agreed_at: string | null; marketing_agreed_at: string | null; created_at: string
}

const SELECT_COLS = `id, campaign_code, user_id, name, phone, email, contact, platform, account_url,
  category, region, follower_size, collab_terms, privacy_agreed_at, marketing_agreed_at, created_at`

// GET / — 목록(campaign 필터 + 페이지네이션) + 캠페인 코드 목록(필터 셀렉트용)
adminApp.get('/', async (c) => {
  const { DB } = c.env
  await ensureCampaignApplicationsTable(DB)
  const campaign = codeFilter(c.req.query('campaign'))
  const page = Math.max(1, intParam(c.req.query('page'), 1))
  const limit = Math.min(100, Math.max(1, intParam(c.req.query('limit'), 50)))
  const offset = (page - 1) * limit

  const where = campaign ? 'WHERE campaign_code = ?' : ''
  const listBinds: (string | number)[] = campaign ? [campaign, limit, offset] : [limit, offset]
  const rows = await DB.prepare(
    `SELECT ${SELECT_COLS} FROM campaign_applications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...listBinds).all<AppRow>().catch(() => ({ results: [] as AppRow[] }))
  const total = campaign
    ? await DB.prepare('SELECT COUNT(*) AS n FROM campaign_applications WHERE campaign_code = ?').bind(campaign).first<{ n: number }>().catch(() => null)
    : await DB.prepare('SELECT COUNT(*) AS n FROM campaign_applications').first<{ n: number }>().catch(() => null)
  const codes = await DB.prepare(
    'SELECT campaign_code, COUNT(*) AS cnt FROM campaign_applications GROUP BY campaign_code ORDER BY cnt DESC LIMIT 50',
  ).all<{ campaign_code: string; cnt: number }>().catch(() => ({ results: [] as { campaign_code: string; cnt: number }[] }))

  return c.json({
    success: true,
    data: { applications: rows.results || [], total: total?.n ?? 0, page, limit, campaigns: codes.results || [] },
  })
})

// GET /export.csv?campaign= — 신청자 명단 CSV (수식 인젝션 가드)
adminApp.get('/export.csv', async (c) => {
  const { DB } = c.env
  await ensureCampaignApplicationsTable(DB)
  const campaign = codeFilter(c.req.query('campaign'))
  const where = campaign ? 'WHERE campaign_code = ?' : ''
  const stmt = DB.prepare(`SELECT ${SELECT_COLS} FROM campaign_applications ${where} ORDER BY created_at DESC LIMIT 5000`)
  const rows = await (campaign ? stmt.bind(campaign) : stmt).all<AppRow>().catch(() => ({ results: [] as AppRow[] }))

  // csv-injection 가드 — 선행 =+-@/탭/CR 셀은 작은따옴표로 무력화(district-coupon-admin 과 동일 패턴)
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    const g = /^[=+\-@\t\r]/.test(s) ? "'" + s : s
    return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
  }
  const head = ['신청일', '캠페인', '유저ID', '이름', '연락처(전화)', '연락처(기타)', '이메일', '플랫폼',
    '계정URL', '카테고리', '활동지역', '팔로워규모', '희망 협업 조건', '개인정보동의일', '마케팅수신동의일']
  const body = (rows.results || []).map((r) => [
    r.created_at, r.campaign_code, r.user_id, r.name, r.phone, r.contact, r.email, r.platform,
    r.account_url, r.category, r.region, r.follower_size, r.collab_terms, r.privacy_agreed_at, r.marketing_agreed_at,
  ])
  const csv = '﻿' + [head, ...body].map((r) => r.map(esc).join(',')).join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campaign-${campaign || 'all'}-applications.csv"`,
    },
  })
})

export const adminCampaignApplicationsRoutes = adminApp
