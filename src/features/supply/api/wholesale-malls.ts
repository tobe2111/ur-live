/**
 * 🏬 2026-06-09 도매몰 멀티-몰(multi-mall) 테넌시 — BACKEND foundation (v1, 검토 필요).
 *
 * 한 운영자(유통스타트)가 카테고리별로 분리된 여러 도매몰(식품/패션 등)을 운영. 모델 B = 몰별 회원가입
 * (각 판매사/제조사가 몰마다 따로 등록 → sellers.id / suppliers.id 가 이미 몰-고유). 따라서 예치금/세금계산서/
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
  // 🏥 2026-07-03 (의료용품 도매몰): 규제 몰 게이트 — 1이면 가입 시 인허가(신고번호) 필수. (구 행/픽스처엔 부재 → optional.)
  requires_license?: number | null
  license_label?: string | null // 예: '의료기기 판매업 신고번호' (인허가 필드 라벨)
  // 🧩 2026-07-03 (대표 — "이상적 제외 레이어"): 몰별 기능 토글 JSON. { "dropship": false, ... } 형태.
  //   키 부재 = 기본 켜짐(feature ON). 특정 몰에서 기능을 빼려면 그 키를 false 로. → 코드 0, 어드민 데이터 토글.
  features_json?: string | null
  // 🏢 2026-07-04 (대표 — "푸터 사업자정보·로고도 몰마다 다름"): 몰별 회사(푸터) 정보 JSON.
  //   { company, ceo, bizRegNo, mailOrderNo, address, tel, fax, csEmail, bankName, bankNo, bankHolder }
  //   미설정 키는 기본(유통스타트 BUSINESS_INFO) 폴백 — 기본 몰 byte-불변.
  company_json?: string | null
  active: number
  created_at?: string | null
}

/**
 * 🧩 2026-07-03 몰 기능 플래그 SSOT — mall.features_json 을 파싱해 특정 기능이 그 몰에서 켜졌는지 반환.
 *   키가 없으면 기본값(def, 기본 true=ON) → 기존 몰/미설정 몰은 전부 ON(동작 불변). 몰에서 빼려면 false 로 저장.
 *   예: mallFeature(mall, 'dropship') === false 면 그 몰은 무재고 드랍십 숨김.
 */
export function mallFeature(mall: { features_json?: string | null } | null | undefined, key: string, def = true): boolean {
  if (!mall?.features_json) return def
  try {
    const f = JSON.parse(mall.features_json) as Record<string, unknown>
    const v = f?.[key]
    return typeof v === 'boolean' ? v : def
  } catch { return def }
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
    requires_license INTEGER DEFAULT 0,
    license_label TEXT,
    features_json TEXT,
    company_json TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale-malls:ensure'))
  // 🏥 2026-07-03 자가치유 ALTER — 기존 테이블에 규제 몰 컬럼 보강(신규 컬럼, 기본 0/NULL = 기존 몰 무영향).
  await DB.prepare('ALTER TABLE wholesale_malls ADD COLUMN requires_license INTEGER DEFAULT 0').run().catch(() => { /* 이미 존재 */ })
  await DB.prepare('ALTER TABLE wholesale_malls ADD COLUMN license_label TEXT').run().catch(() => { /* 이미 존재 */ })
  await DB.prepare('ALTER TABLE wholesale_malls ADD COLUMN features_json TEXT').run().catch(() => { /* 이미 존재 */ })
  await DB.prepare('ALTER TABLE wholesale_malls ADD COLUMN company_json TEXT').run().catch(() => { /* 이미 존재 */ })
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_malls_host ON wholesale_malls(host) WHERE host IS NOT NULL').run().catch(swallow('wholesale-malls:idx-host'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_malls_active ON wholesale_malls(active)').run().catch(swallow('wholesale-malls:idx-active'))
  // 기본 몰(id=1) 시드 — 행이 하나도 없을 때만(기존 유통스타트 = 기본 몰). host=현 도매 호스트.
  //   ⚠️ id=1 명시 INSERT (AUTOINCREMENT 라도 빈 테이블 첫 행은 1 이지만, 명시로 안전 보장).
  //   INSERT OR IGNORE + 빈 테이블 가드 → 재실행/동시 cold-isolate 에도 중복 시드 안 함.
  const any = await DB.prepare('SELECT id FROM wholesale_malls LIMIT 1').first<{ id: number }>().catch(() => null)
  if (!any) {
    await DB.prepare(
      `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, active, created_at)
       VALUES (1, 'default', '유통스타트', 'utongstart.com', '유통스타트', '#1f2937', 1, datetime('now'))`
    ).run().catch(swallow('wholesale-malls:seed-default'))
  }
  // 🏥 2026-07-03 (대표 — 의료용품 도매몰 신설): 메디스타트(id=2, slug='medi') 시드 — slug 기준 멱등(중복 X).
  //   host 는 도메인 연결 전이라 비움 → ?mall=medi 로 미리보기/가입 접근. 어드민에서 도메인 PATCH 시 라이브.
  //   requires_license=1 + categories_json(의료기기/위생/간병/건강) → 규제 몰 게이트 + 카테고리 세트.
  const medi = await DB.prepare("SELECT id FROM wholesale_malls WHERE slug = 'medi' LIMIT 1").first<{ id: number }>().catch(() => null)
  if (!medi) {
    await DB.prepare(
      `INSERT OR IGNORE INTO wholesale_malls (id, slug, name, host, brand_name, brand_color, categories_json, requires_license, license_label, active, created_at)
       VALUES (2, 'medi', '메디스타트', NULL, '메디스타트', '#0ea5e9',
         '[{"id":"medical_device","label":"의료기기"},{"id":"hygiene","label":"위생용품"},{"id":"care","label":"간병용품"},{"id":"health","label":"건강용품"}]',
         1, '의료기기 판매업 신고번호', 1, datetime('now'))`
    ).run().catch(swallow('wholesale-malls:seed-medi'))
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
    'SELECT id, slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, requires_license, license_label, features_json, company_json, active, created_at FROM wholesale_malls'
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

/**
 * 요청 → mall_id resolver. 우선순위 (2026-06-18 대표 확정 "몰 = 도메인 = 계정"):
 *   1. ?mall=<slug> 쿼리 (dev/testing override).
 *   2. host → mall (loadMallByHost) — 도메인이 몰을 결정. 게스트/로그인 동일 → flip-flop 불가.
 *   3. 기본 1 (fallback — host 가 어떤 몰에도 매핑 안 됨).
 * 🔒 INVARIANT: 기본 몰(1) + 단일 호스트만 있으면 항상 1 반환 → 동작 불변.
 *
 * 변경 이력: 2026-06-09 최초엔 "계정 우선"(로그인 판매사는 어느 호스트든 자기 몰 = 모델 B). 2026-06-18
 *   대표가 "판매사/제조사는 몰별 별도 로그인 = 몰=도메인" 으로 확정 → host 우선으로 전환. 이전 account-first
 *   는 [계정 몰 ≠ 보는 도메인 몰] 일 때 로그인 상태에 따라 카탈로그가 들쭉날쭉(flip-flop)하던 근본 원인.
 *   host-first 는 게스트/로그인 카탈로그를 일관되게 만들고, 단일 몰 환경에선 byte-identical(모두 1).
 *   ⚠️ 계정 머니 작업(예치금/주문/정산)은 seller_id/supplier_id 에 직접 매달려 몰-격리되므로 무영향.
 *   (account → mall_id 읽기 함수는 이 전환으로 호출처가 없어져 제거. 다시 필요하면 git history 참조.)
 */
export async function resolveMallId(c: MallResolverContext): Promise<number> {
  const { DB } = c.env
  await ensureMallSchema(DB)
  // 1) ?mall=<slug> (dev/testing) — 존재하는 slug 일 때만.
  const slugQ = String(c.req.query('mall') || '').trim()
  if (slugQ) {
    const bySlug = await loadMallBySlug(DB, slugQ)
    if (bySlug) return bySlug.id
  }
  // 2) host → mall (도메인이 몰을 결정). 매핑 안 된 호스트 → loadMallByHost 가 기본 1 반환.
  let host: string | null = null
  try { host = new URL(c.req.url).hostname } catch { host = c.req.header('Host') || null }
  const m = await loadMallByHost(DB, host)
  // 3) fallback 1.
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
