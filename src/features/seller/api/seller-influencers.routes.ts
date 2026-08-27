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
 * 데이터: ad_influencer_leads — **읽기 전용**. DB 핸들은 반드시 `adsLeadsDb(c.env)` 라우터로
 *   얻는다(ads-leads-db.test.ts R1 강제) — 리드 테이블 SQL 은 ADS_DB, 나머지(platform_settings·
 *   products·outreach)는 메인 DB 로 문장 단위 자동 라우팅. ADS_DB 미바인딩이면 메인 DB 그대로
 *   (이사 전 데이터가 원래 거기 있으므로 올바른 폴백), 테이블 자체가 없으면 catch → 빈 목록.
 */
import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '@/shared/ads/leads-db'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { intParam } from '@/shared/pagination'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { ensureOfferInvitesTable, generateOfferToken } from '@/features/marketing/api/influencer-offer-invites.routes'
import { enqueueOutreachEmails } from '@/features/marketing/api/outreach-email'
import {
  resolveAdsDbAccess, checkAdsDbQuota, recordAdsDbRows, type AdsDbAccess,
} from '@/worker/utils/ads-db-access'

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

/**
 * 🔒 유어애즈 DB 열람 게이트 (2026-08-27 대표 지시 — "대행사로 가입하면 유어애즈 DB 를 볼 수 없게").
 *
 * 판정은 `ads-db-access.ts` 가 SSOT 다. 여기서는 **거절을 응답으로 바꾸는 일만** 한다 —
 * 판정을 라우트마다 다시 쓰면 반드시 갈라지고, 갈라진 쪽이 조용히 열린다.
 *
 * ⚠️ DB 핸들은 여기서도 `adsLeadsDb(c.env)` 로 얻는다 — 게이트가 읽는 것은 리드 테이블이 아니라
 *    `seller_meta`·`seller_operators`·`platform_settings`(메인 DB)지만, 라우터가 문장 단위로
 *    알아서 고른다. bare `adsLeadsDb(c.env)` 를 쓰면 `ads-leads-db.test.ts` R1 이 빨간불을 낸다 —
 *    "이 파일은 리드 테이블을 만지므로 핸들 선택을 사람이 하지 마라" 가 그 가드의 취지다.
 *
 * ⚠️ 403 본문에 `code` 를 실어 보낸다 — 프런트가 "왜 막혔는지"를 구분해서 보여줘야
 *    막힌 사장님이 무엇을 하면 되는지 알 수 있다(그냥 실패 토스트면 문의만 늘어난다).
 */
async function gateAdsDb(c: Ctx, opts?: { quota?: boolean }): Promise<Response | null> {
  const sellerId = sid(c)
  const acc: AdsDbAccess = await resolveAdsDbAccess(adsLeadsDb(c.env), sellerId)
  if (!acc.allowed) return c.json({ success: false, error: acc.error, code: acc.code, blocked: true }, 403)
  if (opts?.quota) {
    const q = await checkAdsDbQuota(adsLeadsDb(c.env), sellerId)
    if (!q.allowed) return c.json({ success: false, error: q.error, code: q.code, blocked: true }, 429)
  }
  return null
}

const OUTREACH_CHANNELS = ['instagram', 'youtube', 'tiktok', 'blog', 'naver_clip'] as const
type OutreachChannel = (typeof OUTREACH_CHANNELS)[number]

// ── 제안 테이블 (메인 DB — repair-schema 에도 동일 등록) ────────────────────────────
// adsLeadsDb 라우터는 호출마다 새 객체라 WeakSet 메모가 안 먹는다 → isolate 단위 boolean.
let _ensuredOnce = false
async function ensureOutreachTable(DB: D1Database) {
  if (_ensuredOnce) return
  _ensuredOnce = true
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
    const denied = await gateAdsDb(c as Ctx, { quota: true })
    if (denied) return denied
    const db = adsLeadsDb(c.env)

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
    const rows = await db.prepare(`
      SELECT id, platform, handle, name, category, region, thumbnail,
             subscriber_count, video_count, recent_avg_views, recent_avg_comments, last_post_at
        FROM ad_influencer_leads
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all().catch(() => ({ results: [] as never[] }))

    const cnt = await db.prepare(`SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE ${where.join(' AND ')}`)
      .bind(...binds).first<{ n: number }>().catch(() => null)

    // 컨택 단가(표시용) — 청구 배선은 머니 경로라 별도(기본 0 = 미청구 안내)
    const fee = await db.prepare(`SELECT value FROM platform_settings WHERE key = 'influencer_contact_fee_krw'`)
      .first<{ value: string }>().catch(() => null)

    // 열람량 적립 — **실제로 내보낸 행 수**만 센다(요청 수가 아니라). 상한의 근거이자 감사 기록.
    const served = (rows.results || []).length
    await recordAdsDbRows(adsLeadsDb(c.env), sid(c as Ctx), served)

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
    // 카테고리 분포도 자산이다 — 어느 분야에 깊이가 있는지가 그대로 드러난다.
    const denied = await gateAdsDb(c as Ctx)
    if (denied) return denied
    const db = adsLeadsDb(c.env)
    const rows = await db.prepare(`
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
    const denied = await gateAdsDb(c as Ctx)
    if (denied) return denied
    const sellerId = sid(c as Ctx)
    const db = adsLeadsDb(c.env)
    await ensureOutreachTable(db)
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
      const own = await db.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ? LIMIT 1')
        .bind(productId, sellerId).first().catch(() => null)
      if (!own) return c.json({ success: false, error: '내 매장의 이용권만 제안에 담을 수 있습니다' }, 403)
    }

    const fee = await db.prepare(`SELECT value FROM platform_settings WHERE key = 'influencer_contact_fee_krw'`)
      .first<{ value: string }>().catch(() => null)
    const unitFee = Number(fee?.value) || 0

    const ins = await db.prepare(`
      INSERT INTO influencer_outreach_requests
        (seller_id, product_id, target_lead_ids, target_count, commission_pct, product_support, channels, period_days, message, status, quoted_fee_krw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    `).bind(sellerId, productId, JSON.stringify(ids), ids.length, pct, support, JSON.stringify(channels), periodDays, message, unitFee * ids.length).run()

    // 타깃 리드별 수락 토큰 — 어드민 큐가 발송 시 이 URL 을 함께 전달한다(수락 → 딜 발효 다리).
    const outreachId = Number(ins.meta?.last_row_id)
    if (outreachId) {
      await ensureOfferInvitesTable(db)
      const inviteStmts = ids.map((leadId) => db.prepare(
        `INSERT INTO influencer_offer_invites (outreach_id, lead_id, token, seller_id, product_id, commission_pct, product_support, channels, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(outreachId, leadId, generateOfferToken(), sellerId, productId, pct, support, JSON.stringify(channels), message))
      await db.batch(inviteStmts).catch(() => null) // fail-soft — 실패 시 어드민 큐에서 재생성 가능
    }

    // ①(2026-08-22 대표): 자동발송 게이트 — 켜면 어드민 검토 없이 즉시 드립 큐 적재(발송은 여전히
    //   유어딜 시스템 — 연락처는 끝까지 셀러에게 안 보인다). 기본 OFF = 어드민 검토 유지.
    try {
      const auto = await db.prepare("SELECT value FROM platform_settings WHERE key = 'outreach_auto_send'")
        .first<{ value: string }>()
      if (auto?.value === 'true' && outreachId) {
        await enqueueOutreachEmails(c.env, outreachId)
      }
    } catch { /* fail-soft */ }

    // 유어딜 운영이 받아 발송한다 — 어드민 벨 (fail-soft)
    await createDashboardNotification(
      db, 'admin', null, 'influencer_outreach',
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
    const db = adsLeadsDb(c.env)
    await ensureOutreachTable(db)
    const rows = await db.prepare(`
      SELECT o.id, o.product_id, o.target_count, o.commission_pct, o.product_support, o.channels, o.period_days,
             o.status, o.quoted_fee_krw, o.created_at,
             (SELECT COUNT(*) FROM influencer_offer_invites v WHERE v.outreach_id = o.id AND v.status = 'accepted') AS accepted_count
        FROM influencer_outreach_requests o WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 50
    `).bind(sellerId).all().catch(() => ({ results: [] as never[] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '제안 목록을 불러오지 못했습니다', '[seller-influencers]')
  }
})

export { app as sellerInfluencersRoutes }
