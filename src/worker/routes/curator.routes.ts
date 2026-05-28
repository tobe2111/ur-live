/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 링크샵 API SSOT.
 *
 * 모든 유저가 본인 공개 페이지(/u/:handle)에서 상품 핀 큐레이션.
 * 핀 클릭 → 상품 페이지 ?ref={user_id} → 기존 affiliate_ref 시스템 재활용.
 * 결제 시 affiliate_earnings 자동 적립 → 큐레이터 정산.
 *
 * 영구 룰:
 *   - 알리아스(@/) import 금지 → 상대경로
 *   - 모든 mutation 은 requireAuth() / requireAuth() 검증
 *   - safeError() 로 에러 reply (DB 메시지 누출 X)
 *   - rate limit 은 KV 미구성 시 fail-open (CLAUDE.md 룰)
 *   - 핸들 정책은 policy.ts CURATOR_DEFAULTS SSOT
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth } from '../middleware/auth'
import { safeError } from '../utils/safe-error'
import {
  generateUniqueHandle,
  isHandleAvailable,
  isValidHandleFormat,
} from '../utils/handle-generator'
import { CURATOR_DEFAULTS, WITHDRAWAL_DEFAULTS, TAX_POLICY, COMMISSION_DEFAULTS } from '../../shared/constants/policy'
import { getPolicy } from '../utils/dynamic-policy'

const curatorRoutes = new Hono<{ Bindings: Env }>()

// ── 유틸: 인증된 user_id (number) 추출 ──
// 🛡️ 2026-05-25 fix: auth middleware 는 c.set('user', { id, ... }) 패턴.
//   이전 c.get('userId') 는 항상 null → 401. 'user' 객체에서 id 추출.
function getAuthUserId(c: any): number | null {
  const user = c.get?.('user')
  const raw = user?.id ?? c.get?.('userId') ?? c.get?.('userIdNumber')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── 유틸: 핀 개수 상한 검사 ──
async function getPinCount(DB: D1Database, userId: number): Promise<number> {
  const row = await DB.prepare('SELECT COUNT(*) as cnt FROM product_pins WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>()
    .catch(() => null)
  return row?.cnt ?? 0
}

/**
 * 🛡️ 2026-05-25: 큐레이터 테이블 lazy CREATE — D1 migration 미적용 환경 graceful.
 *   TD-001 (D1 CI 권한 부재) 로 migration 0278 자동 적용 안 될 때 첫 호출 시 보장.
 */
async function ensureCuratorTables(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS product_pins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      click_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    )`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_product_pins_user_pos ON product_pins(user_id, position)`).run().catch(() => null)
    // users.handle / bio / linkshop_theme 컬럼 (idempotent ALTER — 이미 있으면 throw → swallow)
    for (const sql of [
      "ALTER TABLE users ADD COLUMN handle TEXT",
      "ALTER TABLE users ADD COLUMN bio TEXT",
      "ALTER TABLE users ADD COLUMN linkshop_theme TEXT DEFAULT 'dark'",
    ]) {
      await DB.prepare(sql).run().catch(() => null)
    }
    await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique ON users(handle) WHERE handle IS NOT NULL`).run().catch(() => null)
  } catch { /* graceful */ }
}

// ============================================================
// GET /api/curator/:handle  (public)
// 큐레이터 공개 페이지 데이터: user + pins (with product 메타)
// ============================================================
curatorRoutes.get('/:handle', async (c) => {
  try {
    const handle = c.req.param('handle')?.toLowerCase().trim()
    if (!handle || !isValidHandleFormat(handle)) {
      return c.json({ success: false, error: '잘못된 핸들 형식입니다' }, 400)
    }
    const DB = c.env.DB
    await ensureCuratorTables(DB)

    // 🛡️ 2026-05-27 (사용자 요청): banner_url 도 반환 — 큐레이터 배경 사진.
    //   banner_url 신규 컬럼 (repair-schema 적용 전 환경 graceful fallback).
    let user: {
      id: number; handle: string; name: string; bio: string | null;
      profile_image: string | null; linkshop_theme: string; banner_url?: string | null
    } | null = await DB.prepare(
      `SELECT id, handle, name, bio, profile_image, linkshop_theme, banner_url
       FROM users WHERE handle = ? LIMIT 1`,
    )
      .bind(handle)
      .first<{
        id: number; handle: string; name: string; bio: string | null;
        profile_image: string | null; linkshop_theme: string; banner_url: string | null
      }>().catch(() => null)
    if (!user) {
      // banner_url 컬럼 없는 환경 — fallback
      user = await DB.prepare(
        `SELECT id, handle, name, bio, profile_image, linkshop_theme
         FROM users WHERE handle = ? LIMIT 1`,
      )
        .bind(handle)
        .first<{
          id: number; handle: string; name: string; bio: string | null;
          profile_image: string | null; linkshop_theme: string
        }>()
    }

    if (!user) return c.json({ success: false, error: '큐레이터를 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-05-25 (C 옵션): linked seller 매칭 시 셀러 공개페이지 정보 동봉.
    //   CuratorPage 가 seller 있으면 풍부한 UI (탭 / 라이브 / 상품) 표시.
    //   일반 user (seller 없음) — 단순 핀 그리드만.
    const linkedSeller = await DB.prepare(
      `SELECT id, username, name, status FROM sellers
       WHERE linked_user_id = ? AND status = 'approved' LIMIT 1`,
    ).bind(user.id).first<{ id: number; username: string; name: string; status: string }>().catch(() => null)

    const { results: pins } = await DB.prepare(
      `SELECT pp.id, pp.product_id, pp.position, pp.note, pp.click_count,
              p.name AS product_name, p.image_url, p.thumbnail, p.price, p.original_price,
              p.category, p.is_active,
              COALESCE(p.referral_commission_rate, 0) AS commission_rate
       FROM product_pins pp
       JOIN products p ON p.id = pp.product_id
       WHERE pp.user_id = ? AND p.is_active = 1
       ORDER BY pp.position ASC, pp.created_at DESC
       LIMIT ?`,
    )
      .bind(user.id, CURATOR_DEFAULTS.PIN_MAX_PER_USER)
      .all()

    return c.json({
      success: true,
      curator: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        bio: user.bio,
        profile_image: user.profile_image,
        theme: user.linkshop_theme || 'dark',
      },
      pins: pins ?? [],
      // 🛡️ 2026-05-25 신모델: linked seller 있으면 셀러 공개페이지로 자연 흡수.
      linked_seller: linkedSeller ? {
        id: linkedSeller.id,
        username: linkedSeller.username,
        name: linkedSeller.name,
      } : null,
    })
  } catch (err) {
    return safeError(c, err, '큐레이터 정보 조회 중 오류가 발생했습니다', '[curator:get]')
  }
})

// ============================================================
// GET /api/curator/:handle/p/:productId/redirect  (public)
// 핀 클릭 → 클릭 로그 + count 증가 + 302 redirect with ?ref=
// ============================================================
curatorRoutes.get('/:handle/p/:productId/redirect', async (c) => {
  try {
    const handle = c.req.param('handle')?.toLowerCase().trim()
    const productId = Number(c.req.param('productId'))
    if (!handle || !isValidHandleFormat(handle) || !Number.isFinite(productId)) {
      return c.json({ success: false, error: 'invalid' }, 400)
    }
    const DB = c.env.DB

    const pin = await DB.prepare(
      `SELECT pp.id, pp.user_id, pp.product_id
       FROM product_pins pp
       JOIN users u ON u.id = pp.user_id
       WHERE u.handle = ? AND pp.product_id = ?
       LIMIT 1`,
    )
      .bind(handle, productId)
      .first<{ id: number; user_id: number; product_id: number }>()

    if (!pin) {
      // 핀 없어도 상품 페이지로는 안전하게 redirect (404 보다 UX 우월)
      return c.redirect(`/products/${productId}`, 302)
    }

    // 봇 탐지: ip + UA hash 저장 (직접 저장 X)
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || ''
    const ua = c.req.header('user-agent') || ''
    const dailySalt = new Date().toISOString().slice(0, 10)
    const ipHash = await sha256Short(`${ip}|${dailySalt}`)
    const uaHash = await sha256Short(ua)

    // 클릭 로그 + count 증가 (best-effort — 실패해도 redirect 는 진행)
    c.executionCtx.waitUntil(
      (async () => {
        try {
          await DB.prepare(
            `INSERT INTO pin_click_logs (pin_id, curator_user_id, product_id, ip_hash, user_agent_hash, referer)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
            .bind(pin.id, pin.user_id, pin.product_id, ipHash, uaHash, c.req.header('referer') || null)
            .run()
          await DB.prepare(`UPDATE product_pins SET click_count = click_count + 1 WHERE id = ?`)
            .bind(pin.id)
            .run()
        } catch { /* ignore */ }
      })(),
    )

    // ?ref= 로 redirect — ProductDetailPage 가 localStorage.affiliate_ref 저장 (기존 시스템 재활용)
    return c.redirect(`/products/${productId}?ref=${pin.user_id}`, 302)
  } catch (err) {
    return safeError(c, err, '리다이렉트 처리 중 오류가 발생했습니다', '[curator:redirect]')
  }
})

async function sha256Short(input: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return '' }
}

// ============================================================
// GET /api/curator/handle/check?q=foo  (public)
// 핸들 사용 가능 여부 + 추천 alternatives
// ============================================================
curatorRoutes.get('/handle/check', async (c) => {
  try {
    const q = String(c.req.query('q') || '').toLowerCase().trim()
    if (!q) return c.json({ success: false, available: false, error: '핸들을 입력해주세요' }, 400)
    if (!isValidHandleFormat(q)) {
      return c.json({
        success: true,
        available: false,
        reason: 'invalid_format',
        message: `${CURATOR_DEFAULTS.HANDLE_MIN_LEN}-${CURATOR_DEFAULTS.HANDLE_MAX_LEN}자, 소문자/숫자/_ 만 가능합니다`,
      })
    }
    const available = await isHandleAvailable(c.env.DB, q)
    return c.json({ success: true, available, handle: q })
  } catch (err) {
    return safeError(c, err, '핸들 확인 중 오류가 발생했습니다', '[curator:check]')
  }
})

// ============================================================
// POST /api/curator/me/pins  (requireUser)
// 핀 추가 — 첫 핀이면 handle 자동 생성.
// Body: { product_id: number, note?: string }
// ============================================================
curatorRoutes.post('/me/pins', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    await ensureCuratorTables(c.env.DB)

    const body = await c.req.json<{ product_id?: number; note?: string }>().catch(() => ({} as any))
    const productId = Number(body.product_id)
    if (!Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '상품 ID 가 잘못되었습니다' }, 400)
    }
    const note = body.note ? String(body.note).slice(0, CURATOR_DEFAULTS.PIN_NOTE_MAX_LEN) : null
    const DB = c.env.DB

    // 상품 존재 + 활성 검증
    const product = await DB.prepare('SELECT id, is_active FROM products WHERE id = ? LIMIT 1')
      .bind(productId)
      .first<{ id: number; is_active: number }>()
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (!product.is_active) return c.json({ success: false, error: '비활성 상품은 핀할 수 없습니다' }, 400)

    // 핀 상한 검증
    const cnt = await getPinCount(DB, userId)
    if (cnt >= CURATOR_DEFAULTS.PIN_MAX_PER_USER) {
      return c.json({
        success: false,
        error: `핀은 최대 ${CURATOR_DEFAULTS.PIN_MAX_PER_USER}개까지 가능합니다`,
      }, 400)
    }

    // 첫 핀: handle 자동 생성
    const user = await DB.prepare('SELECT id, handle, name FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first<{ id: number; handle: string | null; name: string }>()
    if (!user) return c.json({ success: false, error: '사용자를 찾을 수 없습니다' }, 404)

    let handleJustCreated = false
    let handle = user.handle
    if (!handle) {
      handle = await generateUniqueHandle(DB, user.name || `user${userId}`)
      await DB.prepare('UPDATE users SET handle = ?, linkshop_theme = COALESCE(linkshop_theme, ?) WHERE id = ?')
        .bind(handle, 'dark', userId)
        .run()
      handleJustCreated = true
    }

    // 다음 position
    const posRow = await DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM product_pins WHERE user_id = ?')
      .bind(userId)
      .first<{ next_pos: number }>()
    const nextPos = posRow?.next_pos ?? 0

    // INSERT — UNIQUE(user_id, product_id) 충돌 시 toggle 로 안내
    try {
      const result = await DB.prepare(
        `INSERT INTO product_pins (user_id, product_id, position, note)
         VALUES (?, ?, ?, ?)`,
      )
        .bind(userId, productId, nextPos, note)
        .run()
      return c.json({
        success: true,
        pin: {
          id: result.meta.last_row_id,
          user_id: userId,
          product_id: productId,
          position: nextPos,
          note,
        },
        handle,
        handle_just_created: handleJustCreated,
      })
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes('UNIQUE')) {
        return c.json({ success: false, error: '이미 핀에 추가된 상품입니다', code: 'ALREADY_PINNED' }, 409)
      }
      throw e
    }
  } catch (err) {
    return safeError(c, err, '핀 추가 중 오류가 발생했습니다', '[curator:pin-add]')
  }
})

// ============================================================
// DELETE /api/curator/me/pins/:id  (requireUser)
// ============================================================
curatorRoutes.delete('/me/pins/:id', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const pinId = Number(c.req.param('id'))
    if (!Number.isFinite(pinId)) return c.json({ success: false, error: 'invalid' }, 400)

    const result = await c.env.DB.prepare('DELETE FROM product_pins WHERE id = ? AND user_id = ?')
      .bind(pinId, userId)
      .run()

    if (!result.meta.changes) return c.json({ success: false, error: '핀을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '핀 삭제 중 오류가 발생했습니다', '[curator:pin-del]')
  }
})

// ============================================================
// PATCH /api/curator/me/pins/reorder  (requireUser)
// Body: { pin_ids: number[] } — 순서대로 position 부여
// ============================================================
curatorRoutes.patch('/me/pins/reorder', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)

    const body = await c.req.json<{ pin_ids?: number[] }>().catch(() => ({} as any))
    const ids = Array.isArray(body.pin_ids) ? body.pin_ids.filter(Number.isFinite).slice(0, 500) : []
    if (!ids.length) return c.json({ success: false, error: 'pin_ids 필요' }, 400)

    // 모든 ID 가 본인 소유인지 검증
    const placeholders = ids.map(() => '?').join(',')
    const { results: owned } = await c.env.DB
      .prepare(`SELECT id FROM product_pins WHERE user_id = ? AND id IN (${placeholders})`)
      .bind(userId, ...ids)
      .all<{ id: number }>()
    const ownedSet = new Set((owned ?? []).map(r => r.id))
    if (ownedSet.size !== ids.length) {
      return c.json({ success: false, error: '본인 핀만 정렬할 수 있습니다' }, 403)
    }

    // batch UPDATE
    const stmts = ids.map((id: number, i: number) =>
      c.env.DB.prepare('UPDATE product_pins SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .bind(i, id, userId),
    )
    await c.env.DB.batch(stmts)

    return c.json({ success: true, count: ids.length })
  } catch (err) {
    return safeError(c, err, '핀 순서 변경 중 오류가 발생했습니다', '[curator:reorder]')
  }
})

// ============================================================
// PATCH /api/curator/me/pins/:id  (requireUser) — note 수정
// ============================================================
curatorRoutes.patch('/me/pins/:id', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const pinId = Number(c.req.param('id'))
    if (!Number.isFinite(pinId)) return c.json({ success: false, error: 'invalid' }, 400)
    const body = await c.req.json<{ note?: string }>().catch(() => ({} as any))
    const note = body.note ? String(body.note).slice(0, CURATOR_DEFAULTS.PIN_NOTE_MAX_LEN) : null

    const result = await c.env.DB.prepare(
      `UPDATE product_pins SET note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
    ).bind(note, pinId, userId).run()

    if (!result.meta.changes) return c.json({ success: false, error: '핀을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '핀 수정 중 오류가 발생했습니다', '[curator:pin-patch]')
  }
})

// ============================================================
// PATCH /api/curator/me/handle  (requireUser)
// Body: { handle: string }
// 30일 cooldown (CURATOR_DEFAULTS.HANDLE_CHANGE_COOLDOWN_DAYS)
// ============================================================
curatorRoutes.patch('/me/handle', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const body = await c.req.json<{ handle?: string }>().catch(() => ({} as any))
    const newHandle = String(body.handle || '').toLowerCase().trim()

    if (!isValidHandleFormat(newHandle)) {
      return c.json({
        success: false,
        error: `핸들은 ${CURATOR_DEFAULTS.HANDLE_MIN_LEN}-${CURATOR_DEFAULTS.HANDLE_MAX_LEN}자, 소문자/숫자/_ 만 가능합니다`,
        code: 'INVALID_FORMAT',
      }, 400)
    }
    const DB = c.env.DB

    // 본인 현재 handle 조회 (변경 cooldown 검증)
    const user = await DB.prepare('SELECT handle, updated_at FROM users WHERE id = ? LIMIT 1')
      .bind(userId)
      .first<{ handle: string | null; updated_at: string | null }>()
    if (!user) return c.json({ success: false, error: '사용자 없음' }, 404)

    // 이미 동일 handle 이면 noop
    if (user.handle === newHandle) return c.json({ success: true, handle: newHandle, noop: true })

    // UNIQUE 검증 (excludeUserId 본인은 통과)
    const available = await isHandleAvailable(DB, newHandle, userId)
    if (!available) {
      return c.json({ success: false, error: '이미 사용중인 핸들입니다', code: 'TAKEN' }, 409)
    }

    await DB.prepare('UPDATE users SET handle = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(newHandle, userId)
      .run()

    return c.json({ success: true, handle: newHandle })
  } catch (err) {
    return safeError(c, err, '핸들 변경 중 오류가 발생했습니다', '[curator:handle-patch]')
  }
})

// ============================================================
// PATCH /api/curator/me/profile  (requireUser)
// 🛡️ 2026-05-27 (옵션 C): 큐레이터 인라인 편집 — name / bio / profile_image.
// 다른 컬럼 (handle) 은 별도 endpoint (cooldown 룰 분리).
// ============================================================
curatorRoutes.patch('/me/profile', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const body = await c.req.json<{ name?: string; bio?: string; profile_image?: string; banner_url?: string }>().catch(() => ({} as { name?: string; bio?: string; profile_image?: string; banner_url?: string }))

    const updates: string[] = []
    const binds: (string | number)[] = []
    if (typeof body.name === 'string') {
      const v = body.name.trim().slice(0, 40)
      if (!v) return c.json({ success: false, error: '이름은 최소 1자 필요' }, 400)
      updates.push('name = ?')
      binds.push(v)
    }
    if (typeof body.bio === 'string') {
      updates.push('bio = ?')
      binds.push(body.bio.trim().slice(0, 500))
    }
    if (typeof body.profile_image === 'string') {
      const v = body.profile_image.trim()
      if (v && !/^https?:\/\//i.test(v)) return c.json({ success: false, error: 'URL 형식 오류' }, 400)
      updates.push('profile_image = ?')
      binds.push(v)
    }
    if (typeof body.banner_url === 'string') {
      const v = body.banner_url.trim()
      if (v && !/^https?:\/\//i.test(v)) return c.json({ success: false, error: 'URL 형식 오류' }, 400)
      updates.push('banner_url = ?')
      binds.push(v)
    }
    if (updates.length === 0) return c.json({ success: false, error: '변경할 필드 없음' }, 400)

    binds.push(userId)
    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(...binds).run()

    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '프로필 변경 중 오류가 발생했습니다', '[curator:profile-patch]')
  }
})

// ============================================================
// GET /api/curator/me/dashboard  (requireUser)
// 큐레이터 대시보드: 30일 적립 / 클릭 / 구매 / top pins / 일별 차트
// ============================================================
curatorRoutes.get('/me/dashboard', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const DB = c.env.DB
    await ensureCuratorTables(DB)

    // 🛡️ 2026-05-25: handle 반환 — /u/me redirect / 마이페이지 카드용
    // 🛡️ 2026-05-27 (영구 fix — 큐레이터 모델): 모든 user 가 공개 페이지 보유.
    //   handle NULL 인 사용자도 자동 생성 → /host/new fall through 영구 차단.
    //   user.name 기반 slug → 충돌 시 user2/3..99 → random hex.
    let meRow = await DB.prepare('SELECT handle, name FROM users WHERE id = ? LIMIT 1')
      .bind(userId).first<{ handle: string | null; name: string | null }>().catch(() => null)
    if (meRow && !meRow.handle) {
      try {
        const newHandle = await generateUniqueHandle(DB, meRow.name || `user${userId}`, userId)
        await DB.prepare('UPDATE users SET handle = ? WHERE id = ?')
          .bind(newHandle, userId).run()
        meRow = { ...meRow, handle: newHandle }
      } catch { /* generation 실패 — graceful, 다음 호출 재시도 */ }
    }

    // 🛡️ 2026-05-25 (loading P0): linked seller 도 같이 반환 → /u/me 가 한 번에 redirect target 결정.
    //   이전: /u/me → /u/{handle} → /profile/{username} (3-step 직렬). 이후: /u/me → /profile/{username} 직행.
    // 🛡️ 2026-05-27 (영구 fix — 사용자 보고): linked_user_id 매핑 없으면 email 매칭 fallback + 즉시 backfill.
    //   사용자 보고: 카카오 로그인 (linked_user_id NULL 상태) → dashboard 가 linked_seller 못 찾아
    //   /host/new fall through. backfill cron / KakaoAuthService auto-link 가 production 에서 아직 실행 안 된 환경 graceful.
    let linkedSeller = await DB.prepare(
      `SELECT id, username FROM sellers WHERE linked_user_id = ? AND status = 'approved' LIMIT 1`,
    ).bind(userId).first<{ id: number; username: string }>().catch(() => null)

    if (!linkedSeller) {
      // Email 매칭 fallback — auto-link 가 아직 안 된 사용자
      const u = await DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first<{ email: string }>().catch(() => null)
      if (u?.email) {
        linkedSeller = await DB.prepare(
          `SELECT id, username FROM sellers WHERE email = ? AND status = 'approved' AND (linked_user_id IS NULL OR linked_user_id = ?) LIMIT 1`
        ).bind(u.email, userId).first<{ id: number; username: string }>().catch(() => null)
        // 발견 시 즉시 backfill — 다음 호출은 1차 query 에서 hit
        if (linkedSeller) {
          await DB.prepare(`UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?`)
            .bind(userId, linkedSeller.id).run().catch(() => null)
        }
      }
    }

    // 30일 어필리에이트 적립 (affiliate_earnings 가 기존 SSOT)
    const earnings30 = await DB.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total
       FROM affiliate_earnings
       WHERE referrer_id = ? AND created_at >= datetime('now', '-30 days')`,
    ).bind(userId).first<{ total: number }>().catch(() => null)

    // 30일 클릭
    const clicks30 = await DB.prepare(
      `SELECT COUNT(*) AS cnt
       FROM pin_click_logs
       WHERE curator_user_id = ? AND created_at >= datetime('now', '-30 days')`,
    ).bind(userId).first<{ cnt: number }>().catch(() => null)

    // 30일 구매 건수
    const purchases30 = await DB.prepare(
      `SELECT COUNT(*) AS cnt
       FROM affiliate_earnings
       WHERE referrer_id = ? AND created_at >= datetime('now', '-30 days')`,
    ).bind(userId).first<{ cnt: number }>().catch(() => null)

    // Top 3 pins (7일 click_count 기준 — denormalized)
    const { results: topPins } = await DB.prepare(
      `SELECT pp.id, pp.product_id, pp.click_count, p.name AS product_name, p.thumbnail, p.image_url
       FROM product_pins pp
       JOIN products p ON p.id = pp.product_id
       WHERE pp.user_id = ?
       ORDER BY pp.click_count DESC
       LIMIT 3`,
    ).bind(userId).all().catch(() => ({ results: [] as any[] }))

    // 일별 적립 차트 (30일)
    const { results: daily } = await DB.prepare(
      `SELECT date(created_at) AS date, COALESCE(SUM(commission_amount), 0) AS amount
       FROM affiliate_earnings
       WHERE referrer_id = ? AND created_at >= datetime('now', '-30 days')
       GROUP BY date(created_at)
       ORDER BY date ASC`,
    ).bind(userId).all().catch(() => ({ results: [] as any[] }))

    return c.json({
      success: true,
      handle: meRow?.handle ?? null,
      // 🛡️ 2026-05-25: linked_seller 동봉 → /u/me 가 직접 /profile/{username} navigate
      linked_seller: linkedSeller ? { id: linkedSeller.id, username: linkedSeller.username } : null,
      stats: {
        month_earnings: earnings30?.total ?? 0,
        clicks_30d: clicks30?.cnt ?? 0,
        purchases_30d: purchases30?.cnt ?? 0,
        top_pins: topPins ?? [],
        earnings_daily_30d: daily ?? [],
      },
    })
  } catch (err) {
    return safeError(c, err, '대시보드 조회 중 오류가 발생했습니다', '[curator:dashboard]')
  }
})

// ============================================================
// GET /api/curator/me/pins/stats?range=7  (requireUser)
// 각 핀별 N일 클릭/구매/적립
// ============================================================
curatorRoutes.get('/me/pins/stats', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const range = Math.max(1, Math.min(90, Number(c.req.query('range')) || CURATOR_DEFAULTS.STATS_DEFAULT_RANGE_DAYS))
    const since = `-${range} days`

    const { results } = await c.env.DB.prepare(
      `SELECT pp.id, pp.product_id, pp.click_count AS lifetime_clicks,
              (SELECT COUNT(*) FROM pin_click_logs WHERE pin_id = pp.id AND created_at >= datetime('now', ?)) AS clicks,
              (SELECT COUNT(*) FROM affiliate_earnings ae WHERE ae.referrer_id = pp.user_id AND ae.product_id = pp.product_id AND ae.created_at >= datetime('now', ?)) AS purchases,
              (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_earnings ae WHERE ae.referrer_id = pp.user_id AND ae.product_id = pp.product_id AND ae.created_at >= datetime('now', ?)) AS earnings
       FROM product_pins pp
       WHERE pp.user_id = ?
       ORDER BY pp.position ASC
       LIMIT ?`,
    ).bind(since, since, since, userId, CURATOR_DEFAULTS.PIN_MAX_PER_USER).all()

    return c.json({ success: true, range, stats: results ?? [] })
  } catch (err) {
    return safeError(c, err, '핀 통계 조회 중 오류가 발생했습니다', '[curator:pin-stats]')
  }
})

// ============================================================
// GET /api/curator/recommendations  (requireAuth optional)
// 핀 후보 추천 — 인기 + 카테고리 + 최근본 (단순)
// ============================================================
curatorRoutes.get('/recommendations', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    const DB = c.env.DB

    // 본인이 이미 핀한 상품은 제외
    const { results: pinned } = userId
      ? await DB.prepare('SELECT product_id FROM product_pins WHERE user_id = ?')
          .bind(userId)
          .all<{ product_id: number }>()
      : { results: [] as { product_id: number }[] }
    const excludeIds = (pinned ?? []).map(p => p.product_id)

    const limit = Math.max(5, Math.min(50, Number(c.req.query('limit')) || 20))
    const exclusion = excludeIds.length
      ? ` AND p.id NOT IN (${excludeIds.map(() => '?').join(',')})`
      : ''

    const { results } = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.category, p.image_url, p.thumbnail,
              COALESCE(p.referral_commission_rate, 0) AS commission_rate,
              COALESCE(p.sold_count, 0) AS sold_count
       FROM products p
       WHERE p.is_active = 1
         AND COALESCE(p.referral_enabled, 0) = 1
         ${exclusion}
       ORDER BY p.sold_count DESC, p.id DESC
       LIMIT ?`,
    ).bind(...excludeIds, limit).all()

    return c.json({ success: true, recommendations: results ?? [] })
  } catch (err) {
    return safeError(c, err, '추천 핀 조회 중 오류가 발생했습니다', '[curator:recommend]')
  }
})

// ============================================================
// POST /api/curator/me/withdrawal (requireUser) — Phase 4 출금
// Body: { amount, bank_name, bank_account, account_holder }
// 기존 user_withdrawals 테이블 재활용 (mig 0274) — 검증 + 원천징수 계산만 SSOT.
// ============================================================
curatorRoutes.post('/me/withdrawal', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const body = await c.req.json<{ amount?: number; bank_name?: string; bank_account?: string; account_holder?: string }>().catch(() => ({} as any))
    const amount = Number(body.amount)
    const bankName = String(body.bank_name || '').trim()
    const bankAccount = String(body.bank_account || '').trim()
    const accountHolder = String(body.account_holder || '').trim()

    // 🛡️ 2026-05-25: 동적 정책 — 어드민이 platform_settings 로 조정 가능 (fallback=policy.ts 상수)
    const minAmount = await getPolicy(c.env.DB, 'curator_min_withdrawal', WITHDRAWAL_DEFAULTS.MIN_AMOUNT)
    if (!Number.isFinite(amount) || amount < minAmount) {
      return c.json({
        success: false,
        error: `최소 출금 금액은 ${minAmount.toLocaleString()}원입니다`,
      }, 400)
    }
    if (!bankName || !bankAccount || !accountHolder) {
      return c.json({ success: false, error: '은행/계좌/예금주 모두 필요합니다' }, 400)
    }

    // 🛡️ 2026-05-25 신모델 정산 분기:
    //   사업자 셀러 (sellers.linked_user_id = userId) — 실제 돈 출금 (user_withdrawals)
    //   일반 user — 딜로만 적립 (user_points). 출금 거부.
    const sellerRow = await c.env.DB.prepare(
      `SELECT id FROM sellers WHERE linked_user_id = ? AND status = 'approved' LIMIT 1`,
    ).bind(userId).first<{ id: number }>().catch(() => null)
    if (!sellerRow) {
      return c.json({
        success: false,
        error: '실제 돈 출금은 사업자 셀러만 가능합니다. 일반 회원은 딜로 적립되어 쇼핑/공구에 사용 가능합니다.',
        code: 'NOT_SELLER',
      }, 403)
    }
    if (bankAccount.length < 8 || bankAccount.length > 30) {
      return c.json({ success: false, error: '계좌번호가 유효하지 않습니다' }, 400)
    }

    const DB = c.env.DB

    // 잔액 검증 — affiliate_earnings SUM - 이미 출금 신청한 금액
    const balance = await DB.prepare(
      `SELECT
         COALESCE((SELECT SUM(commission_amount) FROM affiliate_earnings WHERE referrer_id = ?), 0)
         - COALESCE((SELECT SUM(amount) FROM user_withdrawals WHERE user_id = ? AND status IN ('requested','approved','paid')), 0)
         AS available`,
    ).bind(String(userId), String(userId)).first<{ available: number }>()
    const available = balance?.available ?? 0
    if (amount > available) {
      return c.json({
        success: false,
        error: `출금 가능 금액 초과 (가능: ${available.toLocaleString()}원)`,
        available,
      }, 400)
    }

    // 원천징수 — 동적 정책 (curator_withholding_rate, 백분율). fallback=TAX_POLICY.BUSINESS_INCOME_RATE (3.3%).
    const withholdingPct = await getPolicy(c.env.DB, 'curator_withholding_rate', TAX_POLICY.BUSINESS_INCOME_RATE * 100)
    const withholdingTax = Math.floor(amount * withholdingPct / 100)
    const netAmount = amount - withholdingTax

    try {
      const result = await DB.prepare(
        `INSERT INTO user_withdrawals (user_id, amount, withholding_tax, net_amount, bank_name, bank_account, account_holder, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'requested')`,
      ).bind(String(userId), amount, withholdingTax, netAmount, bankName, bankAccount, accountHolder).run()

      return c.json({
        success: true,
        withdrawal: {
          id: result.meta.last_row_id,
          amount,
          withholding_tax: withholdingTax,
          net_amount: netAmount,
          status: 'requested',
        },
      })
    } catch (e: any) {
      return safeError(c, e, '출금 신청 중 오류가 발생했습니다', '[curator:withdrawal]')
    }
  } catch (err) {
    return safeError(c, err, '출금 신청 중 오류가 발생했습니다', '[curator:withdrawal]')
  }
})

// ============================================================
// GET /api/curator/me/withdrawal (requireUser) — 출금 가능 잔액 + 이력
// ============================================================
curatorRoutes.get('/me/withdrawal', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const DB = c.env.DB

    // 🛡️ 2026-05-25: 테이블 미존재 시 graceful — 0 fallback.
    const earnings = await DB.prepare(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total FROM affiliate_earnings WHERE referrer_id = ?`,
    ).bind(String(userId)).first<{ total: number }>().catch(() => null)

    const withdrawn = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM user_withdrawals
       WHERE user_id = ? AND status IN ('requested','approved','paid')`,
    ).bind(String(userId)).first<{ total: number }>().catch(() => null)

    const lifetimeEarnings = earnings?.total ?? 0
    const totalWithdrawn = withdrawn?.total ?? 0
    const available = Math.max(0, lifetimeEarnings - totalWithdrawn)

    const { results: history } = await DB.prepare(
      `SELECT id, amount, withholding_tax, net_amount, bank_name, status, requested_at
       FROM user_withdrawals WHERE user_id = ?
       ORDER BY requested_at DESC LIMIT 20`,
    ).bind(String(userId)).all().catch(() => ({ results: [] as any[] }))

    // 🛡️ 동적 정책 — platform_settings 우선, fallback=policy.ts
    const upgradeThreshold = await getPolicy(c.env.DB, 'seller_upgrade_threshold', WITHDRAWAL_DEFAULTS.SELLER_UPGRADE_THRESHOLD)
    const minWithdrawal = await getPolicy(c.env.DB, 'curator_min_withdrawal', WITHDRAWAL_DEFAULTS.MIN_AMOUNT)
    const withholdingPct = await getPolicy(c.env.DB, 'curator_withholding_rate', TAX_POLICY.BUSINESS_INCOME_RATE * 100)

    // 셀러 승급 안내 여부
    let upgradeOffered = false
    let upgradeEligible = false
    try {
      const u = await DB.prepare(
        `SELECT seller_upgrade_offered_at, user_type FROM users WHERE id = ? LIMIT 1`,
      ).bind(userId).first<{ seller_upgrade_offered_at: string | null; user_type: string }>()
      upgradeOffered = !!u?.seller_upgrade_offered_at
      if (u?.user_type === 'user' && lifetimeEarnings >= upgradeThreshold) {
        // cooldown 검사
        const cooldownMs = WITHDRAWAL_DEFAULTS.UPGRADE_REOFFER_DAYS * 86400_000
        const lastMs = u?.seller_upgrade_offered_at ? Date.parse(u.seller_upgrade_offered_at) : 0
        upgradeEligible = !lastMs || (Date.now() - lastMs > cooldownMs)
      }
    } catch { /* ignore */ }

    // 🛡️ 2026-05-25 신모델: 사업자 셀러 여부 — 출금 UI 분기
    const sellerRow = await DB.prepare(
      `SELECT id FROM sellers WHERE linked_user_id = ? AND status = 'approved' LIMIT 1`,
    ).bind(userId).first<{ id: number }>().catch(() => null)
    const isBusinessSeller = !!sellerRow

    // user_points 의 현재 딜 잔액 (일반 user 용 표시)
    const pointsBalance = await DB.prepare(
      `SELECT COALESCE(balance, 0) AS balance FROM user_points WHERE user_id = ? LIMIT 1`,
    ).bind(String(userId)).first<{ balance: number }>().catch(() => null)

    return c.json({
      success: true,
      lifetime_earnings: lifetimeEarnings,
      total_withdrawn: totalWithdrawn,
      available,
      min_withdrawal: minWithdrawal,
      withholding_rate: withholdingPct / 100,
      history: history ?? [],
      // 신모델: 정산 분기 정보
      payout_mode: isBusinessSeller ? 'cash' : 'deal',
      is_business_seller: isBusinessSeller,
      deal_balance: pointsBalance?.balance ?? 0,
      seller_upgrade: {
        threshold: upgradeThreshold,
        eligible: upgradeEligible,
        offered: upgradeOffered,
      },
    })
  } catch (err) {
    return safeError(c, err, '출금 정보 조회 중 오류가 발생했습니다', '[curator:withdrawal-info]')
  }
})

// ============================================================
// POST /api/curator/me/seller-upgrade-acknowledge (requireUser)
// 사용자가 셀러 승급 안내를 봤다고 mark — 30일 동안 재안내 X
// ============================================================
curatorRoutes.post('/me/seller-upgrade-acknowledge', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    await c.env.DB.prepare(
      `UPDATE users SET seller_upgrade_offered_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(userId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '확인 처리 중 오류가 발생했습니다', '[curator:upgrade-ack]')
  }
})

// ============================================================
// 유저 사업자 등록 — 영입/추천 commission 현금 정산 분기 (docs/SERVICE_MODEL.md §4).
//   사업자(verified) → user: ledger 현금 정산 + 원천징수 / 비사업자 → 딜.
//   인플루언서=유저 모델 유지 (셀러 계정 안 만듦).
// ============================================================

// GET — 내 사업자 등록 상태 조회
curatorRoutes.get('/me/business', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const row = await c.env.DB.prepare(
      `SELECT business_number, business_name, business_status, business_verified_at,
              tax_type, bank_name, bank_account, account_holder
         FROM users WHERE id = ?`,
    ).bind(userId).first<Record<string, unknown>>().catch(() => null)
    return c.json({
      success: true,
      data: row || { business_status: 'none' },
    })
  } catch (err) {
    return safeError(c, err, '사업자 정보 조회 중 오류가 발생했습니다', '[curator:business:get]')
  }
})

// POST — 사업자 등록 / 갱신 (국세청 진위확인 자동)
curatorRoutes.post('/me/business', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const body = await c.req.json<{
      business_number?: string; business_name?: string; representative?: string;
      start_date?: string; tax_type?: string;
      bank_name?: string; bank_account?: string; account_holder?: string;
    }>().catch(() => ({} as Record<string, string>))

    const bizNo = String(body.business_number || '').replace(/-/g, '').trim()
    const bizName = String(body.business_name || '').trim()
    const representative = String(body.representative || '').trim()
    const startDate = String(body.start_date || '').replace(/-/g, '').trim()
    const taxType = body.tax_type === 'other_income' ? 'other_income' : 'business_income'
    const bankName = String(body.bank_name || '').trim()
    const bankAccount = String(body.bank_account || '').trim()
    const accountHolder = String(body.account_holder || '').trim()

    if (!/^\d{10}$/.test(bizNo)) {
      return c.json({ success: false, error: '사업자번호는 10자리 숫자입니다' }, 400)
    }
    if (!bizName || !representative) {
      return c.json({ success: false, error: '상호명/대표자명이 필요합니다' }, 400)
    }
    if (!bankName || bankAccount.length < 8 || bankAccount.length > 30 || !accountHolder) {
      return c.json({ success: false, error: '은행/계좌(8~30자)/예금주가 필요합니다' }, 400)
    }

    // 국세청 진위확인 (key 없으면 pending — 어드민 수동 검수).
    let status = 'pending'
    let verifiedAt: string | null = null
    const ntsKey = (c.env as { NTS_API_KEY?: string }).NTS_API_KEY
    if (ntsKey && startDate) {
      const { ntsValidateBusiness } = await import('../utils/nts-business-verify')
      const r = await ntsValidateBusiness(ntsKey, { businessNumber: bizNo, startDate, representative })
      if (r.ok && r.valid === '02') {
        return c.json({ success: false, error: '사업자번호·대표자명·개업일이 일치하지 않습니다', code: 'NTS_MISMATCH' }, 400)
      }
      if (r.autoApprovable) { status = 'verified'; verifiedAt = new Date().toISOString() }
    }

    await c.env.DB.prepare(
      `UPDATE users SET
         business_number = ?, business_name = ?, business_status = ?,
         business_verified_at = ?, tax_type = ?,
         bank_name = ?, bank_account = ?, account_holder = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    ).bind(bizNo, bizName, status, verifiedAt, taxType, bankName, bankAccount, accountHolder, userId).run()

    return c.json({
      success: true,
      data: { business_status: status },
      message: status === 'verified'
        ? '사업자 인증 완료 — 이후 영입/추천 수익은 현금으로 정산됩니다'
        : '등록 접수 — 관리자 검수 후 현금 정산이 활성화됩니다',
    })
  } catch (err) {
    return safeError(c, err, '사업자 등록 중 오류가 발생했습니다', '[curator:business:post]')
  }
})

// ============================================================
// GET /me/introduced-stores — 내가 영입한 매장 + commission (Creator 대칭).
//   에이전시 AgencyIntroducedStoresPage 의 유저 버전. introduced_by_influencer_id = 본인 users.id.
// ============================================================
curatorRoutes.get('/me/introduced-stores', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const DB = c.env.DB

    const stores = await DB.prepare(
      `SELECT s.id, s.business_name, s.status, s.introduced_at, s.referral_bonus_until,
              COALESCE((SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE','SHIPPING','COMPLETED')), 0) AS total_orders,
              COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE','SHIPPING','COMPLETED')), 0) AS total_sales
         FROM sellers s
        WHERE s.introduced_by_influencer_id = ?
        ORDER BY s.introduced_at DESC, s.id DESC
        LIMIT 200`
    ).bind(userId).all<{ id: number; business_name: string | null; status: string | null; introduced_at: string | null; referral_bonus_until: string | null; total_orders: number; total_sales: number }>().catch(() => ({ results: [] as any[] }))

    // 영입 commission 누적 (point_transactions intro_commission*)
    const commission = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
         FROM point_transactions
        WHERE user_id = ? AND type IN ('intro_commission', 'intro_commission_backfill')`
    ).bind(String(userId)).first<{ total: number }>().catch(() => ({ total: 0 }))

    return c.json({
      success: true,
      total_commission: commission?.total || 0,
      stores: stores.results || [],
    })
  } catch (err) {
    return safeError(c, err, '영입 매장 조회 중 오류가 발생했습니다', '[curator:introduced-stores]')
  }
})

export { curatorRoutes }
