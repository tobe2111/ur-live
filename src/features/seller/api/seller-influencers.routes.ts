/**
 * 📣 셀러 대시보드 × 유어애즈 — 인플루언서 탐색 + 협업 제안(아웃리치)
 *   설계 SSOT: docs/design/seller-dashboard-v2.md (2026-08-20 대표 확정)
 *
 * 대표 확정 사항:
 *   ① 셀러 대시보드에서 유어애즈 인플루언서 DB 를 **리스트로 탐색**(크리에이터 탐색 UI 참고)
 *   ② 제안 조건: 판매 커미션 %, 상품 무상/유상 제공, 진행 매체(인스타·유튜브·틱톡·블로그·클립), 기간
 *   ③ 제안 양식은 셀러가 작성·저장 → **발송은 유어딜이 대행**(이메일/DM 에 유어딜 소개를 덧붙여)
 *   ④ 컨택은 인플루언서 1명당 과금 — ⚠️ **비용 청구 배선은 이 파일에 없다**(머니 경로 — 게이트).
 *      지금은 단가(platform_settings.influencer_contact_fee_krw)를 **표시**하고 제안을 기록만 한다.
 *   ⑤ 🔒 **연락처(email/instagram DM 주소)는 어떤 셀러에게도 반환하지 않는다** — 중개자 비공개는
 *      대표 명시 지시이고, 직접 매장도 발송을 유어딜이 대행하므로 v1 에서 연락처가 필요 없다.
 *      (연락처 열람 판매는 과금 배선과 함께 별도 결정 — design doc §6)
 *
 * 데이터: ADS_DB(유어애즈 전용 D1, wrangler.toml 바인딩) 의 ad_influencer_leads — **읽기 전용**.
 *   ADS_DB 미바인딩 환경(로컬 등)은 빈 목록 + configured:false (fail-soft).
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { intParam } from '@/shared/pagination'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

const app = new Hono<{ Bindings: Env }>()
type Ctx = Context<{ Bindings: Env }>

// 모든 라우트: 셀러 인증 (서브앱 — 부모 미들웨어 미상속)
app.use('*', async (c, next) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
  ;(c as Ctx).set('sellerId' as never, sellerId as never)
  await next()
})
const sid = (c: Ctx): number => (c as any).get('sellerId') as number

const OUTREACH_CHANNELS = ['instagram', 'youtube', 'tiktok', 'blog', 'naver_clip'] as const
type OutreachChannel = (typeof OUTREACH_CHANNELS)[number]

// ── 제안 테이블 (메인 DB — repair-schema 에도 동일 등록) ────────────────────────────
const _ensured = new WeakSet<object>()
async function ensureOutreachTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS influencer_outreach_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      product_id INTEGER,
      target_lead_ids TEXT NOT NULL,
      target_count INTEGER NOT NULL DEFAULT 0,
      commission_pct REAL NOT NULL DEFAULT 0,
      product_support TEXT NOT NULL DEFAULT 'free',
      channels TEXT NOT NULL DEFAULT '[]',
      period_days INTEGER,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      quoted_fee_krw INTEGER NOT NULL DEFAULT 0,
      admin_note TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_outreach_seller ON influencer_outreach_requests(seller_id, created_at DESC)`).run()
  } catch { /* fail-soft */ }
}

// ── GET /list — 인플루언서 탐색 (연락처 무반환) ─────────────────────────────────────
app.get('/list', async (c) => {
  try {
    const ads = c.env.ADS_DB
    if (!ads) return c.json({ success: true, data: [], total: 0, configured: false })

    const q = c.req.query()
    const page = Math.max(1, intParam(q.page, 1))
    const limit = Math.min(50, Math.max(1, intParam(q.limit, 20)))
    const offset = (page - 1) * limit

    const where: string[] = [
      "COALESCE(opted_out, 0) = 0",       // 수신 거부 존중
      "COALESCE(is_brand, 0) = 0",        // 브랜드 계정 제외 — 개인 크리에이터만
      "COALESCE(subscriber_count, 0) > 0",
    ]
    const binds: (string | number)[] = []
    if (q.category) { where.push('category = ?'); binds.push(String(q.category).slice(0, 40)) }
    if (q.platform) { where.push('platform = ?'); binds.push(String(q.platform).slice(0, 20)) }
    const minF = intParam(q.min_followers, 0); const maxF = intParam(q.max_followers, 0)
    if (minF > 0) { where.push('subscriber_count >= ?'); binds.push(minF) }
    if (maxF > 0) { where.push('subscriber_count <= ?'); binds.push(maxF) }
    if (q.search) { where.push('(handle LIKE ? OR name LIKE ?)'); const t = `%${String(q.search).slice(0, 50)}%`; binds.push(t, t) }

    const SORTS: Record<string, string> = {
      followers: 'subscriber_count DESC', posts: 'video_count DESC',
      avg_views: 'recent_avg_views DESC', comments: 'recent_avg_comments DESC',
      score: 'lead_score DESC',
    }
    const orderBy = SORTS[String(q.sort || '')] || 'subscriber_count DESC'

    // 🔒 연락처 컬럼(email/instagram/links)은 SELECT 목록에 아예 없다 — 실수로도 안 나간다.
    const rows = await ads.prepare(`
      SELECT id, platform, handle, name, category, region, thumbnail,
             subscriber_count, video_count, recent_avg_views, recent_avg_comments, last_post_at
        FROM ad_influencer_leads
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all().catch(() => ({ results: [] as never[] }))

    const cnt = await ads.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${where.join(' AND ')}`)
      .bind(...binds).first<{ n: number }>().catch(() => null)

    // 컨택 단가(표시용) — 청구 배선은 머니 경로라 별도(기본 0 = 미청구 안내)
    const fee = await c.env.DB.prepare(`SELECT value FROM platform_settings WHERE key = 'influencer_contact_fee_krw'`)
      .first<{ value: string }>().catch(() => null)

    return c.json({
      success: true, configured: true,
      data: rows.results || [], total: cnt?.n ?? 0, page, limit,
      contact_fee_krw: Number(fee?.value) || 0,
    })
  } catch (err) {
    return safeError(c, err, '인플루언서 목록을 불러오지 못했습니다', '[seller-influencers]')
  }
})

// ── GET /categories — 필터용 카테고리 분포 ─────────────────────────────────────────
app.get('/categories', async (c) => {
  try {
    const ads = c.env.ADS_DB
    if (!ads) return c.json({ success: true, data: [] })
    const rows = await ads.prepare(`
      SELECT category, COUNT(*) AS n FROM ad_influencer_leads
       WHERE category IS NOT NULL AND category != '' AND COALESCE(opted_out,0)=0 AND COALESCE(is_brand,0)=0
       GROUP BY category ORDER BY n DESC LIMIT 30
    `).all<{ category: string; n: number }>().catch(() => ({ results: [] as never[] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '카테고리를 불러오지 못했습니다', '[seller-influencers]')
  }
})

// ── POST /outreach — 제안 저장(발송은 유어딜 대행 — 어드민 큐 통지) ──────────────────
app.post('/outreach', rateLimit({ action: 'influencer_outreach', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = sid(c as Ctx)
    await ensureOutreachTable(c.env.DB)
    const b = await c.req.json<{
      target_lead_ids?: unknown; product_id?: number
      commission_pct?: number; product_support?: string
      channels?: unknown; period_days?: number; message?: string
    }>().catch(() => ({} as any))

    const ids = Array.isArray(b.target_lead_ids)
      ? [...new Set(b.target_lead_ids.map(Number).filter((n: number) => Number.isFinite(n) && n > 0))].slice(0, 50)
      : []
    if (ids.length === 0) return c.json({ success: false, error: '제안할 인플루언서를 선택해주세요 (최대 50명)' }, 400)

    const pct = Number(b.commission_pct)
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) {
      return c.json({ success: false, error: '판매 커미션은 0~90% 사이로 입력해주세요' }, 400)
    }
    const support = b.product_support === 'paid' ? 'paid' : 'free'
    const channels = Array.isArray(b.channels)
      ? (b.channels.filter((x: unknown): x is OutreachChannel => OUTREACH_CHANNELS.includes(x as OutreachChannel)))
      : []
    if (channels.length === 0) return c.json({ success: false, error: '진행 매체를 1개 이상 선택해주세요' }, 400)
    const message = String(b.message || '').trim()
    if (message.length < 20 || message.length > 3000) {
      return c.json({ success: false, error: '제안 내용을 20자 이상 3000자 이내로 작성해주세요' }, 400)
    }
    const periodDays = Number.isFinite(Number(b.period_days)) ? Math.max(1, Math.min(365, Number(b.period_days))) : null
    const productId = Number.isFinite(Number(b.product_id)) && Number(b.product_id) > 0 ? Number(b.product_id) : null
    if (productId) {
      // 자기 매장 이용권만 걸 수 있다 (IDOR)
      const own = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ? LIMIT 1')
        .bind(productId, sellerId).first().catch(() => null)
      if (!own) return c.json({ success: false, error: '내 매장의 이용권만 제안에 담을 수 있습니다' }, 403)
    }

    const fee = await c.env.DB.prepare(`SELECT value FROM platform_settings WHERE key = 'influencer_contact_fee_krw'`)
      .first<{ value: string }>().catch(() => null)
    const unitFee = Number(fee?.value) || 0

    const ins = await c.env.DB.prepare(`
      INSERT INTO influencer_outreach_requests
        (seller_id, product_id, target_lead_ids, target_count, commission_pct, product_support, channels, period_days, message, status, quoted_fee_krw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    `).bind(sellerId, productId, JSON.stringify(ids), ids.length, pct, support, JSON.stringify(channels), periodDays, message, unitFee * ids.length).run()

    // 유어딜 운영이 받아 발송한다 — 어드민 벨 (fail-soft)
    await createDashboardNotification(
      c.env.DB, 'admin', null, 'influencer_outreach',
      `📣 인플루언서 제안 요청 ${ids.length}명`,
      `셀러 #${sellerId} — 커미션 ${pct}% · ${support === 'free' ? '무상 제공' : '유상'} · ${channels.join(', ')}${unitFee ? ` · 예상 비용 ${(unitFee * ids.length).toLocaleString('ko-KR')}원` : ''}`,
      '/admin/influencer-outreach',
    ).catch(() => {})

    return c.json({
      success: true,
      data: {
        id: Number(ins.meta?.last_row_id), target_count: ids.length,
        quoted_fee_krw: unitFee * ids.length,
        message: unitFee > 0
          ? `제안이 접수되었습니다. 발송 확정 시 ${ids.length}명 × ${unitFee.toLocaleString('ko-KR')}원이 청구됩니다.`
          : '제안이 접수되었습니다. 유어딜이 검토 후 인플루언서에게 전달해 드려요.',
      },
    })
  } catch (err) {
    return safeError(c, err, '제안 접수 중 오류가 발생했습니다', '[seller-influencers]')
  }
})

// ── GET /outreach — 내 제안 목록 ───────────────────────────────────────────────────
app.get('/outreach', async (c) => {
  try {
    const sellerId = sid(c as Ctx)
    await ensureOutreachTable(c.env.DB)
    const rows = await c.env.DB.prepare(`
      SELECT id, product_id, target_count, commission_pct, product_support, channels, period_days,
             status, quoted_fee_krw, created_at
        FROM influencer_outreach_requests WHERE seller_id = ? ORDER BY created_at DESC LIMIT 50
    `).bind(sellerId).all().catch(() => ({ results: [] as never[] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '제안 목록을 불러오지 못했습니다', '[seller-influencers]')
  }
})

export { app as sellerInfluencersRoutes }
