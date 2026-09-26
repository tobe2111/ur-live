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
import { FULL_SCREEN_ONLY, canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'

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

  it('안쪽 위치 보고가 렌더마다 부모를 흔들지 않는다', () => {
    // 🔁 2026-09-26 재조준: 종전 이 자리는 `lazy()` 를 렌더 중에 만드는지 봤는데, 이제 로딩은
    //   라우트 표가 맡아 그 함정이 사라졌다. **같은 클래스의 새 함정**이 그 자리에 생겼다 —
    //   `InnerBridge` 가 렌더마다 `onDepth()` 를 부르면 부모 setState → 재렌더 → 또 호출로
    //   무한 루프가 된다. 그래서 **바뀔 때만** 올려야 한다.
    const code = readCode(TOOL_SHEET)
    expect(code, '변화 감지 없이 onDepth 를 부르면 무한 렌더가 된다')
      .toMatch(/if \(last\.current !== deeper\)[\s\S]{0,120}onDepth\(deeper\)/)
  })
})

describe('④ 지도를 손으로 적지 않는다 — 라우트 표가 지도다', () => {
  const sheet = readCode(TOOL_SHEET)

  it('시트가 **실제 라우트 표**를 렌더한다', () => {
    // 🔴 이게 이 판의 핵심이다. 손으로 적은 `주소 → 모듈` 목록은 ① 파라미터 화면(`/:id/edit`)을
    //   못 담고 ② 목록이 navigate() 하면 마이가 통째로 떠났다. 라우트 표를 그대로 렌더하면 둘 다 풀린다.
    expect(sheet).toContain("from '@/routes/seller.routes'")
    expect(sheet, '라우트 표를 실제로 펼쳐야 한다(import 만 있으면 죽은 코드다)').toContain('{SellerRoutes()}')
  })

  it('안쪽 이동이 브라우저 히스토리를 안 건드린다 (MemoryRouter)', () => {
    expect(sheet, 'BrowserRouter 면 주소창이 바뀌고 마이가 통째로 이동한다').toContain('<MemoryRouter')
    expect(sheet).not.toContain('<BrowserRouter')
    expect(sheet, '처음 열 주소를 넘겨야 그 화면이 뜬다').toMatch(/initialEntries=\{\[path\]\}/)
  })

  it('셀러 밖 주소는 빈 화면이 되지 않고 진짜로 나간다', () => {
    // 메모리 라우터엔 `/` 나 `/u/me` 가 없다 — catch-all 이 없으면 아무것도 안 그려진다.
    expect(sheet).toMatch(/<Route path="\*" element=\{<Escape/)
    expect(readCode(SECTION), '호출부가 실제로 내보내야 한다').toContain('onLeave={(to)')
  })

  it('손으로 적은 주소→모듈 지도가 되살아나지 않는다', () => {
    const map = readCode('src/pages/user-profile/seller-section/tool-pages.ts')
    const entries = [...map.matchAll(/'\/seller\/[^']*':\s*\(\)\s*=>\s*import\(/g)]
    expect(entries.length, '지도가 돌아왔다 — 라우트 표와 두 벌이 되어 반드시 갈린다').toBe(0)
  })

  it('일부러 뺀 것만 못 연다 — 기본은 "열 수 있다"', () => {
    expect(canOpenInSheet('/seller/orders')).toBe(true)
    expect(canOpenInSheet('/seller/products/9/edit'), '파라미터 화면도 열린다').toBe(true)
    expect(canOpenInSheet('/seller/scan'), '카메라 + 마이에 전용 버튼이 따로 있다').toBe(false)
    expect(canOpenInSheet('/seller/meal-voucher/new'), '전용 시트가 이미 있다').toBe(false)
    // 목록이 늘어나면 "아직 안 예쁘다" 를 "못 한다" 로 적기 시작한 것이다.
    expect(Object.keys(FULL_SCREEN_ONLY).length, '제외가 늘었다 — UI 정리의 일을 여기 적지 말 것').toBeLessThanOrEqual(3)
  })

  it('제외에는 **이유가 값으로** 적혀 있다', () => {
    expect(Object.keys(FULL_SCREEN_ONLY).length).toBeGreaterThan(0)
    for (const [p, why] of Object.entries(FULL_SCREEN_ONLY)) {
      expect(why.length, `${p} 의 제외 사유가 비어 있다 — 이유 없는 제외는 다음 세션이 판단할 수 없다`)
        .toBeGreaterThan(20)
    }
  })

  it('시트 안에서 한 단계 들어가면 되돌아올 수 있다', () => {
    expect(sheet, 'onBack 이 없으면 목록→수정 뒤 되돌아올 길이 X 뿐이다(시트가 통째로 닫힌다)')
      .toMatch(/onBack=\{deeper \? back : undefined\}/)
    expect(readCode('src/pages/user-profile/seller-section/Sheet.tsx')).toContain('onBack')
  })

  it('전체 도구가 나가는 것을 표시한다', () => {
    const code = readCode(ALL_TOOLS)
    expect(code).toContain('canOpenInSheet')
    expect(code, '무엇이 화면을 바꾸는지 누르기 전에 알려 주지 않으면 튕겼다고 느낀다')
      .toMatch(/leaves\s*\n?\s*\?\s*<ExternalLink/)
  })
})

describe('⑤ 시트 안에서 깨지던 껍데기', () => {
  // 이 셋은 `SellerLayout` 을 안 써서 임베드 컨텍스트가 껍데기를 못 벗겼다 —
  // 시트 안에서 헤더가 두 겹이 되고 `min-h-screen` 이 100vh 로 늘어났다(모바일 룰 위반이기도 하다).
  const FIXED = [
    'src/pages/SellerProxyProductsPage.tsx',
    'src/pages/SellerProspectsPage.tsx',
    'src/pages/SellerAdSlotsPage.tsx',
  ]

  it('셋 다 SellerLayout 을 쓴다 (그래야 컨텍스트가 껍데기를 벗긴다)', () => {
    for (const f of FIXED) {
      expect(readCode(f), `${f} 가 SellerLayout 밖이면 시트 안에 자체 헤더가 그대로 남는다`)
        .toMatch(/<SellerLayout[\s>]/)
    }
  })

  it('셋 다 min-h-screen 이 없다 (100vh 는 폰에서 주소창만큼 크다)', () => {
    for (const f of FIXED) {
      expect(readCode(f), `${f} 에 min-h-screen 이 돌아왔다`).not.toContain('min-h-screen')
    }
  })
})

describe('⑥ 구조 시안 A — 매일 / 가끔 (2026-09-26 대표 확정)', () => {
  const code = readCode(SECTION)

  it('일곱 줄이 한 덩어리로 돌아가지 않는다', () => {
    expect(code, '무엇이 매일이고 무엇이 가끔인지 화면이 말해야 한다')
      .toContain('<GroupLabel>매일</GroupLabel>')
    expect(code).toContain('<GroupLabel>가끔</GroupLabel>')
    // 라벨만 있고 덩어리가 안 나뉘면 아무 일도 안 한 것이다 — 카드가 둘이어야 한다.
    const cards = code.split('rounded-2xl bg-surface shadow-lift overflow-hidden').length - 1
    expect(cards, '묶음 카드가 매일·가끔·전체도구 셋이어야 한다').toBeGreaterThanOrEqual(3)
  })

  it('매일에는 셋만 — 정산까지', () => {
    const daily = code.slice(code.indexOf('<GroupLabel>매일'), code.indexOf('<GroupLabel>가끔'))
    const labels = [...daily.matchAll(/label="([^"]+)"/g)].map((m) => m[1])
    expect(labels).toEqual(['주문', '이용권', '정산'])
  })

  it('전체 도구가 예시를 나열하지 않는다 (적으면 반드시 낡는다)', () => {
    const line = code.split('\n').find((l) => l.includes('label="전체 도구"'))
    expect(line, '"전체 도구" 줄을 못 찾았다 — 검사가 헛돌고 있다').toBeTruthy()
    for (const gone of ['쿠폰', '알림톡', '숙소', '사업자등록증', '운영자']) {
      expect(code, `"전체 도구" 힌트에 메뉴 이름(${gone})이 박혔다`)
        .not.toMatch(new RegExp(`hint="[^"]*${gone}`))
    }
  })
})

describe('⑦ 같은 일에 화면이 둘이 되지 않는다', () => {
  const code = readCode(SECTION)

  it('손수 시트가 덮는 주소는 대시보드 화면 대신 그 시트로 간다', () => {
    // 🩸 2026-09-26: 범용 도구 시트를 손수 시트 **위에** 얹어, 일곱 개가 문 두 개로 열렸다.
    //   어느 문으로 들어왔느냐에 따라 "주문" 이 다른 화면으로 떴다 — 이 레포가 반복해 당한 클래스다.
    const table = code.slice(code.indexOf('const COVERED_BY_SHEET'), code.indexOf('/** 묶음 한 줄'))
    const paths = [...table.matchAll(/'(\/seller\/[^']+)':/g)].map((m) => m[1])
    expect(paths.length, '측정 0건 — 표가 사라졌거나 형태가 바뀌었다').toBeGreaterThanOrEqual(7)
    for (const need of ['/seller/orders', '/seller/group-buy', '/seller/settlements', '/seller/analytics']) {
      expect(paths, `${need} 가 표에 없다 — 그 일에 화면이 둘이 된다`).toContain(need)
    }
  })

  it('표를 실제로 소비한다 (선언만 하면 죽은 코드다)', () => {
    expect(code).toMatch(/const covered = COVERED_BY_SHEET\[path\]/)
    expect(code, '표에 걸리면 **먼저** 돌려보내야 한다 — 뒤에 두면 시트가 먼저 열린다')
      .toMatch(/if \(covered\) \{ setTool\(covered\); return \}[\s\S]{0,600}?if \(inSheet\)/)
  })

  it('묶음 줄이 여는 도구가 전부 표에 덮여 있다', () => {
    // 묶음 줄에 있는데 표에 없으면, 전체 도구에서 같은 일이 다른 화면으로 열린다.
    const table = code.slice(code.indexOf('const COVERED_BY_SHEET'), code.indexOf('/** 묶음 한 줄'))
    const covered = new Set([...table.matchAll(/:\s*'([a-z]+)',/g)].map((m) => m[1]))
    const rows = [...code.matchAll(/openTool\('([a-z]+)'\)/g)].map((m) => m[1])
      .filter((t) => t !== 'tools')
    expect(rows.length).toBeGreaterThanOrEqual(7)
    for (const t of new Set(rows)) {
      expect(covered, `묶음 줄 '${t}' 이 표에 없다 — 전체 도구에서 다른 화면이 열린다`).toContain(t)
    }
  })
})
