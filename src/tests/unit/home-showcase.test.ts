import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  BANNER_SLOTS, NEW_BANNER_SLOT, parseBannerSlot, isBannerSlot,
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
  it('🔴 자리 미지정은 null 이다 — 기본 자리로 승격되지 않는다', () => {
    // 2026-08-04 실사고: `banner_type DEFAULT 'inline'` 이라 SQLite 가 **기존 행에도**
    // 그 값을 채웠고, 예전에 올린 배너가 홈 중간 배너 자리에 저절로 나타났다.
    expect(parseBannerSlot(null)).toBeNull()
    expect(parseBannerSlot(undefined)).toBeNull()
    expect(parseBannerSlot('')).toBeNull()
    expect(parseBannerSlot('HERO')).toBeNull()
    expect(parseBannerSlot('inline')).toBe('inline')
    expect(isBannerSlot('wide')).toBe(true)
    expect(isBannerSlot('banner')).toBe(false)
  })

  it('새 배너의 초기 선택은 히어로가 아니다 (실수로 최상단을 덮지 않게)', () => {
    expect(NEW_BANNER_SLOT).not.toBe('hero')
    expect(BANNER_SLOTS).toContain(NEW_BANNER_SLOT)
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
  it('중간·와이드 배너는 데이터 0건이면 null 을 반환한다 (대표 확정 규칙)', () => {
    expect(code('src/components/home/HomeBannerStrip.tsx')).toMatch(/banners\.length\s*===\s*0\s*\)\s*return\s+null/)
  })

  it('히어로는 배너가 없으면 **브랜드 기본 배경**을 그린다 (2026-08-04 대표 지시)', () => {
    // ⚠️ 히어로만 예외다. "배너 안 올리면 안 보이게" 는 **배너 콘텐츠** 규칙이고,
    //    히어로 자리 자체는 화면 뼈대라 대표가 직접 기본 배경을 요구했다.
    expect(code('src/components/home/HomeHeroBanner.tsx')).toMatch(/if\s*\(\s*!hero\s*\)\s*return\s+<HomeHeroDefault\s*\/>/)
  })

  it('기본 히어로는 영상·이미지 파일을 요청하지 않는다 (첫 화면 무게 0)', () => {
    // 홈 최상단에 수 MB 를 얹으면 이 레포가 로딩에 들인 노력을 한 번에 되돌린다.
    const def = code('src/components/home/HomeHeroDefault.tsx')
    expect(def).not.toMatch(/<video|<img|url\(https?:/)
  })

  it('기본 히어로가 장식으로 끝나지 않는다 — 실제 검색 진입점을 갖는다', () => {
    expect(code('src/components/home/HomeHeroDefault.tsx')).toMatch(/\/search\?q=/)
  })

  it('기본 히어로 배경 애니메이션이 prefers-reduced-motion 을 존중한다', () => {
    const css = read('src/index.css')
    const block = css.slice(css.indexOf('ur-hero-bloom-a'))
    expect(block).toMatch(/prefers-reduced-motion[\s\S]{0,400}ur-hero-bloom-a/)
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
    // 🔄 2026-08-19 갱신: 섹션이 자체 카드를 갖고 있던 구조가 **피드 카드 재사용**으로 바뀌었다
    //   (대표 신고 "섹션 카드와 동네딜 카드가 다르네"). 그래서 이 파일에는 링크 생성 코드가 없고,
    //   목적지 판정은 그 카드가 한다 — 검사 대상도 함께 옮긴다. 불변식 자체는 그대로:
    //   **홈 섹션 카드의 목적지는 손으로 찍지 않는다.**
    const src = code('src/components/home/HomeSections.tsx')
    const card = code('src/pages/main-home/GroupBuyFeedCard.tsx')
    expect(card).toMatch(/canonicalDetailPath\(/)
    // 손으로 찍은 삼항(`? '/vouchers/..' : '/group-buy/..'`)이 되살아나면 숙소가 틀린 상세로 간다.
    expect(src).not.toMatch(/\?\s*`\/vouchers\//)
    expect(card).not.toMatch(/\?\s*`\/vouchers\//)
    // 섹션이 다시 자기 카드를 만들면(=두 카드가 갈리면) 여기서 걸린다.
    // ⚠️ **`import` 줄이 아니라 렌더(JSX)를 본다.** 처음엔 `/GroupBuyFeedCard/` 로 썼다가
    //    카드를 `<div>` 로 바꿔도 초록이 뜨는 걸 되돌려-검증에서 잡았다 — import 는 남으니까.
    expect(src, '홈 섹션은 피드와 같은 카드를 렌더해야 한다').toMatch(/<GroupBuyFeedCard\b/)
  })

  it('판정에 필요한 컬럼(deal_only·category)을 SELECT 가 싣는다', () => {
    // 화면에 안 쓰이는 컬럼이라 "정리" 하다 빠지기 쉽다 — 빠지면 교환권이 이용권 상세로 간다.
    const rules = code('src/features/sections/api/section-rules.ts')
    expect(rules).toMatch(/p\.deal_only/)
    expect(rules).toMatch(/p\.category,/)
  })
})

describe('⑥ 옛 배너가 저절로 뜨지 않는다 · 자리 필터', () => {
  const src = code('src/features/banners/api/banners.routes.ts')

  it('🔴 자리 컬럼 ALTER 에 DEFAULT 가 없다 (기존 행이 자리를 얻으면 안 된다)', () => {
    // SQLite 는 ADD COLUMN 의 DEFAULT 를 **기존 행에도** 적용한다 — 그래서 기본값을 주면
    // 예전에 올린 배너가 전부 그 자리를 차지한 것으로 읽힌다(2026-08-04 라이브 사고).
    expect(src).toMatch(/ADD COLUMN banner_slot TEXT`/)
    expect(src).not.toMatch(/ADD COLUMN banner_slot TEXT DEFAULT/)
  })

  it('🔴 자리 필터가 엄격 일치다 (COALESCE 로 기본값을 씌우지 않는다)', () => {
    expect(src).toMatch(/AND banner_slot = \?/)
    expect(src).not.toMatch(/COALESCE\(banner_slot/)
  })

  it('클라이언트도 미지정을 기본 자리로 승격시키지 않는다', () => {
    const hook = code('src/components/home/useHomeBanners.ts')
    expect(hook).toMatch(/parseBannerSlot\(b\.banner_slot\)/)
    expect(hook).toMatch(/banner_slot === slot/)
  })

  it('type 쿼리 파라미터는 화이트리스트를 통과한 값만 쓴다', () => {
    expect(src).toMatch(/isBannerSlot\(slotRaw\)/)
  })

  it('컬럼 ALTER 는 요청마다가 아니라 WeakSet 메모이즈 뒤에 있다 (per-request DDL 금지)', () => {
    expect(src).toMatch(/WeakSet<D1Database>/)
    expect(src).toMatch(/_bannerColsReady\.has\(DB\)/)
  })

  it('어드민 저장 경로도 같은 ensureBannerColumns 를 쓰고, 미지정을 null 로 저장한다', () => {
    const admin = code('src/features/admin/api/admin-banners.routes.ts')
    expect(admin).toMatch(/ensureBannerColumns/)
    expect(admin).toMatch(/parseBannerSlot\(banner_slot\)/)
  })

  it('배너 1~2장이면 3열 그리드에 홀로 서지 않는다', () => {
    // 대표 신고 화면: 1장이 3열 그리드의 1/3 폭에 들어가 가로로 긴 이미지가 잘렸다.
    const strip = code('src/components/home/HomeBannerStrip.tsx')
    expect(strip).toMatch(/banners\.length === 1 \? 'grid-cols-1'/)
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
      'banners.banner_slot', 'banners.video_url',
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

describe('⑪ 홈이 기본으로 시안 모양이어야 한다 (2026-08-04 "시안이랑 완전 다르잖아")', () => {
  const seed = code('src/features/sections/api/section-seed.ts')
  const routes = code('src/features/sections/api/sections.routes.ts')

  it('기본 노출 줄이 시드로 존재한다', () => {
    // 기능만 넣고 섹션을 안 만들면 홈은 "틀만 있고 안이 빈" 화면이 된다 — 그게 실제로 났다.
    // ⚠️ '오늘 마감 임박' 은 2026-08-04 대표 지시로 제외("아예 필요없어") — ⑫ 에서 부재를 고정한다.
    for (const t of ['지금 인기 이용권', '주말에 떠나는 숙소']) {
      expect(seed).toContain(t)
    }
  })

  it('시드는 규칙 섹션만 넣는다 (manual 은 담긴 상품이 없어 어차피 홈에서 빠진다)', () => {
    expect(seed).not.toMatch(/source: 'manual'/)
  })

  it('시드가 기존 섹션을 덮지 않는다 (제목이 같으면 건너뛴다)', () => {
    expect(seed).toMatch(/if \(existing\.has\(s\.title\)\) continue/)
    expect(seed).not.toMatch(/\bDELETE FROM homepage_sections\b/)
    // 🚑 2026-08-17 v2 heal 예외: UPDATE 는 **값이 정확히 '/group-buy'(홈 리다이렉트 별칭 — 어떤
    // 의도로도 옳을 수 없는 죽은 링크)인 more_href 정정** 하나만 허용한다. 제목/부제/규칙을 덮는
    // UPDATE 는 여전히 금지 — "대표 편집 보존"이 이 가드의 본질이다. 여기 걸리면 heal 이 아니라
    // 편집 덮어쓰기를 넣은 것이니 시드 철학(주석 상단)을 다시 읽을 것.
    const updates = seed.match(/UPDATE homepage_sections[^`]*/g) ?? []
    expect(updates.length).toBeLessThanOrEqual(1)
    for (const u of updates) {
      expect(u).toMatch(/SET more_href = '[^']*' WHERE more_href = '\/group-buy'/)
    }
  })

  it('시드가 **홈 조회** 경로에서 실행된다 (어드민이 안 열어도 떠야 한다)', () => {
    // ⚠️ "파일 어딘가에 호출이 있다"로는 못 잡는다 — 어드민 목록에도 같은 호출이 있어서
    //    홈 경로에서 빼도 초록이 뜬다(이 테스트를 만들 때 실제로 그랬다).
    //    그래서 **공개 GET 블록 안**에 있는지를 위치로 확인한다.
    const publicStart = routes.indexOf("sectionsRoutes.get('/',")
    const adminStart = routes.indexOf("sectionsRoutes.get('/admin'")
    expect(publicStart).toBeGreaterThan(-1)
    expect(adminStart).toBeGreaterThan(publicStart)
    const publicBlock = routes.slice(publicStart, adminStart)
    expect(publicBlock).toMatch(/maybeSeedHomeSections\(/)
  })
})

describe('⑫ 배너 미디어 업로드 · 시드 조정 (2026-08-04 대표 3·4번)', () => {
  const up = code('src/features/upload/api/upload.routes.ts')
  const comp = code('src/pages/admin/banners/BannerMediaUpload.tsx')
  const page = code('src/pages/AdminBannersPage.tsx')
  const seed = code('src/features/sections/api/section-seed.ts')

  it('영상 업로드는 **어드민 전용** 엔드포인트다', () => {
    // 공용 /upload/image 에 영상 MIME 을 열면 모든 셀러가 영상을 올릴 수 있게 된다.
    expect(up).toMatch(/'\/upload\/banner-video'[\s\S]{0,120}requireAdmin\(\)/)
  })

  it('공용 이미지 업로드에 영상 MIME 이 새어들지 않았다', () => {
    const allowed = up.match(/const ALLOWED_MIME = new Set\(\[[^\]]*\]/)?.[0] ?? ''
    expect(allowed).not.toMatch(/video\//)
  })

  it('영상도 매직바이트로 검증한다 (확장자만 믿지 않는다)', () => {
    expect(up).toMatch(/detectVideoMime/)
    expect(up).toMatch(/0x1a, 0x45, 0xdf, 0xa3|0x1a && bytes\[1\] === 0x45/)
  })

  it('배너 폼이 이미지·영상 **둘 다** 업로더를 쓴다 (URL 수동입력만이면 대표가 못 쓴다)', () => {
    expect(page).toMatch(/<BannerMediaUpload kind="image"/)
    expect(page).toMatch(/<BannerMediaUpload kind="video"/)
  })

  it('업로더가 "저장 눌러야 반영" 을 알린다', () => {
    // 올리고 나가면 URL 만 채워진 채 사라진다 — 그걸 모르면 "왜 안 됐지" 가 된다.
    expect(comp).toMatch(/저장 버튼을 눌러야 반영/)
  })

  it("시드에서 '오늘 마감 임박' 이 빠졌다 (대표 \"아예 필요없어\")", () => {
    expect(seed).not.toMatch(/title: '오늘 마감 임박'/)
    expect(seed).toMatch(/title: '지금 인기 이용권'/)
    expect(seed).toMatch(/title: '주말에 떠나는 숙소'/)
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
