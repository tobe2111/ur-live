/**
 * 🏬 프랜차이즈 지점 편의 기능 (2026-10-17 대표 "응응 다 해줘") — 불변식.
 *
 * 대표 확정 규칙: **모든 건 지점 단위이고, 그 지점의 주인이 정한다.** 브랜드는 보여 주기용 묶음이다.
 *
 * ① 목록 상한 — 지점이 20·50곳을 넘어도 조용히 빠지지 않는다(바인딩 한도는 조각으로 나눈다).
 * ② 이용권 복사 — 지점 고유 정보(상호·주소·좌표·확인코드·플레이스)는 **원본에서 가져오지 않는다**.
 * ③ 브랜드 — 운영 권한이 있는 지점만 넣고, 남의 브랜드에 묶인 지점은 빼앗지 않고, 지점 주인은 늘 뺄 수 있다.
 * ④ 브랜드 페이지 — 가까운 지점부터, 좌표 없는 지점은 뒤로.
 *
 * ⚠️ 이 시험이 **못 막는 것**: 화면이 실제로 지점마다 한 번씩 부르는지(브라우저 밖) · D1 실제 바인딩 한도
 *   (node:sqlite 는 999 까지 받는다 — 조각 크기는 숫자로만 고정한다) · 손님 화면 디자인.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { chunkIds, allInChunks, D1_IN_CHUNK } from '@/worker/utils/d1-in-chunks'
import { buildCopyBody, BRANCH_SPECIFIC_FIELDS } from '@/features/seller/api/seller-product-copy.routes'
import {
  addStoreToBrand, createBrand, listMyBrands, normalizeBrandSlug, removeStoreFromBrand, brandOfStore,
} from '@/worker/utils/store-brands'
import { sortBranchesByDistance } from '@/pages/brand/brand-branches'
import { readCode } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { for (const s of list) await s.run(); return [] },
  } as unknown as D1Database
}

/** 본사(유저 10) · 점주(유저 20) · 남(유저 30). 지점 1·2 는 본사 직영, 3 은 점주 가게(본사는 운영자), 4 는 점주 혼자. */
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT, status TEXT)`)
  db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER, user_id INTEGER,
           role TEXT, granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT)`)
  for (const id of [1, 2, 3, 4]) db.exec(`INSERT INTO sellers (id, business_name, status) VALUES (${id}, '지점${id}', 'approved')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (1, 10, 'owner'), (2, 10, 'owner'),
           (3, 20, 'owner'), (3, 10, 'operator'), (4, 20, 'owner')`)
  return d1(db)
}

describe('① 목록 상한 — 조각으로 나눠 돌리고 합친다', () => {
  it('250곳을 90개 이하 조각으로 나누고 하나도 잃지 않는다', () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1)
    const parts = chunkIds(ids)
    expect(parts.every((p) => p.length <= D1_IN_CHUNK)).toBe(true)
    expect(parts.flat()).toEqual(ids)
    expect(D1_IN_CHUNK).toBeLessThan(100) // D1 바인딩 한도 100 — 다른 자리까지 남겨야 한다
  })

  it('한 조각이 실패해도 나머지 조각의 행은 살린다', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => i + 1)
    const rows = await allInChunks(ids, async (chunk) => {
      if (chunk[0] === 91) throw new Error('boom')
      return chunk.map((id) => ({ id }))
    })
    expect(rows.length).toBe(200 - 90)
  })

  it('빈 목록이면 쿼리를 아예 안 부른다', async () => {
    let called = 0
    await allInChunks([], async () => { called++; return [] })
    expect(called).toBe(0)
  })

  it('요약·목록·알림이 20·50 으로 잘라 두지 않는다', () => {
    const ops = readCode('src/features/seller/api/seller-operators.routes.ts')
    expect(ops).not.toMatch(/\.slice\(0,\s*20\)/)
    expect(ops).toMatch(/allInChunks\(ids,/)
    const util = readCode('src/worker/utils/seller-operators.ts')
    expect(util).not.toMatch(/LIMIT 50`/)
    expect(util).toMatch(/MAX_OPERABLE_STORES = 500/)
    const notif = readCode('src/features/seller/api/seller-store-notifications.ts')
    const m = notif.match(/NOTIF_MAX_STORES = (\d+)/)
    expect(Number(m?.[1])).toBeGreaterThanOrEqual(90)
    expect(Number(m?.[1])).toBeLessThan(100) // 그 문장은 매장 id + LIMIT 하나를 묶는다
  })
})

describe('② 이용권 복사 — 지점 고유 정보는 원본에서 가져오지 않는다', () => {
  const src = {
    id: 7, seller_id: 1, name: '치킨 1마리', price: 18000, original_price: 21000, category: 'meal_voucher',
    voucher_terms: '1인 1매', voucher_expiry: '90', image_url: 'https://x/a.jpg', images: '["https://x/a.jpg"]',
    restaurant_name: '강남점', restaurant_address: '서울 강남구', restaurant_phone: '02-1', restaurant_lat: 37.5, restaurant_lng: 127,
    store_verify_pin: '1234', kakao_place_url: 'https://place.map.kakao.com/1', region_si: '서울', region_gu: '강남구',
    referral_commission_rate: 0.05,
  }

  it('상호·주소·전화·좌표·확인코드·플레이스·지역을 싣지 않는다', () => {
    const body = buildCopyBody(src) as Record<string, unknown>
    for (const f of BRANCH_SPECIFIC_FIELDS) expect(body[f]).toBeUndefined()
  })

  it('이용권 자체(이름·가격·정가·조건·사진·소개비)는 그대로 옮긴다', () => {
    const body = buildCopyBody(src, { menu: '[{"name":"후라이드"}]', max_per_person: '2' }) as Record<string, unknown>
    expect(body).toMatchObject({ name: '치킨 1마리', price: 18000, original_price: 21000, category: 'meal_voucher', voucher_terms: '1인 1매', image_url: 'https://x/a.jpg' })
    expect(body.referral_commission_rate).toBe(0.05)
    expect(body.menu).toEqual([{ name: '후라이드' }])
    expect(body.max_per_person).toBe(2)
  })

  it('복사는 새 INSERT 를 쓰지 않고 손으로 쓴 등록과 같은 함수를 탄다', () => {
    const copy = readCode('src/features/seller/api/seller-product-copy.routes.ts')
    expect(copy).toMatch(/createSellerProduct\(/)
    expect(copy).not.toMatch(/INSERT INTO products/)
    // 원본·대상 둘 다 권한 검사
    expect(copy).toMatch(/canOperateStore\(db, userId, sourceSellerId\)/)
    expect(copy).toMatch(/canOperateStore\(db, userId, targetId\)/)
  })
})

describe('③ 브랜드 — 지점 주인이 정한다', () => {
  it('주소 규칙: 영문 소문자·숫자·하이픈 3~30자, 예약어 금지', () => {
    expect(normalizeBrandSlug('Kyochon')).toBe('kyochon')
    expect(normalizeBrandSlug('ab')).toBeNull()
    expect(normalizeBrandSlug('-abc')).toBeNull()
    expect(normalizeBrandSlug('a--b')).toBeNull()
    expect(normalizeBrandSlug('admin')).toBeNull()
    expect(normalizeBrandSlug('교촌')).toBeNull()
  })

  it('운영 권한이 있는 지점만 넣는다 — 점주가 본사를 들인 가맹점은 되고, 혼자 운영하는 점주 가게는 안 된다', async () => {
    const DB = fresh()
    const made = await createBrand(DB, 10, '교촌', 'kyochon')
    expect(made.ok).toBe(true)
    const id = made.ok ? made.brand.id : 0
    expect(await addStoreToBrand(DB, 10, id, 1)).toEqual({ ok: true })
    expect(await addStoreToBrand(DB, 10, id, 3)).toEqual({ ok: true }) // 운영자로 들어와 있다
    expect(await addStoreToBrand(DB, 10, id, 4)).toEqual({ ok: false, code: 'NOT_OPERATOR' })
    expect(await addStoreToBrand(DB, 30, id, 2)).toEqual({ ok: false, code: 'NOT_BRAND_OWNER' })
    expect(await addStoreToBrand(DB, 10, id, 1)).toEqual({ ok: true }) // 멱등
  })

  it('남의 브랜드에 묶인 지점은 빼앗지 않는다', async () => {
    const DB = fresh()
    const a = await createBrand(DB, 10, '교촌', 'kyochon')
    const b = await createBrand(DB, 20, '점주브랜드', 'jeomju')
    const aId = a.ok ? a.brand.id : 0, bId = b.ok ? b.brand.id : 0
    expect(await addStoreToBrand(DB, 20, bId, 3)).toEqual({ ok: true })
    expect(await addStoreToBrand(DB, 10, aId, 3)).toEqual({ ok: false, code: 'IN_OTHER_BRAND' })
  })

  it('지점 주인은 남이 만든 브랜드에서도 자기 지점을 뺄 수 있고, 남은 못 뺀다', async () => {
    const DB = fresh()
    const a = await createBrand(DB, 10, '교촌', 'kyochon')
    const aId = a.ok ? a.brand.id : 0
    await addStoreToBrand(DB, 10, aId, 3)
    expect((await removeStoreFromBrand(DB, 30, 3)).ok).toBe(false)
    expect((await removeStoreFromBrand(DB, 20, 3)).ok).toBe(true) // 점주(주인)가 이긴다
    expect((await listMyBrands(DB, 10))[0].seller_ids).toEqual([])
  })

  it('같은 주소는 두 번 못 만든다', async () => {
    const DB = fresh()
    await createBrand(DB, 10, '교촌', 'kyochon')
    expect(await createBrand(DB, 20, '가짜교촌', 'kyochon')).toEqual({ ok: false, code: 'SLUG_TAKEN' })
  })

  it('이용권 상세 링크는 지점이 둘 이상일 때만 약속한다', async () => {
    const DB = fresh()
    const a = await createBrand(DB, 10, '교촌', 'kyochon')
    const aId = a.ok ? a.brand.id : 0
    await addStoreToBrand(DB, 10, aId, 1)
    expect((await brandOfStore(DB, 1))?.branch_count).toBe(1)
    const pub = readCode('src/features/brands/api/brands-public.routes.ts')
    expect(pub).toMatch(/Number\(b\.branch_count\) > 1/)
  })
})

describe('④ 브랜드 페이지 — 손님 노출 규칙과 정렬', () => {
  it('메인 피드와 같은 노출 술어를 쓴다(승인 지점·도매 원본 제외·본진 몰)', () => {
    const pub = readCode('src/features/brands/api/brands-public.routes.ts')
    expect(pub).toMatch(/approvedSellerProductSql\('p'\)/)
    expect(pub).toMatch(/consumerVisibleProductSql\('p'\)/)
    expect(pub).toMatch(/mainScopeFor\(db, 'products', 'p'\)/)
    expect(pub).toMatch(/IN \('approved', 'active'\)/)
    expect(pub).toMatch(/toPublicProductRows\(/)
  })

  it('가까운 지점부터, 좌표 없는 지점은 뒤로, 위치가 없으면 순서 그대로', () => {
    const s = (seller_id: number, lat: number | null, lng: number | null) => ({ seller_id, name: '', address: '', lat, lng })
    const list = [s(1, 37.6, 127.0), s(2, null, null), s(3, 37.5, 127.0)]
    expect(sortBranchesByDistance(list, { lat: 37.49, lng: 127.0 }).map((x) => x.seller_id)).toEqual([3, 1, 2])
    expect(sortBranchesByDistance(list, null).map((x) => x.seller_id)).toEqual([1, 2, 3])
  })

  it('라우트가 등록돼 있고 워커가 404 로 막지 않는다', () => {
    const app = readCode('src/App.tsx')
    expect(app).toMatch(/path="\/brand\/:slug"/)
    const known = readCode('src/shared/seo/known-routes.ts')
    expect(known).toMatch(/'brand'/)
  })
})
