/**
 * 🥕 **당근 모델 — 들여보내되, 승인 전엔 열지 않는다** (2026-09-16 대표 확정)
 *
 * > 대표: *"일단 반려는 되더라도 셀러 대시보드를 쓸 수는 있나보네. 우리도 반려는 되더라도 쓸 수는
 * > 있게 하고 유어애즈 인플루언서 DB는 보이지 않게 하자 반려 아닌 승인까지는. 최종 이용권 등록은
 * > 되지만 반려가 아닌 승인이 되어야 메인에 노출이 되게끔 하고."*
 *
 * 세 지시는 **서로를 떠받친다**. 문을 열어 주면서(①) 노출·DB 를 안 막으면(②③) 가입만 하면
 * 누구나 남의 가게 이름으로 메인에 뜨고 44,000행을 본다. 그래서 한 파일에서 같이 잠근다.
 *
 * ## 왜 문자열이 아니라 SQL 을 돌리나
 * ③의 실패 모드 둘 다 **조용하다**: 너무 조이면 플랫폼 상품(`seller_id IS NULL`)이 통째로
 * 사라지고(에러 없음), 너무 풀면 오늘과 똑같이 보여서 티가 안 난다. `NOT EXISTS` 상관
 * 서브쿼리가 의도대로 도는지는 소스를 읽어선 알 수 없다 ⇒ **실제 SQLite 에 넣고 행을 센다**.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - 직링크 상세·구매는 원래 대상이 아니다(대표 지시가 *"메인에 노출"*). 그 구멍은
 *     `approvedSellerProductSql` 주석에 적어 뒀고 돈은 `payout_requires_voucher_use` 가 잡는다.
 *   - 어드민이 실제로 승인을 눌러 주는지 — 운영이다.
 *   - D1 과 node:sqlite 의 차이.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { approvedSellerProductSql } from '@/shared/db/consumer-visible-product'
import { resolveAdsDbAccess } from '@/worker/utils/ads-db-access'
import { shouldHideAdsDbNav } from '@/shared/seller-approval'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  } as unknown as D1Database
}

const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const REG = 'src/features/seller/api/seller-registration.routes.ts'
// 🔁 2026-09-16 분해: 상태 조회·세션 전환 3개는 이 파일로 옮겨졌다(경로·로직 불변).
const SESSION = 'src/features/seller/api/seller-registration/session-routes.ts'

/**
 * ⚠️ 슬라이스가 **비어 있지 않은지 먼저 확인한다.** 아래 시험 둘은 `not.toContain` 으로 판정하는데,
 *    코드가 다른 파일로 옮겨가 슬라이스가 `''` 가 되면 **아무 결함이든 통과**한다.
 *    실제로 2026-09-16 파일 분해에서 그 일이 났다 — 한 시험은 빨간불을 냈고 하나는 조용히 통과했다.
 */
function switchToSellerBody(): string {
  const s = src(SESSION)
  const fn = s.slice(s.indexOf("app.post('/switch-to-seller'"))
  const body = fn.slice(0, fn.indexOf('const now = Math.floor'))
  expect(body.length, 'switch-to-seller 본문을 못 찾았다 — 앵커가 낡았다(빈 슬라이스는 어떤 판정도 통과시킨다)')
    .toBeGreaterThan(200)
  return body
}
const WAIT = 'src/pages/SellerWaitingPage.tsx'

// ── ① 대기·반려도 대시보드에 들어간다 ────────────────────────────────────────────
describe('① 반려여도 셀러 대시보드는 쓸 수 있다', () => {
  it('switch-to-seller 가 대기·반려를 막지 않는다', () => {
    const body = switchToSellerBody()
    expect(body, "대기 계정을 403 으로 돌려보내면 서류를 고칠 화면에 못 들어간다").not.toContain("'PENDING'")
    expect(body, "승인만 통과시키는 조건이 남아 있으면 반려 계정이 갇힌다")
      .not.toMatch(/status\s*!==\s*'approved'/)
  })

  it('정지(suspended)는 계속 막는다 — 반려와 같이 취급하면 징계가 무의미하다', () => {
    // ⚠️ 문자열 존재로 재면 `if (false) {` 로 바꿔도 초록이다(주입이 잡았다) — **조건문**을 본다.
    expect(switchToSellerBody()).toMatch(/if\s*\(seller\.status\s*===\s*'suspended'\)/)
  })

  it('대기 화면이 정지가 아니면 대시보드로 보낸다 — 단 토큰을 실제로 받았을 때만', () => {
    const s = src(WAIT)
    expect(s, '승인만 통과시키면 대기·반려가 이 화면에 갇힌다').toMatch(/if\s*\(s\s*!==\s*'suspended'\)/)
    expect(s, '토큰 없이 /seller 로 보내면 로그인 화면으로 튕긴다 — 대기 안내보다 나쁘다')
      .toMatch(/if\s*\(entered\)\s*\{/)
  })
})

// ── ② 유어애즈 인플루언서 DB — 승인 전엔 안 열린다 ────────────────────────────────
function adsDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT)`)
  db.exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT)`)
  db.exec(`CREATE TABLE seller_operators (seller_id INTEGER, role TEXT, revoked_at DATETIME)`)
  return db
}
const seller = (db: Db, id: number, status: string) =>
  db.prepare('INSERT INTO sellers (id, status) VALUES (?, ?)').run(id, status)
const meta = (db: Db, id: number, k: string, v: string) =>
  db.prepare('INSERT INTO seller_meta (seller_id, key, value) VALUES (?, ?, ?)').run(id, k, v)
const owner = (db: Db, id: number) =>
  db.prepare("INSERT INTO seller_operators (seller_id, role, revoked_at) VALUES (?, 'owner', NULL)").run(id)

describe('② 유어애즈 DB 는 승인된 매장에만 열린다', () => {
  it('대기 중이면 ADS_DB_NOT_APPROVED', async () => {
    const db = adsDb(); seller(db, 1, 'pending'); meta(db, 1, 'store_channel', 'direct'); owner(db, 1)
    const r = await resolveAdsDbAccess(d1(db), 1)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.code).toBe('ADS_DB_NOT_APPROVED')
  })

  it('반려도 ADS_DB_NOT_APPROVED — "반려 아닌 승인까지는" 이 대표 문장이다', async () => {
    const db = adsDb(); seller(db, 1, 'rejected'); meta(db, 1, 'store_channel', 'direct'); owner(db, 1)
    const r = await resolveAdsDbAccess(d1(db), 1)
    expect(r.allowed === false && r.code).toBe('ADS_DB_NOT_APPROVED')
  })

  it('승인 + 직접 등록이면 열린다 (정상 매장을 막으면 안 된다)', async () => {
    const db = adsDb(); seller(db, 1, 'approved'); meta(db, 1, 'store_channel', 'direct'); owner(db, 1)
    expect((await resolveAdsDbAccess(d1(db), 1)).allowed).toBe(true)
  })

  it('승인돼도 중개(대행)면 여전히 막힌다 — 2026-08-27 규칙 불변', async () => {
    const db = adsDb(); seller(db, 1, 'active'); meta(db, 1, 'store_channel', 'brokered'); owner(db, 1)
    const r = await resolveAdsDbAccess(d1(db), 1)
    expect(r.allowed === false && r.code).toBe('ADS_DB_AGENCY_BLOCKED')
  })

  it('대표 수동 allow 는 승인 전에도 이긴다 — 판정 순서가 곧 되돌릴 수 있는 손잡이다', async () => {
    const db = adsDb(); seller(db, 1, 'pending'); meta(db, 1, 'ads_db_access', 'allow')
    expect((await resolveAdsDbAccess(d1(db), 1)).allowed).toBe(true)
  })

  it('셀러 행이 아예 없으면 막는다 (여기서는 fail-closed 가 맞다)', async () => {
    const db = adsDb()
    const r = await resolveAdsDbAccess(d1(db), 99)
    expect(r.allowed === false && r.code).toBe('ADS_DB_NOT_APPROVED')
  })
})

// ── ③ 메인 노출은 승인된 매장만 ──────────────────────────────────────────────────
function feedDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER)`)
  // ⏳ 2026-09-21: `approvedSellerProductSql` 에 노출 유예(②)가 합쳐지면서 이 테이블을 읽는다.
  //   ⚠️ 이 줄을 지우면 시험이 'no such table' 로 죽는다 — 그건 **라이브에서 메인 피드가 통째로
  //   깨지는 것과 같은 고장**이다(피드 술어가 이 테이블을 참조하므로). 그래서 `repair-schema` 에도
  //   등록해 뒀다. 픽스처가 라이브를 흉내 내는 자리이니 같이 만든다.
  db.exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT)`)
  return db
}
/** 피드 WHERE 와 **같은 모양**으로 돌려 보이는 상품 id 를 돌려준다. */
const visible = (db: Db): number[] =>
  db.prepare(`SELECT id FROM products p WHERE ${approvedSellerProductSql('p')} ORDER BY id`)
    .all().map((r) => Number((r as { id: number }).id))

describe('③ 승인된 매장의 상품만 메인에 뜬다', () => {
  it('대기·반려 매장의 상품은 빠지고 승인 매장은 남는다', () => {
    const db = feedDb()
    db.exec(`INSERT INTO sellers (id, status) VALUES (1,'approved'),(2,'pending'),(3,'rejected'),(4,'active')`)
    db.exec(`INSERT INTO products (id, seller_id) VALUES (10,1),(20,2),(30,3),(40,4)`)
    expect(visible(db)).toEqual([10, 40])
  })

  it('🔴 판매자 없는 플랫폼 상품은 그대로 보인다 — 여기가 조이면 홈이 통째로 빈다', () => {
    const db = feedDb()
    db.exec(`INSERT INTO sellers (id, status) VALUES (2,'pending')`)
    db.exec(`INSERT INTO products (id, seller_id) VALUES (10,NULL),(20,2)`)
    expect(visible(db), '교환권·KT·데모는 심사할 매장이 없다').toEqual([10])
  })

  it('셀러 행이 사라진 상품은 통과시킨다 (의도적 관대 — 조인이 깨진 날 전멸 방지)', () => {
    const db = feedDb()
    db.exec(`INSERT INTO products (id, seller_id) VALUES (10,777)`)
    expect(visible(db)).toEqual([10])
  })

  it('status 가 비어 있는 매장은 가린다 — 승인 기록이 없으면 승인이 아니다', () => {
    const db = feedDb()
    db.exec(`INSERT INTO sellers (id, status) VALUES (5,NULL)`)
    db.exec(`INSERT INTO products (id, seller_id) VALUES (10,5)`)
    expect(visible(db)).toEqual([])
  })

  /**
   * 🔴 배선이 **셋 다** 있어야 한다. 하나라도 빠지면 그 경로로만 조용히 샌다:
   *   라이브 라우트만 있고 cron 이 빠지면 → 캐시가 서빙하는 동안 승인 전 매장이 보인다.
   *   둘 다 있고 홈 섹션이 빠지면 → 피드엔 없는데 "인기 이용권" 줄에는 뜬다.
   */
  it('라이브 피드·캐시 cron·홈 섹션이 모두 같은 술어를 쓴다', () => {
    for (const f of [
      'src/features/group-buy/api/group-buy-public.routes.ts',
      'src/worker/cron/group-buy-feed-cache.ts',
      'src/features/sections/api/section-rules.ts',
    ]) {
      // ⚠️ 이름만 재면 **import 줄 때문에** 술어를 지워도 초록이다(주입이 잡았다).
      //    SQL 안의 `AND ${…}` 호출을 앵커로 쓴다.
      expect(src(f), `${f} 가 승인 필터를 안 쓰면 그 경로로만 샌다`)
        .toMatch(/AND \$\{approvedSellerProductSql\(/)
    }
  })
})

// ── ④ 네비는 열리지 않을 문을 보여 주지 않는다 ───────────────────────────────────
describe('④ 승인 전엔 파트너 찾기 메뉴를 감춘다', () => {
  it('모르면 보여 준다 (fail-open) — 값이 없다고 숨기면 승인된 매장의 메뉴가 사라진다', () => {
    expect(shouldHideAdsDbNav('')).toBe(false)
    expect(shouldHideAdsDbNav(null)).toBe(false)
    expect(shouldHideAdsDbNav(undefined)).toBe(false)
  })

  it('대기·반려는 감추고 승인·활성은 보여 준다', () => {
    expect(shouldHideAdsDbNav('pending')).toBe(true)
    expect(shouldHideAdsDbNav('rejected')).toBe(true)
    expect(shouldHideAdsDbNav('approved')).toBe(false)
    expect(shouldHideAdsDbNav('active')).toBe(false)
  })

  it('사이드바와 그룹 탭이 같은 함수를 쓴다 — 한쪽만 감추면 다른 쪽으로 들어간다', () => {
    for (const f of [
      'src/components/seller-layout/useSellerNavModel.ts',
      'src/components/seller/SellerGroupTabs.tsx',
    ]) {
      // ⚠️ 같은 이유 — import 만 남아도 초록이 되지 않게 **그 경로에 대한 호출**을 본다.
      expect(src(f), `${f} 에서 그 판정이 실제로 걸리지 않는다`)
        .toMatch(/'\/seller\/influencers'[\s\S]{0,40}shouldHideAdsDbNav\(/)
    }
  })

  it('상태를 쓰는 곳은 배너 하나뿐이다 (여러 곳에서 쓰면 반드시 한 곳이 낡는다)', () => {
    const banner = src('src/components/seller/SellerApprovalBanner.tsx')
    expect(banner).toMatch(/localStorage\.setItem\(SELLER_STATUS_KEY/)
    expect(banner, '토큰의 status 는 7일 스냅샷이라 승인돼도 배너가 안 사라진다')
      .toContain("api.get('/api/seller/surface')")
  })

  it('surface 응답이 배너가 쓸 셋을 내려준다 — 등록증 URL 은 빼고', () => {
    const s = src('src/features/auth/api/seller.routes.ts')
    const fn = s.slice(s.indexOf("sellerRoutes.get('/surface'"))
    const body = fn.slice(0, fn.indexOf('sellerRoutes.post('))
    expect(body).toContain('reject_reason')
    expect(body).toMatch(/has_business_cert:\s*!!/)
    // ⚠️ 판정 범위를 **응답 객체**로 좁힌다. 파일 전체로 재면 `.first<{ … }>()` 의 타입
    //    주석에도 같은 이름이 있어 **늘 빨간불**이 된다(첫 판이 실제로 그랬다).
    const resp = body.slice(body.lastIndexOf('return c.json({'), body.indexOf('} catch'))
    expect(resp, '남의 등록증 주소를 응답에 실으면 안 된다 — 도착 여부(boolean)면 충분하다')
      .not.toMatch(/^\s*business_registration_image_url\s*:/m)
  })
})
