/**
 * 🏬 2026-06-09 도매몰 멀티-몰 테넌시 — 어드민 몰 관리 CRUD (v1, 검토 필요).
 *
 * 슈퍼-어드민이 카테고리별 도매몰(식품/패션 등)을 생성/수정/비활성. 한 운영자, 몰별 회원가입(모델 B).
 *   - GET    /api/admin/wholesale-malls       — 전체 몰 목록
 *   - POST   /api/admin/wholesale-malls       — 몰 생성
 *   - PATCH  /api/admin/wholesale-malls/:id    — 몰 수정
 *
 * ⚠️ adminApp(IP whitelist + requireAdmin + audit) 체인. 기본 몰(id=1)은 비활성/삭제 금지(가드).
 *    캐시 무효화: 변경 후 invalidateMallCache 로 즉시 반영.
 * 마운트: app.route('/api/admin/wholesale-malls', adminWholesaleMallRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { ensureMallSchema, invalidateMallCache, DEFAULT_MALL_ID } from './wholesale-malls'
import { normalizeAdminRole } from '@/shared/admin-roles'
import { RESERVED_SLUGS, validateMallSlug, auditMallSlugs } from '@/shared/mall/slug'
import { validateMallColor } from '@/shared/mall/branding'

const app = new Hono<{ Bindings: Env }>()
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

// 🔒 2026-06-29 (대표 — "도매몰 관리는 슈퍼어드민만"): 몰 생성/수정(관리)은 슈퍼 전용.
//   GET(몰 목록)은 여러 도매 어드민 화면의 몰 선택기(AdminMallSelect)가 읽으므로 유지 — 관리(쓰기)만 잠금.
//   requireAdmin 이 c.set('user',{role}) 로 넣은 역할을 정규화해 super 만 통과.
function requireSuperAdmin() {
  return async (c: import('hono').Context, next: import('hono').Next) => {
    const role = normalizeAdminRole((c.get('user') as { role?: string } | undefined)?.role)
    if (role !== 'super') {
      return c.json({ success: false, error: '도매몰 관리는 슈퍼관리자만 가능합니다', code: 'SUPER_ONLY' }, 403)
    }
    return next()
  }
}

// slug: 소문자/숫자/하이픈만 (host 라우팅·URL 안전). 길이 cap. 미충족 시 null.
function cleanSlug(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().slice(0, 40)
  if (!s || !/^[a-z0-9-]+$/.test(s)) return null
  return s
}

/**
 * 🔴 세션 ③-a 〔대표 경계조건 ② — "가드는 양방향이어야 합니다"〕
 *
 * 슬러그는 `urdeal.kr/{슬러그}` 자리에 앉는다 ⇒ **예약어와 겹치면 그 라우트가 죽는다.**
 * CI 는 `라우트 ⊆ 예약어`(mall-branding.test)를 보지만 **라이브 DB 는 못 읽는다**.
 * 여기가 그 반쪽 — **쓰기 시점 차단**이다.
 *
 * ⚠️ 왜 `cleanSlug` 로 안 끝나는가: `cleanSlug` 는 문자 집합만 본다(1~40자, 예약어 무검사).
 *   그래서 지금까지 `admin`·`products` 같은 슬러그를 **만들 수 있었다.**
 * ⚠️ 3~30자 하한/상한은 취향이 아니라 **리졸버와의 정합**이다 — `firstPathSegment` 가
 *   `/^[a-z0-9-]{3,30}$/` 로 후보를 거르므로, 그 밖의 슬러그는 **경로로 영영 도달할 수 없다**.
 *   만들 수는 있는데 열리지는 않는 몰을 허용하지 않는다.
 */
function rejectReservedSlug(s: string): string | null {
  const v = validateMallSlug(s)
  return v.ok ? null : v.reason
}
// host: 다중 호스트 'a.com,b.com' 허용. 소문자·공백제거. 길이 cap. 빈 값 → null.
function cleanHost(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase().slice(0, 300)
  return s || null
}
function cleanText(raw: unknown, max: number): string | null {
  const s = String(raw ?? '').trim().slice(0, max)
  return s || null
}

/**
 * 🧩 2026-07-03 몰 기능 토글 JSON 정규화 — 평평한 { key: boolean } 객체만 허용(주입/오염 방지).
 *   문자열/객체 입력 모두 수용 → 파싱 후 boolean 값만 추려 재직렬화. 빈/무효 → null(미설정=전 기능 ON).
 *   키는 영숫자/언더스코어 40자 이내로 제한. 최대 40개 키.
 */
function validFeaturesJson(raw: unknown): string | null {
  let obj: unknown = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch { return null } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const out: Record<string, boolean> = {}
  let n = 0
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (n >= 40) break
    if (typeof v !== 'boolean') continue
    const key = String(k).trim().slice(0, 40)
    if (!/^[a-zA-Z0-9_]+$/.test(key)) continue
    out[key] = v; n++
  }
  return Object.keys(out).length ? JSON.stringify(out) : null
}

/**
 * 🏢 2026-07-04 몰 회사(푸터) 정보 JSON 정규화 — 평평한 { key: string } 만 허용.
 *   허용 키 화이트리스트(푸터 표시 항목) + 값 300자 cap. 빈/무효 → null(미설정=기본 BUSINESS_INFO 폴백).
 */
const COMPANY_KEYS = ['company', 'ceo', 'bizRegNo', 'mailOrderNo', 'address', 'tel', 'fax', 'csEmail', 'bankName', 'bankNo', 'bankHolder'] as const
function validCompanyJson(raw: unknown): string | null {
  let obj: unknown = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch { return null } }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const out: Record<string, string> = {}
  for (const k of COMPANY_KEYS) {
    const v = (obj as Record<string, unknown>)[k]
    if (typeof v !== 'string') continue
    const s = v.trim().slice(0, 300)
    if (s) out[k] = s
  }
  return Object.keys(out).length ? JSON.stringify(out) : null
}

// ── GET / — 전체 몰 목록 ──────────────────────────────────────────────────────
app.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, requires_license, license_label, features_json, company_json, COALESCE(consumer_path,0) AS consumer_path, active, created_at
       FROM wholesale_malls ORDER BY id ASC LIMIT 200`
    ).all()
    return c.json({ success: true, malls: results ?? [] })
  } catch (err) {
    return safeError(c, err, '몰 목록 조회 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

/**
 * ── GET /slug-conflicts — 🔴 **양방향 가드의 런타임 절반** 〔대표 경계조건 ②〕 ──────────────
 *
 * CI 는 `라우트 ⊆ 예약어` 만 본다. 반대 방향 — **이미 존재하는 몰 슬러그가 라우트를 먹고 있는가** —
 * 는 **라이브 DB 를 읽어야** 알 수 있고 CI 는 그걸 못 한다. 여기가 그 절반이다.
 *
 * ⚠️ **쓰기 차단(위 `rejectReservedSlug`)만으로는 부족한 이유**: 그 가드는 **오늘 이후** 생성분에만 걸린다.
 *   가드 이전에 만들어진 행은 그대로 남아 있고, **조회하지 않으면 영영 모른다.**
 *   (이 레포가 오늘 하루에만 두 번 만난 클래스 — "실패가 아니라 조용한 부재".)
 *
 * 응답 `ok:false` 면 그 슬러그가 앉은 자리의 페이지가 **몰에 가려져 있다**는 뜻이다.
 */
app.get('/slug-conflicts', async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)
    const { results } = await DB.prepare(
      `SELECT id, slug, name, COALESCE(active,1) AS active FROM wholesale_malls WHERE slug IS NOT NULL LIMIT 500`
    ).all<{ id: number; slug: string; name: string; active: number }>()
    // 판정은 순수함수(`auditMallSlugs`)가 한다 — 라우트는 조회·전달만.
    //   그래야 이 불변식이 **테스트로 고정**된다(라우트 안에 있으면 D1 없이는 못 돈다).
    const audit = auditMallSlugs(results ?? [])
    return c.json({ success: true, ...audit, reserved_count: RESERVED_SLUGS.length })
  } catch (err) {
    return safeError(c, err, '몰 슬러그 점검 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

// ── POST / — 몰 생성 ──────────────────────────────────────────────────────────
app.post('/', requireSuperAdmin(), rateLimit({ action: 'admin-wholesale-mall-create', max: 20, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const slug = cleanSlug(body.slug)
    if (!slug) return c.json({ success: false, error: 'slug 는 영소문자/숫자/하이픈만 사용할 수 있습니다' }, 400)
    const reserved = rejectReservedSlug(slug)
    if (reserved) return c.json({ success: false, error: reserved, code: 'SLUG_RESERVED' }, 400)
    const name = cleanText(body.name, 80)
    if (!name) return c.json({ success: false, error: '몰 이름을 입력해주세요' }, 400)
    const host = cleanHost(body.host)
    const brand_name = cleanText(body.brand_name, 80)
    const brand_color = cleanText(body.brand_color, 20)
    // 🎨 대비 게이트 — 이 색은 **면**이고 그 위에 흰 글자가 올라간다(몰 홈 아바타·안전결제 띠,
    //   어드민 목록 썸네일). 옅은 색을 고르면 글자가 그대로 안 보인다. `branding.ts` 가
    //   *"대비는 취향이 아니라 규격"* 이라고 선언해 놓고 검사가 없던 자리다(2026-08-02).
    if (brand_color) { const v = validateMallColor(brand_color); if (!v.ok) return c.json({ success: false, error: v.reason }, 400) }
    const logo_url = cleanText(body.logo_url, 1000)
    const deposit_account = cleanText(body.deposit_account, 500)
    const commission_rate = Number.isFinite(Number(body.commission_rate)) ? Number(body.commission_rate) : null
    const categories_json = cleanText(body.categories_json, 4000)
    // 🏥 2026-07-03 규제 몰 게이트 — 가입 시 인허가(신고번호) 필수 여부 + 필드 라벨.
    const requires_license = Number(body.requires_license) === 1 ? 1 : 0
    const license_label = cleanText(body.license_label, 80)
    // 🧩 2026-07-03 몰 기능 토글 JSON (제외 레이어). 최대 2000자. 파싱 검증(잘못된 JSON 은 저장 안 함).
    const features_json = validFeaturesJson(body.features_json)
    // 🏢 2026-07-04 몰 회사(푸터) 정보 JSON.
    const company_json = validCompanyJson(body.company_json)
    const active = Number(body.active) === 0 ? 0 : 1
    // 🏬 세션 ③-a: `urdeal.kr/{슬러그}` 경로로 열 몰인가. **기본 0(fail-closed)** — 명시할 때만 열린다.
    const consumer_path = Number(body.consumer_path) === 1 ? 1 : 0

    // slug 중복 차단 (UNIQUE 와 정합 — 친절한 메시지).
    const dupe = await DB.prepare('SELECT id FROM wholesale_malls WHERE slug = ?').bind(slug).first<{ id: number }>().catch(() => null)
    if (dupe) return c.json({ success: false, error: '이미 사용 중인 slug 입니다' }, 409)

    const ins = await DB.prepare(
      `INSERT INTO wholesale_malls (slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, requires_license, license_label, features_json, company_json, consumer_path, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(slug, name, host, brand_name, brand_color, logo_url, deposit_account, commission_rate, categories_json, requires_license, license_label, features_json, company_json, consumer_path, active).run()
    const id = Number(ins.meta?.last_row_id)
    if (!id) return c.json({ success: false, error: '몰 생성 중 오류가 발생했습니다' }, 500)
    invalidateMallCache(DB)
    return c.json({ success: true, id })
  } catch (err) {
    return safeError(c, err, '몰 생성 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

// ── PATCH /:id — 몰 수정 ──────────────────────────────────────────────────────
app.patch('/:id', requireSuperAdmin(), rateLimit({ action: 'admin-wholesale-mall-update', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 몰 ID' }, 400)
  try {
    await ensureMallSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const sets: string[] = []
    const binds: (string | number | null)[] = []
    if ('slug' in body) {
      const s = cleanSlug(body.slug)
      if (!s) return c.json({ success: false, error: 'slug 는 영소문자/숫자/하이픈만 사용할 수 있습니다' }, 400)
      const reserved = rejectReservedSlug(s)
      if (reserved) return c.json({ success: false, error: reserved, code: 'SLUG_RESERVED' }, 400)
      // slug 중복(다른 몰) 차단.
      const dupe = await DB.prepare('SELECT id FROM wholesale_malls WHERE slug = ? AND id <> ?').bind(s, id).first<{ id: number }>().catch(() => null)
      if (dupe) return c.json({ success: false, error: '이미 사용 중인 slug 입니다' }, 409)
      sets.push('slug = ?'); binds.push(s)
    }
    if ('name' in body) { const v = cleanText(body.name, 80); if (!v) return c.json({ success: false, error: '몰 이름을 입력해주세요' }, 400); sets.push('name = ?'); binds.push(v) }
    if ('host' in body) { sets.push('host = ?'); binds.push(cleanHost(body.host)) }
    if ('brand_name' in body) { sets.push('brand_name = ?'); binds.push(cleanText(body.brand_name, 80)) }
    if ('brand_color' in body) {
      const v0 = cleanText(body.brand_color, 20)
      // 🎨 생성과 **같은 게이트** — 한쪽만 막으면 수정으로 우회된다.
      if (v0) { const v = validateMallColor(v0); if (!v.ok) return c.json({ success: false, error: v.reason }, 400) }
      sets.push('brand_color = ?'); binds.push(v0)
    }
    if ('logo_url' in body) { sets.push('logo_url = ?'); binds.push(cleanText(body.logo_url, 1000)) }
    if ('deposit_account' in body) { sets.push('deposit_account = ?'); binds.push(cleanText(body.deposit_account, 500)) }
    if ('commission_rate' in body) { sets.push('commission_rate = ?'); binds.push(Number.isFinite(Number(body.commission_rate)) ? Number(body.commission_rate) : null) }
    if ('categories_json' in body) { sets.push('categories_json = ?'); binds.push(cleanText(body.categories_json, 4000)) }
    if ('requires_license' in body) { sets.push('requires_license = ?'); binds.push(Number(body.requires_license) === 1 ? 1 : 0) }
    if ('license_label' in body) { sets.push('license_label = ?'); binds.push(cleanText(body.license_label, 80)) }
    if ('features_json' in body) { sets.push('features_json = ?'); binds.push(validFeaturesJson(body.features_json)) }
    if ('company_json' in body) { sets.push('company_json = ?'); binds.push(validCompanyJson(body.company_json)) }
    if ('consumer_path' in body) { sets.push('consumer_path = ?'); binds.push(Number(body.consumer_path) === 1 ? 1 : 0) }
    if ('active' in body) {
      const act = Number(body.active) === 0 ? 0 : 1
      // 🔒 INVARIANT 가드: 기본 몰(id=1)은 비활성 금지(전 데이터의 기본 몰 — 비활성 시 카탈로그/배너 전멸).
      if (id === DEFAULT_MALL_ID && act === 0) return c.json({ success: false, error: '기본 몰은 비활성화할 수 없습니다' }, 400)
      sets.push('active = ?'); binds.push(act)
    }
    if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
    binds.push(id)
    const up = await DB.prepare(`UPDATE wholesale_malls SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '몰을 찾을 수 없습니다' }, 404)
    invalidateMallCache(DB)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '몰 수정 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

/**
 * 🏪 **이 몰에 속한 매장** 〔2026-08-03 — 파일럿 개설의 빠진 조각〕
 *
 * 몰을 만들어도 **매장을 붙일 방법이 없었다.** 상품의 몰 귀속은 서버가 `sellers.mall_id` 를 읽어
 * 찍는데(`sellerMallIdOf`), 그 값은 **가입 시 호스트로만** 정해지고 기본이 1(본진)이다.
 * ⇒ 몰을 만들고 공구를 등록하면 **새 몰이 아니라 본진에 붙어** `urdeal.kr/{슬러그}` 는 계속 빈 화면.
 *   `UPDATE sellers SET mall_id` 를 하는 코드가 레포 전체에 **하나도 없었다**(실측).
 *
 * 🔴 **머니 경로 무접촉** — 정산율·예치금·원장 전부 안 건드린다. `sellers.mall_id` 한 컬럼만 옮긴다.
 *   그 컬럼이 정하는 것은 *이 매장의 상품이 어느 몰 홈에 보이는가* 뿐이다.
 * ⚠️ 옮기면 **그 매장의 기존 상품도 함께 옮겨간다** — 몰 상품 목록은 `products.mall_id` 로 거르는데
 *   상품에 찍힌 값은 등록 시점의 것이다. 그래서 상품도 같이 옮긴다(아래 `moveProducts`, 기본 켬).
 *   안 그러면 "매장은 옮겼는데 상품은 본진에 남는" 절반 상태가 된다.
 */
app.get('/:id/sellers', requireSuperAdmin(), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 몰 ID' }, 400)
  try {
    await ensureMallSchema(DB)
    const rows = await DB.prepare(
      `SELECT id, username, business_name, status, is_active,
              (SELECT COUNT(*) FROM products p WHERE p.seller_id = s.id AND COALESCE(p.mall_id,1) = ?) AS products
         FROM sellers s
        WHERE COALESCE(s.mall_id, 1) = ?
        ORDER BY s.id DESC LIMIT 200`
    ).bind(id, id).all().catch(() => ({ results: [] as unknown[] }))
    return c.json({ success: true, data: rows.results ?? [] })
  } catch (err) {
    return safeError(c, err, '몰 매장 조회 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

/** 매장을 이 몰로 옮긴다. `seller` = 숫자 id 또는 username(로그인 아이디). */
app.post('/:id/sellers', requireSuperAdmin(), rateLimit({ action: 'admin-mall-seller-attach', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 몰 ID' }, 400)
  try {
    await ensureMallSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const raw = String(body.seller ?? '').trim()
    if (!raw) return c.json({ success: false, error: '매장 id 또는 로그인 아이디를 입력해주세요' }, 400)
    // 🔴 몰이 **실재하고 열려 있어야** 한다 — 없는 몰/비활성 몰로 옮기면 그 매장 상품이 어디에도 안 뜬다.
    const mall = await DB.prepare('SELECT id, name, COALESCE(active,1) AS active FROM wholesale_malls WHERE id = ?')
      .bind(id).first<{ id: number; name: string; active: number }>().catch(() => null)
    if (!mall) return c.json({ success: false, error: '몰을 찾을 수 없습니다' }, 404)
    if (Number(mall.active) !== 1) return c.json({ success: false, error: '비활성 몰로는 옮길 수 없습니다', code: 'MALL_INACTIVE' }, 400)

    const asId = /^\d+$/.test(raw) ? Number(raw) : null
    const seller = asId
      ? await DB.prepare('SELECT id, username, business_name, COALESCE(mall_id,1) AS mall_id FROM sellers WHERE id = ?').bind(asId).first<{ id: number; username: string; business_name: string | null; mall_id: number }>().catch(() => null)
      : await DB.prepare('SELECT id, username, business_name, COALESCE(mall_id,1) AS mall_id FROM sellers WHERE LOWER(username) = LOWER(?)').bind(raw).first<{ id: number; username: string; business_name: string | null; mall_id: number }>().catch(() => null)
    if (!seller) return c.json({ success: false, error: '그런 매장이 없습니다(로그인 아이디 또는 id 확인)', code: 'SELLER_NOT_FOUND' }, 404)

    const from = Number(seller.mall_id) || DEFAULT_MALL_ID
    const up = await DB.prepare('UPDATE sellers SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id, seller.id).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '매장을 옮기지 못했습니다' }, 500)

    // 기존 상품도 같이 옮긴다(기본). `moveProducts:false` 로 끄면 매장만 옮긴다.
    let moved = 0
    if (body.moveProducts !== false) {
      const mv = await DB.prepare(
        'UPDATE products SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE seller_id = ? AND COALESCE(mall_id,1) = ?'
      ).bind(id, seller.id, from).run().catch(() => null)
      moved = mv?.meta?.changes ?? 0
    }
    invalidateMallCache(DB)
    return c.json({ success: true, data: { seller_id: seller.id, username: seller.username, from_mall_id: from, to_mall_id: id, products_moved: moved } })
  } catch (err) {
    return safeError(c, err, '매장 연결 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

/** 연결 해제 = 본진(1)으로 되돌린다. 삭제가 아니라 **이동**이라 되돌릴 수 있다. */
app.delete('/:id/sellers/:sellerId', requireSuperAdmin(), rateLimit({ action: 'admin-mall-seller-detach', max: 60, windowSec: 60 }), async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  const sellerId = Number(c.req.param('sellerId'))
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 요청' }, 400)
  }
  if (id === DEFAULT_MALL_ID) return c.json({ success: false, error: '본진에서는 해제할 것이 없습니다' }, 400)
  try {
    await ensureMallSchema(DB)
    const up = await DB.prepare('UPDATE sellers SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND COALESCE(mall_id,1) = ?')
      .bind(DEFAULT_MALL_ID, sellerId, id).run()
    if ((up.meta?.changes ?? 0) === 0) return c.json({ success: false, error: '이 몰에 속한 매장이 아닙니다' }, 404)
    const mv = await DB.prepare('UPDATE products SET mall_id = ?, updated_at = CURRENT_TIMESTAMP WHERE seller_id = ? AND COALESCE(mall_id,1) = ?')
      .bind(DEFAULT_MALL_ID, sellerId, id).run().catch(() => null)
    invalidateMallCache(DB)
    return c.json({ success: true, data: { products_moved: mv?.meta?.changes ?? 0 } })
  } catch (err) {
    return safeError(c, err, '매장 연결 해제 중 오류가 발생했습니다', '[admin-wholesale-malls]')
  }
})

export { app as adminWholesaleMallRoutes }
