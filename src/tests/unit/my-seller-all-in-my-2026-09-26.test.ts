/**
 * 🏪 마이에서 전부 + 청크 다이어트 — 계약 가드 (2026-09-26)
 *   대표: *"모두 다 마이로 가능하게끔 하고 최적화 필요해. 로딩 속도를 줄이고"*
 *   시안: `docs/design/my-seller-all-in-my-2026-09-26.md`
 *
 * ## 이 파일이 지키는 것
 * 1. **비셀러가 판매 코드를 안 받는다** — 게이트가 `lazy` **바깥**에 있어야 한다.
 * 2. **시트는 전부 열 때 받는다** — 정적 import 가 하나라도 돌아오면 마이 청크가 다시 커진다.
 * 3. **41개 화면이 복제 없이 열린다** — `SellerLayout` 이 컨텍스트를 읽는 배선.
 * 4. **지도가 낡지 않는다** — 나브 색인의 모든 경로가 지도 ∪ 제외목록 안에.
 *
 * ## 이 파일이 **못** 지키는 것 (정직하게)
 * - 시트가 실제로 **열리는지**는 셀러 로그인이 필요해 여기서 못 잰다(staging).
 * - 청크가 실제로 갈렸는지는 **빌드 산출물**을 봐야 한다 — 여기서는 갈리게 만드는
 *   *조건*(정적 import 부재 · 규칙 존재)만 본다. 실측은 `check-critical-chunks` 와
 *   PR 본문의 폐쇄 측정이 맡는다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'
import { SELLER_TAB_GROUPS } from '@/components/seller/seller-tab-groups'
import { NAV_GROUPS, SELLER_SEARCH_ONLY } from '@/components/seller/seller-nav'
import { TOOL_PAGES, FULL_SCREEN_ONLY, canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'

const LAZY_GATE = 'src/pages/user-profile/SellerSectionLazy.tsx'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const LAYOUT = 'src/components/SellerLayout.tsx'
const EMBED = 'src/shared/seller-embed.tsx'
const TOOL_SHEET = 'src/pages/user-profile/seller-section/ToolPageSheet.tsx'
const ALL_TOOLS = 'src/pages/user-profile/seller-section/AllToolsSheet.tsx'
const VITE = 'vite.config.ts'

describe('① 비셀러는 판매 코드를 받지 않는다', () => {
  it('게이트가 lazy 바깥이다 — 좌석 0곳이면 렌더 자체를 안 한다', () => {
    const code = readCode(LAZY_GATE)
    // `React.lazy` 는 **렌더될 때** 받는다. 조건 없이 <Suspense><Lazy/></Suspense> 를 두면
    // 안에서 null 을 돌려줘도 이미 청크를 받은 뒤다.
    expect(code, '좌석 0곳 조기 반환이 사라지면 비셀러가 판매 청크를 받는다')
      .toMatch(/state\.stores\.length === 0\)\s*return null/)
    // 조기 반환이 <Suspense> 보다 먼저 와야 한다(순서가 곧 의미다).
    expect(code.indexOf('return null')).toBeLessThan(code.indexOf('<Suspense'))
  })

  it('UserProfilePage 는 판매 섹션을 게이트를 통해서만 부른다', () => {
    const code = readCode('src/pages/UserProfilePage.tsx')
    expect(code).toContain("from './user-profile/SellerSectionLazy'")
    expect(code, '직접 import 하면 게이트를 우회해 비셀러도 받는다')
      .not.toMatch(/from '\.\/user-profile\/SellerSection'/)
  })
})

describe('② 시트는 전부 열 때 받는다', () => {
  const code = readCode(SECTION)

  it('판매 섹션에 시트 정적 import 가 0 이다', () => {
    const statics = [...code.matchAll(/^import\s+\w+\s+from\s+'\.\/(?:seller-section\/)?(\w*Sheet)'/gm)]
    expect(statics.map(m => m[1]), '정적으로 돌아온 시트가 있다 — 마이 청크가 그만큼 커진다')
      .toEqual([])
  })

  it('시트가 실제로 lazy 로 선언돼 있다 (0건이면 통과가 아니라 고장)', () => {
    const lazies = [...code.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\(/g)].map(m => m[1])
    expect(lazies.length, '측정 0건 — 선언 형태가 바뀌었는데 검사가 헛돌고 있다').toBeGreaterThanOrEqual(13)
    for (const need of ['OrdersSheet', 'WithdrawSheet', 'AllToolsSheet', 'ToolPageSheet']) {
      expect(lazies, `${need} 가 lazy 가 아니다`).toContain(need)
    }
  })

  it('판정을 SellerSection 이 다시 하지 않는다 — 지도를 정적으로 읽으면 봉투가 통째로 붙는다', () => {
    expect(code, "tool-pages 를 정적 import 하면 시트 청크가 정적 의존이 되어 lazy 가 무의미해진다")
      .not.toContain("from './seller-section/tool-pages'")
    expect(code, '시트가 넘겨준 판정을 써야 한다').toContain('onPick={(path, label, inSheet)')
  })

  it('나브 색인이 셀러 껍데기 봉투에서 떨어져 있다', () => {
    const v = readCode(VITE)
    for (const f of ['seller-nav', 'seller-tab-groups', 'seller-primary-nav', 'useSellerNavModel']) {
      expect(v, `${f} 가 app-seller-nav 로 안 가면 목록 한 장에 83.8KB 가 딸려 온다`)
        .toMatch(new RegExp(`${f}'\\)\\)\\s*return 'app-seller-nav'`))
    }
    // 규칙 순서: 색인 규칙이 셀러 catch-all 보다 **먼저** 와야 이긴다.
    expect(v.indexOf("return 'app-seller-nav'"))
      .toBeLessThan(v.indexOf("if (id.includes('/src/components/seller/')) return 'app-seller-components'"))
  })
})

describe('③ 41개 화면이 복제 없이 시트에서 열린다', () => {
  it('SellerLayout 이 컨텍스트를 읽고 껍데기를 벗는다', () => {
    const code = readCode(LAYOUT)
    expect(code).toContain("from '@/shared/seller-embed'")
    expect(code).toMatch(/const embedded = useSellerEmbedded\(\)/)
    expect(code, 'bare 만 보면 페이지마다 prop 을 뚫어야 하고 41개 중 몇은 반드시 빠진다')
      .toMatch(/if \(bare \|\| embedded\) return <>\{children\}<\/>/)
  })

  it('컨텍스트가 권한을 만들지 않는다 — 토큰·좌석·API 를 모른다', () => {
    const code = readCode(EMBED)
    // 🩸 2026-09-26: 첫 판은 **건초더미만 소문자로** 바꾸고 바늘은 안 바꿔서(`localStorage` 는
    //   camelCase) 주입을 통과시켰다. 되돌려-검증이 잡았다. 이제 대소문자 무시로 본다.
    for (const forbidden of ['localStorage', 'sessionStorage', 'document', 'fetch', 'token', 'seat', 'axios']) {
      expect(code, `임베드 신호가 ${forbidden} 을 알면 "시트로 열면 통과되는 문" 이 생긴다`)
        .not.toMatch(new RegExp(forbidden, 'i'))
    }
    // 그리고 **react 말고는 아무것도 import 하지 않는다** — 위 목록은 언제든 새는 이름이 생긴다.
    const froms = [...code.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
    expect(froms.length, '측정 0건 — import 형태가 바뀌었다').toBeGreaterThanOrEqual(1)
    expect(froms, '이 파일은 표시 하나만 들고 있어야 한다').toEqual(['react'])
  })

  it('시트가 라이트 섬 **클래스**로 감싼다 (주석은 런타임에 아무 일도 안 한다)', () => {
    const raw = readRaw(TOOL_SHEET)
    expect(raw, '대시보드 화면은 dark: 가 금지돼 있다 — 마이 다크에서 흰 폼 위 흰 글자가 난다')
      .toMatch(/className="light-island/)
    expect(readCode(TOOL_SHEET)).toContain('<SellerEmbedProvider>')
  })

  it('lazy 를 렌더 중에 만들지 않는다 (매 렌더 새 타입 = 트리 리마운트)', () => {
    const code = readCode(TOOL_SHEET)
    expect(code, 'useMemo 없이 lazy() 를 부르면 입력하던 글자가 사라진다')
      .toMatch(/useMemo\(\(\)\s*=>\s*\{[\s\S]*?lazy\(load\)/)
  })
})

describe('④ 지도가 낡지 않는다', () => {
  /** 사이드바·탭·검색 전용을 합친 색인의 모든 셀러 경로. */
  const navPaths = [
    ...NAV_GROUPS.flatMap(g => g.items.map(i => i.path)),
    ...SELLER_TAB_GROUPS.flatMap(g => g.tabs.map(t => t.path)),
    ...SELLER_SEARCH_ONLY.map(s => s.path),
  ].filter(p => p.startsWith('/seller/'))

  it('색인이 비어 있지 않다 (0건이면 아래 검사가 전부 헛돈다)', () => {
    expect(new Set(navPaths).size).toBeGreaterThanOrEqual(30)
  })

  it('모든 셀러 경로가 지도 ∪ 제외목록 안에 있다', () => {
    const missing = [...new Set(navPaths)].filter(
      p => !Object.prototype.hasOwnProperty.call(TOOL_PAGES, p)
        && !Object.prototype.hasOwnProperty.call(FULL_SCREEN_ONLY, p),
    )
    expect(missing, '전체 도구에서 눌렀는데 시트가 안 열리는 화면이 조용히 생긴다').toEqual([])
  })

  it('지도와 제외목록이 겹치지 않는다', () => {
    const both = Object.keys(TOOL_PAGES).filter(p => p in FULL_SCREEN_ONLY)
    expect(both, '같은 화면을 여는 길이 둘이면 반드시 갈린다').toEqual([])
  })

  it('제외에는 **이유가 값으로** 적혀 있다', () => {
    for (const [p, why] of Object.entries(FULL_SCREEN_ONLY)) {
      expect(why.length, `${p} 의 제외 사유가 비어 있다 — 이유 없는 제외는 다음 세션이 판단할 수 없다`)
        .toBeGreaterThan(20)
    }
  })

  it('지도가 실제 화면 파일을 가리킨다', () => {
    const raw = readRaw('src/pages/user-profile/seller-section/tool-pages.ts')
    const mods = [...raw.matchAll(/import\('(@\/pages\/[A-Za-z0-9]+)'\)/g)].map(m => m[1])
    expect(mods.length, '측정 0건 — import 형태가 바뀌었다').toBeGreaterThanOrEqual(30)
    expect(new Set(mods).size, '같은 화면을 두 경로가 가리킨다').toBe(mods.length)
  })

  it('카메라 화면은 시트로 열지 않는다', () => {
    expect(canOpenInSheet('/seller/scan')).toBe(false)
    expect(canOpenInSheet('/seller/meal-voucher/new'), '전용 시트가 이미 있다').toBe(false)
  })

  it('전체 도구가 나가는 것을 표시한다', () => {
    const code = readCode(ALL_TOOLS)
    expect(code).toContain('canOpenInSheet')
    expect(code, '무엇이 화면을 바꾸는지 누르기 전에 알려 주지 않으면 튕겼다고 느낀다')
      .toMatch(/leaves\s*\n?\s*\?\s*<ExternalLink/)
  })
})
