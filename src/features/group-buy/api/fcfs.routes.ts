/**
 * 🎯 2026-06-20 (대표 — 선착순 응모 상품): 초기 시딩 전략용 "선착순 N/M명" 상품.
 *
 * 모델: (a) 응모형 — 결제 없음. 운영자가 어드민에서 등록한 (반)시드 공구 상품에 유저가 '지원'.
 *   - 모집정원(spots) / 지원수 시드(appliedSeed) 는 어드민에서 세팅 (product_supply_meta, K-V 사이드테이블).
 *   - 표시 지원수 = appliedSeed + 실제 지원수(fcfs_applications). "선착순 {표시}/{spots}명".
 *   - 상위노출: 일반 공구보다 리스트 상단(클라가 fcfs active 를 앞에 병합).
 *   - 선정: 어드민에서 수동 선택 또는 랜덤 N명 → 선정자 알림(notifications).
 *
 * 라우트:
 *   공개:  GET  /api/fcfs/active                  — 활성 선착순 상품(+config) 목록 (상위노출/배지용)
 *          GET  /api/fcfs/:productId              — 단일 config + 표시 지원수
 *   유저:  POST /api/fcfs/:productId/apply        — 지원(1인 1회, 결제 X)  [requireAuth]
 *          GET  /api/fcfs/:productId/me           — 내 지원 상태           [requireAuth]
 *   어드민: PUT  /api/admin/fcfs/:productId        — 선착순 설정(enabled/spots/appliedSeed/deadline)
 *          GET  /api/admin/fcfs/:productId/applicants — 지원자 목록
 *          POST /api/admin/fcfs/:productId/select — 선정(winners[] 또는 count 랜덤) + 알림
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, requireAdmin } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { publicCache } from '@/worker/middleware/edge-cache'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'
import { setSupplyMeta, getSupplyMeta } from '@/worker/utils/product-supply-meta'
import { safeError } from '@/worker/utils/safe-error'

type Vars = { user?: { id: string | number; email?: string } }

const _ensured = new WeakSet<object>()
async function ensureFcfsTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS fcfs_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT DEFAULT 'applied',
      created_at DATETIME DEFAULT (datetime('now')),
      selected_at DATETIME,
      UNIQUE(product_id, user_id)
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_fcfs_app_product ON fcfs_applications(product_id, status)").run()
  } catch { /* ignore */ }
}

interface FcfsConfig { enabled: boolean; spots: number; appliedSeed: number; deadline: string | null }
function parseConfig(rec: Record<string, string> | undefined): FcfsConfig {
  return {
    enabled: rec?.fcfs_enabled === '1',
    spots: Math.max(0, parseInt(rec?.fcfs_spots || '0', 10) || 0),
    appliedSeed: Math.max(0, parseInt(rec?.fcfs_applied_seed || '0', 10) || 0),
    deadline: rec?.fcfs_deadline || null,
  }
}
async function realAppliedCount(DB: D1Database, productId: number): Promise<number> {
  const r = await DB.prepare("SELECT COUNT(*) as n FROM fcfs_applications WHERE product_id=? AND status IN ('applied','selected')")
    .bind(productId).first<{ n: number }>().catch(() => null)
  return r?.n || 0
}

// ─────────────────────────────── 공개 ───────────────────────────────
const publicApp = new Hono<{ Bindings: Env; Variables: Vars }>()

publicApp.get('/active', async (c) => {
  try {
    const DB = c.env.DB
    await ensureFcfsTable(DB)
    // fcfs_enabled='1' 인 product_id 들 → 상품 정보 join
    const { results: metaRows } = await DB.prepare(
      "SELECT product_id, key, value FROM product_supply_meta WHERE key LIKE 'fcfs_%'"
    ).all<{ product_id: number; key: string; value: string | null }>().catch(() => ({ results: [] as { product_id: number; key: string; value: string | null }[] }))
    const byId = new Map<number, Record<string, string>>()
    for (const m of metaRows || []) {
      const rec = byId.get(m.product_id) || {}; rec[m.key] = m.value ?? ''; byId.set(m.product_id, rec)
    }
    const enabledIds = [...byId.entries()].filter(([, rec]) => rec.fcfs_enabled === '1').map(([id]) => id)
    if (enabledIds.length === 0) return c.json({ success: true, data: [] })
    const ph = enabledIds.map(() => '?').join(',')
    // 🏙️ 2026-07-04 (상권관 랜딩): ?region=<지역코드 5~12자리> 면 product_regions prefix 필터(additive).
    //   group-buy-public 의 region 분기와 동일 패턴 — 미전달 시 기존 쿼리 그대로.
    const regionRaw = String(c.req.query('region') || '').trim()
    const regionParam = /^\d{5,12}$/.test(regionRaw) ? regionRaw : ''
    const regionJoin = regionParam ? 'JOIN product_regions pr ON pr.product_id = p.id' : ''
    const regionWhere = regionParam ? 'AND pr.region_dong_code LIKE ?' : ''
    const regionBinds = regionParam ? [`${regionParam}%`] : []
    const { results: prods } = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.restaurant_name, p.restaurant_address, p.category
         FROM products p ${regionJoin}
        WHERE p.id IN (${ph}) AND p.is_active=1 ${regionWhere}`
    ).bind(...enabledIds, ...regionBinds).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
    // 🧯 2026-07-02: 상품별 COUNT 루프(N+1) → GROUP BY 단일 쿼리 — 캐시 miss 시에도 D1 왕복 상수화.
    const countRows = await DB.prepare(
      `SELECT product_id, COUNT(*) as n FROM fcfs_applications
        WHERE product_id IN (${ph}) AND status IN ('applied','selected') GROUP BY product_id`
    ).bind(...enabledIds).all<{ product_id: number; n: number }>().catch(() => ({ results: [] as { product_id: number; n: number }[] }))
    const countById = new Map((countRows.results || []).map(r => [r.product_id, r.n]))
    const out = []
    for (const p of prods || []) {
      const cfg = parseConfig(byId.get(p.id as number))
      const real = countById.get(p.id as number) || 0
      out.push({ ...p, fcfs: { ...cfg, appliedDisplay: cfg.appliedSeed + real, realApplied: real } })
    }
    return c.json({ success: true, data: out })
  } catch (err) { return safeError(c, err, '선착순 목록 조회 실패', '[fcfs]') }
})

// 🧯 2026-07-02 (폭주 점검): 공개 config+카운트 — 상세 표면 폭주 시 D1 직행이던 것 30s 엣지 캐시.
//   publicApp 한정이라 인증 경로(/:id/me, /:id/apply — userApp)와 URL 충돌 없음. 응모 직후 fresh 카운트는 POST 응답이 담당.
publicApp.get('/:productId', publicCache(30), async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'bad id' }, 400)
    await ensureFcfsTable(DB)
    const meta = await getSupplyMeta(DB, [productId])
    const cfg = parseConfig(meta.get(productId))
    const real = await realAppliedCount(DB, productId)
    return c.json({ success: true, data: { ...cfg, appliedDisplay: cfg.appliedSeed + real, realApplied: real } })
  } catch (err) { return safeError(c, err, '선착순 조회 실패', '[fcfs]') }
})

// ─────────────────────────────── 유저 ───────────────────────────────
const userApp = new Hono<{ Bindings: Env; Variables: Vars }>()
userApp.use('*', requireAuth())

// 🧯 2026-07-02 (대표 "트래픽 폭주에도 이상적으로"): 오픈런 표면 — IP당 10회/분 캡.
//   정상 유저는 1탭 1회(멱등)라 무영향, 봇/연타만 차단. INSERT OR IGNORE 멱등은 기존 유지.
userApp.post('/:productId/apply', rateLimit({ action: 'fcfs_apply', max: 10, windowSec: 60 }), async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    const userId = String(c.get('user')?.id || '')
    if (!Number.isFinite(productId) || !userId) return c.json({ success: false, error: 'bad request' }, 400)
    await ensureFcfsTable(DB)
    const meta = await getSupplyMeta(DB, [productId])
    const cfg = parseConfig(meta.get(productId))
    if (!cfg.enabled) return c.json({ success: false, error: '선착순 응모 대상이 아닙니다' }, 400)
    if (cfg.deadline && new Date(cfg.deadline).getTime() < Date.now()) return c.json({ success: false, error: '응모가 마감되었습니다' }, 400)
    // 1인 1회 (UNIQUE) — INSERT OR IGNORE 멱등
    const res = await DB.prepare("INSERT OR IGNORE INTO fcfs_applications (product_id, user_id, status) VALUES (?, ?, 'applied')")
      .bind(productId, userId).run()
    const already = (res.meta?.changes || 0) === 0
    const real = await realAppliedCount(DB, productId)
    return c.json({ success: true, data: { applied: true, already, appliedDisplay: cfg.appliedSeed + real } })
  } catch (err) { return safeError(c, err, '응모 처리 실패', '[fcfs]') }
})

userApp.get('/:productId/me', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    const userId = String(c.get('user')?.id || '')
    if (!Number.isFinite(productId) || !userId) return c.json({ success: false, error: 'bad request' }, 400)
    await ensureFcfsTable(DB)
    const row = await DB.prepare("SELECT status FROM fcfs_applications WHERE product_id=? AND user_id=?")
      .bind(productId, userId).first<{ status: string }>().catch(() => null)
    return c.json({ success: true, data: { status: row?.status || null } })
  } catch (err) { return safeError(c, err, '응모 상태 조회 실패', '[fcfs]') }
})

// ─────────────────────────────── 어드민 ───────────────────────────────
const adminApp = new Hono<{ Bindings: Env; Variables: Vars }>()
adminApp.use('*', requireAdmin())

adminApp.put('/:productId', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'bad id' }, 400)
    const body = await c.req.json<{ enabled?: boolean; spots?: number; appliedSeed?: number; deadline?: string | null }>()
    await ensureFcfsTable(DB)
    await setSupplyMeta(DB, productId, {
      fcfs_enabled: body.enabled ? '1' : '0',
      fcfs_spots: Math.max(0, Math.floor(Number(body.spots) || 0)),
      fcfs_applied_seed: Math.max(0, Math.floor(Number(body.appliedSeed) || 0)),
      fcfs_deadline: body.deadline || null,
    })
    return c.json({ success: true })
  } catch (err) { return safeError(c, err, '선착순 설정 저장 실패', '[fcfs]') }
})

adminApp.get('/:productId/applicants', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    await ensureFcfsTable(DB)
    const { results } = await DB.prepare(
      `SELECT a.id, a.user_id, a.status, a.created_at, a.selected_at, u.name as user_name, u.phone as user_phone
       FROM fcfs_applications a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.product_id=? ORDER BY a.created_at ASC`
    ).bind(productId).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
    return c.json({ success: true, data: results || [] })
  } catch (err) { return safeError(c, err, '지원자 조회 실패', '[fcfs]') }
})

adminApp.post('/:productId/select', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'bad id' }, 400)
    const body = await c.req.json<{ winners?: string[]; count?: number }>().catch(() => ({} as { winners?: string[]; count?: number }))
    await ensureFcfsTable(DB)

    let winnerIds: string[] = []
    if (Array.isArray(body.winners) && body.winners.length > 0) {
      winnerIds = body.winners.map(String)
    } else if (body.count && body.count > 0) {
      // 랜덤 N명 (applied 중)
      const { results } = await DB.prepare("SELECT user_id FROM fcfs_applications WHERE product_id=? AND status='applied' ORDER BY RANDOM() LIMIT ?")
        .bind(productId, Math.floor(body.count)).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }))
      winnerIds = (results || []).map(r => r.user_id)
    }
    if (winnerIds.length === 0) return c.json({ success: false, error: '선정할 지원자가 없습니다' }, 400)

    const prod = await DB.prepare("SELECT name, restaurant_name, category, deal_only FROM products WHERE id=?").bind(productId).first<{ name?: string; restaurant_name?: string; category?: string; deal_only?: number }>().catch(() => null)
    const dealName = prod?.restaurant_name || prod?.name || '추첨 공구'
    // 💳 2026-07-02 (대표 "당첨되면 결제되게"): 응모는 무결제 설계 그대로 — 당첨 알림에 **결제 딥링크**
    //   를 실어 당첨자가 바로 구매(일반 결제 플로우)로 이어지게 함. 경로는 종류판별 SSOT(교환권/이용권
    //   =/group-buy, 일반=/products — deal_only/isVoucherCategory, group_buy_status 사용 금지 룰 준수).
    const buyPath = (Number(prod?.deal_only) === 1 || isVoucherCategory(prod?.category))
      ? `/group-buy/${productId}` : `/products/${productId}`

    // 🔔 2026-07-05: 이번 선정이 '승계'(재선정)인지 판정 — 이번 winners 를 제외하고 이미 선정 이력
    //   (selected/paid)이 있으면, 초기 선정 이후의 재선정 = 예비 당첨 승계로 본다. 알림톡 문안 분기용.
    const winnerPh = winnerIds.map(() => '?').join(',')
    const priorRow = await DB.prepare(
      `SELECT COUNT(*) AS n FROM fcfs_applications
        WHERE product_id = ? AND status IN ('selected','paid') AND user_id NOT IN (${winnerPh})`,
    ).bind(productId, ...winnerIds).first<{ n: number }>().catch(() => null)
    const isReplacement = (Number(priorRow?.n) || 0) > 0

    for (const uid of winnerIds) {
      await DB.prepare("UPDATE fcfs_applications SET status='selected', selected_at=datetime('now') WHERE product_id=? AND user_id=?").bind(productId, uid).run().catch(() => {})
      // 선정 알림 + 결제 유도 딥링크
      await DB.prepare(
        "INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at) VALUES (?, 'user', 'fcfs_selected', ?, ?, ?, datetime('now'))"
      ).bind(uid, '🎉 추첨 당첨!', `[${dealName}] 추첨에 당첨되셨어요! 지금 결제하시면 확정됩니다. (미결제 시 예비 당첨자에게 넘어갈 수 있어요)`, buyPath).run().catch(() => {})
    }

    // 🔔 2026-07-05 알림톡: 체험단 선정/승계 안내 — 앱을 안 여는 초기 유저 도달 채널 (waitUntil·fail-soft,
    //   sendSystemAlimtalk 이 dedup(phone+template 1h)·일일 캡·실패 재시도 큐 담당).
    //   ⚠️ tpl_code fcfs_selected/fcfs_replacement 는 Aligo 콘솔 등록·승인 필요 — 아래 message 는 승인
    //   템플릿 본문과 일치시켜 유지할 것 ("추첨" 대신 "선정" 표기, alimtalk-templates.ts 레지스트리 등재).
    {
      const _alimBg = async () => {
        try {
          const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
          const ph2 = winnerIds.map(() => '?').join(',')
          const { results: phones } = await DB.prepare(
            `SELECT id, phone FROM users WHERE id IN (${ph2}) AND phone IS NOT NULL AND phone != ''`,
          ).bind(...winnerIds).all<{ id: string; phone: string }>().catch(() => ({ results: [] as Array<{ id: string; phone: string }> }))
          const tpl = isReplacement ? 'fcfs_replacement' : 'fcfs_selected'
          const msg = isReplacement
            ? `[유어딜] ${dealName} 체험단 참여 기회가 회원님께 넘어왔어요!\n\n앞선 선정자의 미결제로 예비 순번이 승계되었습니다. 기한 내 결제하시면 참여가 확정됩니다.\n\n확정하기: https://live.ur-team.com${buyPath}`
            : `[유어딜] ${dealName} 체험단에 선정되셨습니다! 🎉\n\n기한 내 결제하시면 참여가 확정됩니다. (미결제 시 예비 선정자에게 기회가 넘어갈 수 있어요)\n\n확정하기: https://live.ur-team.com${buyPath}`
          for (const p of phones || []) {
            await sendSystemAlimtalk(c.env, p.phone, tpl, msg).catch(() => {})
          }
        } catch { /* fail-soft — 인앱 알림은 위에서 이미 기록됨 */ }
      }
      let _alimDeferred = false
      try { if (c.executionCtx?.waitUntil) { c.executionCtx.waitUntil(_alimBg()); _alimDeferred = true } } catch { /* no ctx */ }
      if (!_alimDeferred) await _alimBg()
    }
    return c.json({ success: true, data: { selected: winnerIds.length, replacement: isReplacement } })
  } catch (err) { return safeError(c, err, '선정 처리 실패', '[fcfs]') }
})

// 공개 + 유저를 한 앱으로 합쳐 export (공개가 먼저, 유저 라우트는 requireAuth)
export const fcfsRoutes = new Hono<{ Bindings: Env; Variables: Vars }>()
fcfsRoutes.route('/', publicApp)
fcfsRoutes.route('/', userApp)
export const fcfsAdminRoutes = adminApp
