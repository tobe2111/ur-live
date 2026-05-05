/**
 * Digital Products API (2026-05-05 Phase 1)
 *
 * 무재고 디지털/정보 상품 (전자책, 강의, 가이드) 접근권 관리.
 *
 * 엔드포인트:
 *   GET  /api/digital/my              — 내 디지털 보관함 목록
 *   GET  /api/digital/access/:token   — access_token 으로 다운로드 URL 획득 (signed URL)
 *   GET  /api/digital/preview/:productId — 무료 미리보기 URL (인증 불필요)
 *   POST /api/digital/revoke/:accessId   — 환불 시 access 무효화 (admin/seller 본인)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'

export const digitalRoutes = new Hono<{ Bindings: Env }>()
digitalRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

// ── GET /api/digital/my — 내 디지털 보관함 ─────────────────────────
digitalRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        dpa.id AS access_id,
        dpa.access_token,
        dpa.expires_at,
        dpa.download_count,
        dpa.download_limit,
        dpa.last_accessed,
        dpa.status,
        dpa.created_at,
        p.id AS product_id,
        p.name AS product_name,
        p.image_url,
        p.product_kind,
        p.content_format,
        p.file_size_mb,
        p.preview_url,
        s.name AS seller_name,
        s.profile_image AS seller_image
      FROM digital_product_access dpa
      JOIN products p ON p.id = dpa.product_id
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE dpa.user_id = ? AND dpa.status = 'active'
      ORDER BY dpa.created_at DESC
      LIMIT 100
    `).bind(String(user.id)).all()

    return c.json({ success: true, data: results || [] })
  } catch (err) {
    if (c.env.ENVIRONMENT !== 'production') console.error('[digital/my]', err)
    return c.json({ success: false, error: '디지털 상품 조회 실패' }, 500)
  }
})

// ── GET /api/digital/access/:token — 다운로드/시청 URL 획득 ───────
digitalRoutes.get('/access/:token', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const token = c.req.param('token')

  try {
    const access = await c.env.DB.prepare(`
      SELECT dpa.*, p.content_url, p.content_format, p.product_kind
      FROM digital_product_access dpa
      JOIN products p ON p.id = dpa.product_id
      WHERE dpa.access_token = ?
    `).bind(token).first<{
      id: number; user_id: string; product_id: number;
      expires_at: string | null; download_count: number; download_limit: number;
      status: string; content_url: string | null; content_format: string | null;
      product_kind: string;
    }>()

    if (!access) return c.json({ success: false, error: '접근권을 찾을 수 없습니다' }, 404)
    if (String(access.user_id) !== String(user.id)) {
      // 본인 access 가 아니면 거부 — IDOR 방어
      return c.json({ success: false, error: '본인 구매한 상품만 접근 가능합니다' }, 403)
    }
    if (access.status !== 'active') {
      return c.json({ success: false, error: `접근권이 ${access.status} 상태입니다` }, 403)
    }
    if (access.expires_at) {
      const expired = new Date(access.expires_at).getTime() < Date.now()
      if (expired) {
        await c.env.DB.prepare("UPDATE digital_product_access SET status = 'expired' WHERE id = ?")
          .bind(access.id).run().catch(() => {})
        return c.json({ success: false, error: '접근 기간이 만료되었습니다' }, 403)
      }
    }
    if (access.download_count >= access.download_limit) {
      return c.json({ success: false, error: `다운로드 한도 초과 (${access.download_limit}회)` }, 403)
    }
    if (!access.content_url) {
      return c.json({ success: false, error: '콘텐츠 URL이 설정되지 않았습니다 (셀러 문의 필요)' }, 503)
    }

    // download_count 증가 + 로그
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
    const ua = c.req.header('user-agent') || ''
    await c.env.DB.batch([
      c.env.DB.prepare(`
        UPDATE digital_product_access
        SET download_count = download_count + 1, last_accessed = datetime('now')
        WHERE id = ?
      `).bind(access.id),
      c.env.DB.prepare(`
        INSERT INTO digital_download_logs (access_id, user_id, product_id, ip, user_agent, status)
        VALUES (?, ?, ?, ?, ?, 'success')
      `).bind(access.id, access.user_id, access.product_id, ip, ua),
    ])

    // Phase 1: 단순 URL 반환 (Phase 2 에서 R2 signed URL 로 교체)
    // content_url 이 외부 URL (YouTube/Vimeo) 면 그대로, R2 면 임시 signed URL 발급 예정
    return c.json({
      success: true,
      data: {
        url: access.content_url,
        format: access.content_format,
        kind: access.product_kind,
        download_count: access.download_count + 1,
        download_limit: access.download_limit,
      },
    })
  } catch (err) {
    if (c.env.ENVIRONMENT !== 'production') console.error('[digital/access]', err)
    return c.json({ success: false, error: '접근권 조회 실패' }, 500)
  }
})

// ── GET /api/digital/preview/:productId — 무료 미리보기 ───────────
digitalRoutes.get('/preview/:productId', async (c) => {
  const productId = c.req.param('productId')
  try {
    const p = await c.env.DB.prepare(`
      SELECT preview_url, name, content_format, product_kind
      FROM products
      WHERE id = ? AND product_kind != 'physical' AND COALESCE(is_active, 1) = 1
    `).bind(productId).first<{ preview_url: string | null; name: string; content_format: string; product_kind: string }>()
    if (!p) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (!p.preview_url) return c.json({ success: false, error: '미리보기 미제공' }, 404)
    return c.json({ success: true, data: { url: p.preview_url, name: p.name, format: p.content_format, kind: p.product_kind } })
  } catch {
    return c.json({ success: false, error: '미리보기 조회 실패' }, 500)
  }
})

// ── POST /api/digital/revoke/:accessId — 환불 시 access 무효화 ──
digitalRoutes.post('/revoke/:accessId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const accessId = c.req.param('accessId')

  try {
    // 셀러 본인 또는 admin 만 가능
    const access = await c.env.DB.prepare(`
      SELECT dpa.*, p.seller_id
      FROM digital_product_access dpa
      JOIN products p ON p.id = dpa.product_id
      WHERE dpa.id = ?
    `).bind(accessId).first<{ id: number; product_id: number; seller_id: number }>()
    if (!access) return c.json({ success: false, error: '접근권을 찾을 수 없습니다' }, 404)

    const isSeller = user.type === 'seller' && Number(user.id) === Number(access.seller_id)
    const isAdmin = user.type === 'admin'
    if (!isSeller && !isAdmin) return c.json({ success: false, error: '권한 없음' }, 403)

    await c.env.DB.prepare("UPDATE digital_product_access SET status = 'revoked' WHERE id = ?")
      .bind(accessId).run()
    return c.json({ success: true })
  } catch (err) {
    if (c.env.ENVIRONMENT !== 'production') console.error('[digital/revoke]', err)
    return c.json({ success: false, error: 'revoke 실패' }, 500)
  }
})
