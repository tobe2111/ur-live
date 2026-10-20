import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseGbAdminScope } from '@/features/group-buy/api/group-buy-admin.routes'
import { NAV_GROUPS, navSectionOf, NAV_SECTIONS } from '@/components/admin/admin-nav-config'

/**
 * 🧭 **어드민이 네 서비스를 구분한다** — 2026-08-14
 *   (대표 *"어드민 대시보드들 페이지 구분을 잘 해야겠어 이미 공동구매로 되어있는 것들이 있던데"*)
 *
 * 실측이었던 것:
 *   - 🏪 공구 서비스(운영자 몰) 전용 어드민은 **페이지 1개**였고, 그것이 **유어딜 그룹 안에** 있었다.
 *   - 그 그룹의 첫 항목 라벨이 하필 **'공동구매'**(유어딜 이용권)라 화면만 보고는 구분이 불가능했다.
 *   - 더 나쁜 쪽: 어드민 공구 목록·**GMV 집계**에 몰 조건이 **없어서**, 운영자 가게 상품과 매출이
 *     **유어딜 실적으로 섞여** 들어왔다(소비자 경로엔 `mainScopeFor` 가 있는데 어드민은 0건이었다).
 *
 * ⚠️ **이 파일이 못 막는 것**: 라이브 DB 에 이미 섞여 저장된 값(코드가 아니라 데이터다).
 *   그리고 다른 어드민 화면(상품·주문·통계)의 같은 누수 — 그건 아직 안 고쳤고, 인계에 적었다.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const ADMIN_GB = 'src/features/group-buy/api/group-buy-admin.routes.ts'

describe('스코프 파서 — 모르면 자기 것만 본다', () => {
  it('기본값은 본진(main) — 남의 가게 상품을 유어딜 실적으로 오독하지 않는다', () => {
    for (const bad of [undefined, null, '', '   ', 'MAIN', 'wat', '1', 0]) {
      expect(parseGbAdminScope(bad)).toBe('main')
    }
  })
  it('명시한 값만 받는다', () => {
    expect(parseGbAdminScope('mall')).toBe('mall')
    expect(parseGbAdminScope('all')).toBe('all')
    expect(parseGbAdminScope(' MALL ')).toBe('mall')   // 공백·대문자는 정규화
  })
})

describe('어드민 공구 조회 — 두 서비스가 섞이지 않는다', () => {
  const src = read(ADMIN_GB)

  it('🔴 목록·집계가 **같은 SSOT** 로 스코프를 만든다 (손으로 쓴 조건 금지)', () => {
    expect(/mainScopeFor\(/.test(src)).toBe(true)
    // 손으로 `mall_id = 1` 을 쓰기 시작하면 소비자 경로와 갈리고, 갈리면 한쪽만 샌다.
    expect(/mall_id\s*(?:=|,|:)\s*[12]\b/.test(src)).toBe(false)
  })

  it('🔴 목록 쿼리에 스코프 조각이 실제로 들어간다', () => {
    const fn = src.slice(src.indexOf("groupBuyAdminRoutes.get('/list'"))
    expect(/\$\{scopeSql\}/.test(fn.slice(0, 2000))).toBe(true)
  })

  it('🔴 **집계(GMV)** 도 스코프를 탄다 — 목록만 고치면 실적이 계속 섞인다', () => {
    const fn = src.slice(src.indexOf("groupBuyAdminRoutes.get('/analytics'"), src.indexOf("groupBuyAdminRoutes.get('/list'"))
    // 카테고리별·top·합계·일별 — 네 쿼리 전부.
    const hits = (fn.match(/\$\{scope(?:P|Bare)\}/g) ?? []).length
    expect(hits, '집계 쿼리 중 스코프가 안 걸린 것이 있다').toBeGreaterThanOrEqual(3)
    expect(/EXISTS \(SELECT 1 FROM order_items/.test(fn), '일별 추이(주문 기반)에 스코프 없음').toBe(true)
  })

  it('행이 어느 가게 것인지 실어 보낸다 — 전체로 볼 때 구분 근거', () => {
    const fn = src.slice(src.indexOf("groupBuyAdminRoutes.get('/list'"))
    expect(/m\.slug AS mall_slug/.test(fn.slice(0, 2000))).toBe(true)
    // 도매몰이 소비자 어드민 목록에 가게로 뜨면 서비스 분리가 깨진다.
    expect(/wholesale_malls m ON m\.id = p\.mall_id AND COALESCE\(m\.consumer_path, 0\) = 1/.test(fn.slice(0, 2000))).toBe(true)
  })
})

/**
 * 🧭 2026-08-16 (대표 *"모두 다 해줘"*) — 위에서 막은 건 **공구 목록·GMV 두 곳뿐**이었다.
 *   나머지 어드민 화면은 `mall_id` 를 한 번도 안 봐서 운영자 가게 상품·매출이 계속 섞였다.
 *
 * ⚠️ 이번에 **인계 문서가 틀렸다는 것도 확인**했다: §17 이 `/admin/deals` 를 "같은 클래스"로
 *   적었지만 그 화면은 **딜포인트(`user_points`) 모니터링**이고 상품과 무관하다. 문서를 믿고
 *   조건을 넣었으면 아무 의미 없는 스코프가 생길 뻔했다 — 그래서 여기서 세는 대상은 3곳이다.
 */
describe('어드민 몰 스코프 — 유어딜 숫자에 남의 가게가 안 섞인다', () => {
  const PRODUCTS = 'src/features/admin/api/admin-products.routes.ts'
  // 🧭 2026-08-16: 탭·카테고리 카운트는 god 파일 래칫 때문에 여기로 추출됐다. 가드도 따라간다
  //   (안 따라가면 "그 파일에 그 문자열이 없다"로 조용히 빨강이 되거나, 더 나쁘게는 낡은 지도가 된다).
  const COUNTS = 'src/features/admin/api/admin-products-counts.ts'
  const STATS = 'src/features/admin/api/admin-stats.routes.ts'
  const COCKPIT = 'src/features/group-buy/api/gb-cockpit.routes.ts'
  const SCOPE = 'src/worker/utils/admin-mall-scope.ts'

  it('🔴 조각을 만드는 곳이 **하나**다 — 화면마다 손으로 쓰면 갈라진다', () => {
    for (const f of [PRODUCTS, STATS, COCKPIT]) {
      expect(/from '[^']*admin-mall-scope'/.test(read(f)), `${f} 가 스코프 SSOT 를 안 쓴다`).toBe(true)
      // 손으로 쓴 삼항(`scope === 'main' ? … : 'mall' ?`)이 다시 생기면 SSOT 가 무의미해진다.
      expect(/scope === 'mall' \? ` AND NOT/.test(read(f)), `${f} 에 손으로 쓴 조건`).toBe(false)
    }
  })

  it('🔴 상품 목록·탭 카운트·카테고리 카운트가 **전부** 스코프를 탄다', () => {
    const src = read(PRODUCTS)
    // 목록만 걸고 카운트를 빼먹으면 "0건인데 탭엔 120" 처럼 화면이 자기모순을 일으킨다.
    //
    // 🐛 **되돌려-검증이 이 검사의 첫 판을 깨뜨렸다.** 원래 `whereClause = where.length[\s\S]{0,120}${scopeP}`
    //   였는데, 목록 분기에서 스코프를 빼도 **else 분기에 남은 `${scopeP}`** 가 120자 안에 들어와
    //   초록이 떴다. 느슨한 근접 매칭은 "어딘가에 그 이름이 있다"만 확인한다 — 이 레포가 반복해
    //   당한 클래스다. ⇒ **두 분기 각각에** 앵커한다.
    expect(/`WHERE \$\{where\.join\(' AND '\)\}\$\{scopeP\}`/.test(src), '필터 있는 목록').toBe(true)
    expect(/scopeP \? `WHERE 1=1\$\{scopeP\}`/.test(src), '필터 없는 목록').toBe(true)
    // 🔴 라우트가 카운트 모듈에 스코프를 **실제로 넘기는지**까지 본다 — 모듈만 옳고 인자가 빠지면
    //   그 모듈은 아무것도 안 거른다(추출이 만든 새 실패 지점이다).
    expect(/fetchProductCounts\(DB, source, scopeBare\)/.test(src), '카운트에 스코프 전달').toBe(true)
    const counts = read(COUNTS)
    expect(/`WHERE \$\{tabWhere\.join\(' AND '\)\}\$\{scopeBare\}`/.test(counts), '탭 카운트').toBe(true)
    expect(/scopeBare \? `WHERE 1=1\$\{scopeBare\}`/.test(counts), '탭 카운트(무필터)').toBe(true)
  })

  it('🔴 카테고리 카운트의 `OR` 이 괄호로 묶여 있다 — 연산자 우선순위 누수', () => {
    // `WHERE a=1 OR a=0 AND mall=1` 은 AND 가 먼저 묶여 **스코프가 절반에만** 걸린다.
    // 에러가 없고 숫자만 조용히 틀리는 종류라 눈으로는 못 잡는다.
    expect(/WHERE \(is_active = 1 OR is_active = 0\)\$\{scopeBare\}/.test(read(COUNTS))).toBe(true)
  })

  it('🔴 대시보드 오늘 매출·주문수가 스코프를 탄다 (대표가 매일 보는 숫자)', () => {
    const src = read(STATS)
    expect(/SUM\(o\.total_amount\)[\s\S]{0,160}\$\{orderScope\}/.test(src), '오늘 매출').toBe(true)
    expect(/COUNT\(\*\) as count FROM orders o[\s\S]{0,80}\$\{orderScope\}/.test(src), '오늘 주문수').toBe(true)
  })

  it('🔴 주문 스코프는 **EXISTS** 다 — JOIN 이면 품목 수만큼 매출이 부푼다', () => {
    const src = read(SCOPE)
    const fn = src.slice(src.indexOf('export async function orderScopeSql'))
    expect(/EXISTS \(SELECT 1 FROM order_items/.test(fn)).toBe(true)
    // 🔎 "JOIN 을 안 쓴다"를 부정문으로 적으면 **아무 일도 안 하는 검사**가 된다(그렇게 쓸 리가 없다).
    //   대신 이 조각을 실제로 소비하는 쪽이 `orders o` 단일 테이블임을 고정한다 — 조각이 JOIN 으로
    //   바뀌면 여기 붙는 SQL 이 깨지므로 이게 진짜 제약이다.
    expect(/FROM orders o WHERE[\s\S]{0,120}\$\{orderScope\}/.test(read(STATS))).toBe(true)
  })

  it('🔴 공구 엔진 조종석 검색이 남의 가게 상품을 안 잡는다', () => {
    // 잡히면 유어딜 어드민이 남의 가게 **공구가**를 바꾸게 된다(같은 resolveGbPricing 을 탄다).
    const src = read(COCKPIT)
    expect((src.match(/\$\{scopeSql\}/g) ?? []).length, '검색/무검색 두 쿼리 모두').toBeGreaterThanOrEqual(2)
  })

  it('`mall` 은 본진의 **여집합**으로 파생된다 — 따로 쓰면 갈라진다', () => {
    const src = read(SCOPE)
    expect(/AND NOT \(1=1\$\{main\}\)/.test(src)).toBe(true)
  })
})

describe('어드민 nav — 서비스가 넷이면 밴드도 넷', () => {
  it('🔴 공구 서비스가 **자기 밴드**를 갖는다 (유어딜 서랍에 세 들지 않는다)', () => {
    const g = NAV_GROUPS.find((x) => x.title.includes('공구 서비스'))
    expect(g, '공구 서비스 그룹이 없다').toBeTruthy()
    expect(navSectionOf(g!)).toBe('mall')
    expect(NAV_SECTIONS.some((s) => s.key === 'mall')).toBe(true)
  })

  it('🔴 운영자 몰 관리가 유어딜 그룹에 남아 있지 않다', () => {
    const urdeal = NAV_GROUPS.filter((g) => navSectionOf(g) === 'urdeal')
    for (const g of urdeal) {
      expect(g.items.some((i) => i.path === '/admin/wholesale-malls'), `${g.title} 에 몰 관리가 남아 있다`).toBe(false)
    }
    const mall = NAV_GROUPS.find((g) => navSectionOf(g) === 'mall')!
    expect(mall.items.some((i) => i.path === '/admin/wholesale-malls')).toBe(true)
  })

  it('🔴 유어딜 항목 라벨이 **공동구매** 로 불리지 않는다 — 그 이름은 다른 서비스와 겹친다', () => {
    // 대표가 화면만 보고 "이건 어느 쪽이야?" 를 묻게 만든 바로 그 라벨이다.
    for (const g of NAV_GROUPS.filter((x) => navSectionOf(x) === 'urdeal')) {
      for (const it of g.items) expect(it.label, `${it.path}`).not.toBe('공동구매')
    }
  })

  it('밴드 순서가 정의돼 있다 — 유어딜 다음에 공구 서비스', () => {
    const keys = NAV_SECTIONS.map((s) => s.key)
    expect(keys.indexOf('mall')).toBeGreaterThan(keys.indexOf('urdeal'))
    expect(keys.indexOf('mall')).toBeLessThan(keys.indexOf('wholesale'))
  })
})
