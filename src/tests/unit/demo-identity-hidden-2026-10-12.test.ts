/**
 * 🙈 데모인 것을 티내지 않는다 — 대표 2026-10-12 *"데모인 것을 티내지마"*
 *
 * ## 무엇이 새고 있었나 (라이브 실측, Googlebot UA 로 서버 HTML 을 받아 셌다)
 *
 *     홈                    `demo-deal` 43회 · `"demo"` 48회   ← __SSR_INITIAL_MAIN__ 50건 중 48건이 데모
 *     지도                  `demo-deal` 48회 · `"demo"` 48회
 *     데모 상세(/pass/2914) `demo-deal` 1회                    ← __SSR_INITIAL_DETAIL__
 *     상세 결제 버튼        데모 `결제하기`·`응모 불가` / 실상품 `구매하기`·`구매 불가`
 *
 * 화면에 "데모" 라는 **글자**는 없었다(그건 어드민뿐이다). 그런데 페이지 소스를 열면 누구나,
 * 그리고 모든 크롤러가 **어느 것이 데모인지 바로** 알 수 있었고, 라벨만 봐도 구분이 됐다.
 * 에러가 안 나고 화면도 안 깨져서 **재 본 사람만 안다.**
 *
 * ## 이 가드가 양방향으로 고정하는 것
 *
 * 한쪽만 잠그면 어느 방향으로든 "맞추고" 싶어진다:
 *   - 티를 되살리는 방향 → `slug`·`fcfs.demo`·`is_demo` 가 응답에 돌아오거나, 라벨 분기가 되살아난다
 *   - **티를 지우려다 정책을 지우는 방향** → 서버측 데모-후순위 정렬(대표 2026-07-04 *"데모 이용권
 *     노출은 항상 후순위"*)과 추첨 선정 차단까지 함께 사라진다. 그쪽이 더 조용하고 더 나쁘다.
 *
 * ## 이 가드가 못 보는 것
 *
 * - 콘텐츠 자체(데모 사진·가게 이름·문구) — 데모 357건이 실제 가게 이름·주소로 색인된다는 사실은
 *   대표가 2026-10-12 에 *"그냥 두기"* 로 결정했다(기록만 남긴다).
 * - 어드민 응답 — 거기서는 **일부러** 데모를 구분해 보여 준다(`AdminDongnedeal` 의 '데모' 뱃지).
 * - 라이브에서 실제로 조용해졌는지 — 배포 후 UA 실측(`curl` 로 `demo-deal` 개수)이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripImports } from '../helpers/source-text'
import { toPublicProductRows, isDemoSlug, DEMO_SLUG_PREFIX } from '@/shared/constants/demo-products'
import { PRODUCT_DETAIL_FIELDS } from '@/shared/db/product-columns'

const listRoute = readCode('src/features/group-buy/api/group-buy-public.routes.ts')
const fcfsRoute = readCode('src/features/group-buy/api/fcfs.routes.ts')
const feedCache = readCode('src/worker/cron/group-buy-feed-cache.ts')
const purchaseBox = readCode('src/pages/group-buy/DealPurchaseBox.tsx')
const bottomBar = readCode('src/pages/group-buy/DealBottomBar.tsx')
const detailPage = readCode('src/pages/GroupBuyDetailPage.tsx')
const mapPage = readCode('src/pages/RestaurantMapPage.tsx')

describe('① 지우는 함수를 실제로 돌려서 잰다 (문자열 검사 아님)', () => {
  it('데모 행에서 slug·is_demo·fcfs.demo 가 사라지고 boost:false 가 생긴다', () => {
    const [row] = toPublicProductRows([{
      id: 2914, name: '자가만족', slug: `${DEMO_SLUG_PREFIX}deal-307`, is_demo: 1,
      restaurant_name: '자가만족',
      fcfs: { enabled: true, spots: 3, appliedDisplay: 15, prelaunch: false, demo: true },
    }])
    const json = JSON.stringify(row)
    expect(json, '응답에 데모 접두사가 남았다').not.toContain(DEMO_SLUG_PREFIX)
    expect(json, '응답에 "demo" 라는 키/값이 남았다').not.toContain('demo')
    expect('slug' in row).toBe(false)
    expect('is_demo' in row).toBe(false)
    // 상위노출 제외는 **이름을 바꿔** 살아 있어야 한다 — 아예 사라지면 클라 boost 가 데모를 끌어올린다.
    expect((row.fcfs as { boost?: boolean }).boost, '상위노출 제외 신호가 사라졌다').toBe(false)
    // 나머지 fcfs 값은 byte-불변
    expect(row.fcfs).toMatchObject({ enabled: true, spots: 3, appliedDisplay: 15, prelaunch: false })
    expect(row.id).toBe(2914)
    expect(row.restaurant_name).toBe('자가만족')
  })

  it('실상품 행은 boost 키조차 안 받는다 — 기본이 상위노출 대상이다', () => {
    const [row] = toPublicProductRows([{
      id: 2919, name: '닭도리탕', slug: null,
      fcfs: { enabled: true, spots: 5, appliedDisplay: 20, prelaunch: false, demo: false },
    }])
    expect('boost' in (row.fcfs as object), '실상품에 boost 가 붙으면 48:2 분포가 되레 티가 된다').toBe(false)
    expect('slug' in row).toBe(false)
  })

  it('fcfs 가 없는 행도, 빈 배열도 안전하다', () => {
    expect(toPublicProductRows([])).toEqual([])
    const [row] = toPublicProductRows([{ id: 1, slug: `${DEMO_SLUG_PREFIX}stay-9` }])
    expect(JSON.stringify(row)).not.toContain(DEMO_SLUG_PREFIX)
    expect(row.id).toBe(1)
  })

  it('원본 배열을 변형하지 않는다 — 서버가 그 뒤에 slug 로 판정할 수도 있다', () => {
    const src = [{ id: 1, slug: `${DEMO_SLUG_PREFIX}deal-1` }]
    toPublicProductRows(src)
    expect(src[0].slug, '입력을 파괴했다').toBe(`${DEMO_SLUG_PREFIX}deal-1`)
  })
})

describe('② 두 응답 지점이 그 함수를 **실제로 거친다** (계산만 하는 것과 다르다)', () => {
  it('리스트 응답이 감싼 배열을 내보낸다', () => {
    expect(listRoute, '리스트 응답이 원본 배열을 그대로 내보낸다')
      .toMatch(/data: toPublicProductRows\(withOnnuri\)/)
  })

  it('선착순 목록 응답도 같은 함수를 거친다', () => {
    expect(fcfsRoute).toMatch(/data: toPublicProductRows\(out\)/)
  })

  it('두 파일이 그 함수를 데모 SSOT 에서 가져온다 — 두 벌 금지', () => {
    for (const [name, code] of [['리스트', listRoute], ['선착순', fcfsRoute]] as const) {
      expect(stripImports(code).includes('function toPublicProductRows'),
        `${name} 라우트가 그 함수를 자기 파일에 다시 구현했다`).toBe(false)
      expect(code, `${name} 라우트가 데모 SSOT 에서 import 하지 않는다`)
        .toMatch(/toPublicProductRows[^\n]*from '@\/shared\/constants\/demo-products'|from '@\/shared\/constants\/demo-products'[^\n]*\n/)
    }
  })
})

describe('③ 상세 응답이 slug 를 싣지 않는다', () => {
  it('PRODUCT_DETAIL_FIELDS 에 slug 가 없다', () => {
    expect((PRODUCT_DETAIL_FIELDS as readonly string[]).includes('slug'),
      'slug 가 되살아나면 데모 상세 HTML 에 `demo-deal-NNN` 이 다시 박힌다').toBe(false)
  })

  it('그래도 목록 SQL 은 slug 를 계속 뽑는다 — 서버가 정렬·판정에 쓴다', () => {
    expect(listRoute, '목록 SQL 에서 slug 를 빼면 서버의 데모 판정이 늘 false 가 된다').toContain('p.slug,')
    expect(feedCache, 'materialized cron 과 라우트의 컬럼이 갈렸다').toContain('p.slug,')
  })
})

describe('④ 소비자 화면에 데모만 다른 문구가 없다', () => {
  it('구매 박스·하단 바에 데모 분기가 0 이다', () => {
    for (const [name, code] of [['DealPurchaseBox', purchaseBox], ['DealBottomBar', bottomBar]] as const) {
      expect(/isDemo/.test(code), `${name} 에 데모 분기가 남았다`).toBe(false)
      expect(/'결제 불가'|'응모 불가'/.test(code), `${name} 에 데모 전용 불가 문구가 남았다`).toBe(false)
    }
  })

  it('두 부품이 같은 구매 동사를 쓴다', () => {
    expect(purchaseBox).toMatch(/ctaLabel = '구매하기'/)
    expect(bottomBar).toMatch(/verb = '구매하기'/)
  })

  it('상세 페이지가 데모 판정을 import 하지 않는다', () => {
    expect(/isDemoSlug/.test(detailPage), '상세가 데모를 알면 라벨 분기가 되살아난다').toBe(false)
  })
})

describe('⑤ 지도 boost 가 중립 이름을 쓰고, 그 판정이 실제로 돈다', () => {
  it('demo 가 아니라 boost 로 제외한다', () => {
    expect(/\.demo\b|is_demo/.test(mapPage), '지도가 아직 데모 플래그를 읽는다').toBe(false)
    expect(mapPage, '상위노출 제외 판정이 사라졌다').toMatch(/f\.boost !== false/)
  })

  it('그 판정이 정렬에 쓰인다 — 계산만 하고 버리면 데모가 위로 올라온다', () => {
    expect(mapPage).toMatch(/sort\(\(a, b\) => boostRank\(b\.id\) - boostRank\(a\.id\)\)/)
  })
})

describe('⑥ 반대 방향 — 티를 지우려다 정책을 지우지 않는다', () => {
  it('서버 데모-후순위 정렬이 살아 있다 (대표 2026-07-04)', () => {
    expect(listRoute, 'DEMO_LAST 정렬이 사라졌다').toMatch(/const DEMO_LAST = `\(CASE WHEN \$\{demoSlugSql\('p'\)\}/)
    expect(listRoute, 'orderBy 가 DEMO_LAST 를 안 쓴다').toMatch(/orderBy = `\$\{DEMO_LAST\}/)
    expect(feedCache, 'materialized cron 의 데모-후순위 정렬이 사라졌다').toMatch(/LIKE 'demo-%' THEN 1 ELSE 0 END\)/)
  })

  it('선착순 목록도 데모를 뒤로 보낸다', () => {
    expect(fcfsRoute).toMatch(/ORDER BY is_demo/)
  })

  it('서버 데모 판정 SSOT 가 그대로 동작한다', () => {
    expect(isDemoSlug(`${DEMO_SLUG_PREFIX}deal-1`)).toBe(true)
    expect(isDemoSlug(null)).toBe(false)
    expect(isDemoSlug('cheese-pork-cutlet')).toBe(false)
  })
})

describe('⑦ 읽기 하한 — 0건이면 통과가 아니라 실패', () => {
  it('검사 대상 소스가 전부 실재한다', () => {
    for (const [name, code] of [
      ['리스트 라우트', listRoute], ['선착순 라우트', fcfsRoute], ['feed-cache', feedCache],
      ['구매 박스', purchaseBox], ['하단 바', bottomBar], ['상세', detailPage], ['지도', mapPage],
    ] as const) {
      expect(code.length, `${name} 소스를 못 읽었다 — 경로가 낡았다`).toBeGreaterThan(400)
    }
  })
})
