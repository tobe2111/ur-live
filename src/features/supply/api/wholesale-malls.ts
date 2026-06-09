/**
 * 🏬 2026-06-09 도매몰 멀티-몰(multi-mall) 테넌시 — BACKEND foundation (v1, 검토 필요).
 *
 * 한 운영자(유통스타트)가 카테고리별로 분리된 여러 도매몰(식품/패션 등)을 운영. 모델 B = 몰별 회원가입
 * (각 유통사/제조사가 몰마다 따로 등록 → sellers.id / suppliers.id 가 이미 몰-고유). 따라서 예치금/세금계산서/
 * 채팅/주문/정산은 이미 그 id 에 매달려 몰-격리 → mall_id 를 그 테이블에 추가하지 않음. 테넌시는
 * products / sellers / suppliers / wholesale_banners / wholesale_proposal_tickets + 카탈로그/가입 스코핑에만.
 *
 * 🔒 절대 불변식(INVARIANT): 기본 몰(id=1) + 단일 호스트만 있을 때 모든 동작은 오늘과 byte-identical.
 *   - 모든 몰 필터는 1 로 default. 모든 resolver 는 1 로 fallback.
 *   - 시드 row id=1 = 기존 유통스타트(slug='default', host=현 도매 호스트).
 *
 * ⚠️ 머니/인증 코드 재구성 X. additive only. SSOT helper(예치금/Toss) 미변경.
 */
import { swallow } from '@/worker/utils/swallow'

/**
 * resolver 가 필요로 하는 최소 Context 형태(구조적 타입). wholesale.routes(Bindings: Env) 와
 * supplier-auth.routes(Bindings: { DB, JWT_SECRET }) 양쪽에서 동일하게 호출 가능하도록 느슨하게 정의.
 */
interface MallResolverContext {
  env: { DB: D1Database; JWT_SECRET: string }
  req: {
    url: string
    header(name: string): string | undefined
    query(name: string): string | undefined
  }
}

export const DEFAULT_MALL_ID = 1

export interface WholesaleMall {
  id: number
  slug: string
  name: string
  host: string | null
  brand_name: string | null
  brand_color: string | null
  logo_url: string | null
  deposit_account: string | null
  commission_rate: number | null
  categories_json: string | null
  active: number
  created_at?: string | null
}

// ── 멱등 ensure + 기본몰 시드 (repair-schema 와 동일 DDL — cold isolate self-heal) ──
const _mallEnsured = new WeakSet<object>()
async function ensureMallSchema(DB: D1Database): Promise<void> {
  if (_mallEnsured.has(DB)) return
  _mallEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_malls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    name TEXT,
    host TEXT,
    brand_name TEXT,
    brand_color TEXT,
    logo_url TEXT,
    deposit_account TEXT,
    commission_rate REAL,
    categories_json TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale-malls:ensure'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_malls_host ON wholesale_malls(host) WHERE host IS NOT NULL').run().catch(swallow('wholesale-malls:idx-host'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_malls_active ON wholesale_malls(active)').run().catch(swallow('wholesale-malls:idx-active'))
  // 기본 몰(id=1) 시드 — 행이 하나도 없을 때만(기존 유통스타트 = 기본 몰). host=현 도매 호스트.
  //   ⚠️ id=1 명시 INSERT (AUTOINCREMENT 라도 빈 테이블 첫 행은 1 이지만, 명시로 안전 보장).
  //   INSERT OR IGNORE + 빈 테이블 가드 → 재실행/동시 cold-isolate 에도 중복 시드 안 함.
  const any = await DB.prepare('SELECT id FROM wholesale_malls LIMIT 1').first<{ id: number }>().catch(() => null)
  if (!any) {
    await DB.prepare(
      `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, active, created_at)
       VALUES (1, 'default', '유통스타트', 'utongstart.com', '유통스타트', '#2563EB', 1, datetime('now'))`
    ).run().catch(swallow('wholesale-malls:seed-default'))
  }
}

// ── per-isolate host → mall 캐시 (콜드부팅 후 1회만 빌드, slug→mall 도 함께) ──────
interface MallCache { byHost: Map<string, WholesaleMall>; byId: Map<number, WholesaleMall>; bySlug: Map<string, WholesaleMall>; builtAt: number }
const _mallCache = new WeakMap<object, MallCache>()
const MALL_CACHE_TTL_MS = 60_000 // 1분 — 어드민이 몰 추가/수정해도 1분 내 반영. 트래픽 대비 충분.

/** @internal exported for unit-testing only — normalise a hostname: lower, strip www./ port. */
export function normHost(host: string | null | undefined): string {
  return String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
}

async function buildMallCache(DB: D1Database): Promise<MallCache> {
  await ensureMallSchema(DB)
  const byHost = new Map<string, WholesaleMall>()
  const byId = new Map<number, WholesaleMall>()
  const bySlug = new Map<string, WholesaleMall>()
  const { results } = await DB.prepare(
    'SELECT id, slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, active, created_at FROM wholesale_malls'
  ).all<WholesaleMall>().catch(() => ({ results: [] as WholesaleMall[] }))
  for (const m of results || []) {
    byId.set(m.id, m)
    if (m.slug) bySlug.set(m.slug, m)
    if (m.active && m.host) {
      // host 컬럼은 'a.com,b.com' 다중 호스트 허용(쉼표 구분). www./포트 정규화.
      for (const h of String(m.host).split(',')) {
        const nh = normHost(h)
        if (nh) byHost.set(nh, m)
      }
    }
  }
  return { byHost, byId, bySlug, builtAt: Date.now() }
}

async function getMallCache(DB: D1Database): Promise<MallCache> {
  const cached = _mallCache.get(DB)
  if (cached && Date.now() - cached.builtAt < MALL_CACHE_TTL_MS) return cached
  const fresh = await buildMallCache(DB)
  _mallCache.set(DB, fresh)
  return fresh
}

/** per-isolate 캐시 무효화 — 어드민 몰 CRUD 직후 호출(즉시 반영). */
export function invalidateMallCache(DB: D1Database): void {
  _mallCache.delete(DB)
}

/** host → mall (없으면 기본 몰 id=1). www./포트 정규화. */
export async function loadMallByHost(DB: D1Database, host: string | null | undefined): Promise<WholesaleMall | null> {
  const cache = await getMallCache(DB)
  const nh = normHost(host)
  if (nh && cache.byHost.has(nh)) return cache.byHost.get(nh)!
  return cache.byId.get(DEFAULT_MALL_ID) ?? null
}

/** mall_id → mall (없으면 null). */
export async function loadMallById(DB: D1Database, mallId: number): Promise<WholesaleMall | null> {
  const cache = await getMallCache(DB)
  return cache.byId.get(mallId) ?? null
}

/** slug → mall (없으면 null). dev/testing ?mall=<slug> 용. */
export async function loadMallBySlug(DB: D1Database, slug: string): Promise<WholesaleMall | null> {
  const cache = await getMallCache(DB)
  return cache.bySlug.get(slug) ?? null
}

/** host → mall_id (없으면 기본 1). 가입(register) 이 "어느 몰에 가입하는가" 결정에 사용. */
export async function mallIdByHost(DB: D1Database, host: string | null | undefined): Promise<number> {
  const m = await loadMallByHost(DB, host)
  return m?.id ?? DEFAULT_MALL_ID
}

// ── seller_token / supplier_token 에서 account → mall_id 읽기 (로그인 시 우선) ──
//   계정의 mall_id 가 host 보다 우선 → 식품 유통사는 어느 호스트로 와도 식품 몰을 봄.
async function accountMallId(c: MallResolverContext): Promise<number | null> {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(auth.substring(7), c.env.JWT_SECRET, 'HS256') as { seller_id?: number; supplier_id?: number }
    const DB = c.env.DB
    if (payload.seller_id) {
      const row = await DB.prepare('SELECT mall_id FROM sellers WHERE id = ?').bind(payload.seller_id).first<{ mall_id: number | null }>().catch(() => null)
      const mid = Number(row?.mall_id)
      if (Number.isFinite(mid) && mid > 0) return mid
    } else if (payload.supplier_id) {
      const row = await DB.prepare('SELECT mall_id FROM suppliers WHERE id = ?').bind(payload.supplier_id).first<{ mall_id: number | null }>().catch(() => null)
      const mid = Number(row?.mall_id)
      if (Number.isFinite(mid) && mid > 0) return mid
    }
  } catch { /* invalid token → null (host/default fallback) */ }
  return null
}

/**
 * 요청 → mall_id resolver. 우선순위:
 *   1. 로그인된 계정의 mall_id (distributor/supplier 토큰) — 식품 유통사는 어느 호스트든 식품을 봄.
 *   2. ?mall=<slug> 쿼리 (dev/testing).
 *   3. host → mall (loadMallByHost).
 *   4. 기본 1 (fallback).
 * 🔒 INVARIANT: 기본 몰(1) + 단일 호스트만 있으면 항상 1 반환 → 동작 불변.
 */
export async function resolveMallId(c: MallResolverContext): Promise<number> {
  const { DB } = c.env
  await ensureMallSchema(DB)
  // 1) 로그인 계정 몰 우선.
  const acct = await accountMallId(c)
  if (acct != null) return acct
  // 2) ?mall=<slug> (dev/testing) — 존재하는 slug 일 때만.
  const slugQ = String(c.req.query('mall') || '').trim()
  if (slugQ) {
    const bySlug = await loadMallBySlug(DB, slugQ)
    if (bySlug) return bySlug.id
  }
  // 3) host → mall.
  let host: string | null = null
  try { host = new URL(c.req.url).hostname } catch { host = c.req.header('Host') || null }
  const m = await loadMallByHost(DB, host)
  // 4) fallback 1.
  return m?.id ?? DEFAULT_MALL_ID
}

/** register/become 가 "가입 대상 몰" 을 host 로만 결정(계정 토큰 무시 — 신규 가입이므로). */
export async function registrationMallId(c: MallResolverContext): Promise<number> {
  const { DB } = c.env
  await ensureMallSchema(DB)
  // ?mall=<slug> 우선(어드민/테스트가 특정 몰로 가입 유도) → host → 1.
  const slugQ = String(c.req.query('mall') || '').trim()
  if (slugQ) {
    const bySlug = await loadMallBySlug(DB, slugQ)
    if (bySlug) return bySlug.id
  }
  let host: string | null = null
  try { host = new URL(c.req.url).hostname } catch { host = c.req.header('Host') || null }
  return mallIdByHost(DB, host)
}

export { ensureMallSchema }
