/**
 * 🛡️ 2026-05-27 (영업 검증 Layer 2 — 사용자 결정): 매장 사전 등록 + 가입 시 자동 매칭.
 *
 * Layer 1: 영업자별 고유 invite URL
 * Layer 2: 사장님 사전 등록 (이 파일)
 *   - 영업자(영입자) 가 매장 영입 전에 사장님 정보 등록
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
 * 보안: 영업자 본인 인증 필수 (카카오 user 세션 — `requireAuth()`).
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth } from '@/worker/middleware/auth'

const prospectsRoutes = new Hono<{ Bindings: Env }>()

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
    /** 🌇 2026-09-05 에이전시 일몰 — 영업자는 이제 **영입자(users.id)** 하나뿐. 값은 무시된다. */
    introducer_type?: 'influencer'
  }>().catch(() => ({} as Record<string, string>))

  const phone = body.contact_phone?.trim().replace(/-/g, '') || null
  const email = body.contact_email?.trim().toLowerCase() || null
  if (!phone && !email) {
    return c.json({ success: false, error: '연락처 (전화 또는 이메일) 중 하나 필수' }, 400)
  }
  // 🌇 2026-09-05 에이전시 일몰 — 영업자 종류가 하나로 줄었다. 옛 코드는 `introducer_type='agency'`
  //   면 `agencies.id` 로 정규화해 저장했는데, 그 id 를 읽던 대시보드·커미션이 전부 삭제됐다.
  //   이제 영업자는 언제나 **영입자(users.id)** 이고, 귀속은 `sellers.introduced_by_influencer_id` 다.
  const introducerType = 'influencer'
  const introducerId = String(user.id)

  // 중복 등록 차단 — 같은 영업자가 같은 매장 재등록 시 기존 row 재사용
  const dup = await c.env.DB.prepare(
    `SELECT id FROM seller_prospects
      WHERE introducer_type = ? AND introducer_id = ?
        AND (
          (contact_phone IS NOT NULL AND contact_phone = ?) OR
          (contact_email IS NOT NULL AND contact_email = ?)
        )
        AND status = 'visiting' LIMIT 1`
  ).bind(introducerType, introducerId, phone, email).first<{ id: number }>().catch(() => null)
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
  ).bind(phone, email, introducerType, introducerId).first<{ id: number; introducer_type: string }>().catch(() => null)
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
    introducerType, introducerId,
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

// ── 🏁 2026-07-02 (대표 "가장 이상적으로" — 에이전시 대리 등록) ──────────────────────
// 에이전시/영입자가 등록한 prospect 로 **사장님 가입 링크** 생성 → 사장님은 카카오 로그인 +
// 확인·제출만(정보 재입력 0). 무상태 HMAC 토큰(스키마 무변경) — 링크 소지자만 프리필 조회 가능.
async function prospectToken(secret: string, id: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`prospect:${id}`))
  return Array.from(new Uint8Array(sig)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// POST /:id/invite-link — 본인 prospect 의 사장님 가입 링크 발급(에이전시 코드 자동 포함).
prospectsRoutes.post('/:id/invite-link', requireAuth(), async (c) => {
  const user = (c.get as (k: string) => unknown)('user') as { id: number } | undefined
  if (!user?.id) return c.json({ success: false, error: '인증 필요' }, 401)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  const row = await c.env.DB.prepare(
    `SELECT id, introducer_type, introducer_id FROM seller_prospects WHERE id = ?`
  ).bind(id).first<{ id: number; introducer_type: string; introducer_id: string }>()
  if (!row) return c.json({ success: false, error: 'prospect 없음' }, 404)
  // 소유권: introducer_id 는 언제나 user.id (🌇 2026-09-05 에이전시 일몰 — agencies.id 매핑 삭제).
  if (String(row.introducer_id) !== String(user.id)) {
    return c.json({ success: false, error: '본인 등록 prospect 아님' }, 403)
  }
  const pt = await prospectToken(c.env.JWT_SECRET, id)
  // 🌇 에이전시 초대 코드(`?agency=`) 동봉 삭제 — 받아 줄 가입 폼 입력칸도 함께 없어졌다.
  const qs = new URLSearchParams({ prospect: String(id), pt })
  return c.json({ success: true, path: `/seller/register/supplier?${qs.toString()}` })
})

// GET /prefill/:id?pt= — 가입 관문 프리필(공개 — 토큰 소지 = 링크 수신 사장님).
prospectsRoutes.get('/prefill/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const pt = String(c.req.query('pt') || '')
  if (!Number.isFinite(id) || !pt) return c.json({ success: false, error: 'invalid' }, 400)
  const expect = await prospectToken(c.env.JWT_SECRET, id)
  if (pt !== expect) return c.json({ success: false, error: '유효하지 않은 링크' }, 403)
  const row = await c.env.DB.prepare(
    `SELECT store_name, contact_name, contact_phone, business_address, introducer_type, introducer_id, status
       FROM seller_prospects WHERE id = ?`
  ).bind(id).first<{ store_name: string | null; contact_name: string | null; contact_phone: string | null; business_address: string | null; introducer_type: string; introducer_id: string; status: string }>()
  if (!row) return c.json({ success: false, error: 'prospect 없음' }, 404)
  // 🌇 2026-09-05 에이전시 일몰 — 영업자 이름을 `agencies` 에서 끌어오던 분기 삭제.
  const introducerName: string | null = null
  return c.json({
    success: true,
    data: {
      store_name: row.store_name, contact_name: row.contact_name,
      contact_phone: row.contact_phone, business_address: row.business_address,
      introducer_name: introducerName, converted: row.status === 'converted',
    },
  })
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
