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
