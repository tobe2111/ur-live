import { describe, it, expect, beforeEach } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { readFileSync } from 'node:fs'
import { resolveSectionProducts } from '@/features/sections/api/section-rules'
import {
  nearKeyOf, parseNearKey, nearKeyFromCookieHeader, nearCookieValue, nearSubtitle, NEAR_COOKIE,
  nearLabelFromCookieHeader, NEAR_LABEL_COOKIE,
} from '@/shared/home-near'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'
import { resolveHomeNear } from '@/components/home/home-near'
import { seededSectionProductIds } from '@/shared/home-section-ids'
import { stripComments } from '@/tests/helpers/source-text'

/**
 * 📍 2026-10-13 대표 — *"메인에서 위치를 만약 설정하면 맨 위에 이런 이용권은 어떠세요? 유어쇼츠 이런게 나올게
 *   아니라 그 지역에 맞는 이용권이 가장 맨 위에 나와야하지 않을까? … 어드민에서 직접 설정을 하지 않는 한,
 *   그 지역에 가장 가까운 이용권들을 보여줘"* → 시안 확정 *"1,2 섞어서"*(내 위치 · 지역만 고름 둘 다).
 *
 * ## 무엇이었나 (라이브 실측, 동탄5동)
 * 맨 위 '이런 이용권은 어떠세요?' 는 위치와 무관한 **전국 인기순**이라 첫 칸이 전주(약 165km)였다.
 * 그 아래 '주말에 떠나는 숙소'는 소제목이 "가까운 곳부터" 인데 실제론 경주·속초·부산 순이었다.
 *
 * ## 이 시험이 실제로 돌리는 것
 * 정렬은 문자열로 판정할 수 없다 — 진짜 SQLite 에 좌표 있는 상품을 넣고 리졸버를 **실행**해 순서를 본다.
 * 특히 "반경 밖에서는 실매장을 먼저 두지 않는다" 는 결과로만 보인다(그 규칙을 지우면 165km 실매장이
 * 동네 데모 위에 선다 — 라이브에서 서버 거리순이 그대로 그랬다).
 *
 * ⚠️ 못 보는 것: 엣지 캐시가 실제로 위치별로 갈리는지 · 워커가 쿠키를 실제로 받는지(런타임) ·
 *    소비자가 그 결과를 "가깝다" 고 느끼는지(라이브 판정).
 */
const DONGTAN = { lat: 37.20, lng: 127.08 }

function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  db.prepare(`CREATE TABLE products (
    id INTEGER PRIMARY KEY, name TEXT, price INTEGER, original_price INTEGER,
    image_url TEXT, category TEXT, discount_rate INTEGER, sold_count INTEGER,
    dominant_color TEXT, avg_rating REAL, review_count INTEGER, view_count INTEGER,
    deal_only INTEGER, restaurant_name TEXT, restaurant_address TEXT, slug TEXT,
    restaurant_lat REAL, restaurant_lng REAL,
    images TEXT, is_active INTEGER, group_buy_status TEXT, created_at TEXT,
    seller_id INTEGER, is_supply_product INTEGER, supply_source_id INTEGER, mall_id INTEGER
  )`).run()
  db.prepare(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT)`).run()
  db.prepare(`CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT)`).run()
  const ins = db.prepare(`INSERT INTO products
    (id,name,price,original_price,image_url,category,discount_rate,sold_count,dominant_color,
     avg_rating,review_count,view_count,deal_only,restaurant_name,restaurant_address,slug,
     restaurant_lat,restaurant_lng,images,
     is_active,group_buy_status,created_at,seller_id,is_supply_product,supply_source_id,mall_id)
    VALUES (?,?,1000,2000,'x','meal_voucher',50,?,NULL,4.5,1,1,0,'가게','주소',?,?,?,NULL,1,'active','2026-09-01',1,0,NULL,1)`)
  //            id  이름              인기  slug           lat      lng
  const rows: [number, string, number, string | null, number | null, number | null][] = [
    [1, '전주 실매장(165km)', 100, null, 35.84, 127.11],
    [2, '방배 실매장(33km)', 90, null, 37.49, 126.99],
    [3, '데모 0.7km', 5, 'demo-deal-3', 37.1948, 127.0813],
    [4, '데모 0.9km', 6, 'demo-deal-4', 37.2068, 127.0735],
    [5, '실매장 4km', 1, null, 37.236, 127.08],
    [6, '데모 20km', 7, 'demo-deal-6', 37.38, 127.10],
    [7, '실매장 좌표없음', 50, null, null, null],
    [8, '데모 좌표없음', 60, 'demo-deal-8', null, null],
  ]
  for (const r of rows) ins.run(...(r as unknown as never[]))
  // 🧭 경도 보정 판정용 — 동쪽 7km 와 북쪽 8km. cos(위도) 보정을 빼면 동쪽이 8.8km 로 부풀어 순서가 뒤집힌다.
  const insBeauty = db.prepare(`INSERT INTO products
    (id,name,price,original_price,image_url,category,sold_count,deal_only,slug,restaurant_lat,restaurant_lng,
     is_active,group_buy_status,created_at,seller_id,is_supply_product,mall_id,review_count,view_count)
    VALUES (?,?,1000,2000,'x','beauty_voucher',1,0,NULL,?,?,1,'active','2026-09-01',1,0,1,1,1)`)
  insBeauty.run(...([9, '동쪽 7km', 37.20, 127.08 + 7 / 88.6] as never[]))
  insBeauty.run(...([10, '북쪽 8km', 37.20 + 8 / 111.32, 127.08] as never[]))
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}
const env = () => ({ DB: makeD1() } as unknown as Parameters<typeof resolveSectionProducts>[0])
const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id as number)

describe('① 서버 — 위치가 있으면 가까운 순 (진짜 SQLite)', () => {
  it('반경 10km 안: 실매장 먼저 → 데모 가까운 순 · 반경 밖: 순수 거리순 · 좌표 없음: 맨 뒤', async () => {
    const out = await resolveSectionProducts(env(), { source: 'category', sourceValue: 'meal_voucher', limit: 12, near: DONGTAN })
    expect(ids(out)).toEqual([5, 3, 4, 6, 2, 1, 7, 8])
  })

  it('🔴 반경 밖에서 실매장을 먼저 두지 않는다 — 165km 실매장이 20km 데모 위에 서면 안 된다', async () => {
    const out = ids(await resolveSectionProducts(env(), { source: 'popular', limit: 12, near: DONGTAN }))
    expect(out.indexOf(6)).toBeLessThan(out.indexOf(2))
    expect(out.indexOf(6)).toBeLessThan(out.indexOf(1))
  })

  it('인기 규칙(맨 위 줄)도 같은 거리 정렬을 받는다 — 인기 점수는 동률 깨기로만 남는다', async () => {
    const out = await resolveSectionProducts(env(), { source: 'popular', limit: 5, near: DONGTAN })
    expect(ids(out)).toEqual([5, 9, 10, 3, 4]) // 반경 안 실매장(5·9·10, 가까운 순) → 데모(3·4)
  })

  it('경도는 위도로 보정한다 — 동쪽 7km 가 북쪽 8km 보다 앞', async () => {
    const out = await resolveSectionProducts(env(), { source: 'category', sourceValue: 'beauty_voucher', limit: 2, near: DONGTAN })
    expect(ids(out)).toEqual([9, 10])
  })

  it('위치가 없으면 종전 그대로 — 데모 후순위 + 인기순', async () => {
    const out = ids(await resolveSectionProducts(env(), { source: 'category', sourceValue: 'meal_voucher', limit: 12 }))
    expect(out.slice(0, 4)).toEqual([1, 2, 7, 5]) // 실매장 4곳(인기순)이 먼저
    expect(out.slice(4).every((id) => [3, 4, 6, 8].includes(id))).toBe(true)
  })

  it('위치 정렬도 배제(excludeIds)와 함께 동작한다 — 위 줄에 나온 것은 빼고 다음으로 채운다', async () => {
    const out = ids(await resolveSectionProducts(env(), { source: 'category', sourceValue: 'meal_voucher', limit: 3, near: DONGTAN, excludeIds: [5, 3] }))
    expect(out).toEqual([4, 6, 2])
  })

  it('카드 컬럼에 좌표가 실린다 — 섹션 카드도 km 를 그린다', async () => {
    const [first] = await resolveSectionProducts(env(), { source: 'popular', limit: 1, near: DONGTAN })
    expect(first.restaurant_lat).toBeTypeOf('number')
    expect(first.restaurant_lng).toBeTypeOf('number')
  })
})

describe('② 위치 키 — 화면·워커·서버가 같은 격자', () => {
  it('0.02° 격자로 맞춘다(피드 near 캐시키와 같다)', () => {
    expect(nearKeyOf({ lat: 37.2013, lng: 127.0791 })).toBe('37.20,127.08')
    expect(nearKeyOf({ lat: 35.1631, lng: 129.0636 })).toBe('35.16,129.06')
  })

  it('서버는 받은 값을 다시 격자에 맞춘다 — 정밀 좌표가 와도 캐시가 안 쪼개진다', () => {
    expect(parseNearKey('37.201345,127.079912')).toEqual({ lat: 37.2, lng: 127.08 })
    expect(parseNearKey('37.20_127.08')).toEqual({ lat: 37.2, lng: 127.08 })
  })

  it('쓰레기 값은 null — SQL 에 인라인되므로 숫자 아닌 것은 절대 통과시키지 않는다', () => {
    for (const bad of ['', 'abc', '37.2', '1,2,3', '999,127', '37.2,999', "1);DROP TABLE x;--,1", 'NaN,1', 'Infinity,1']) {
      expect(parseNearKey(bad), bad).toBeNull()
    }
  })

  it('쿠키 왕복 — 쉼표 대신 밑줄, 읽을 때 다시 격자 키', () => {
    const v = nearCookieValue('37.20,127.08')
    expect(v).toBe('37.20_127.08')
    expect(nearKeyFromCookieHeader(`a=1; ${NEAR_COOKIE}=${v}; b=2`)).toBe('37.20,127.08')
    expect(nearKeyFromCookieHeader(`${NEAR_COOKIE}=garbage`)).toBe('')
    expect(nearKeyFromCookieHeader(`x${NEAR_COOKIE}=37.20_127.08`)).toBe('')
  })

  it('소제목 — 라벨이 없으면 "내 주변"', () => {
    expect(nearSubtitle('동탄5동')).toBe('동탄5동에서 가까운 순')
    expect(nearSubtitle('')).toBe('내 주변에서 가까운 순')
  })
})

describe('②-2 워커 첫 화면 — 소제목이 화면과 같다', () => {
  const seedJson = (near: boolean) => JSON.stringify({
    success: true,
    data: [{ id: 1, title: '이런 이용권은 어떠세요?', subtitle: '많이 팔린 순으로 모았어요', ...(near ? { near: true } : {}),
      products: [{ id: 5, name: '실매장', price: 1000, original_price: 2000, image_url: 'https://media.ur-team.com/a.jpg', category: 'meal_voucher' }] }],
  })

  it('위치로 정렬된 줄은 "{라벨}에서 가까운 순" — 서버 문구("많이 팔린 순")를 그대로 그리면 거짓말이다', () => {
    const html = buildHomeFirstScreen(seedJson(true), '', '동탄5동')
    expect(html).toContain('동탄5동에서 가까운 순')
    expect(html).not.toContain('많이 팔린 순')
  })

  it('위치가 없으면 서버 문구 그대로(종전)', () => {
    expect(buildHomeFirstScreen(seedJson(false), '', '동탄5동')).toContain('많이 팔린 순으로 모았어요')
  })

  it('🔴 라벨은 쿠키(사용자 입력)라 탈출·길이 제한을 받는다', () => {
    const evil = '<img src=x onerror=alert(1)>'
    const label = nearLabelFromCookieHeader(`${NEAR_LABEL_COOKIE}=${encodeURIComponent(evil)}`)
    expect(label.length).toBeLessThanOrEqual(20)
    expect(buildHomeFirstScreen(seedJson(true), '', label)).not.toContain('<img src=x') // 카드 사진 <img> 는 정상, 주입 태그만 없어야
    expect(nearLabelFromCookieHeader(`${NEAR_LABEL_COOKIE}=${encodeURIComponent('동탄5동')}`)).toBe('동탄5동')
    expect(nearLabelFromCookieHeader(`${NEAR_LABEL_COOKIE}=%E0%A4%A`)).toBe('') // 깨진 인코딩
  })
})

describe('③ 화면 입력 — 내 위치 · 지역만 고름 (시안 ①②)', () => {
  it('내 위치가 있으면 그 좌표 · 동 이름 · 카드에 km', () => {
    const n = resolveHomeNear({ userLoc: { lat: 37.2005, lng: 127.079 }, dongLabel: '동탄5동', regionKey: '부산' })
    expect(n.key).toBe('37.20,127.08')
    expect(n.label).toBe('동탄5동')
    expect(n.kmFrom).toEqual({ lat: 37.2005, lng: 127.079 })
  })

  it('지역만 골랐으면 시/도 중심 · 시/도 이름 · km 없음(내 위치가 아니므로)', () => {
    const n = resolveHomeNear({ userLoc: null, regionKey: '부산' })
    expect(n.key).toBe(nearKeyOf({ lat: 35.1796, lng: 129.0756 }))
    expect(n.label).toBe('부산')
    expect(n.kmFrom).toBeNull()
  })

  it('둘 다 없으면 위치 없음 — 종전 요청 그대로', () => {
    expect(resolveHomeNear({ userLoc: null }).key).toBe('')
    expect(resolveHomeNear({ userLoc: null, regionKey: '없는지역' }).key).toBe('')
  })
})

describe('④ 시드 — 같은 위치로 만든 것만 쓴다', () => {
  const seed = (body: unknown) => {
    document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove()
    const el = document.createElement('script')
    el.id = '__SSR_INITIAL_SECTIONS__'
    el.type = 'application/json'
    el.textContent = JSON.stringify(body)
    document.body.appendChild(el)
  }
  beforeEach(() => document.getElementById('__SSR_INITIAL_SECTIONS__')?.remove())

  it('위치가 같으면 그 시드의 id 를 피드 뒤로 민다', () => {
    seed({ success: true, near: '37.20,127.08', data: [{ products: [{ id: 3 }, { id: 4 }] }] })
    expect(seededSectionProductIds('37.20,127.08')).toEqual(new Set([3, 4]))
  })

  it('🔴 위치가 다르면 빈 집합 — 지금 화면에 없는 카드를 뒤로 밀지 않는다', () => {
    seed({ success: true, data: [{ products: [{ id: 1 }] }] }) // 위치 없이 만든 시드
    expect(seededSectionProductIds('37.20,127.08').size).toBe(0)
    seed({ success: true, near: '35.16,129.06', data: [{ products: [{ id: 1 }] }] })
    expect(seededSectionProductIds('37.20,127.08').size).toBe(0)
  })

  it('위치 없음 + 위치 없는 시드 = 종전 동작', () => {
    seed({ success: true, data: [{ products: [{ id: 9 }] }] })
    expect(seededSectionProductIds()).toEqual(new Set([9]))
  })
})

describe('⑤ 배선', () => {
  const code = (p: string) => stripComments(readFileSync(p, 'utf8'))

  it('라우트가 near 를 리졸버에 넘기고, L1 캐시키를 위치로 가르고, 응답에 위치를 싣는다', () => {
    const r = code('src/features/sections/api/sections.routes.ts')
    expect(r).toMatch(/const near = parseNearKey\(c\.req\.query\('near'\)\)/)
    expect(r).toMatch(/nearKey \? `sections:public:n\$\{nearKey\}` : 'sections:public'/)
    expect(r).toMatch(/excludeIds: \[\.\.\.claimed\],\s*near,/)
    expect(r).toMatch(/\{ success: true, data: result, near: nearKey \}/)
  })

  it('🔴 수동 섹션은 위치로 표시하지 않는다 — 어드민이 고른 것이 이긴다', () => {
    const r = code('src/features/sections/api/sections.routes.ts')
    expect(r).toMatch(/near: normalizeSectionSource\(s\.source\) !== 'manual'/)
  })

  it('화면이 위치별 쿼리키·쿼리로 요청하고, 위치 줄의 소제목을 바꾼다', () => {
    const s = code('src/components/home/HomeSections.tsx')
    expect(s).toMatch(/nearKey \? \['home', 'sections', nearKey\] : \['home', 'sections'\]/)
    expect(s).toMatch(/nearKey \? `\/api\/sections\?near=\$\{nearKey\}` : '\/api\/sections'/)
    expect(s).toMatch(/sec\.near \? nearSubtitle\(near\?\.label\) : sec\.subtitle/)
    expect(s).toMatch(/userLoc=\{sec\.near \? near\?\.kmFrom : null\}/)
  })

  it('두 홈(모바일·PC)이 같은 위치를 섹션·피드·쿠키에 넘긴다', () => {
    for (const p of ['src/pages/mobile-home/MobileHomePage.tsx', 'src/pages/pc-home/PcHomePage.tsx']) {
      const s = code(p)
      expect(s, p).toMatch(/const near = resolveHomeNear\(\{ userLoc, dongLabel: dong\?\.dong, regionKey: region\.regionKey \}\)/)
      expect(s, p).toMatch(/useEffect\(\(\) => \{ syncNearCookie\(near\.key, near\.label\) \}, \[near\.key, near\.label\]\)/)
      expect(s, p).toMatch(/near=\{near\}/)
      expect(s, p).toMatch(/sectionNearKey=\{near\.key\}/)
    }
  })

  it('워커가 쿠키로 섹션 시드를 받는다 — 쿠키가 없으면 경로가 정확히 /api/sections', () => {
    const w = code('src/worker/index.ts')
    expect(w).toContain("path: '/api/sections' + ((k) => (k ? `?near=${k}` : ''))(nearKeyFromCookieHeader(c.req.header('cookie')))")
    expect(w).toContain("buildHomeFirstScreen(ssrExtraPayload, urdealLoaderHtml, nearLabelFromCookieHeader(c.req.header('cookie')))")
  })
})
