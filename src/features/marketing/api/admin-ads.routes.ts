/**
 * 🆕 2026-06-28 유어애즈(UR Ads) 운영 어드민 — 가입자 관리.
 *   기존 플랫폼 어드민 인증(requireAdmin) 위에서 ad_accounts 조회/잠금해제/정지.
 *   UR Ads 서비스 전용(유어딜/도매와 무관) — /api/admin/ads/*.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { ensureAdsAccountSchema, adminSetPassword } from './ads-account'
import { ensureEntitlementSchema, setPlan, type AdsPlan } from './ads-entitlements'
import { mediaStatus } from './media-gateway'
import { listServices, adminUpsertService, adminListOrders, adminUpdateOrder } from './ad-services'
import { adminListReviews, adminSetReviewStatus } from './ad-service-reviews'
import { adminListShortLinks, adminSetShortLinkActive } from './short-links'
import { intParam } from '@/shared/pagination'
import { generateOutreachDrafts, OUTREACH_BATCH_MAX, type OutreachLeadInput } from './influencer-outreach'
import { ensureInfluencerSchema } from './influencer-discovery'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// GET /api/admin/ads/stats — 요약
app.get('/stats', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const t = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN access_unlocked = 1 THEN 1 ELSE 0 END) AS unlocked,
      SUM(CASE WHEN status IS NOT NULL AND status != 'active' THEN 1 ELSE 0 END) AS suspended,
      SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_accounts`).first<{ total: number; unlocked: number; suspended: number; recent7: number }>().catch(() => null)
  return c.json({ success: true, stats: { total: Number(t?.total) || 0, unlocked: Number(t?.unlocked) || 0, suspended: Number(t?.suspended) || 0, recent7: Number(t?.recent7) || 0 }, media: mediaStatus(c.env) })
})

// GET /api/admin/ads/accounts?q=&limit= — 가입자 목록(연동/알림 플래그 포함)
app.get('/accounts', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const limit = Math.min(300, Math.max(1, intParam(c.req.query('limit'), 100)))
  const q = (c.req.query('q') || '').trim().toLowerCase()
  const like = `%${q}%`
  const rows = (await (q
    ? c.env.DB.prepare(`SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts
        WHERE LOWER(email) LIKE ? OR LOWER(COALESCE(company_name, '')) LIKE ? ORDER BY id DESC LIMIT ?`).bind(like, like, limit)
    : c.env.DB.prepare('SELECT id, email, company_name, phone, status, access_unlocked, created_at, last_login_at FROM ad_accounts ORDER BY id DESC LIMIT ?').bind(limit)
  ).all<{ id: number; email: string; company_name: string | null; phone: string | null; status: string | null; access_unlocked: number; created_at: string; last_login_at: string | null }>().catch(() => null))?.results || []
  // 연동/알림/플랜 플래그(테이블 미존재 가능 → best-effort).
  const connSet = new Set(((await c.env.DB.prepare('SELECT DISTINCT seller_id FROM ad_searchad_tenants').all<{ seller_id: number }>().catch(() => null))?.results || []).map(r => r.seller_id))
  const alertSet = new Set(((await c.env.DB.prepare('SELECT account_id FROM ad_alert_settings WHERE enabled = 1').all<{ account_id: number }>().catch(() => null))?.results || []).map(r => r.account_id))
  const planMap = new Map(((await c.env.DB.prepare('SELECT account_id, plan FROM ad_entitlements').all<{ account_id: number; plan: string }>().catch(() => null))?.results || []).map(r => [r.account_id, r.plan]))
  const accounts = rows.map(r => ({ ...r, connected: connSet.has(r.id), alert_on: alertSet.has(r.id), plan: planMap.get(r.id) || 'free' }))
  return c.json({ success: true, accounts })
})

// PATCH /api/admin/ads/accounts/:id — 잠금해제(access_unlocked) / 정지(status) 변경
app.patch('/accounts/:id', async (c) => {
  await ensureAdsAccountSchema(c.env.DB)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []
  const binds: (string | number)[] = []
  if (body.access_unlocked !== undefined) { sets.push('access_unlocked = ?'); binds.push(body.access_unlocked ? 1 : 0) }
  if (body.status !== undefined) {
    const st = String(body.status)
    if (st !== 'active' && st !== 'suspended') return c.json({ success: false, error: '상태 값이 올바르지 않습니다' }, 400)
    sets.push('status = ?'); binds.push(st)
  }
  // 🆕 플랜 지정(엔타이틀먼트 뼈대) — 집행은 ADS_BILLING_ENFORCED='true' 일 때만.
  if (body.plan !== undefined) {
    const p = String(body.plan)
    if (p !== 'free' && p !== 'starter' && p !== 'pro') return c.json({ success: false, error: '플랜 값이 올바르지 않습니다' }, 400)
    await ensureEntitlementSchema(c.env.DB)
    await setPlan(c.env.DB, id, p as AdsPlan, body.period_end ? String(body.period_end) : null)
    if (!sets.length) return c.json({ success: true })
  }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  await c.env.DB.prepare(`UPDATE ad_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/ads/accounts/:id/reset-password — 어드민 강제 비번 재설정(현재 비번 확인 없음)
//   가입자가 비번을 잊었거나 초기 세팅이 필요할 때 운영자가 콘솔에서 직접 지정. 새 비번은 요청 바디로만.
app.post('/accounts/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const newPassword = String(body.password || '')
  const r = await adminSetPassword(c.env.DB, id, newPassword)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 404)
  return c.json({ success: true })
})

// ── 마케팅 서비스몰 운영 — 상품 관리 + 주문 접수함 ──────────────────────────
// GET /api/admin/ads/services — 전체 상품(비활성 포함)
app.get('/services', async (c) => c.json({ success: true, services: await listServices(c.env.DB, true) }))

// POST /api/admin/ads/services — 상품 생성/수정(id 있으면 수정)
app.post('/services', async (c) => {
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await adminUpsertService(c.env.DB, {
    id: b.id ? Number(b.id) : undefined, category: String(b.category || ''), name: String(b.name || ''),
    subtitle: b.subtitle ? String(b.subtitle) : undefined, description: b.description ? String(b.description) : undefined,
    pricing: (b.pricing || {}) as Parameters<typeof adminUpsertService>[1]['pricing'],
    active: b.active === undefined ? undefined : !!b.active, sort_order: b.sort_order != null ? Number(b.sort_order) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, id: r.id })
})

// GET /api/admin/ads/service-orders?status= — 주문 접수함
app.get('/service-orders', async (c) => {
  const status = (c.req.query('status') || '').trim() || undefined
  return c.json({ success: true, orders: await adminListOrders(c.env.DB, status) })
})

// PATCH /api/admin/ads/service-orders/:id — 상태/이행방식/메모
app.patch('/service-orders/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await adminUpdateOrder(c.env.DB, id, {
    status: b.status !== undefined ? String(b.status) : undefined,
    payment_status: b.payment_status !== undefined ? String(b.payment_status) : undefined,
    fulfillment_method: b.fulfillment_method !== undefined ? String(b.fulfillment_method) : undefined,
    admin_note: b.admin_note !== undefined ? String(b.admin_note) : undefined,
    supplier: b.supplier !== undefined ? String(b.supplier) : undefined,
    supplier_order_id: b.supplier_order_id !== undefined ? String(b.supplier_order_id) : undefined,
    supplier_cost: b.supplier_cost !== undefined ? Number(b.supplier_cost) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// GET /api/admin/ads/service-reviews — 리뷰 모더레이션 목록
app.get('/service-reviews', async (c) => c.json({ success: true, reviews: await adminListReviews(c.env.DB) }))

// PATCH /api/admin/ads/service-reviews/:id — 노출/숨김
app.patch('/service-reviews/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await adminSetReviewStatus(c.env.DB, id, b.status === 'hidden' ? 'hidden' : 'visible')
  return c.json({ success: true })
})

// ── 단축 링크 모더레이션 (피싱/스팸 신고 대응) ───────────────────────────────
// GET /api/admin/ads/short-links — 최근 링크(계정 포함)
app.get('/short-links', async (c) => c.json({ success: true, links: await adminListShortLinks(c.env.DB) }))

// PATCH /api/admin/ads/short-links/:id — 활성/비활성(비활성 = 즉시 404)
app.patch('/short-links/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await adminSetShortLinkActive(c.env.DB, id, !!b.active)
  return c.json({ success: true })
})

// ── 🎯 인플루언서 공용 풀(자동 수집) 어드민 (2026-07-20, Phase E) ───────────────
//   수집 엔진은 ur-ads 워커 cron. 여기(메인 어드민)는 결과 열람/큐레이션 + 키워드 관리 + 수동 트리거만.
//   ⚠️ 메인 번들 경량 유지 위해 수집/발굴 코드는 import 안 하고 전부 inline SQL(공용 풀 = account_id 0).
const POOL = 0

async function ensureKeywordTable(DB: D1Database) {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE, category TEXT,
    active INTEGER NOT NULL DEFAULT 1, hits INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'seed',
    created_at DATETIME DEFAULT (datetime('now')))`).run().catch(() => null)
  // 📊 키워드별 성과 컬럼(수집 엔진 ensureDiscoveryKeywords 와 동일 — 어드민이 먼저 조회해도 안전).
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN found_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN saved_total INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_saved INTEGER NOT NULL DEFAULT 0').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_discovery_keywords ADD COLUMN last_run_at DATETIME').run().catch(() => null)
}

// GET /api/admin/ads/influencer-pool?platform=&category=&hasContact=1&q=&limit=
app.get('/influencer-pool', async (c) => {
  const where = ['account_id = ?']; const binds: (string | number)[] = [POOL]
  const platform = (c.req.query('platform') || '').trim()
  if (['youtube', 'naver_blog', 'naver_cafe', 'tistory', 'instagram', 'tiktok'].includes(platform)) { where.push('platform = ?'); binds.push(platform) }
  const category = (c.req.query('category') || '').trim()
  if (category) { where.push('category = ?'); binds.push(category) }
  if (c.req.query('hasContact') === '1') where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  if (c.req.query('hasEmail') === '1') where.push('email IS NOT NULL')      // 아웃리치 리스트용(이메일 보유만)
  if (c.req.query('hasInstagram') === '1') where.push('instagram IS NOT NULL')
  const status = (c.req.query('status') || '').trim()   // 아웃리치 상태 필터
  if (['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(status)) { where.push('status = ?'); binds.push(status) }
  // 🎯 규모 필터(tier) — 유어딜 딜은 마이크로/중형(1만~50만)이 실전 효율 최고. YT 구독자 기준(네이버블로그는 지표 없어 무관).
  const tier = (c.req.query('tier') || '').trim()
  if (tier === 'nano') where.push('subscriber_count > 0 AND subscriber_count < 10000')
  else if (tier === 'micro') where.push('subscriber_count >= 10000 AND subscriber_count < 100000')
  else if (tier === 'mid') where.push('subscriber_count >= 100000 AND subscriber_count < 500000')
  else if (tier === 'macro') where.push('subscriber_count >= 500000')
  else if (tier === 'sweet') where.push("(platform IN ('naver_blog','naver_cafe','tistory') OR (subscriber_count >= 10000 AND subscriber_count < 500000))")
  // 이름/핸들 + source_keyword(수집 키워드) 매칭 — "방배" 검색 시 '방배 맛집'으로 찾은 리드도 걸림(지역 시딩 거르기).
  const q = (c.req.query('q') || '').trim().toLowerCase()
  if (q) { where.push('(LOWER(name) LIKE ? OR LOWER(COALESCE(handle,\'\')) LIKE ? OR LOWER(COALESCE(source_keyword,\'\')) LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  // 팔로업 필요 — 팔로업 예정일이 지났거나, 컨택함 상태로 5일+ 무진전(회신/계약 전).
  if (c.req.query('needFollowup') === '1') where.push("((follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at IS NOT NULL AND contacted_at <= datetime('now','-5 days')))")
  // 📥 인바운드 신청만 — 스스로 신청(사전동의)한 리드. 자유 연락 가능.
  if (c.req.query('source') === 'inbound') where.push("source = 'inbound'")
  // 🧹 노이즈 숨김 — 기존 풀에 남은 뉴스·방송·기관·체험단모집·대행 계정 제외(신규는 저장 시점에 이미 필터).
  if (c.req.query('hideNoise') === '1') {
    for (const w of ['뉴스', '신문사', '방송국', '연합뉴스', '체험단', '서포터즈', '기자단', '리뷰어 모집', '마케팅 대행', '광고 대행', '대행사', '구청', '시청']) {
      where.push('name NOT LIKE ?'); binds.push(`%${w}%`)
    }
  }
  const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 200)))
  const offset = Math.max(0, intParam(c.req.query('offset'), 0)) // 페이지네이션 — 풀 전체(1800+) 브라우징
  // 정렬: 기본 'fit'(유어딜 핏 — 스위트스팟 1만~50만 + 네이버블로그 최우선 → 준대형 → 나노 → 초대형).
  //   'subscribers'(구독자순) · 'recent'(최근수집).
  const sort = (c.req.query('sort') || 'fit').trim()
  const orderBy = sort === 'subscribers' ? 'subscriber_count DESC, id DESC'
    : sort === 'recent' ? 'id DESC'
    : `CASE
         WHEN platform IN ('naver_blog','naver_cafe','tistory') THEN 0
         WHEN subscriber_count >= 10000 AND subscriber_count < 500000 THEN 0
         WHEN subscriber_count >= 500000 AND subscriber_count < 1000000 THEN 1
         WHEN subscriber_count > 0 AND subscriber_count < 10000 THEN 2
         ELSE 3
       END ASC, subscriber_count DESC, id DESC`
  const whereSql = where.join(' AND ')
  // 현재 필터의 전체 건수(페이지네이션 UI "X / Y" + 더보기 판단) — 같은 where/binds 재사용.
  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${whereSql}`)
    .bind(...binds).first<{ n: number }>().catch(() => null)
  const rows = await c.env.DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at, contacted_at, follow_up_at, contact_channel, outreach_draft, source, consented_at
    FROM ad_influencer_leads WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all().catch(() => null)
  return c.json({ success: true, leads: rows?.results || [], total: totalRow?.n ?? 0, offset, limit })
})

// GET /api/admin/ads/influencer-pool/stats — 누적/최근 실행 통계 + 플랫폼별 카운트
app.get('/influencer-pool/stats', async (c) => {
  const agg = await c.env.DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN platform='youtube' THEN 1 ELSE 0 END) AS youtube,
      SUM(CASE WHEN platform='naver_blog' THEN 1 ELSE 0 END) AS naver_blog,
      SUM(CASE WHEN email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN platform='naver_cafe' THEN 1 ELSE 0 END) AS naver_cafe,
      SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS st_new,
      SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS st_contacted,
      SUM(CASE WHEN status='interested' THEN 1 ELSE 0 END) AS st_interested,
      SUM(CASE WHEN status='contracted' THEN 1 ELSE 0 END) AS st_contracted,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS st_rejected,
      SUM(CASE WHEN status='hold' THEN 1 ELSE 0 END) AS st_hold,
      -- 📊 아웃리치 퍼널: 한 번이라도 컨택한 리드(컨택/관심/계약) = 실제 아웃리치 모수
      SUM(CASE WHEN status IN ('contacted','interested','contracted') THEN 1 ELSE 0 END) AS reached,
      SUM(CASE WHEN status IN ('interested','contracted') THEN 1 ELSE 0 END) AS replied,
      -- 컨택 채널 분해(어느 채널이 먹히는지)
      SUM(CASE WHEN contact_channel='email' THEN 1 ELSE 0 END) AS ch_email,
      SUM(CASE WHEN contact_channel='dm' THEN 1 ELSE 0 END) AS ch_dm,
      SUM(CASE WHEN contact_channel='note' THEN 1 ELSE 0 END) AS ch_note,
      SUM(CASE WHEN contact_channel='kakao' THEN 1 ELSE 0 END) AS ch_kakao,
      SUM(CASE WHEN contact_channel='call' THEN 1 ELSE 0 END) AS ch_call,
      SUM(CASE WHEN contact_channel='other' THEN 1 ELSE 0 END) AS ch_other,
      SUM(CASE WHEN contacted_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS contacted7,
      SUM(CASE WHEN (follow_up_at IS NOT NULL AND follow_up_at <= date('now')) OR (status='contacted' AND contacted_at <= datetime('now','-5 days')) THEN 1 ELSE 0 END) AS need_followup,
      SUM(CASE WHEN collected_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_influencer_leads WHERE account_id = ?`).bind(POOL).first().catch(() => null)
  const stRow = await c.env.DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_autocollect_stats'").first<{ value: string }>().catch(() => null)
  let run: unknown = null; try { run = stRow?.value ? JSON.parse(stRow.value) : null } catch { run = null }
  return c.json({ success: true, stats: agg || {}, run, gate: c.env.ADS_AUTO_COLLECT_ENABLED === 'true' })
})

// PATCH /api/admin/ads/influencer-pool/:id { status?, memo?, follow_up_at? } — 아웃리치 큐레이션
app.patch('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const sets: string[] = []; const binds: (string | number)[] = []
  if (typeof b.status === 'string' && ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(b.status)) {
    sets.push('status = ?'); binds.push(b.status)
    if (['contacted', 'interested', 'contracted'].includes(b.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (typeof b.memo === 'string') { sets.push('memo = ?'); binds.push(b.memo.slice(0, 500)) }
  // 컨택 채널(이메일/인스타DM/네이버쪽지/카톡/전화/기타) — 빈 문자열이면 해제.
  if (b.contact_channel !== undefined) {
    const ch = b.contact_channel
    if (ch === null || ch === '') sets.push('contact_channel = NULL')
    else if (typeof ch === 'string' && ['email', 'dm', 'note', 'kakao', 'call', 'other'].includes(ch)) { sets.push('contact_channel = ?'); binds.push(ch) }
    else return c.json({ success: false, error: '컨택 채널 값 오류' }, 400)
  }
  if (b.follow_up_at !== undefined) {
    const f = b.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return c.json({ success: false, error: '날짜 형식(YYYY-MM-DD) 오류' }, 400)
  }
  if (!sets.length) return c.json({ success: false, error: '변경 항목 없음' }, 400)
  await c.env.DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// POST /api/admin/ads/influencer-pool/outreach-drafts { ids } — ✍ 개인화 제안 초안 일괄 생성(최대 10명)
//   ⚖️ 생성만, 발송 없음(정보통신망법 — 발송은 사람이 1건씩 검토 후). 초안은 리드 행(outreach_draft)에 저장.
app.post('/influencer-pool/outreach-drafts', async (c) => {
  await ensureInfluencerSchema(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const ids: number[] = (Array.isArray(b.ids) ? (b.ids as unknown[]) : []).map(Number).filter((n: number) => Number.isFinite(n) && n > 0).slice(0, OUTREACH_BATCH_MAX)
  if (!ids.length) return c.json({ success: false, error: `초안을 만들 리드를 선택해주세요 (최대 ${OUTREACH_BATCH_MAX}명)` }, 400)
  const ph = ids.map(() => '?').join(',')
  const rows = (await c.env.DB.prepare(`SELECT id, name, platform, subscriber_count, category, source_keyword, description
    FROM ad_influencer_leads WHERE account_id = ? AND id IN (${ph})`).bind(POOL, ...ids)
    .all<OutreachLeadInput>().catch(() => null))?.results || []
  if (!rows.length) return c.json({ success: false, error: '선택한 리드를 찾을 수 없습니다' }, 404)
  const r = await generateOutreachDrafts(c.env.ANTHROPIC_API_KEY, rows)
  if (!r.ok || !r.drafts) return c.json({ success: false, error: r.error || '생성 실패' }, 502)
  // 저장(1 batch) — {subject,body,dm,generated_at} JSON. 재생성 시 덮어씀(초안일 뿐 — 사람 검토가 최종).
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  await c.env.DB.batch(Array.from(r.drafts.entries()).map(([id, d]) =>
    c.env.DB.prepare('UPDATE ad_influencer_leads SET outreach_draft = ? WHERE id = ? AND account_id = ?')
      .bind(JSON.stringify({ ...d, generated_at: now }), id, POOL))).catch(() => null)
  const failed = ids.filter((id: number) => !r.drafts!.has(id))
  return c.json({ success: true, generated: r.drafts.size, failed, drafts: Object.fromEntries(Array.from(r.drafts.entries()).map(([id, d]) => [id, { ...d, generated_at: now }])) })
})

// POST /api/admin/ads/influencer-pool/merge-duplicates — 중복 리드 통합(1건만 남김)
//   1차: 같은 이메일 / 2차: 같은 인스타 핸들(이메일 없이 유튜브+블로그로 잡힌 동일인 — 인스타는 사람마다 고유).
//   상태 진전(계약>관심>컨택함>신규)·정보 많은 순으로 대표 1건을 남기고 나머지 삭제(대표에 없는 컨택은 보존 백필).
app.post('/influencer-pool/merge-duplicates', async (c) => {
  const DB = c.env.DB
  const rank = "CASE status WHEN 'contracted' THEN 4 WHEN 'interested' THEN 3 WHEN 'contacted' THEN 2 WHEN 'hold' THEN 1 ELSE 0 END"
  // 한 그룹(같은 키의 리드들)을 대표 1건으로 통합 — 대표에 없는 이메일/인스타/틱톡/링크는 나머지에서 백필.
  const mergeRows = async (rows: Array<{ id: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null }>): Promise<number> => {
    if (rows.length < 2) return 0
    const keep = rows[0]; const drop = rows.slice(1)
    const em = keep.email || drop.find(r => r.email)?.email || null
    const ig = keep.instagram || drop.find(r => r.instagram)?.instagram || null
    const tt = keep.tiktok || drop.find(r => r.tiktok)?.tiktok || null
    const lk = keep.links || drop.find(r => r.links)?.links || null
    await DB.prepare('UPDATE ad_influencer_leads SET email = ?, instagram = ?, tiktok = ?, links = ? WHERE id = ?').bind(em, ig, tt, lk, keep.id).run().catch(() => null)
    await DB.batch(drop.map(r => DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(r.id, POOL))).catch(() => null)
    return drop.length
  }
  const orderBy = `${rank} DESC, (CASE WHEN email IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN instagram IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN links IS NOT NULL THEN 1 ELSE 0 END) DESC, subscriber_count DESC, id ASC`
  let mergedEmail = 0, mergedInsta = 0
  // 1차 — 이메일.
  const emailGroups = (await DB.prepare(`SELECT email, COUNT(*) AS n FROM ad_influencer_leads
    WHERE account_id = ? AND email IS NOT NULL AND email != '' GROUP BY LOWER(email) HAVING n > 1`).bind(POOL)
    .all<{ email: string; n: number }>().catch(() => null))?.results || []
  for (const g of emailGroups) {
    const rows = (await DB.prepare(`SELECT id, email, instagram, tiktok, links FROM ad_influencer_leads
      WHERE account_id = ? AND LOWER(email) = LOWER(?) ORDER BY ${orderBy}`).bind(POOL, g.email)
      .all<{ id: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null }>().catch(() => null))?.results || []
    mergedEmail += await mergeRows(rows)
  }
  // 2차 — 인스타 핸들(이메일 병합 후 남은 상태 기준). 크로스플랫폼 동일인 자동 병합.
  const igGroups = (await DB.prepare(`SELECT LOWER(instagram) AS ig, COUNT(*) AS n FROM ad_influencer_leads
    WHERE account_id = ? AND instagram IS NOT NULL AND instagram != '' GROUP BY LOWER(instagram) HAVING n > 1`).bind(POOL)
    .all<{ ig: string; n: number }>().catch(() => null))?.results || []
  for (const g of igGroups) {
    const rows = (await DB.prepare(`SELECT id, email, instagram, tiktok, links FROM ad_influencer_leads
      WHERE account_id = ? AND LOWER(instagram) = ? ORDER BY ${orderBy}`).bind(POOL, g.ig)
      .all<{ id: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null }>().catch(() => null))?.results || []
    mergedInsta += await mergeRows(rows)
  }
  return c.json({ success: true, merged: mergedEmail + mergedInsta, mergedEmail, mergedInsta, groups: emailGroups.length + igGroups.length })
})

// GET /api/admin/ads/seller-match?category=맛집&region=강남 — 🔗 유어딜 셀러 매칭(읽기 전용)
//   인플루언서 카테고리 → 유어딜 이용권 카테고리 매핑 → 그 카테고리 승인 매장 목록 + **지역 커버리지** 반환.
//   region 파라미터(선택): 매장 상품의 시/군구/동(product_regions, 텍스트 LIKE)으로 필터 → 로컬 딜 근접 매칭.
//   ⚠️ 서비스 경계: sellers/products/product_regions 를 **읽기만** 함(변경 0). 매칭 판단은 어드민(사람).
app.get('/seller-match', async (c) => {
  const cat = (c.req.query('category') || '').trim()
  const region = (c.req.query('region') || '').trim().slice(0, 40)
  // 인플루언서 카테고리 → 유어딜 이용권 카테고리.
  const MAP: Record<string, string> = {
    '맛집': 'meal_voucher', '푸드': 'meal_voucher', '외식창업': 'meal_voucher',
    '뷰티': 'beauty_voucher', '네일': 'beauty_voucher',
    '숙소': 'stay_voucher',
  }
  const vcat = MAP[cat]
  if (!vcat) return c.json({ success: true, category: cat, voucher_category: null, region: region || null, sellers: [], note: '이 카테고리는 유어딜 이용권 카테고리(맛집/뷰티/네일/숙소)와 직접 매칭되지 않습니다.' })
  // product_regions(시/군구/동 텍스트 태깅, best-effort — 태깅된 매장만 지역 표시)로 커버리지 집계 + 선택 필터.
  //   region 지정 시 그 지역에 태깅된 매장만(LEFT JOIN + HAVING 으로 지역 없는 매장 제외).
  const regionLike = region ? `%${region}%` : ''
  const havingRegion = region
    ? `HAVING SUM(CASE WHEN pr.region_si LIKE ? OR pr.region_gu LIKE ? OR pr.region_dong LIKE ? THEN 1 ELSE 0 END) > 0`
    : ''
  const sql = `SELECT s.id, COALESCE(NULLIF(s.business_name,''), s.name) AS name,
      COUNT(DISTINCT p.id) AS product_count,
      GROUP_CONCAT(DISTINCT COALESCE(NULLIF(pr.region_gu,''), NULLIF(pr.region_si,''))) AS regions
    FROM sellers s
    JOIN products p ON p.seller_id = s.id AND p.is_active = 1 AND p.category = ?
    LEFT JOIN product_regions pr ON pr.product_id = p.id
    WHERE s.status = 'approved'
    GROUP BY s.id ${havingRegion}
    ORDER BY product_count DESC, s.id DESC LIMIT 100`
  const binds = region ? [vcat, regionLike, regionLike, regionLike] : [vcat]
  const rows = (await c.env.DB.prepare(sql).bind(...binds)
    .all<{ id: number; name: string; product_count: number; regions: string | null }>().catch(() => null))?.results || []
  return c.json({ success: true, category: cat, voucher_category: vcat, region: region || null, sellers: rows })
})

// DELETE /api/admin/ads/influencer-pool/:id
app.delete('/influencer-pool/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  await c.env.DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(id, POOL).run().catch(() => null)
  return c.json({ success: true })
})

// GET /api/admin/ads/influencer-pool/keywords — 수집 키워드 목록(활성/후보)
app.get('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  // 성과순(saved_total) 정렬 — "잘 무는" 키워드가 위로. 지역 시딩 조정용.
  const r = await c.env.DB.prepare('SELECT id, keyword, category, active, hits, source, created_at, found_total, saved_total, last_saved, last_run_at FROM ad_discovery_keywords ORDER BY active DESC, saved_total DESC, hits DESC, id ASC LIMIT 1000').all().catch(() => null)
  return c.json({ success: true, keywords: r?.results || [] })
})

// POST /api/admin/ads/influencer-pool/keywords { keyword, category? } — 키워드 추가
app.post('/influencer-pool/keywords', async (c) => {
  await ensureKeywordTable(c.env.DB)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const kw = String(b.keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return c.json({ success: false, error: '키워드는 2~40자' }, 400)
  await c.env.DB.prepare("INSERT OR IGNORE INTO ad_discovery_keywords (keyword, category, active, source) VALUES (?, ?, 1, 'manual')")
    .bind(kw, String(b.category || '수동').slice(0, 40)).run().catch(() => null)
  return c.json({ success: true })
})

// PATCH /api/admin/ads/influencer-pool/keywords/:id { active } — 활성/비활성
app.patch('/influencer-pool/keywords/:id', async (c) => {
  const id = Number(c.req.param('id')); if (!Number.isFinite(id)) return c.json({ success: false, error: '잘못된 ID' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await c.env.DB.prepare('UPDATE ad_discovery_keywords SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run().catch(() => null)
  return c.json({ success: true })
})

// GET /api/admin/ads/influencer-pool/export?format=xls|csv — 🎯 풀 전체 다운로드 (2026-07-20 대표 "엑셀 + 카테고리별 분리")
//   xls = SpreadsheetML(엑셀이 여는 XML) **카테고리별 시트 분리** + 전체 시트. csv = BOM 단일 파일(엑셀 호환).
//   화면 500개 제한과 무관하게 전체(안전 상한 20,000) 내보냄. 셀은 String 타입이라 수식 실행 없음(csv 는 가드).
app.get('/influencer-pool/export', async (c) => {
  const rows = (await c.env.DB.prepare(`SELECT platform, name, handle, url, subscriber_count, video_count, email, instagram, tiktok, links, category, source_keyword, status, collected_at
    FROM ad_influencer_leads WHERE account_id = ? ORDER BY category, subscriber_count DESC, id DESC LIMIT 20000`)
    .bind(POOL).all<{ platform: string; name: string; handle: string | null; url: string; subscriber_count: number; video_count: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null; category: string | null; source_keyword: string | null; status: string; collected_at: string }>()
    .catch(() => null))?.results || []
  const PLAT: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡' }
  const HEAD = ['플랫폼', '이름', '핸들', 'URL', '구독자', '이메일', '인스타그램', '틱톡', '기타링크', '카테고리', '수집키워드', '상태', '수집일']
  const noSub = (p: string) => ['naver_blog', 'naver_cafe', 'tistory'].includes(p) // 구독자 지표 없는 플랫폼
  const cells = (r: typeof rows[number]) => [PLAT[r.platform] || r.platform, r.name, r.handle || '', r.url, noSub(r.platform) ? '' : String(r.subscriber_count || 0), r.email || '', r.instagram ? `@${r.instagram}` : '', r.tiktok ? `@${r.tiktok}` : '', r.links || '', r.category || '기타', r.source_keyword || '', r.status, (r.collected_at || '').slice(0, 10)]

  if (c.req.query('format') === 'csv') {
    const csvEscapeCell = (v: string) => { const s = String(v ?? ''); const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g }
    const body = [HEAD.join(','), ...rows.map(r => cells(r).map(csvEscapeCell).join(','))].join('\r\n')
    return new Response('﻿' + body, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="influencer-pool.csv"` } })
  }

  // SpreadsheetML — 카테고리별 시트 + 전체 시트. 시트명은 엑셀 제약(31자·특수문자) 정리.
  const xe = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rowXml = (vals: string[]) => `<Row>${vals.map(v => `<Cell><Data ss:Type="String">${xe(v)}</Data></Cell>`).join('')}</Row>`
  const sheetXml = (name: string, rs: typeof rows) => `<Worksheet ss:Name="${xe(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '기타')}"><Table>${rowXml(HEAD)}${rs.map(r => rowXml(cells(r))).join('')}</Table></Worksheet>`
  const byCat = new Map<string, typeof rows>()
  for (const r of rows) { const k = r.category || '기타'; const arr = byCat.get(k) || []; arr.push(r); byCat.set(k, arr) }
  const sheets = [sheetXml(`전체 (${rows.length})`, rows), ...Array.from(byCat.entries()).map(([k, rs]) => sheetXml(`${k} (${rs.length})`, rs))].join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets}</Workbook>`
  return new Response(xml, { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename="influencer-pool.xls"` } })
})

// POST /api/admin/ads/influencer-pool/collect — 수동 수집(ur-ads 워커에 서비스바인딩으로 위임 → 메인 번들 무영향)
//   🔥 백그라운드 실행(2026-07-20): 수집은 외부 API 수십 건 순회라 수십 초 걸려 동기 대기 시 브라우저 타임아웃
//   → "실패"로 오표시. waitUntil 로 넘겨 즉시 started 반환, 완료는 UI 가 stats(last_run) 폴링으로 따라잡음.
//   main 의 waitUntil 이 서비스바인딩 subrequest(ur-ads 동기 수집)를 살려둠 — 매시간 cron 과 동일 지속성.
app.post('/influencer-pool/collect', async (c) => {
  const ads = c.env.ADS
  if (!ads?.fetch) return c.json({ success: false, error: 'ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작' }, 503)
  const kick = async () => { try { await ads.fetch(new Request('https://ur-ads/__ads/collect', { method: 'POST' })) } catch { /* fail-soft */ } }
  if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(kick()); return c.json({ success: true, started: true }) }
  // 폴백(waitUntil 미지원 환경): 동기 실행(구 동작).
  try { await kick(); return c.json({ success: true, started: false }) }
  catch { return c.json({ success: false, error: 'ur-ads 위임 오류' }, 502) }
})

export { app as adminAdsRoutes }
