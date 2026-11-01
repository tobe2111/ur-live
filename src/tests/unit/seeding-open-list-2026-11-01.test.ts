/**
 * 🎁 체험 목록(`/influencer/seeding`) — 모집 깔때기의 착지 (2026-11-01)
 *
 * ## 무엇을 지키나
 * 2026-10-31 에 신청·승인·신청권을 다 만들고도 **신청할 수 있는 것의 목록이 없었다** — 상세 주소를
 * 이미 아는 사람만 신청할 수 있었다. 이 목록이 그 구멍이고, 목록은 **무엇을 내보내는가**가 전부라
 * 문자열 검사가 아니라 **실제 SQLite** 에 넣고 "보이는 product_id" 를 센다.
 *
 * 🔴 **양방향으로 잰다** — 걸러지는 쪽만 보면 "전부 거른다"(= 목록이 늘 빈다)도 통과한다.
 *
 * ⚠️ 못 보는 것: 화면 렌더(사진·줄 모양) · 엣지 캐시 적중 · 실제 신청 성공(그건 상세·신청 시트의 몫).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readCode } from '../helpers/source-text'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    exec: (sql: string) => void
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
  }
}
import { SEEDING_TABLES_SQL, listOpenOffers, monthKeyKst, saveOffer } from '@/features/seeding/api/seeding-db'
import { DEFAULT_OFFER } from '@/shared/seeding'
import { isKnownAppPath } from '@/shared/seo/known-routes'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'

type Raw = InstanceType<typeof DatabaseSync>
let DB: D1Database, raw: Raw

function makeD1(): { DB: D1Database; raw: Raw } {
  const r = new DatabaseSync(':memory:')
  const stmt = (sql: string) => {
    let args: unknown[] = []
    const api = {
      sql,
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const x = r.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(x.changes) } } },
      first: async () => { const x = r.prepare(sql).get(...(args as never[])); return x === undefined ? null : x },
      all: async () => ({ results: r.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const db = { prepare: stmt } as unknown as D1Database
  r.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`)
  // 실제 술어(consumerVisibleProductSql · approvedSellerProductSql)가 읽는 컬럼만.
  r.exec(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, price INTEGER, original_price INTEGER, image_url TEXT,
    category TEXT, deal_only INTEGER, is_active INTEGER, seller_id INTEGER, sold_count INTEGER,
    restaurant_name TEXT, restaurant_address TEXT, is_supply_product INTEGER, supply_source_id INTEGER)`)
  r.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT)`)
  r.exec(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT)`)
  for (const s of SEEDING_TABLES_SQL) r.exec(s)
  return { DB: db, raw: r }
}

/** 기본은 **보이는** 상품 — 각 시험이 한 가지만 비틀어 그 한 가지가 원인임을 분리한다. */
function product(id: number, over: Record<string, unknown> = {}) {
  const row = {
    name: `상품${id}`, price: 20000, original_price: 30000, image_url: 'https://x/y.jpg',
    category: 'meal_voucher', deal_only: 0, is_active: 1, seller_id: 5, sold_count: 0,
    restaurant_name: '가게', restaurant_address: '서울 강남구', is_supply_product: 0, supply_source_id: null,
    ...over,
  }
  raw.prepare(
    `INSERT INTO products (id, name, price, original_price, image_url, category, deal_only, is_active, seller_id,
      sold_count, restaurant_name, restaurant_address, is_supply_product, supply_source_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(...([id, row.name, row.price, row.original_price, row.image_url, row.category, row.deal_only,
    row.is_active, row.seller_id, row.sold_count, row.restaurant_name, row.restaurant_address,
    row.is_supply_product, row.supply_source_id] as never[]))
}

const offerOn = (productId: number, over: Partial<typeof DEFAULT_OFFER> = {}, sellerId: number | null = 5) =>
  saveOffer(DB, productId, sellerId, { ...DEFAULT_OFFER, ...over, enabled: true })

const app = (productId: number, status: string, monthKey = monthKeyKst(), user = 7) => raw.prepare(
  `INSERT INTO seeding_applications (product_id, seller_id, user_id, platform, status, month_key)
   VALUES (?, 5, ?, 'instagram', ?, ?)`,
).run(...([productId, user, status, monthKey] as never[]))

const ids = async () => (await listOpenOffers(DB)).map((o) => o.product_id)

beforeEach(() => {
  ({ DB, raw } = makeD1())
  raw.prepare(`INSERT INTO sellers (id, status) VALUES (5, 'approved')`).run()
})

describe('🎁 목록이 무엇을 내보내나 — 양방향', () => {
  it('제공을 켠 상품은 보인다(양의 방향 — 이게 없으면 아래 전부가 헛돈다)', async () => {
    product(1); await offerOn(1)
    expect(await ids()).toEqual([1])
  })

  it('제공을 끄면 빠진다', async () => {
    product(1); await saveOffer(DB, 1, 5, { ...DEFAULT_OFFER, enabled: false })
    expect(await ids()).toEqual([])
  })

  it('제공 설정이 아예 없으면 빠진다', async () => {
    product(1)
    expect(await ids()).toEqual([])
  })

  it('비활성 상품은 빠진다', async () => {
    product(1, { is_active: 0 }); await offerOn(1)
    expect(await ids()).toEqual([])
  })

  it('도매 **원본**은 빠지고 판매사 재판매 복제본은 보인다', async () => {
    product(1, { is_supply_product: 1, supply_source_id: null })
    product(2, { is_supply_product: 1, supply_source_id: 99 })
    await offerOn(1); await offerOn(2)
    expect(await ids()).toEqual([2])
  })

  it('승인 안 된 매장의 상품은 빠진다 — 그리고 매장이 없는 상품(플랫폼)은 보인다', async () => {
    raw.prepare(`INSERT INTO sellers (id, status) VALUES (6, 'pending')`).run()
    product(1, { seller_id: 6 }); await offerOn(1, {}, 6)
    product(2, { seller_id: null }); await offerOn(2, {}, null)
    expect(await ids()).toEqual([2])
  })

  it('노출 유예 중인 매장은 빠진다', async () => {
    raw.prepare(`INSERT INTO seller_meta (seller_id, key, value) VALUES (5, 'store_exposure_from', '2999-01-01 00:00:00')`).run()
    product(1); await offerOn(1)
    expect(await ids()).toEqual([])
  })
})

describe('🎟️ 자리 수 — 이번 달 모집 인원', () => {
  it('자리가 다 차면 빠지고, 한 자리 남으면 그 수가 실린다', async () => {
    product(1); await offerOn(1, { slots_per_month: 2 })
    app(1, 'pending')
    const one = await listOpenOffers(DB)
    expect(one.map((o) => [o.product_id, o.slots_left])).toEqual([[1, 1]])
    app(1, 'approved')
    expect(await ids()).toEqual([])
  })

  it('거절·취소는 자리를 돌려준다', async () => {
    product(1); await offerOn(1, { slots_per_month: 1 })
    app(1, 'rejected'); app(1, 'cancelled', monthKeyKst(), 8)
    expect(await ids()).toEqual([1])
  })

  it('지난 달 신청은 이번 달 자리를 먹지 않는다', async () => {
    product(1); await offerOn(1, { slots_per_month: 1 })
    app(1, 'pending', '2001-01')
    expect(await ids()).toEqual([1])
  })
})

describe('📦 응답 모양', () => {
  it('화면이 쓰는 값이 다 실리고, 조건(팔로워·플랫폼)도 함께 온다', async () => {
    product(1, { category: 'beauty_voucher', deal_only: 0 })
    await offerOn(1, { platforms: ['instagram', 'youtube'], min_followers: 3000, slots_per_month: 4 })
    const [o] = await listOpenOffers(DB)
    expect(o).toMatchObject({
      product_id: 1, name: '상품1', price: 20000, original_price: 30000,
      category: 'beauty_voucher', deal_only: 0, restaurant_name: '가게', restaurant_address: '서울 강남구',
      platforms: ['instagram', 'youtube'], min_followers: 3000, slots_left: 4,
    })
  })

  it('🔗 상세 주소를 서버가 지어내지 않는다 — 화면이 `detailHref` SSOT 로 만든다', async () => {
    product(1); await offerOn(1)
    const [o] = await listOpenOffers(DB)
    // 주소를 응답에 담기 시작하면 규칙이 두 벌이 되어 같은 상품이 두 URL 로 갈린다.
    // ⚠️ `image_url`(사진)은 주소가 아니라 자원이라 허용 — 금지하는 것은 **상세로 가는 링크**다.
    for (const k of Object.keys(o)) {
      expect(k, `${k} 는 상세 링크처럼 읽힌다`).not.toMatch(/href|path|link|detail/i)
      if (k.endsWith('_url')) expect(k).toBe('image_url')
    }
    expect(readCode('src/pages/InfluencerSeedingPage.tsx')).toContain('detailHref({ id: o.product_id')
  })

  it('limit 은 범위 안으로 접는다(거절하지 않는다)', async () => {
    for (let i = 1; i <= 3; i++) { product(i); await offerOn(i) }
    expect((await listOpenOffers(DB, 0 as unknown as number)).length).toBe(3)
    expect((await listOpenOffers(DB, NaN as unknown as number)).length).toBe(3)
    expect((await listOpenOffers(DB, 1)).length).toBe(1)
  })
})

describe('🧭 배선', () => {
  it('🚨 `/influencer/seeding` 이 알려진 경로다 — 아니면 워커가 404 로 준다', () => {
    // 1세그먼트가 아니라 `influencer` 아래에 둔 이유가 이것이다(몰 슬러그·known-leaf 무접촉).
    expect(isKnownAppPath('/influencer/seeding')).toBe(true)
    expect(isKnownAppPath('/influencer/존재하지않는것')).toBe(true) // 부모 판정 — 깊은 경로는 자르지 않는다
    expect(isKnownAppPath('/seeding')).toBe(false) // 1세그먼트로 옮기려면 known-leaf 를 함께 고쳐야 한다
  })

  it('라우트가 App.tsx 에 있고 로그인을 요구하지 않는다(모집 메일의 착지)', () => {
    const src = readCode('src/App.tsx')
    const m = src.match(/<Route path="\/influencer\/seeding"[^/]*?\/>/)
    expect(m, '라우트가 없다').toBeTruthy()
    expect(m![0]).not.toContain('ProtectedRoute')
    expect(m![0]).toContain('InfluencerSeedingPage')
  })

  it('목록 API 는 공개이고 테이블을 먼저 보장한다', () => {
    const src = readCode('src/features/seeding/api/seeding.routes.ts')
    const open = src.slice(src.indexOf("seedingRoutes.get('/open'"))
    expect(open.slice(0, 400)).not.toContain('requireAuth')
    expect(open.slice(0, 400)).toContain('ensureSeedingTables')
  })

  it('🔒 자격 판정은 상세 한 곳에만 — 목록 화면이 다시 판정하지 않는다', () => {
    const page = readCode('src/pages/InfluencerSeedingPage.tsx')
    expect(page).not.toContain('checkEligibility')
  })

  it('막다른 길이 이어져 있다 — 제공 안 켠 상세와 내 체험에서 목록으로', () => {
    expect(readCode('src/components/seeding/SellThisCard.tsx')).toContain('/influencer/seeding')
    expect(readCode('src/pages/MySeedingPage.tsx')).toContain('/influencer/seeding')
  })
})

describe('🔗 공유 카드 메타 — 서버 표와 한 벌', () => {
  /* 🩸 왜 이 그룹이 생겼나 (2026-11-01, 배포 후 라이브 실측):
       화면에 `<SEO … noindex />` 를 줬는데 배포된 서버 HTML 은 `index, follow` 였다. react-helmet 이
       심는 것은 **JS 를 안 돌리는 크롤러·스크래퍼에 닿지 않고**, 서버 메타는 `consumer-surfaces` 표가
       정한다 — 표에 항목이 없으면 `index.html` 기본(= 유어딜 홈) 카드가 뜬다.
       🔑 `robots.txt` 의 `Disallow: /influencer/` 로 **크롤은 이미 막혀 있어 색인 영향은 없다.**
          표에 넣는 이유는 **공유 카드** 하나다(선례 `/store/new`).
       ⚠️ 기존 가드(`consumer-surface-seo`·`breadcrumb-*`)를 깨뜨려 봤는데 **안 잡는다**(페이지가 문구를
          손으로 적어도 68건 전부 통과) ⇒ 여기서 묶는다. */
  const SURFACE = '/influencer/seeding'

  it('① 표에 항목이 있고 noindex 이며 빵부스러기 라벨이 없다', () => {
    const e = (CONSUMER_SURFACE_SEO as Record<string, { title?: string; description?: string; noindex?: boolean; crumb?: string }>)[SURFACE]
    expect(e, `${SURFACE} 가 표에 없다 — 공유 카드가 유어딜 홈 메타로 뜬다`).toBeTruthy()
    expect(e.noindex, 'noindex 가 아니면 thin content 가 색인 후보가 된다').toBe(true)
    // 🍞 2026-10-11 가드의 불변식 — 색인 말라고 한 URL 을 체인이 가리키게 두지 않는다.
    expect(e.crumb, 'noindex 표면엔 빵부스러기 라벨을 두지 않는다').toBeUndefined()
    expect((e.title || '').length, '제목이 비면 카드가 비어 보인다').toBeGreaterThan(4)
    expect((e.description || '').length).toBeGreaterThan(10)
  })

  it('② 화면이 그 표를 읽는다 — 문구를 손으로 적지 않는다', () => {
    const src = readCode('src/pages/InfluencerSeedingPage.tsx')
    expect(src, '표를 import 하지 않는다 — 두 벌이면 한쪽만 고치는 날 갈린다').toContain("from '@/shared/seo/consumer-surfaces'")
    // 🔑 `<SEO>` 의 title·description 이 표에서 와야 한다(리터럴이면 갈린다).
    const seo = src.match(/<SEO[\s\S]{0,300}?\/>/)
    expect(seo, '`<SEO …/>` 를 못 찾았다 — 이 단언이 헛돈다').toBeTruthy()
    // 브랜드 접미사는 `withSiteName` 이 붙인다(표엔 안 담는다 — 가드 surface-title-contract ②).
    expect(seo![0]).toMatch(/title=\{withSiteName\(SURFACE_SEO\.title\)\}/)
    expect(seo![0]).toMatch(/description=\{[A-Z_]*SURFACE_SEO/)
    expect(seo![0], '크롤러가 JS 를 돌리는 경우를 위해 클라도 noindex 를 넘긴다').toContain('noindex')
  })

  it('③ 반대 방향 — 표에 손으로 적은 사본을 두지 않는다', () => {
    // 표의 문구가 페이지 소스에 **리터럴로** 또 있으면 그게 사본이다(둘이 갈리는 씨앗).
    const e = (CONSUMER_SURFACE_SEO as Record<string, { title?: string; description?: string }>)[SURFACE]
    const src = readCode('src/pages/InfluencerSeedingPage.tsx')
    expect(src.includes(`"${e.title}"`), '제목을 리터럴로 다시 적었다').toBe(false)
    expect(src.includes(`"${e.description}"`), '설명을 리터럴로 다시 적었다').toBe(false)
  })
})
