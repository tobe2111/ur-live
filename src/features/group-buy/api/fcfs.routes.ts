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
    // 🎲 2026-07-05 (운영 감사 Q9 — 추첨 공정성 증빙): 추첨 실행 기록. "당첨이 조작 아니냐"에
    //   답할 수 있도록 실행자·방식·응모자 풀 스냅샷·당첨자를 영구 보관. 지자체(B2G) 체험단
    //   사업 정산 증빙으로도 제출 가능.
    await DB.prepare(`CREATE TABLE IF NOT EXISTS fcfs_draw_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      admin_id TEXT,
      method TEXT NOT NULL,
      requested_count INTEGER,
      pool_size INTEGER NOT NULL,
      pool_snapshot TEXT,
      winners TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare("CREATE INDEX IF NOT EXISTS idx_fcfs_draw_product ON fcfs_draw_logs(product_id, created_at)").run()
  } catch { /* ignore */ }
}

/**
 * 편향 없는 crypto 정수 [0, maxExclusive) — modulo 편향을 rejection sampling 으로 제거.
 * SQLite RANDOM() 은 시드/구현이 불투명해 공정성 증빙에 부적합 — WebCrypto CSPRNG 사용.
 */
function cryptoInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive
  for (;;) {
    crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

/** Fisher-Yates (crypto) — 앞에서 n 개가 당첨. 원본 배열 비파괴. */
function cryptoShuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
// 🧯 2026-07-05 (대표 "데모로 만드는 건 실 유저가 추첨될 수 없는 형태여야"): 데모 상품 판별 —
//   seed-demo 시드 동네딜/이용권은 slug 'demo-deal-N' 이 유일 식별자(어드민 삭제/집계와 동일 기준).
async function isDemoProduct(DB: D1Database, productId: number): Promise<boolean> {
  const row = await DB.prepare('SELECT slug FROM products WHERE id=?')
    .bind(productId).first<{ slug: string | null }>().catch(() => null)
  return (row?.slug || '').startsWith('demo-deal-')
}

// 표시 카운트에는 'demo'(데모 상품에 실 유저가 응모한 행 — 추첨 풀 제외 전용 상태)도 포함 —
// 응모하면 숫자는 올라가되(체감 유지) 추첨 풀(status='applied')에는 구조적으로 못 들어간다.
async function realAppliedCount(DB: D1Database, productId: number): Promise<number> {
  const r = await DB.prepare("SELECT COUNT(*) as n FROM fcfs_applications WHERE product_id=? AND status IN ('applied','selected','demo')")
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
      "SELECT product_id, key, value FROM product_supply_meta WHERE key LIKE 'fcfs_%' OR key = 'prelaunch'"
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
    // 🎯 2026-07-04 (대표 "데모 이용권 노출은 항상 후순위"): is_demo 플래그 + 데모-후순위 정렬 —
    //   이 목록을 직접 렌더하는 표면(상권관 랜딩 등)에서도 실 상품 먼저, 데모는 뒤.
    const { results: prods } = await DB.prepare(
      `SELECT p.id, p.name, p.price, p.original_price, p.image_url, p.restaurant_name, p.restaurant_address, p.category,
              (CASE WHEN COALESCE(p.slug,'') LIKE 'demo-deal-%' THEN 1 ELSE 0 END) AS is_demo
         FROM products p ${regionJoin}
        WHERE p.id IN (${ph}) AND p.is_active=1 ${regionWhere}
        ORDER BY is_demo, p.created_at DESC`
    ).bind(...enabledIds, ...regionBinds).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
    // 🧯 2026-07-02: 상품별 COUNT 루프(N+1) → GROUP BY 단일 쿼리 — 캐시 miss 시에도 D1 왕복 상수화.
    const countRows = await DB.prepare(
      `SELECT product_id, COUNT(*) as n FROM fcfs_applications
        WHERE product_id IN (${ph}) AND status IN ('applied','selected','demo') GROUP BY product_id`
    ).bind(...enabledIds).all<{ product_id: number; n: number }>().catch(() => ({ results: [] as { product_id: number; n: number }[] }))
    const countById = new Map((countRows.results || []).map(r => [r.product_id, r.n]))
    const out = []
    for (const p of prods || []) {
      const cfg = parseConfig(byId.get(p.id as number))
      const real = countById.get(p.id as number) || 0
      out.push({ ...p, fcfs: { ...cfg, prelaunch: (byId.get(p.id as number)?.prelaunch === '1'), appliedDisplay: cfg.appliedSeed + real, realApplied: real } })
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
    // 🛡️ 2026-07-02 (감사 26 — 봇 응모 방어): 가입 24시간 미만 신규 계정 응모 제한.
    //   무료 응모 특성상 계정 양산 봇의 1순위 표적 — 최소 숙성 기간 요구(조회 실패 시 fail-open).
    try {
      const u = await DB.prepare('SELECT created_at FROM users WHERE id = ?').bind(userId)
        .first<{ created_at: string | null }>()
      const createdMs = u?.created_at ? Date.parse(String(u.created_at).replace(' ', 'T') + 'Z') : NaN
      if (Number.isFinite(createdMs) && Date.now() - createdMs < 24 * 60 * 60 * 1000) {
        return c.json({ success: false, error: '가입 후 24시간이 지나야 응모할 수 있어요' }, 403)
      }
    } catch { /* fail-open */ }
    await ensureFcfsTable(DB)
    const meta = await getSupplyMeta(DB, [productId])
    const cfg = parseConfig(meta.get(productId))
    if (!cfg.enabled) return c.json({ success: false, error: '선착순 응모 대상이 아닙니다' }, 400)
    if (cfg.deadline && new Date(cfg.deadline).getTime() < Date.now()) return c.json({ success: false, error: '응모가 마감되었습니다' }, 400)
    // 🧯 2026-07-05: 데모 상품 응모는 status='demo' 로 저장 — 추첨 풀(status='applied')에
    //   **존재 자체가 불가능**해 실 유저가 당첨될 수 없는 구조(선정 게이트와 이중 방어).
    //   표시 카운트에는 포함(체감 유지), UX 는 일반 응모와 동일("응모 완료 · 당첨 시 안내").
    const applyStatus = (await isDemoProduct(DB, productId)) ? 'demo' : 'applied'
    // 1인 1회 (UNIQUE) — INSERT OR IGNORE 멱등
    const res = await DB.prepare("INSERT OR IGNORE INTO fcfs_applications (product_id, user_id, status) VALUES (?, ?, ?)")
      .bind(productId, userId, applyStatus).run()
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

// 🎲 2026-07-05 (Q9): 추첨 실행 이력 — 공정성 증빙 열람용(실행자·방식·풀 크기·당첨자).
adminApp.get('/:productId/draws', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'bad id' }, 400)
    await ensureFcfsTable(DB)
    const { results } = await DB.prepare(
      `SELECT id, admin_id, method, requested_count, pool_size, winners, created_at
       FROM fcfs_draw_logs WHERE product_id=? ORDER BY created_at DESC LIMIT 50`
    ).bind(productId).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
    return c.json({ success: true, data: results || [] })
  } catch (err) { return safeError(c, err, '추첨 이력 조회 실패', '[fcfs]') }
})

adminApp.post('/:productId/select', async (c) => {
  try {
    const DB = c.env.DB
    const productId = parseInt(c.req.param('productId') || '', 10)
    if (!Number.isFinite(productId)) return c.json({ success: false, error: 'bad id' }, 400)
    const body = await c.req.json<{ winners?: string[]; count?: number }>().catch(() => ({} as { winners?: string[]; count?: number }))
    await ensureFcfsTable(DB)

    // 🧯 2026-07-05 (대표 "이용권 데모의 경우 실 유저가 추첨되면 안돼"): 데모 동네딜/이용권
    //   (slug 'demo-deal-N', seed-demo 시드 — 실매장 딜 아님)은 추첨 선정 전면 차단.
    //   fcfs_applications 행은 전부 **실 유저**라 데모에서 선정하는 순간 실 유저에게
    //   "당첨! 결제하세요" 딥링크 알림이 나가 가짜 딜 결제 사고로 이어짐.
    //   수동 winners 지정도 동일 차단. 응모수 시드(fcfs_applied_seed) 표시는 불변.
    if (await isDemoProduct(DB, productId)) {
      return c.json({ success: false, error: '데모 상품은 추첨 선정이 차단되어 있습니다 — 실 유저 당첨 방지 (응모수 시드 표시만 사용)' }, 400)
    }

    // 🎲 2026-07-05 (Q9 공정성): 추첨 방식 교체 — SQLite `ORDER BY RANDOM()`(재현/증빙 불가) →
    //   응모자 풀 전체를 읽어 WebCrypto Fisher-Yates 로 셔플. 실행 내역(실행자·방식·풀·당첨자)을
    //   fcfs_draw_logs 에 영구 기록해 "공정했는가"에 데이터로 답한다.
    const { results: poolRows } = await DB.prepare(
      "SELECT user_id FROM fcfs_applications WHERE product_id=? AND status='applied' ORDER BY created_at ASC"
    ).bind(productId).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }))
    const pool = (poolRows || []).map(r => r.user_id)

    let winnerIds: string[] = []
    let method = 'crypto_random'
    if (Array.isArray(body.winners) && body.winners.length > 0) {
      // 수동 지정 — 풀에 실제 존재하는 응모자만 인정(임의 uid 주입 차단).
      const poolSet = new Set(pool)
      winnerIds = body.winners.map(String).filter(uid => poolSet.has(uid))
      method = 'manual'
    } else if (body.count && body.count > 0) {
      winnerIds = cryptoShuffle(pool).slice(0, Math.floor(body.count))
    }
    if (winnerIds.length === 0) return c.json({ success: false, error: '선정할 지원자가 없습니다' }, 400)

    // 감사 로그 — 알림/상태 갱신 전에 기록(실패해도 추첨은 진행, fail-soft).
    const adminId = String(c.get('user')?.id || '')
    await DB.prepare(
      `INSERT INTO fcfs_draw_logs (product_id, admin_id, method, requested_count, pool_size, pool_snapshot, winners)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productId, adminId, method, Math.floor(Number(body.count) || winnerIds.length),
      pool.length, JSON.stringify(pool.slice(0, 5000)), JSON.stringify(winnerIds),
    ).run().catch(() => {})

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
            ? `[유어딜] ${dealName} 체험단 참여 기회가 회원님께 넘어왔어요!\n\n앞선 선정자의 미결제로 예비 순번이 승계되었습니다. 기한 내 결제하시면 참여가 확정됩니다.\n\n확정하기: https://urdeal.kr${buyPath}`
            : `[유어딜] ${dealName} 체험단에 선정되셨습니다! 🎉\n\n기한 내 결제하시면 참여가 확정됩니다. (미결제 시 예비 선정자에게 기회가 넘어갈 수 있어요)\n\n확정하기: https://urdeal.kr${buyPath}`
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
