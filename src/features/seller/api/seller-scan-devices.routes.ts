/**
 * 📟 2026-07-20 (대표 — "사장님 말고 직원 폰·공기계로 스캔할 땐?"): 매장 스캔 전용 기기 링크.
 *
 * 문제: 계산대 스캔(use-by-seller)이 seller JWT(=사장님 카카오 로그인) 전용이라 직원 폰/공기계는
 *   사장님 개인 카카오를 로그인해줘야 했음(계정 공유 = 보안·프라이버시 문제).
 * 해법: 사장님이 대시보드에서 **스캔 전용 링크** 발급 → 직원 폰/공기계는 그 링크(QR)로 접속만 하면
 *   로그인 없이 스캔 가능. **최소 권한**(바우처 사용 처리만 — 정산·설정·상품 접근 불가) + 회수 가능.
 *
 * 보안:
 *   - 토큰 32byte 랜덤(base64url) — 서버엔 SHA-256 해시만 저장(유출 시 원문 복원 불가)
 *   - 발급/목록/회수는 seller JWT 필수 · 활성 기기 캡 10개 · 회수(revoked_at) 즉시 무효
 *   - 스캔 인증 브리지(scanOrSellerAuth)는 use-by-seller 한 라우트에만 배선 — scope 확장 금지
 */
import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { requireAuth } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'

type Bindings = { DB: D1Database; JWT_SECRET: string }

// per-request DDL 금지 룰 — ensure + WeakSet 메모이즈 (product_supply_meta 패턴)
const ensured = new WeakSet<object>()
async function ensureScanDevicesTable(DB: D1Database): Promise<void> {
  if (ensured.has(DB as unknown as object)) return
  await DB.prepare(
    `CREATE TABLE IF NOT EXISTS seller_scan_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      name TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked_at TEXT
    )`
  ).run()
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_scan_devices_seller ON seller_scan_devices(seller_id)').run().catch(() => {})
  ensured.add(DB as unknown as object)
}

async function sha256b64(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 스캔 기기 키 검증 — 활성(미회수) 기기면 sellerId 반환 + last_used_at 갱신(best-effort). */
export async function verifyScanDeviceKey(DB: D1Database, key: string): Promise<{ sellerId: number; deviceId: number } | null> {
  if (!key || key.length < 20 || key.length > 128) return null
  try {
    await ensureScanDevicesTable(DB)
    const hash = await sha256b64(key)
    const row = await DB.prepare(
      'SELECT id, seller_id FROM seller_scan_devices WHERE token_hash = ? AND revoked_at IS NULL'
    ).bind(hash).first<{ id: number; seller_id: number }>()
    if (!row) return null
    DB.prepare("UPDATE seller_scan_devices SET last_used_at = datetime('now') WHERE id = ?").bind(row.id).run().catch(() => {})
    return { sellerId: Number(row.seller_id), deviceId: Number(row.id) }
  } catch { return null }
}

/**
 * 스캔 인증 브리지 — X-Scan-Device-Key 헤더(+Authorization 부재)면 기기 키 인증으로
 * getCurrentUser 컨트랙트(c.set('user'))를 채우고, 아니면 기존 requireAuth 로 위임(행동 불변).
 * ⚠️ use-by-seller(바우처 사용 처리) 한 라우트 전용 — 다른 라우트 배선 금지(최소 권한).
 */
export function scanOrSellerAuth() {
  const fallback = requireAuth()
  return async (c: Context, next: Next) => {
    const key = c.req.header('X-Scan-Device-Key')
    if (key && !c.req.header('Authorization')) {
      const dev = await verifyScanDeviceKey((c.env as Bindings).DB, key)
      if (!dev) return c.json({ success: false, error: '유효하지 않은 스캔 기기 링크입니다. 사장님께 새 링크를 요청하세요.' }, 401)
      c.set('user', { id: dev.sellerId, type: 'seller', scan_device_id: dev.deviceId })
      return next()
    }
    return fallback(c, next)
  }
}

export const sellerScanDevicesRoutes = new Hono<{ Bindings: Bindings }>()

// ── POST /scan-devices — 발급 (seller JWT, 활성 캡 10) ──
sellerScanDevicesRoutes.post('/scan-devices', rateLimit({ action: 'scan_device_issue', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const DB = c.env.DB
    await ensureScanDevicesTable(DB)
    const active = await DB.prepare(
      'SELECT COUNT(*) AS n FROM seller_scan_devices WHERE seller_id = ? AND revoked_at IS NULL'
    ).bind(sellerId).first<{ n: number }>()
    if (Number(active?.n || 0) >= 10) {
      return c.json({ success: false, error: '활성 스캔 기기는 최대 10개입니다. 안 쓰는 기기를 먼저 회수해주세요.' }, 400)
    }
    const body = await c.req.json<{ name?: string }>().catch(() => ({} as { name?: string }))
    const name = String(body.name || '').trim().slice(0, 40) || '스캔 기기'
    const key = randomKey()
    const hash = await sha256b64(key)
    const r = await DB.prepare(
      'INSERT INTO seller_scan_devices (seller_id, name, token_hash) VALUES (?, ?, ?)'
    ).bind(sellerId, name, hash).run()
    // key 원문은 이 응답 1회만 — 서버엔 해시만 남음
    return c.json({ success: true, data: { id: r.meta?.last_row_id, name, key, link: `/store/scan?dk=${key}` } })
  } catch (err) {
    return safeError(c, err, '스캔 기기 발급 중 오류가 발생했습니다', '[scan-devices]')
  }
})

// ── GET /scan-devices — 목록 ──
sellerScanDevicesRoutes.get('/scan-devices', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    await ensureScanDevicesTable(c.env.DB)
    const rows = await c.env.DB.prepare(
      `SELECT id, name, created_at, last_used_at, revoked_at FROM seller_scan_devices
       WHERE seller_id = ? ORDER BY (revoked_at IS NULL) DESC, id DESC LIMIT 50`
    ).bind(sellerId).all<{ id: number; name: string; created_at: string; last_used_at: string | null; revoked_at: string | null }>()
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '스캔 기기 조회 중 오류가 발생했습니다', '[scan-devices]')
  }
})

// ── POST /scan-devices/:id/revoke — 회수(즉시 무효) ──
sellerScanDevicesRoutes.post('/scan-devices/:id/revoke', rateLimit({ action: 'scan_device_revoke', max: 30, windowSec: 3600 }), async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 기기 ID' }, 400)
    await ensureScanDevicesTable(c.env.DB)
    // 소유권 검증 포함 원자 UPDATE (IDOR 방지)
    const r = await c.env.DB.prepare(
      "UPDATE seller_scan_devices SET revoked_at = datetime('now') WHERE id = ? AND seller_id = ? AND revoked_at IS NULL"
    ).bind(id, sellerId).run()
    if (!r.meta?.changes) return c.json({ success: false, error: '이미 회수됐거나 존재하지 않는 기기입니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '스캔 기기 회수 중 오류가 발생했습니다', '[scan-devices]')
  }
})
