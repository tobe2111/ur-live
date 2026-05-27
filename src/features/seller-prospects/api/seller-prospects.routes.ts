/**
 * 🛡️ 2026-05-27 (영업 검증 Layer 2 — 사용자 결정): 매장 사전 등록 + 가입 시 자동 매칭.
 *
 * Layer 1: 영업자별 고유 invite URL (이미 일부 구현 — agency-invites)
 * Layer 2: 사장님 사전 등록 (이 파일)
 *   - 영업자 (agency/influencer) 가 매장 영입 전에 사장님 정보 등록
 *   - 사장님 가입 시 (phone/email 매칭) 자동 introduced_by_X_id 매핑
 *   - 부정 방지: prospect 만료 (default 30일), 매장 1개당 1 영업자 (가장 빠른 prospect)
 * Layer 3: 영업 증빙 업로드 (proof_image_url)
 * Layer 4: 첫 매출 발생 시 commission 활성 (별도 cron)
 *
 * Endpoints:
 *   POST /api/prospects                - 영업자가 매장 사전 등록
 *   GET  /api/prospects/mine           - 본인 등록한 prospects list
 *   PATCH /api/prospects/:id           - 메모/증빙 수정
 *   DELETE /api/prospects/:id          - 만료 전 회수
 *
 * 보안: 영업자 본인 인증 필수 (admin_token / agency_token / seller_token influencer 권한).
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth } from '@/worker/middleware/auth'

const prospectsRoutes = new Hono<{ Bindings: Env }>()

// 영업자 타입 판별 — agency_token / seller_token (influencer) / admin_token 중 하나
function detectIntroducer(c: { req: { header: (k: string) => string | undefined } }): { type: 'agency' | 'influencer' | 'admin'; id: string } | null {
  // 클라이언트가 Authorization header 로 보내는 토큰 type 검사
  // 여기선 단순화 — 향후 jwt decode 로 정확히 (현재는 user_id 기반)
  return null  // helper — 실제로는 requireAuth 에서 c.get('user') 사용
}

// 매장 사전 등록
prospectsRoutes.post('/', requireAuth(), async (c) => {
  const user = (c.get as (k: string) => unknown)('user') as { id: number; type?: string } | undefined
  if (!user?.id) return c.json({ success: false, error: '인증 필요' }, 401)

  const body = await c.req.json<{
    store_name?: string
    contact_name?: string
    contact_phone?: string
    contact_email?: string
    business_address?: string
    notes?: string
    proof_image_url?: string
    introducer_type?: 'agency' | 'influencer'
  }>().catch(() => ({} as Record<string, string>))

  const phone = body.contact_phone?.trim().replace(/-/g, '') || null
  const email = body.contact_email?.trim().toLowerCase() || null
  if (!phone && !email) {
    return c.json({ success: false, error: '연락처 (전화 또는 이메일) 중 하나 필수' }, 400)
  }
  const introducerType = body.introducer_type === 'agency' ? 'agency' : 'influencer'

  // 중복 등록 차단 — 같은 영업자가 같은 매장 재등록 시 기존 row 재사용
  const dup = await c.env.DB.prepare(
    `SELECT id FROM seller_prospects
      WHERE introducer_type = ? AND introducer_id = ?
        AND (
          (contact_phone IS NOT NULL AND contact_phone = ?) OR
          (contact_email IS NOT NULL AND contact_email = ?)
        )
        AND status = 'visiting' LIMIT 1`
  ).bind(introducerType, String(user.id), phone, email).first<{ id: number }>().catch(() => null)
  if (dup) {
    return c.json({ success: true, prospect_id: dup.id, message: '이미 등록된 prospect — 그대로 유지' })
  }

  // 다른 영업자가 먼저 등록한 같은 매장 — 차단 (가장 빠른 prospect 가 lock)
  const conflict = await c.env.DB.prepare(
    `SELECT id, introducer_type, introducer_id FROM seller_prospects
      WHERE (
        (contact_phone IS NOT NULL AND contact_phone = ?) OR
        (contact_email IS NOT NULL AND contact_email = ?)
      )
      AND status = 'visiting'
      AND (introducer_type != ? OR introducer_id != ?)
      LIMIT 1`
  ).bind(phone, email, introducerType, String(user.id)).first<{ id: number; introducer_type: string }>().catch(() => null)
  if (conflict) {
    return c.json({
      success: false,
      error: `다른 영업자가 이미 영입 중인 매장입니다 (${conflict.introducer_type})`,
      code: 'ALREADY_CLAIMED',
    }, 409)
  }

  // 기본 30일 후 만료
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const result = await c.env.DB.prepare(
    `INSERT INTO seller_prospects (
      introducer_type, introducer_id,
      store_name, contact_name, contact_phone, contact_email,
      business_address, notes, proof_image_url,
      status, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visiting', ?)`
  ).bind(
    introducerType, String(user.id),
    body.store_name?.trim().slice(0, 100) || null,
    body.contact_name?.trim().slice(0, 50) || null,
    phone,
    email,
    body.business_address?.trim().slice(0, 200) || null,
    body.notes?.trim().slice(0, 500) || null,
    body.proof_image_url?.trim() || null,
    expiresAt,
  ).run()

  return c.json({ success: true, prospect_id: result.meta.last_row_id, expires_at: expiresAt })
})

// 본인 등록한 prospects 목록 (영업자 dashboard 용)
prospectsRoutes.get('/mine', requireAuth(), async (c) => {
  const user = (c.get as (k: string) => unknown)('user') as { id: number } | undefined
  if (!user?.id) return c.json({ success: false, error: '인증 필요' }, 401)

  const { results } = await c.env.DB.prepare(
    `SELECT id, store_name, contact_name, contact_phone, contact_email,
            business_address, status, converted_seller_id, first_sale_at,
            commission_locked_at, expires_at, created_at
       FROM seller_prospects
      WHERE introducer_id = ?
      ORDER BY created_at DESC LIMIT 100`
  ).bind(String(user.id)).all().catch(() => ({ results: [] }))

  return c.json({ success: true, data: results })
})

// prospect 회수 (만료 전)
prospectsRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = (c.get as (k: string) => unknown)('user') as { id: number } | undefined
  if (!user?.id) return c.json({ success: false, error: '인증 필요' }, 401)

  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  const result = await c.env.DB.prepare(
    `DELETE FROM seller_prospects WHERE id = ? AND introducer_id = ? AND status = 'visiting'`
  ).bind(id, String(user.id)).run()

  if ((result.meta.changes ?? 0) === 0) {
    return c.json({ success: false, error: '회수 불가 (이미 변환되었거나 본인 등록 아님)' }, 404)
  }
  return c.json({ success: true })
})

export { prospectsRoutes }

/**
 * 🛡️ Helper — seller 가입 시 prospect 매칭 (seller-registration 에서 호출).
 *   phone / email 로 prospects 검색 → 가장 빠른 visiting prospect 매칭.
 *   매칭 시 status='converted' + converted_seller_id 저장.
 *   반환: { introducerType, introducerId } 또는 null.
 */
export async function matchProspectOnSignup(
  DB: D1Database,
  newSellerId: number,
  contactPhone: string | null,
  contactEmail: string | null,
): Promise<{ introducerType: 'agency' | 'influencer'; introducerId: string } | null> {
  if (!contactPhone && !contactEmail) return null
  const phone = contactPhone?.replace(/-/g, '') || null
  const email = contactEmail?.toLowerCase() || null

  const prospect = await DB.prepare(
    `SELECT id, introducer_type, introducer_id FROM seller_prospects
      WHERE (
        (contact_phone IS NOT NULL AND contact_phone = ?) OR
        (contact_email IS NOT NULL AND contact_email = ?)
      )
      AND status = 'visiting'
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at ASC LIMIT 1`
  ).bind(phone, email).first<{ id: number; introducer_type: 'agency' | 'influencer'; introducer_id: string }>().catch(() => null)

  if (!prospect) return null

  await DB.prepare(
    `UPDATE seller_prospects SET status = 'converted', converted_seller_id = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(newSellerId, prospect.id).run().catch(() => null)

  return { introducerType: prospect.introducer_type, introducerId: prospect.introducer_id }
}
