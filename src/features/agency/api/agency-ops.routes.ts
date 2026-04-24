/**
 * Agency Operations Routes (인증 필요)
 *
 *   POST /api/agency/notices            - 셀러 공지사항 발송
 *   GET  /api/agency/notices            - 공지 이력
 *   GET  /api/agency/contracts          - 셀러 계약 목록
 *   POST /api/agency/contracts          - 셀러 계약 등록
 *   PUT  /api/agency/contracts/:id      - 셀러 계약 수정
 *   POST /api/agency/link-kakao         - 카카오 계정 연동
 *   POST /api/agency/unlink-kakao       - 카카오 연동 해제
 *   GET  /api/agency/kakao-link-status  - 카카오 연동 상태 조회
 */

import { verifyPassword } from '@/lib/password'
import { parseSessionCookie } from '@/worker/utils/session'
import { KakaoAuthService } from '../../auth/services/KakaoAuthService'
import { isAgencyPinVerified } from './agency-pin.routes'
import { createAgencyApp, requireAgency } from './agency-shared'
import type { AgencyCtx } from './agency-shared'

const app = createAgencyApp()
app.use('*', requireAgency as any)

// ── POST /notices — 셀러 공지사항 발송 ──
app.post('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { title, message } = await c.req.json<{ title: string; message: string }>()
  if (!title || !message) return c.json({ success: false, error: '제목과 내용을 입력해주세요' }, 400)

  const { results: sellers } = await c.env.DB.prepare(
    'SELECT seller_id FROM agency_sellers WHERE agency_id = ?'
  ).bind(agencyId).all<{ seller_id: number }>()

  if (!sellers?.length) return c.json({ success: false, error: '소속 셀러가 없습니다' })

  const stmts = sellers.map(s =>
    c.env.DB.prepare(`
      INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at)
      VALUES ('seller', ?, 'agency_notice', ?, ?, datetime('now'))
    `).bind(String(s.seller_id), title, message)
  )
  for (let i = 0; i < stmts.length; i += 50) {
    await c.env.DB.batch(stmts.slice(i, i + 50))
  }

  return c.json({ success: true, message: `${sellers.length}명의 셀러에게 공지를 발송했습니다.` })
})

// ── GET /notices — 공지 이력 ──
app.get('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT dn.title, dn.message, dn.created_at
    FROM dashboard_notifications dn
    JOIN agency_sellers ag ON dn.recipient_id = CAST(ag.seller_id AS TEXT)
    WHERE ag.agency_id = ? AND dn.type = 'agency_notice'
    GROUP BY dn.title, dn.message, dn.created_at
    ORDER BY dn.created_at DESC
    LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

// ── 셀러 계약 관리 ──
app.get('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  const { results } = await c.env.DB.prepare(`
    SELECT ac.*, s.name AS seller_name, s.email AS seller_email
    FROM agency_contracts ac JOIN sellers s ON ac.seller_id = s.id
    WHERE ac.agency_id = ? ORDER BY ac.end_date ASC
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

app.post('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 생성 민감 액션 — PIN 인증 필수
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const { seller_id, start_date, end_date, terms } = await c.req.json<any>()
  if (!seller_id || !start_date || !end_date) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400)

  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_contracts (agency_id, seller_id, start_date, end_date, terms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date, terms = excluded.terms, status = 'active'
  `).bind(agencyId, seller_id, start_date, end_date, terms || null).run()

  return c.json({ success: true, message: '계약이 등록되었습니다' })
})

app.put('/contracts/:id', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 수정 민감 액션 — PIN 인증 필수
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const id = c.req.param('id')
  const body = await c.req.json<any>()
  const sets: string[] = []; const vals: any[] = []
  if (body.end_date) { sets.push('end_date = ?'); vals.push(body.end_date) }
  if (body.terms !== undefined) { sets.push('terms = ?'); vals.push(body.terms) }
  if (body.status) { sets.push('status = ?'); vals.push(body.status) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id, agencyId)
  await c.env.DB.prepare(`UPDATE agency_contracts SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

// ── POST /link-kakao — 에이전시 계정에 카카오 연동 ─────────────
app.post('/link-kakao', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id
    const DB = c.env.DB

    const agency = await DB.prepare(
      'SELECT id, linked_user_id FROM agencies WHERE id = ?'
    ).bind(agencyId).first<{ id: number; linked_user_id: number | null }>()
    if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다' }, 404)
    if (agency.linked_user_id) {
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409)
    }

    // 두 가지 연동 모드:
    //  1) 세션 기반 (권장, 팝업 플로우): body 비움 → 세션 쿠키의 userId 사용.
    //  2) code 기반 (구 플로우 호환): code + redirect_uri 전달.
    const body = await c.req.json<{ code?: string; redirect_uri?: string }>().catch(() => ({} as { code?: string; redirect_uri?: string }))

    let kakaoUserId: number | null = null
    let kakaoUserInfo: { name?: string; email?: string } = {}

    if (body.code) {
      const kakaoKey = (c.env as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY
      if (!kakaoKey) return c.json({ success: false, error: '카카오 API 설정 누락' }, 500)
      const kakao = new KakaoAuthService(DB, kakaoKey)
      const tokenData = await kakao.exchangeCodeFull(body.code, body.redirect_uri || '')
      const kakaoUser = await kakao.getUserInfo(tokenData.access_token)
      const user = await kakao.upsertUser(kakaoUser)
      kakaoUserId = user.id
      kakaoUserInfo = { name: user.name, email: user.email }
    } else {
      const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user'])
      if (!sessionUser) {
        return c.json({ success: false, error: '카카오 로그인이 필요합니다. 팝업에서 카카오 인증을 완료해주세요.' }, 400)
      }
      const userId = Number(sessionUser.userId)
      if (!Number.isFinite(userId)) {
        return c.json({ success: false, error: '세션이 유효하지 않습니다.' }, 400)
      }
      kakaoUserId = userId
      kakaoUserInfo = { name: sessionUser.name, email: sessionUser.email }
    }

    // 🛡️ Atomic UPDATE: SELECT→UPDATE 사이 race 방지 (셀러와 동일 패턴).
    const upd = await DB.prepare(
      `UPDATE agencies
       SET linked_user_id = ?, updated_at = datetime('now')
       WHERE id = ?
         AND linked_user_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM agencies a2 WHERE a2.linked_user_id = ? AND a2.id != ?)`
    ).bind(kakaoUserId, agencyId, kakaoUserId, agencyId).run()

    if (!upd.meta?.changes || upd.meta.changes === 0) {
      const conflict = await DB.prepare(
        'SELECT id FROM agencies WHERE linked_user_id = ? AND id != ?'
      ).bind(kakaoUserId, agencyId).first<{ id: number }>()
      if (conflict) {
        return c.json({ success: false, error: '이 카카오 계정은 이미 다른 에이전시에 연동되어 있습니다.' }, 409)
      }
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409)
    }

    return c.json({
      success: true,
      message: '카카오 계정 연동 완료',
      data: { user_id: kakaoUserId, user_name: kakaoUserInfo.name, user_email: kakaoUserInfo.email },
    })
  } catch (err) {
    console.error('[agency link-kakao] error:', err)
    return c.json({ success: false, error: (err as Error).message || '카카오 연동 실패' }, 500)
  }
})

app.post('/unlink-kakao', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id
    // 🛡️ 카카오 전용 에이전시(/register-from-user)는 임시 비번만 있어 unlink 시 lockout.
    const body = await c.req.json<{ current_password?: string }>().catch(() => ({} as { current_password?: string }))
    if (!body.current_password) {
      return c.json({
        success: false,
        error: '현재 비밀번호 확인이 필요합니다. 비밀번호가 없다면 먼저 "비밀번호 찾기" 로 설정해주세요.',
        code: 'PASSWORD_REQUIRED'
      }, 400)
    }

    const agency = await c.env.DB.prepare(
      'SELECT password_hash FROM agencies WHERE id = ?'
    ).bind(agencyId).first<{ password_hash: string }>()
    if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다' }, 404)

    const ok = await verifyPassword(body.current_password, agency.password_hash)
    if (!ok) return c.json({ success: false, error: '비밀번호가 틀렸습니다' }, 401)

    await c.env.DB.prepare(
      "UPDATE agencies SET linked_user_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(agencyId).run()
    return c.json({ success: true, message: '카카오 연동이 해제되었습니다.' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

app.get('/kakao-link-status', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id
    const row = await c.env.DB.prepare(`
      SELECT a.linked_user_id, u.name as user_name, u.email as user_email, u.profile_image
      FROM agencies a LEFT JOIN users u ON u.id = a.linked_user_id WHERE a.id = ?
    `).bind(agencyId).first<{ linked_user_id: number | null; user_name?: string; user_email?: string; profile_image?: string }>()
    return c.json({
      success: true,
      data: row?.linked_user_id
        ? { linked: true, user: { id: row.linked_user_id, name: row.user_name, email: row.user_email, profile_image: row.profile_image } }
        : { linked: false }
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export { app as agencyOpsRoutes }
