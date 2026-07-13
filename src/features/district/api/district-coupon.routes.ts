/**
 * 🧾 2026-07-13 상권 쿠폰(영수증 페이백) — 소비자/공개 API (district-coupon-estimate-2026-07.md SSOT).
 *
 * 골목형상점가 사업: 참여 점포에서 기준액 이상 구매 → 영수증 등록 → 어드민 승인 → 무상 쿠폰 지급
 *   → 상권 내 어느 참여 점포에서든 사용(매장 PIN self-redeem) → 사용 매장으로 정산.
 *
 * 🏛️ 아키텍처(대표 승인 2026-07-12): **병렬 엔티티** — 기존 vouchers/이용권 머니 경로 무접촉.
 *   - 무상 발행: 결제·딜·유어딜 5% 와 코드/원장 레벨 완전 분리(전금법 — 무상 리워드가 유상 선불과 안 섞임).
 *   - 만료 = 소멸(자동환불 파이프라인 애초에 미탑승 — 별도 테이블). lazy expiry(사용 CAS 가 expires_at 검증).
 *   - 매장 미지정 발급 → **사용 시점에 redeemed_store_id 귀속**(voucher 의 product.seller 파생 모델과 근본 차이).
 *   - 정산 리포트는 district_coupons 집계로 결정론(원장 무접촉) — 원장/payout 합류는 별도 격리 PR.
 *
 * 💸 머니 룰: 승인=CAS(submitted→approved 승자만 발급) · 쿠폰-영수증 UNIQUE(receipt_id) 멱등 ·
 *   사용=CAS(unused→used + 만료검증) · 영수증 승인번호 UNIQUE(campaign, card_approval_no) ·
 *   계정당 월 한도(platform_settings) · 예산 소진 가드(발급합 ≤ budget_total).
 *
 * 라우트(마운트: /api/district):
 *   공개:  GET  /campaigns/:slug            — 캠페인 + 참여 점포 목록
 *   유저:  POST /campaigns/:slug/receipts   — 영수증 등록(multipart: image+금액+매장+승인번호) [requireAuth]
 *          GET  /my                          — 내 영수증 + 쿠폰 지갑
 *          POST /coupons/:code/redeem        — 매장 PIN self-redeem(사용 시 매장 귀속) [rate-limit R1 미러]
 */
import { Hono } from 'hono'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { notifyUser } from '@/lib/notifications'
import { intParam } from '@/shared/pagination'

export type DistrictEnv = { DB: D1Database; MEDIA_BUCKET?: R2Bucket }

// ── 테이블 ensure (WeakSet 메모 — per-request DDL 금지 룰 준수) ──────────────
const _ensured = new WeakSet<object>()
export async function ensureDistrictTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB as unknown as object)) return
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS district_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      budget_total INTEGER NOT NULL DEFAULT 0,
      reward_tiers TEXT NOT NULL DEFAULT '[]',
      coupon_expires_days INTEGER NOT NULL DEFAULT 30,
      starts_at TEXT, ends_at TEXT,
      created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare(`CREATE TABLE IF NOT EXISTS district_stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      store_code TEXT NOT NULL,
      address TEXT, phone TEXT,
      bank_name TEXT, bank_account TEXT, account_holder TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      seller_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run()
    // 🔗 2026-07-13 전환 다리: 상권 점포 ↔ 유어딜 매장(sellers) 선택 연결 — 딜 병기/추천용(비머니).
    try { await DB.prepare("ALTER TABLE district_stores ADD COLUMN seller_id INTEGER").run() } catch { /* exists */ }
    await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_district_store_pin ON district_stores(campaign_id, store_code)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_district_store_campaign ON district_stores(campaign_id, is_active)").run()
    await DB.prepare(`CREATE TABLE IF NOT EXISTS district_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      store_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      card_approval_no TEXT NOT NULL,
      image_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      reject_reason TEXT,
      reviewed_by TEXT, reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run()
    // 🛡️ 영수증 돌려쓰기 구조 차단 — 승인번호는 캠페인 내 1회(부정방지 1단계 핵심).
    await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_district_receipt_approval ON district_receipts(campaign_id, card_approval_no)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_district_receipt_user ON district_receipts(user_id, campaign_id)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_district_receipt_status ON district_receipts(campaign_id, status)").run()
    await DB.prepare(`CREATE TABLE IF NOT EXISTS district_coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      receipt_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      face_value INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'unused',
      redeemed_store_id INTEGER, redeemed_at TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`).run()
    // 🛡️ 영수증 1건 = 쿠폰 1장 멱등(승인 동시요청 이중발급 구조 차단).
    await DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_district_coupon_receipt ON district_coupons(receipt_id)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_district_coupon_user ON district_coupons(user_id, status)").run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_district_coupon_store ON district_coupons(campaign_id, redeemed_store_id)").run()
    _ensured.add(DB as unknown as object)
  } catch { /* best-effort — 개별 쿼리가 재시도 */ }
}

// ── 헬퍼 (순수 계산은 district-shared.ts SSOT — 유닛테스트 공유) ────────────────
import { parseRewardTiers, matchTier, normalizeApprovalNo, type RewardTier } from '../district-shared'
export { parseRewardTiers, matchTier, normalizeApprovalNo }
export type { RewardTier }
function couponCode(): string {
  // CSPRNG 10자 (혼동 문자 제외 32진 — ~50bit, UNIQUE 인덱스가 최종 방어)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const buf = new Uint8Array(10)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < 10; i++) s += chars[buf[i] % chars.length]
  return s
}
export async function insertCouponForReceipt(
  DB: D1Database,
  r: { id: number; campaign_id: number; user_id: string },
  faceValue: number,
  expiresDays: number,
): Promise<{ id: number; code: string } | null> {
  // UNIQUE(receipt_id) 멱등 + code 충돌 재시도(최대 5회)
  for (let i = 0; i < 5; i++) {
    const code = `DC${couponCode()}`
    const res = await DB.prepare(
      `INSERT OR IGNORE INTO district_coupons (campaign_id, user_id, receipt_id, code, face_value, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 'unused', datetime('now', '+' || ? || ' days')) RETURNING id, code`,
    ).bind(r.campaign_id, r.user_id, r.id, code, faceValue, Math.max(1, expiresDays)).first<{ id: number; code: string }>().catch(() => null)
    if (res?.id) return res
    // IGNORE 로 삽입 0건: receipt_id 기존(멱등 — 기존 행 반환) 또는 code 충돌(재시도)
    const existing = await DB.prepare('SELECT id, code FROM district_coupons WHERE receipt_id = ?')
      .bind(r.id).first<{ id: number; code: string }>().catch(() => null)
    if (existing) return existing
  }
  return null
}

// 매직바이트(확장자 위변조 차단 — upload.routes 패턴 복제)
const MAGIC: Record<string, number[]> = {
  jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46],
}
function sniffExt(bytes: Uint8Array): string | null {
  for (const [ext, sig] of Object.entries(MAGIC)) if (sig.every((b, i) => bytes[i] === b)) return ext
  return null
}
function randomKey(len = 20): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length]
  return s
}

async function settingInt(DB: D1Database, key: string, fallback: number): Promise<number> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  const n = Number(row?.value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// 🔗 2026-07-13 전환 다리 게이트 — 상권 쿠폰 소비자 표면에 유어딜 동네딜 병기/추천.
//   비머니(공개 카탈로그 read 만). 2026-07-13 대표 지시로 **기본 ON**(opt-out):
//   미설정/비-'false' → 활성. 어드민이 platform_settings 에 'false' 저장 시 즉시 비활성(응답 byte-복원).
async function bridgeEnabled(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'district_deal_bridge_enabled'")
    .first<{ value: string }>().catch(() => null)
  return row?.value !== 'false'
}
/** 연결된 매장(seller_id)별 활성 동네딜 — 소비자 카탈로그 가시성 조건과 동일(도매 원본·교환권 제외). */
async function activeDealsBySeller(DB: D1Database, campaignId: number): Promise<Map<number, { count: number; product_id: number; name: string }>> {
  const rows = await DB.prepare(
    `SELECT p.seller_id AS sid, COUNT(*) AS cnt, MIN(p.id) AS pid
     FROM products p
     WHERE p.seller_id IN (SELECT seller_id FROM district_stores WHERE campaign_id = ? AND seller_id IS NOT NULL AND is_active = 1)
       AND p.is_active = 1 AND p.group_buy_status = 'active'
       AND COALESCE(p.deal_only, 0) = 0
       AND NOT (COALESCE(p.is_supply_product,0) = 1 AND COALESCE(p.supply_source_id,0) = 0)
     GROUP BY p.seller_id LIMIT 300`,
  ).bind(campaignId).all<{ sid: number; cnt: number; pid: number }>().catch(() => ({ results: [] as { sid: number; cnt: number; pid: number }[] }))
  const list = rows.results || []
  const map = new Map<number, { count: number; product_id: number; name: string }>()
  if (!list.length) return map
  const pids = list.map((r) => r.pid).slice(0, 100)
  const names = await DB.prepare(
    `SELECT id, name FROM products WHERE id IN (${pids.map(() => '?').join(',')})`,
  ).bind(...pids).all<{ id: number; name: string }>().catch(() => ({ results: [] as { id: number; name: string }[] }))
  const nameById = new Map((names.results || []).map((n) => [n.id, n.name]))
  for (const r of list) map.set(r.sid, { count: Number(r.cnt) || 0, product_id: r.pid, name: nameById.get(r.pid) || '동네딜' })
  return map
}

// ══════════════════════════ 공개 ══════════════════════════
const publicApp = new Hono<{ Bindings: DistrictEnv }>()

publicApp.get('/campaigns/:slug', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const slug = String(c.req.param('slug') || '').slice(0, 64)
  const camp = await c.env.DB.prepare(
    `SELECT id, slug, name, description, status, reward_tiers, coupon_expires_days, starts_at, ends_at
     FROM district_campaigns WHERE slug = ?`,
  ).bind(slug).first<Record<string, unknown>>().catch(() => null)
  if (!camp) return c.json({ success: false, error: '캠페인을 찾을 수 없습니다' }, 404)
  const stores = await c.env.DB.prepare(
    `SELECT id, name, address, seller_id FROM district_stores WHERE campaign_id = ? AND is_active = 1 ORDER BY name LIMIT 500`,
  ).bind(camp.id).all<{ id: number; name: string; address: string | null; seller_id: number | null }>().catch(() => ({ results: [] as { id: number; name: string; address: string | null; seller_id: number | null }[] }))
  let storeRows: Array<Record<string, unknown>> = (stores.results || []) as unknown as Array<Record<string, unknown>>
  // 🔗 전환 다리(게이트 ON): 연결 매장의 활성 동네딜 병기 — 실패해도 기본 응답 유지(fail-soft).
  if (await bridgeEnabled(c.env.DB)) {
    try {
      const deals = await activeDealsBySeller(c.env.DB, Number(camp.id))
      storeRows = storeRows.map((st) => {
        const d = st.seller_id ? deals.get(Number(st.seller_id)) : undefined
        return d ? { ...st, deal_count: d.count, deal_product_id: d.product_id, deal_name: d.name } : st
      })
    } catch { /* fail-soft */ }
  }
  return c.json({
    success: true,
    campaign: { ...camp, reward_tiers: parseRewardTiers(camp.reward_tiers as string) },
    stores: storeRows,
  })
})

// ══════════════════════════ 유저 ══════════════════════════
const userApp = new Hono<{ Bindings: DistrictEnv }>()
userApp.use('*', requireAuth())

// 영수증 등록 — multipart(image, store_id, amount, card_approval_no)
userApp.post('/campaigns/:slug/receipts',
  rateLimit({ action: 'district_receipt_submit', max: 5, windowSec: 3600 }),
  async (c) => {
    await ensureDistrictTables(c.env.DB)
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const userId = String(user.id)
    const slug = String(c.req.param('slug') || '').slice(0, 64)

    const camp = await c.env.DB.prepare(
      `SELECT id, status, budget_total, reward_tiers, ends_at FROM district_campaigns WHERE slug = ?`,
    ).bind(slug).first<{ id: number; status: string; budget_total: number; reward_tiers: string; ends_at: string | null }>().catch(() => null)
    if (!camp || camp.status !== 'open') return c.json({ success: false, error: '접수 중인 캠페인이 아닙니다' }, 400)

    const form = await c.req.formData().catch(() => null)
    if (!form) return c.json({ success: false, error: '잘못된 요청 형식입니다' }, 400)
    const storeId = intParam(String(form.get('store_id') ?? ''), 0)
    const amount = intParam(String(form.get('amount') ?? ''), 0)
    const approvalNo = normalizeApprovalNo(String(form.get('card_approval_no') ?? ''))
    const image = form.get('image')

    if (!storeId) return c.json({ success: false, error: '구매 매장을 선택해주세요' }, 400)
    if (amount <= 0 || amount > 10_000_000) return c.json({ success: false, error: '결제 금액이 올바르지 않습니다' }, 400)
    if (approvalNo.length < 4 || approvalNo.length > 32) return c.json({ success: false, error: '카드 승인번호를 확인해주세요 (영수증의 승인번호)' }, 400)
    if (!image || typeof image === 'string') return c.json({ success: false, error: '영수증 사진을 첨부해주세요' }, 400)

    // 기준액 매칭(서버 권위) — 미달이면 즉시 안내(어드민 큐 낭비 방지)
    const tiers = parseRewardTiers(camp.reward_tiers)
    const face = matchTier(tiers, amount)
    if (face == null) {
      const minTier = tiers.length ? tiers[tiers.length - 1].min_amount : 0
      return c.json({ success: false, error: `최소 ${minTier.toLocaleString()}원 이상 구매 영수증만 등록할 수 있어요` }, 400)
    }

    // 매장 유효성(해당 캠페인 참여 + 활성)
    const store = await c.env.DB.prepare(
      'SELECT id FROM district_stores WHERE id = ? AND campaign_id = ? AND is_active = 1',
    ).bind(storeId, camp.id).first().catch(() => null)
    if (!store) return c.json({ success: false, error: '참여 점포가 아닙니다' }, 400)

    // 계정당 월 한도(승인+대기 합산 — platform_settings 조정, 기본 4건/월)
    const cap = await settingInt(c.env.DB, 'district_receipt_monthly_cap', 4)
    const used = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM district_receipts
       WHERE campaign_id = ? AND user_id = ? AND status IN ('submitted','approved')
         AND created_at >= datetime('now', 'start of month')`,
    ).bind(camp.id, userId).first<{ cnt: number }>().catch(() => null)
    if ((Number(used?.cnt) || 0) >= cap) {
      return c.json({ success: false, error: `이번 달 등록 한도(${cap}건)에 도달했어요` }, 429)
    }

    // 이미지 검증(매직바이트) + R2 저장
    const file = image as File
    if (file.size > 10 * 1024 * 1024) return c.json({ success: false, error: '사진은 10MB 이하만 가능합니다' }, 400)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const ext = sniffExt(bytes)
    if (!ext) return c.json({ success: false, error: 'JPG/PNG/WebP 사진만 업로드할 수 있습니다' }, 400)
    const ym = new Date().toISOString().slice(0, 7)
    // 🛡️ 32자 CSPRNG(≈190bit) — 영수증(카드 승인번호 노출)은 biz-cert 와 동급 민감문서(공개 버킷 키=접근통제).
    const key = `uploads/district/${camp.id}/${ym}/${randomKey(32)}.${ext}`
    if (!c.env.MEDIA_BUCKET) return c.json({ success: false, error: '업로드 저장소가 준비되지 않았습니다' }, 500)
    await c.env.MEDIA_BUCKET.put(key, bytes, { httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` } })

    // 승인번호 UNIQUE — INSERT OR IGNORE + changes 검사(영수증 돌려쓰기 구조 차단)
    const ins = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO district_receipts (campaign_id, user_id, store_id, amount, card_approval_no, image_key, status)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted')`,
    ).bind(camp.id, userId, storeId, amount, approvalNo, key).run().catch(() => null)
    if (!ins || ins.meta.changes === 0) {
      // 중복 승인번호 — 업로드분 정리(best-effort)
      try { await c.env.MEDIA_BUCKET.delete(key) } catch { /* ignore */ }
      return c.json({ success: false, error: '이미 등록된 영수증(승인번호)입니다' }, 409)
    }
    return c.json({ success: true, expected_face_value: face, message: '접수되었습니다 — 검수 후 쿠폰이 지급돼요' })
  })

// 내 영수증 + 쿠폰 지갑
userApp.get('/my', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const userId = String(user.id)
  const receipts = await c.env.DB.prepare(
    `SELECT r.id, r.campaign_id, r.amount, r.status, r.reject_reason, r.created_at, s.name AS store_name, dc.slug AS campaign_slug
     FROM district_receipts r
     JOIN district_campaigns dc ON dc.id = r.campaign_id
     LEFT JOIN district_stores s ON s.id = r.store_id
     WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 100`,
  ).bind(userId).all().catch(() => ({ results: [] }))
  const coupons = await c.env.DB.prepare(
    `SELECT c.id, c.campaign_id, c.code, c.face_value,
            CASE WHEN c.status = 'unused' AND c.expires_at <= datetime('now') THEN 'expired' ELSE c.status END AS status,
            c.expires_at, c.redeemed_at, s.name AS redeemed_store_name, dc.name AS campaign_name, dc.slug AS campaign_slug
     FROM district_coupons c
     JOIN district_campaigns dc ON dc.id = c.campaign_id
     LEFT JOIN district_stores s ON s.id = c.redeemed_store_id
     WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 100`,
  ).bind(userId).all().catch(() => ({ results: [] }))
  return c.json({ success: true, receipts: receipts.results || [], coupons: coupons.results || [] })
})

// 사용처리 — 매장 선택 + 매장 PIN(self-redeem, R1 rate-limit 미러: 코드 키·성공 시 리셋)
userApp.post('/coupons/:code/redeem',
  rateLimit({
    action: 'district_redeem', max: 5, windowSec: 300, sensitive: true,
    // ⚠️ 핸들러의 code 정규화(trim+upper+slice16)와 byte-일치해야 성공 리셋 DELETE 가 같은 키를 지움.
    keyFn: (c) => `district_redeem:${String(c.req.param('code') || '').trim().toUpperCase().slice(0, 16)}`,
  }),
  async (c) => {
    await ensureDistrictTables(c.env.DB)
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const userId = String(user.id)
    const code = String(c.req.param('code') || '').trim().toUpperCase().slice(0, 16)
    const body = await c.req.json<{ store_id?: unknown; store_code?: unknown }>().catch(() => ({} as { store_id?: unknown; store_code?: unknown }))
    const storeId = intParam(String(body.store_id ?? ''), 0)
    const pin = String(body.store_code ?? '').trim()
    if (!storeId || !/^\d{4,8}$/.test(pin)) return c.json({ success: false, error: '사용 매장과 매장 확인코드를 입력해주세요' }, 400)

    const coupon = await c.env.DB.prepare(
      'SELECT id, campaign_id, status, expires_at FROM district_coupons WHERE code = ? AND user_id = ?',
    ).bind(code, userId).first<{ id: number; campaign_id: number; status: string; expires_at: string }>().catch(() => null)
    if (!coupon) return c.json({ success: false, error: '쿠폰을 찾을 수 없습니다' }, 404)
    if (coupon.status !== 'unused') return c.json({ success: false, error: '이미 사용되었거나 만료된 쿠폰입니다' }, 400)

    // 매장 PIN 검증(사용 시점 매장 귀속의 신뢰 근거 — 문자열 정확일치, 불일치도 rate-limit 카운트)
    const store = await c.env.DB.prepare(
      'SELECT id, store_code FROM district_stores WHERE id = ? AND campaign_id = ? AND is_active = 1',
    ).bind(storeId, coupon.campaign_id).first<{ id: number; store_code: string }>().catch(() => null)
    if (!store || store.store_code !== pin) {
      return c.json({ success: false, error: '매장 확인코드가 일치하지 않습니다' }, 403)
    }

    // CAS: unused→used + 만료 검증 + 사용 시점 매장 귀속(redeemed_store_id) — 이중사용 구조 차단
    const cas = await c.env.DB.prepare(
      `UPDATE district_coupons SET status = 'used', redeemed_store_id = ?, redeemed_at = datetime('now')
       WHERE id = ? AND user_id = ? AND status = 'unused' AND expires_at > datetime('now')`,
    ).bind(storeId, coupon.id, userId).run().catch(() => null)
    if (!cas || cas.meta.changes === 0) return c.json({ success: false, error: '사용할 수 없는 쿠폰입니다 (만료/이미 사용)' }, 409)

    // 성공 시 rate-limit 리셋(R1 미러 — 정상 사용자가 오입력 누적으로 잠기지 않게)
    try {
      await c.env.DB.prepare("DELETE FROM rate_limit_attempts WHERE action = 'district_redeem' AND key = ?")
        .bind(`district_redeem:${code}`).run()
    } catch { /* best-effort */ }
    // 🔗 전환 다리(게이트 ON): 사용 완료 화면에 상권 딜 추천 1줄 — 사용 매장 딜 우선, 없으면 캠페인 내 딜.
    let bridge: { product_id: number; name: string } | null = null
    try {
      if (await bridgeEnabled(c.env.DB)) {
        const deals = await activeDealsBySeller(c.env.DB, coupon.campaign_id)
        const linked = await c.env.DB.prepare('SELECT seller_id FROM district_stores WHERE id = ?')
          .bind(storeId).first<{ seller_id: number | null }>().catch(() => null)
        const own = linked?.seller_id ? deals.get(Number(linked.seller_id)) : undefined
        const any = own || deals.values().next().value
        if (any) bridge = { product_id: any.product_id, name: any.name }
      }
    } catch { /* fail-soft — 추천은 부가 정보 */ }
    return c.json({ success: true, message: '사용 완료! 결제 금액에서 쿠폰 금액을 빼고 결제하세요', bridge })
  })

// 사후 알림 도우미(어드민 승인/반려에서 재사용)
export async function notifyDistrictUser(DB: D1Database, userId: string, title: string, message: string): Promise<void> {
  await notifyUser(DB, userId, 'district_coupon', title, message, '/district/my')
}

export const districtPublicRoutes = new Hono<{ Bindings: DistrictEnv }>()
districtPublicRoutes.route('/', publicApp)
districtPublicRoutes.route('/', userApp)
