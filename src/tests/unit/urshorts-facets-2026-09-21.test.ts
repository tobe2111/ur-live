/**
 * 🎬 유어쇼츠 전체 보기(`/urshorts`) — 도시·종류 축 (2026-09-21 대표 확정 "시안 A + 카테고리").
 *
 * ## 이 시험이 지키는 것
 * ① 분류기가 **모르면 `null`** 이다(찍으면 부산 칩에 서울 영상이 뜬다 — 에러가 안 나는 결함).
 * ② 칩은 **데이터가 만든다**: 개수·정렬·"둘 미만이면 줄을 안 그린다".
 * ③ 거르기는 **AND** 이고, 값 없는 영상은 그 축을 고른 순간 빠진다.
 * ④ 두 지역 목록(작은 화면용 ↔ 진짜 표)이 **갈리지 않는다**.
 * ⑤ 화면이 분류기를 import 하지 않는다(상권 키워드 수백 개가 소비자 번들에 실리는 것 차단).
 * ⑥ 배선 — 서버가 분류를 부르고, 「전체 보기」가 새 목록으로 가고, 라우트가 있다.
 *
 * ## ❌ 이 시험이 못 보는 것
 * - **실제로 그려진 칩의 모양·색** — jsdom 에는 레이아웃이 없다. 눈으로 볼 것.
 * - **유튜브 설명글·태그의 실제 수율** — 라이브 키가 있어야 재진다. 오늘 제목만으로 10편 중 7편.
 * - 워커 HTMLRewriter 의 modulepreload 주입(런타임 전용 — 배포 후 curl 로만 판정).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import { KOREA_REGIONS } from '@/shared/constants/korea-regions'
import { URSHORTS_REGION_KEYS, shortsRegionLabel } from '@/shared/urshorts-regions'
import { classifyShort, extractRegion, extractCategory, REGION_SI } from '@/shared/urshorts-tags'
import {
  cityFacets, categoryFacets, filterShorts, pruneFilter, MIN_FACETS_TO_SHOW,
} from '@/pages/urshorts/facets'
import type { UrShortItem } from '@/shared/urshorts'

const item = (o: Partial<UrShortItem> & { id: number }): UrShortItem => ({
  video_id: `v${o.id}`, title: null, channel: null, thumb_url: null, product_id: null,
  product_name: null, store_name: null, product_image: null,
  price: null, original_price: null, discount_rate: null, ...o,
})

// 실제 라이브 값(2026-09-16 D1 실측) — 합성 문자열로 시험하면 "우리가 만든 문장"만 통과한다.
const LIVE = [
  { id: 11, t: "싸와디캅~ 기장 바다🌊 보며 태국 음식🇹🇭 '어밤부' #shorts", ch: '부산일보TV', si: '부산' },
  { id: 10, t: '태국정부 인증도 받은..부산에서 제일 핫한 태국음식 맛집 #아임타이', ch: '해피푸게더', si: '부산' },
  { id: 9, t: '부산 최초 타이셀렉트 !!! 여기 맛있어용 태국음식집 최애! 📍아임타이 #서면맛집', ch: '슬아투니', si: '부산' },
  { id: 5, t: '한식 러버들의 성지가 될 곳! 용산에 새로 오픈한 한식당 #광고 #용산맛집', ch: '파인예플', si: '서울' },
  { id: 4, t: '돈만 있으면 매일 가고 싶은 용산 1티어급 프렌치 가정식 #shorts #맛집', ch: '재슐랭가이드', si: '서울' },
]

describe('① 분류기 — 모르면 null', () => {
  it('라이브 제목에서 도시를 맞힌다', () => {
    for (const r of LIVE) {
      expect(classifyShort({ title: r.t, channel: r.ch }).region_si, r.t.slice(0, 16)).toBe(r.si)
    }
  })

  it('제목이 비면 도시도 종류도 null (3편이 실제로 그렇다)', () => {
    const c = classifyShort({ title: '', channel: null })
    expect(c.region_si).toBeNull()
    expect(c.region_area).toBeNull()
    expect(c.category).toBeNull()
  })

  it('지역이 안 나오는 글은 찍지 않는다', () => {
    expect(extractRegion('오늘 뭐 먹지 #맛집').si).toBeNull()
  })

  it('생활권이 시를 정한다 — 기장 → 부산 · 용산 → 서울', () => {
    expect(extractRegion('기장 바다 보며').si).toBe('부산')
    expect(extractRegion('용산에 새로 오픈').si).toBe('서울')
  })

  it('시가 이미 잡히면 **다른 시의 상권**은 라벨로도 안 쓴다', () => {
    // 🩸 처음엔 `.si` 만 봤는데 주입 러너가 "헛돈다" 고 잡았다 — 시는 이미 정해져 있어
    //    가드를 지워도 안 바뀐다. **실제 증상은 남의 동네 라벨**이다(부산 영상에 '고성' 이 붙는다).
    const got = extractRegion('부산 여행 중 고성 들렀다')
    expect(got.si).toBe('부산')
    expect(got.area, "'고성'(강원·경남)은 부산 상권이 아니다").not.toBe('고성')
  })

  it('동점이면 카테고리를 찍지 않는다 (호텔 브런치)', () => {
    expect(extractCategory('호텔 브런치')).toBeNull()
  })

  it('연결된 이용권의 카테고리가 글자 추정을 이긴다', () => {
    const c = classifyShort({ title: '여기 호텔 숙소 펜션 리조트', productCategory: 'meal_voucher' })
    expect(c.category).toBe('meal_voucher')
  })

  it('레거시 카테고리는 정규화된다 (health → beauty)', () => {
    expect(classifyShort({ title: '', productCategory: 'health_voucher' }).category).toBe('beauty_voucher')
  })
})

describe('② 칩은 데이터가 만든다', () => {
  const rows = [
    item({ id: 1, region_si: '부산', category: 'meal_voucher' }),
    item({ id: 2, region_si: '부산', category: 'meal_voucher' }),
    item({ id: 3, region_si: '서울', category: 'beauty_voucher' }),
    item({ id: 4, region_si: null, category: null }),
  ]

  it('모르는 영상은 칩을 만들지 않는다', () => {
    expect(cityFacets(rows).map((f) => f.key)).toEqual(['부산', '서울'])
  })

  it('개수를 센다', () => {
    expect(cityFacets(rows).find((f) => f.key === '부산')?.count).toBe(2)
  })

  it('많은 순으로 정렬한다', () => {
    expect(cityFacets(rows)[0].key).toBe('부산')
  })

  it('종류 칩은 짧은 이름(식사·미용)을 쓴다', () => {
    expect(categoryFacets(rows).map((f) => f.label).sort()).toEqual(['미용', '식사'])
  })

  it('한 종류뿐이면 줄을 안 그린다 (오늘 카테고리가 그렇다)', () => {
    const onlyMeal = rows.slice(0, 2)
    expect(categoryFacets(onlyMeal).length).toBeLessThan(MIN_FACETS_TO_SHOW)
  })

  it('🔴 이 시험이 0건을 재고 있으면 통과가 아니다', () => {
    expect(rows.length).toBeGreaterThan(0)
    expect(cityFacets(rows).length).toBeGreaterThan(0)
  })
})

describe('③ 거르기', () => {
  const rows = [
    item({ id: 1, region_si: '부산', category: 'meal_voucher' }),
    item({ id: 2, region_si: '부산', category: 'beauty_voucher' }),
    item({ id: 3, region_si: null, category: 'meal_voucher' }),
  ]

  it('두 축은 AND 다', () => {
    expect(filterShorts(rows, { si: '부산', category: 'meal_voucher' }).map((r) => r.id)).toEqual([1])
  })

  it("도시를 고르면 도시를 모르는 영상은 빠진다", () => {
    expect(filterShorts(rows, { si: '부산', category: null }).map((r) => r.id)).toEqual([1, 2])
  })

  it('아무것도 안 고르면 전부 (모르는 영상 포함)', () => {
    expect(filterShorts(rows, { si: null, category: null })).toHaveLength(3)
  })

  it('목록에 없는 값은 조용히 풀린다 (내려간 도시의 옛 링크)', () => {
    const pruned = pruneFilter({ si: '제주', category: null }, cityFacets(rows), categoryFacets(rows))
    expect(pruned.si).toBeNull()
  })

  it('있는 값은 유지된다', () => {
    expect(pruneFilter({ si: '부산', category: null }, cityFacets(rows), categoryFacets(rows)).si).toBe('부산')
  })
})

describe('④ 두 지역 목록이 갈리지 않는다', () => {
  it('작은 표 == 진짜 표 (순서까지)', () => {
    expect([...URSHORTS_REGION_KEYS]).toEqual(KOREA_REGIONS.map((r) => r.key))
  })

  it('서버 허용 목록도 같은 것을 쓴다', () => {
    expect([...REGION_SI]).toEqual([...URSHORTS_REGION_KEYS])
  })

  it('줄바꿈이 든 키만 손본다', () => {
    expect(shortsRegionLabel('충남세종')).toBe('충남·세종')
    expect(shortsRegionLabel('부산')).toBe('부산')
    expect(shortsRegionLabel(null)).toBe('')
  })
})

describe('⑤ 화면이 분류기(=상권 키워드 수백 개)를 끌고 오지 않는다', () => {
  for (const f of [
    'src/pages/UrShortsBrowsePage.tsx',
    'src/pages/urshorts/facets.ts',
    'src/pages/urshorts/BrowseCard.tsx',
    'src/pages/admin-urshorts/TagPickers.tsx',
  ]) {
    it(`${f} 는 urshorts-tags 를 import 하지 않는다`, () => {
      expect(readCode(f)).not.toMatch(/from\s+'@\/shared\/urshorts-tags'/)
    })
  }
})

describe('⑥ 배선', () => {
  const routes = stripComments(readCode('src/features/urshorts/api/urshorts.routes.ts'))

  it('분류를 부르는 자리가 다섯 곳 그대로다', () => {
    // 🩸 처음엔 `>= 4` 로 썼는데 **하나를 지워도 통과했다**(주입 러너가 잡았다).
    //    다섯 자리 = 어드민 등록 · refresh-meta · PATCH(상품연결) · 셀러 등록 · 일괄 분류.
    expect((routes.match(/await classifyAndFill\(/g) ?? []).length).toBe(5)
  })

  it('어드민 등록 직후에 부른다 (새 영상이 미분류로 남지 않게)', () => {
    const block = routes.slice(routes.indexOf("'이미 등록된 영상입니다'"), routes.indexOf("'이미 등록된 영상입니다'") + 400)
    expect(block).toMatch(/classifyAndFill\(DB, c\.env, Number\(r\.meta\.last_row_id\)\)/)
  })

  it('공개 SQL 이 상품 카테고리를 먼저 본다', () => {
    expect(routes).toContain('COALESCE(p.category, s.category) AS category')
  })

  it('공개 SQL 이 도시 두 칸을 내려보낸다', () => {
    expect(routes).toContain('s.region_si AS region_si')
    expect(routes).toContain('s.region_area AS region_area')
  })

  it('기존 테이블에도 컬럼을 붙인다(ALTER)', () => {
    for (const col of ['region_si', 'region_area', 'category']) {
      expect(routes).toContain(`ALTER TABLE home_shorts ADD COLUMN ${col}`)
    }
  })

  it('일괄 분류는 한 번에 8편까지다 (서브리퀘스트 한도)', () => {
    expect(routes).toMatch(/todo\.slice\(0,\s*8\)/)
  })

  it('허용 목록 밖 도시·카테고리는 400', () => {
    expect(routes).toMatch(/REGION_SI\.includes\(v\)/)
    expect(routes).toMatch(/VOUCHER_CATEGORIES as readonly string\[\]\)\.includes\(v\)/)
  })

  it('레일의 「전체 보기」 두 자리가 모두 목록으로 간다 (뷰어 아님)', () => {
    // 🩸 처음엔 `toMatch` 하나였는데 레일엔 그 링크가 **둘**(머리말 + 끝 타일)이라
    //    하나만 뷰어로 되돌려도 통과했다(주입 러너가 잡았다).
    const rail = stripComments(readCode('src/components/home/UrShortsRail.tsx'))
    expect((rail.match(/to=\{URSHORTS_BROWSE_PATH\}/g) ?? []).length).toBe(2)
    // 뷰어는 **카드 탭**에서만 — 그건 보러 가는 동작이다.
    expect(rail).toMatch(/URSHORTS_VIEWER_PATH\}\?v=/)
    expect(rail, '「전체 보기」가 다시 뷰어로 갔다').not.toMatch(/to=\{URSHORTS_VIEWER_PATH\}/)
  })

  it('네비 진입점(PC·모바일)도 목록으로 간다', () => {
    for (const f of ['src/components/main/DesktopTopNav.tsx', 'src/pages/mobile-home/MobileHomePage.tsx']) {
      expect(stripComments(readCode(f)), f).toMatch(/to=\{URSHORTS_BROWSE_PATH\}/)
    }
  })

  it('새 경로가 몰 슬러그 예약어에 있다', () => {
    // 예약 안 하면 누가 `urshorts` 로 몰을 만드는 순간 목록이 그 가게로 덮인다(`pass` 와 같은 사고).
    expect(stripComments(readCode('src/shared/mall/slug.ts'))).toMatch(/'urshorts'/)
  })

  it('라우트가 실제로 달려 있다', () => {
    const app = stripComments(readCode('src/App.tsx'))
    expect(app).toMatch(/<Route path="\/urshorts" element=\{<UrShortsBrowsePage \/>\} \/>/)
  })

  it('하드로드 진입점이 청크 병렬화에 등록돼 있다', () => {
    expect(stripComments(readCode('scripts/generate-route-chunk-map.mjs')))
      .toMatch(/urshorts:\s*\['src\/pages\/UrShortsBrowsePage\.tsx'\]/)
    expect(stripComments(readCode('src/worker/index.ts')))
      .toMatch(/url\.pathname === '\/urshorts' \? 'urshorts'/)
  })
})
