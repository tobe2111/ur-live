import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  BANNER_TYPES, DEFAULT_BANNER_TYPE, normalizeBannerType, isBannerType,
  SECTION_SOURCES, DEFAULT_SECTION_SOURCE, normalizeSectionSource,
  clampSectionLimit, SECTION_DEFAULT_LIMIT, SECTION_MAX_LIMIT,
} from '@/shared/constants/home-showcase'

/**
 * 🏠 홈 쇼케이스(2026-08-04 대표 시안 승인) 불변식.
 *
 * 여기서 고정하는 것은 **배선**이다. 렌더 결과가 아니라 "그 조건이 코드에 실제로 있는가".
 * 이 레포에서 반복해 난 사고가 정확히 그 형태였다 — 컴포넌트는 멀쩡한데 아무도 안 부르거나,
 * 조건 하나가 빠져 조용히 다른 동작을 하거나.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 실제 렌더 결과(빈 배너가 정말 아무 픽셀도 안 그리는지) — JSDOM 렌더 테스트가 아니다.
 * - 서버 쿼리의 실제 결과(D1 이 필요하다). WHERE 조건의 **존재**만 본다.
 * - 어드민에서 저장한 값이 홈까지 오는 end-to-end. 그건 staging 확인 몫이다.
 */

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
/** 블록 주석을 걷어낸 소스 — "주석에만 남아도 통과"를 막는다(2026-07-29 실사고 클래스). */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① SSOT — 자리·소스 종류', () => {
  it('배너 기본 자리는 hero 가 아니다 (옛 배너가 홈 최상단을 덮으면 안 됨)', () => {
    expect(DEFAULT_BANNER_TYPE).not.toBe('hero')
    expect(BANNER_TYPES).toContain(DEFAULT_BANNER_TYPE)
  })

  it('normalizeBannerType 은 모르는 값을 기본값으로 떨어뜨린다', () => {
    expect(normalizeBannerType('hero')).toBe('hero')
    expect(normalizeBannerType('HERO')).toBe(DEFAULT_BANNER_TYPE)
    expect(normalizeBannerType(null)).toBe(DEFAULT_BANNER_TYPE)
    expect(normalizeBannerType(undefined)).toBe(DEFAULT_BANNER_TYPE)
    expect(normalizeBannerType({ toString: () => 'hero' })).toBe(DEFAULT_BANNER_TYPE)
    expect(isBannerType('wide')).toBe(true)
    expect(isBannerType('banner')).toBe(false)
  })

  it('섹션 기본 소스는 manual — 기존 섹션의 동작이 바뀌면 안 된다', () => {
    expect(DEFAULT_SECTION_SOURCE).toBe('manual')
    expect(SECTION_SOURCES[0]).toBe('manual')
    expect(normalizeSectionSource('popular')).toBe('popular')
    expect(normalizeSectionSource('무엇')).toBe('manual')
  })

  it('clampSectionLimit 은 0·음수·비숫자를 기본값으로, 큰 값을 상한으로', () => {
    expect(clampSectionLimit(6)).toBe(6)
    expect(clampSectionLimit(0)).toBe(SECTION_DEFAULT_LIMIT)
    expect(clampSectionLimit(-3)).toBe(SECTION_DEFAULT_LIMIT)
    expect(clampSectionLimit('abc')).toBe(SECTION_DEFAULT_LIMIT)
    expect(clampSectionLimit(undefined)).toBe(SECTION_DEFAULT_LIMIT)
    expect(clampSectionLimit(999)).toBe(SECTION_MAX_LIMIT)
    expect(clampSectionLimit(7.9)).toBe(7)
  })
})

describe('② 대표 확정 — 없으면 아무것도 안 그린다', () => {
  it('히어로/중간·와이드 배너는 데이터 0건이면 null 을 반환한다', () => {
    expect(code('src/components/home/HomeHeroBanner.tsx')).toMatch(/if\s*\(\s*!hero\s*\)\s*return\s+null/)
    expect(code('src/components/home/HomeBannerStrip.tsx')).toMatch(/banners\.length\s*===\s*0\s*\)\s*return\s+null/)
  })

  it('서버가 상품 0건 섹션을 목록에서 뺀다 (홈에 제목만 남는 빈 줄 금지)', () => {
    const src = code('src/features/sections/api/sections.routes.ts')
    expect(src).toMatch(/\.filter\(s\s*=>\s*\(s\.products[^)]*\)\.length\s*>\s*0\)/)
  })

  it('배너/섹션 블록은 세로 여백을 아래(pb)로만 갖는다 — 비었을 때 유령 여백 방지', () => {
    const strip = code('src/components/home/HomeBannerStrip.tsx')
    const sections = code('src/components/home/HomeSections.tsx')
    expect(strip).not.toMatch(/className="pt-/)
    expect(sections).not.toMatch(/<section className="pt-/)
  })
})

describe('③ 되돌리기 — 플래그 하나로 전부 꺼진다', () => {
  it('PcHomePage 의 쇼케이스 렌더는 **하나도 빠짐없이** 플래그 블록 안에 있다', () => {
    const page = code('src/pages/pc-home/PcHomePage.tsx')

    // ⚠️ "플래그가 파일 어딘가에 있다"로는 못 잡는다 — import 줄이 늘 먼저 나와서
    //    게이트를 통째로 지워도 초록이 뜬다(이 테스트를 만들 때 실제로 그랬다).
    //    그래서 게이트 **블록의 범위**를 중괄호로 실제 계산해 렌더 위치를 대조한다.
    const gated: Array<[number, number]> = []
    for (let i = page.indexOf('HOME_SHOWCASE_ENABLED &&'); i > -1; i = page.indexOf('HOME_SHOWCASE_ENABLED &&', i + 1)) {
      const open = page.lastIndexOf('{', i)
      if (open < 0) continue
      let depth = 0
      for (let j = open; j < page.length; j++) {
        if (page[j] === '{') depth++
        else if (page[j] === '}' && --depth === 0) { gated.push([open, j]); break }
      }
    }
    expect(gated.length).toBeGreaterThan(0)

    const renders: number[] = []
    for (const comp of ['HomeHeroBanner', 'HomeSections', 'HomeBannerStrip']) {
      const re = new RegExp(`<${comp}\\b`, 'g')
      for (let m = re.exec(page); m; m = re.exec(page)) renders.push(m.index)
    }
    expect(renders.length).toBeGreaterThanOrEqual(3) // 세 컴포넌트가 실제로 배선돼 있을 것

    const ungated = renders.filter(i => !gated.some(([a, b]) => i > a && i < b))
    expect(ungated).toEqual([])
  })

  it('플래그가 feature-flags SSOT 에 있다', () => {
    expect(code('src/shared/feature-flags.ts')).toMatch(/export const HOME_SHOWCASE_ENABLED\s*=/)
  })
})

describe('④ 상품 선정 — 홈 피드와 같은 조건 + 몰 격리', () => {
  const rules = code('src/features/sections/api/section-rules.ts')

  it('규칙 쿼리에 본진 몰 격리(mainScopeFor)가 있다', () => {
    expect(rules).toMatch(/mainScopeFor\(\s*env\.DB\s*,\s*'products'/)
    expect(rules).toMatch(/\$\{productScope\}/)
  })

  it('규칙 쿼리 WHERE 가 홈 피드 조건을 그대로 쓴다', () => {
    expect(rules).toMatch(/p\.is_active\s*=\s*1/)
    expect(rules).toMatch(/p\.group_buy_status\s*=\s*'active'/)
    expect(rules).toMatch(/is_supply_product/)
    expect(rules).toMatch(/p\.category IN/)
  })

  it('수동 섹션 쿼리에도 몰 격리가 있다', () => {
    const routes = code('src/features/sections/api/sections.routes.ts')
    expect(routes).toMatch(/mainScopeFor\(\s*DB\s*,\s*'products'\s*,\s*'p'\s*\)/)
    expect(routes).toMatch(/\$\{productScope\}/)
  })

  it('ORDER BY 는 화이트리스트에서만 온다 — source 문자열이 SQL 에 직접 안 들어간다', () => {
    // `${q.source}` 나 `${source}` 가 쿼리 템플릿에 끼면 즉시 위반.
    expect(rules).not.toMatch(/ORDER BY[^`]*\$\{\s*(q\.)?source\s*\}/)
    expect(rules).toMatch(/RULES\[source\]/)
  })
})

describe('⑤ 카드 링크는 canonicalDetailPath SSOT — 손으로 찍지 않는다', () => {
  it('카드가 SSOT 로 목적지를 정한다 (하드코딩 분기 금지)', () => {
    const src = code('src/components/home/HomeSections.tsx')
    expect(src).toMatch(/canonicalDetailPath\(/)
    // 손으로 찍은 삼항(`? '/vouchers/..' : '/group-buy/..'`)이 되살아나면 숙소가 틀린 상세로 간다.
    expect(src).not.toMatch(/\?\s*`\/vouchers\//)
  })

  it('판정에 필요한 컬럼(deal_only·category)을 SELECT 가 싣는다', () => {
    // 화면에 안 쓰이는 컬럼이라 "정리" 하다 빠지기 쉽다 — 빠지면 교환권이 이용권 상세로 간다.
    const rules = code('src/features/sections/api/section-rules.ts')
    expect(rules).toMatch(/p\.deal_only/)
    expect(rules).toMatch(/p\.category,/)
  })
})

describe('⑥ 옛 배너 보호 · 자리 필터', () => {
  const src = code('src/features/banners/api/banners.routes.ts')

  it('banner_type 조회가 COALESCE 로 NULL(옛 배너)을 기본값으로 읽는다', () => {
    expect(src).toMatch(/COALESCE\(banner_type,\s*\?\)/)
  })

  it('type 쿼리 파라미터는 화이트리스트를 통과한 값만 쓴다', () => {
    expect(src).toMatch(/isBannerType\(typeRaw\)/)
  })

  it('컬럼 ALTER 는 요청마다가 아니라 WeakSet 메모이즈 뒤에 있다 (per-request DDL 금지)', () => {
    expect(src).toMatch(/WeakSet<D1Database>/)
    expect(src).toMatch(/_bannerColsReady\.has\(DB\)/)
  })

  it('어드민 저장 경로도 같은 ensureBannerColumns 를 쓴다 (한쪽만 ALTER 되는 사고 방지)', () => {
    const admin = code('src/features/admin/api/admin-banners.routes.ts')
    expect(admin).toMatch(/ensureBannerColumns/)
    expect(admin).toMatch(/normalizeBannerType\(banner_type\)/)
  })

  it('영상 URL 도 이미지와 같은 URL 검증을 탄다', () => {
    const admin = code('src/features/admin/api/admin-banners.routes.ts')
    expect(admin).toMatch(/validateImageUrl\(video_url\)/)
  })
})

describe('⑦ 어드민 도달성 — 만들 수 있어야 존재한다', () => {
  it('홈 섹션 관리 페이지가 라우트와 nav 양쪽에 있다', () => {
    expect(code('src/routes/admin.routes.tsx')).toMatch(/path="\/admin\/home-sections"/)
    expect(code('src/components/admin/admin-nav-config.ts')).toMatch(/'\/admin\/home-sections'/)
  })

  it('새 컬럼이 정비 레인(repair-schema)에도 등재돼 있다', () => {
    const repair = code('src/worker/routes/repair-schema.routes.ts')
    for (const name of [
      'banners.banner_type', 'banners.video_url',
      'homepage_sections.source', 'homepage_sections.limit_count', 'homepage_sections.more_href',
    ]) {
      expect(repair).toContain(name)
    }
  })

  it('비공개 어드민 경로라 robots 가 이미 /admin 을 막고 있다', () => {
    expect(read('public/robots.txt')).toMatch(/Disallow:\s*\/admin/)
  })
})

describe('⑨ 어드민 편집 — 직접 고르기 · 순서 변경 (2026-08-04 대표 요청)', () => {
  const page = code('src/pages/admin/AdminHomeSectionsPage.tsx')
  const picker = code('src/pages/admin/home-sections/SectionProductPicker.tsx')
  const routes = code('src/features/sections/api/sections.routes.ts')

  it('직접 고르기(manual) 섹션에만 상품 담기 버튼이 뜬다', () => {
    // 규칙 섹션은 서버가 채우므로 담기 버튼이 뜨면 안 된다(눌러도 반영이 안 돼 혼란만 준다).
    expect(page).toMatch(/src === 'manual' &&[\s\S]{0,400}상품 담기/)
  })

  it('담긴 상품 0건인 manual 섹션은 "홈 미노출" 로 표시된다', () => {
    // 서버가 빈 줄을 빼는 건 옳지만, 어드민이 그 이유를 모르면 고장으로 읽는다.
    expect(page).toMatch(/홈 미노출/)
  })

  it('피커가 순서를 바꾸고 그 순서대로 저장한다 (배열 순서 = 홈 순서)', () => {
    expect(picker).toMatch(/product_ids: picked\.map\(p => p\.id\)/)
    expect(picker).toMatch(/\[next\[i\], next\[j\]\] = \[next\[j\]!, next\[i\]!\]/)
  })

  it('피커가 상한(SECTION_MAX_LIMIT)을 넘겨 담지 못하게 막는다', () => {
    expect(picker).toMatch(/picked\.length >= SECTION_MAX_LIMIT/)
  })

  it('피커가 조회 실패와 "결과 0건" 을 구분한다', () => {
    // 둘 다 빈 목록으로 보이면 원인을 못 찾는다(check-query-iserror 와 같은 이유).
    expect(picker).toMatch(/isError/)
  })

  it('섹션 순서 변경이 배열 순서를 그대로 서버로 보낸다', () => {
    expect(page).toMatch(/api\.post\('\/api\/sections\/reorder', \{ section_ids: next\.map\(s => s\.id\) \}\)/)
  })

  it('모든 변경(생성·수정·삭제·상품·순서)이 공개 홈 캐시를 비운다', () => {
    // 안 비우면 최대 120초 동안 "바꿨는데 홈에 없다" 가 되고 그건 고장과 구분되지 않는다.
    const calls = routes.match(/invalidateSectionsCache\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(7) // 정의 1 + 호출 6
  })
})

describe('⑩ 섹션 수정 — 만든 뒤에 고칠 수 있어야 한다 (2026-08-04 "없는 것도 다")', () => {
  const page = code('src/pages/admin/AdminHomeSectionsPage.tsx')
  const form = code('src/pages/admin/home-sections/SectionForm.tsx')

  it('생성과 수정이 같은 폼 컴포넌트를 쓴다', () => {
    // 두 벌로 두면 한쪽에만 필드가 추가돼 "만들 땐 되는데 고칠 땐 안 되는" 필드가 생긴다.
    const uses = page.match(/<SectionForm\b/g) ?? []
    expect(uses.length).toBe(2)
    expect(page).toMatch(/mode="create"/)
    expect(page).toMatch(/mode="edit"/)
  })

  it('생성과 수정이 같은 payload 빌더를 쓴다', () => {
    const calls = page.match(/toPayload\(v\)/g) ?? []
    expect(calls.length).toBe(2)
    expect(page).toMatch(/api\.put\(`\/api\/sections\/\$\{editing\.id\}`, toPayload\(v\)\)/)
  })

  it('수정 폼이 서버 값으로 채워진다 (빈 폼으로 열려 기존 설정을 날리지 않게)', () => {
    expect(page).toMatch(/initial=\{toFormValue\(editing\)\}/)
    expect(page).toMatch(/source: \(s\.source \|\| DEFAULT_SECTION_SOURCE\)/)
  })

  it('쓰이지 않는 layout 필드는 폼에 노출하지 않는다', () => {
    // DB 컬럼은 있지만 홈 렌더가 안 쓴다 — 고를 수는 있는데 아무 일도 안 일어나는 스위치는
    // 없는 것보다 나쁘다. 홈이 layout 을 실제로 쓰게 되면 그때 폼에 추가할 것.
    expect(form).not.toMatch(/name="layout"|form\.layout/)
  })
})

describe('⑧ 청크 — 홈 쇼케이스가 크리티컬 패스에 들어가지 않는다', () => {
  it('components/home 은 eager 청크(app-layout) 규칙에 걸리지 않는다', () => {
    // 2026-08-03 에 RegionLinkGrid 를 components/main/ 에 뒀다가 app-constants 를
    // 크리티컬 패스로 끌고 들어간 사고의 재발 방지.
    const vite = read('vite.config.ts')
    expect(vite).toMatch(/\/src\/components\/main\/'\)\)\s*return\s*'app-layout'/)
    expect(vite).not.toMatch(/\/src\/components\/home\/'\)\)\s*return\s*'app-layout'/)
    const baseline = JSON.parse(read('scripts/critical-chunks-baseline.json'))
    expect(baseline.chunks).not.toContain('app-components')
  })
})
