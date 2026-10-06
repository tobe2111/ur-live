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
import { readCode, readRaw, stripComments } from '../helpers/source-text'
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
    // 🧹 2026-10-01 철거: 하한 13 → **6**. 손수 시트 일곱이 내려갔다(`OrdersSheet` 등).
    //   하한의 일은 "몇 개여야 한다" 가 아니라 **매치 0으로 헛도는 것**을 막는 것이다.
    expect(lazies.length, '측정 0건 — 선언 형태가 바뀌었는데 검사가 헛돌고 있다').toBeGreaterThanOrEqual(6)
    for (const need of ['WithdrawSheet', 'AllToolsSheet', 'ToolPageSheet']) {
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
    // 🔁 2026-09-26: 조기 반환이 fragment → 스코프 있는 `<div>` 로 바뀌었다(여백·seller 스코프 복원).
    //   지키는 불변식은 그대로다 — **컨텍스트를 읽어 껍데기를 건너뛴다**.
    expect(code, 'bare 만 보면 페이지마다 prop 을 뚫어야 하고 41개 중 몇은 반드시 빠진다')
      .toMatch(/if \(bare \|\| embedded\) \{/)
    // 그리고 그 반환이 **도매 리다이렉트보다 먼저**여야 한다(시트 안에서 튕기면 마이가 사라진다).
    expect(code.indexOf('if (bare || embedded) {'))
      .toBeLessThan(code.indexOf('if (wholesaleOnly) return null'))
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

/**
 * 🔁 2026-09-29 재조준 — 대표 확정 **안 C**(코레일톡 전체메뉴 형태)가 '매일 / 가끔' 나눔을 대체했다.
 * 그 나눔의 근거는 *하루에 몇 번 여는가* 였는데, 안 C 의 행은 48px 이라 **여덟 줄이 384px 에 다 들어온다** —
 * 한눈에 보이는 목록을 다시 쪼갤 이유가 없고, 라벨 둘이 먹던 48px 도 돌려받는다.
 * ⇒ 지킬 불변식이 *"둘로 나뉘어 있다"* 에서 *"**한 판**이고 자주 쓰는 셋이 맨 위"* 로 바뀐다.
 *   판이 하나여야 하는 이유는 미감이 아니다 — 안 C 에서 **판이 곧 "여기가 파는 쪽"** 이라는 표시자라
 *   판이 둘이면 그 표시가 무의미해진다.
 */
describe('⑥ 판매 도구 — 한 판, 자주 쓰는 셋이 맨 위 (2026-09-29 안 C)', () => {
  const code = readCode(SECTION)

  it('🔵 판매 도구가 **한 판**이다 (판이 파는 쪽 표시자다)', () => {
    // 판은 공유 상수로만 연다 — 손으로 적은 판이 하나라도 있으면 그 순간 문법이 갈린다.
    expect(code, '판을 손으로 적었다 — LIST_PLATE_CLS 를 쓸 것')
      .not.toContain('rounded-2xl bg-surface shadow-lift overflow-hidden')
    const plates = code.split('<div className={LIST_PLATE_CLS}>').length - 1
    expect(plates, `판매 구역의 판이 ${plates}개다 — 안 C 는 하나다`).toBe(1)
    // 그룹 라벨은 안 C 에서 안 쓴다(구역 제목이 그 일을 한다).
    expect(code).not.toContain('<GroupLabel>')
  })

  /**
   * 🎯 2026-09-30 재조준 — 여덟 줄 → **넷**(대표 확정, ⑥).
   * 지키던 것 둘은 그대로다: *순서*(주문·이용권·정산이 먼저 = 옛 근육기억)와 *전체 도구의 존재*.
   * 새로 지키는 것: **바로가기는 넷을 넘지 않는다.** 여덟이면 폰 한 화면(844px)이
   * `전체 도구` 에서 정확히 끝나 손님 줄이 0이 된다(실측). 바로가기가 아홉이면 바로가기가 아니다.
   */
  it('🔵 바로가기가 넷이고, 자주 쓰는 셋이 맨 위다', () => {
    const labels = [...code.matchAll(/^\s*label="([^"]+)"$/gm)].map((m) => m[1])
    expect(labels.length, '도구 줄을 못 셌다 — 이 검사가 헛돌고 있다').toBe(4)
    // 순서가 바뀌면 옛 근육기억이 깨진다 — 주문·이용권·정산이 먼저다.
    expect(labels.slice(0, 3)).toEqual(['주문', '이용권', '정산'])
    expect(labels[3], '마지막은 나머지로 가는 문이다').toBe('전체 도구')
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

  /**
   * 🧹 **2026-10-01 철거로 이 검사의 모양이 바뀌었다 — 풀지 않고 재조준했다.**
   *
   * 종전 불변식: *"묶음 줄이 여는 일곱 주소가 전부 `COVERED_BY_SHEET` 에 있다"* —
   * 그래야 문이 둘(묶음 줄 / 전체 도구)이어도 **도착지가 하나**였다.
   * 그 표가 필요했던 이유는 도착지가 **두 종류**(손수 시트 ↔ 대시보드 화면)였기 때문이다.
   *
   * 철거 뒤에는 손수 시트가 돈 하나만 남았으므로 **도착지가 구조적으로 하나**다 — 둘 다
   * 같은 대시보드 화면을 `ToolPageSheet` 로 연다. 그래서 검사도 "표에 다 있나" 가 아니라
   * **"지키려던 것"**(한 일에 화면이 하나다)을 직접 본다.
   * ⚠️ 표를 지우지 않은 이유: 돈 경로(`/seller/settlements`)가 아직 손수 시트를 쓴다.
   */
  it('손수 시트가 남은 일은 표가 그리로 보낸다 (돈 하나)', () => {
    const table = code.slice(code.indexOf('const COVERED_BY_SHEET'), code.indexOf("'/seller/settlements': 'withdraw',") + 40)
    const paths = [...table.matchAll(/'(\/seller\/[^']+)':/g)].map((m) => m[1])
    expect(paths.length, '측정 0건 — 표가 사라졌거나 형태가 바뀌었다').toBeGreaterThanOrEqual(1)
    expect(paths, '돈 경로가 표에서 빠졌다 — 출금의 PIN 되돌아오기를 잃는다').toContain('/seller/settlements')
  })

  it('철거된 일곱은 손수 시트로 되살아나지 않는다', () => {
    // 🔴 되돌리려면 **revert** 로 하라는 뜻이다 — 한 개씩 다시 얹으면 그때부터 또 두 벌이다.
    for (const gone of ['OrdersSheet', 'VoucherSheet', 'AnalyticsSheet', 'StoreSheet',
      'PartnersSheet', 'MessagesSheet', 'RefundSheet']) {
      expect(stripComments(code), `${gone} 가 돌아왔다 — 같은 일에 화면이 다시 둘이 된다`)
        .not.toContain(`<${gone}`)
    }
  })

  it('표를 실제로 소비한다 (선언만 하면 죽은 코드다)', () => {
    expect(code).toMatch(/const covered = COVERED_BY_SHEET\[path\]/)
    expect(code, '표에 걸리면 **먼저** 돌려보내야 한다 — 뒤에 두면 시트가 먼저 열린다')
      .toMatch(/if \(covered\) \{ setTool\(covered\); return \}[\s\S]{0,600}?if \(inSheet\)/)
  })

  it('바로가기 줄과 전체 도구가 같은 화면으로 간다', () => {
    // 바로가기가 손수 시트를 열고 전체 도구가 대시보드 화면을 열면, 같은 "주문" 이 두 화면이 된다.
    // ⇒ 바로가기는 **표에 있는 도구**(돈) 아니면 **대시보드 화면**(`openPage`)만 연다.
    const bare = stripComments(code)
    const tools = [...bare.matchAll(/openTool\('([a-z]+)'\)/g)].map((m) => m[1])
    const pages = [...bare.matchAll(/openPage\('(\/seller\/[^']+)'/g)].map((m) => m[1])
    expect(tools.length + pages.length, '바로가기를 하나도 못 찾았다 — 이 검사가 헛돌고 있다')
      .toBeGreaterThanOrEqual(4)
    const table = code.slice(code.indexOf('const COVERED_BY_SHEET'), code.indexOf("'/seller/settlements': 'withdraw',") + 40)
    const covered = new Set([...table.matchAll(/:\s*'([a-z]+)',/g)].map((m) => m[1]))
    for (const t of new Set(tools)) {
      if (t === 'tools') continue   // 전체 도구 자신은 색인이지 일이 아니다
      expect(covered, `바로가기 '${t}' 이 표에 없다 — 전체 도구에서 다른 화면이 열린다`).toContain(t)
    }
    expect(pages, '주문이 대시보드 화면으로 열리지 않는다').toContain('/seller/orders')
    expect(pages, '이용권이 대시보드 화면으로 열리지 않는다').toContain('/seller/group-buy')
  })
})

describe('⑧ 시트 UI 정리 — PC 폭 · 여백 · 제목 두 겹 (2026-09-26)', () => {
  const sheet = readCode('src/pages/user-profile/seller-section/Sheet.tsx')
  const layout = readCode(LAYOUT)
  const css = readRaw('src/index.css')

  it('PC 에서 바텀 시트가 브라우저 폭을 가로지르지 않는다', () => {
    // 마이는 PC 에서 액자를 벗는다(`pc-fullbleed`) — `inset-x-0` 이면 2560px 모니터에서 그만큼 벌어진다.
    expect(sheet, '폭 상한이 없으면 모니터가 넓을수록 더 이상해진다').toContain('lg:w-[min(900px,92vw)]')
    expect(sheet, '가운데로 모아야 한다').toContain('lg:left-1/2')
    expect(sheet).toContain('lg:-translate-x-1/2')
    // 폰은 한 글자도 안 바뀐다 — 바텀 시트가 맞다.
    expect(sheet, '폰 바텀 시트 앵커가 사라졌다').toContain('fixed inset-x-0 bottom-0')
  })

  it('PC 에서 세로도 가운데다 (폰 값이 lg 로 새지 않는다)', () => {
    for (const need of ['lg:top-1/2', 'lg:bottom-auto', 'lg:-translate-y-1/2', 'lg:max-h-[86dvh]']) {
      expect(sheet, `${need} 가 없으면 tall/보통 중 한쪽이 화면 밖으로 나간다`).toContain(need)
    }
  })

  it('시트 안 화면이 가장자리에 붙지 않는다 (bare 가 여백을 준다)', () => {
    // 🩸 종전 bare 는 `<>{children}</>` 이라 `<main>` 이 주던 `p-3 sm:p-5` 가 통째로 없었다.
    expect(layout, 'bare 가 fragment 로 돌아가면 여백이 0 이 된다')
      .toMatch(/if \(bare \|\| embedded\) \{[\s\S]{0,400}?p-3 sm:p-5/)
  })

  it('시트 안에서도 seller 스코프를 잃지 않는다', () => {
    // `.seller-light-theme` 에 걸린 규칙(장식 아이콘 칩 숨김 · 폰 제목 한 번만)이 시트에서만 죽었었다.
    expect(layout).toMatch(/if \(bare \|\| embedded\) \{[\s\S]{0,400}?seller-light-theme/)
    expect(layout).toMatch(/if \(bare \|\| embedded\) \{[\s\S]{0,400}?ur-embed-page/)
  })

  it('시트 머리와 페이지 제목이 같은 이름을 두 번 말하지 않는다', () => {
    expect(css, 'CSS 규칙이 없으면 PC 시트에서 제목이 두 번 뜬다')
      .toMatch(/\.ur-embed-page \.dash-page-title h1 \{ display: none; \}/)
    // 부제는 남긴다 — 이름이 아니라 설명이고 시트 머리가 담지 못한다.
    expect(css).not.toMatch(/\.ur-embed-page \.dash-page-title \{ display: none/)
  })

  it('등록 시트가 여백을 두 겹으로 주지 않는다', () => {
    const v = readCode('src/pages/user-profile/seller-section/VoucherNewSheet.tsx')
    expect(v, 'bare 가 이미 여백을 준다 — 여기서 또 주면 두 겹이다').not.toMatch(/light-island[^"]*px-3 py-3/)
  })
})

/**
 * ⑨ 라우트 표에 구멍이 없다 (2026-09-27)
 *
 * 🩸 **이걸 왜 뒤늦게 넣나**: 시트의 설계 원칙은 *"손으로 적은 지도를 버리고 라우트 표를 렌더한다"*
 * 였는데, **셀러 라우트 셋이 그 표 밖(`App.tsx`)에 홀로 있었다.** 표를 렌더하는 시트에선 그 주소가
 * `*`(Escape)로 떨어져 **시트가 닫히고 마이가 통째로 그 주소로 떠났다.** 그중 `/seller/prospects` 는
 * '전체 도구' 색인이 실제로 내주는 주소였다 — 즉 "열린다" 고 적어 두고 **쫓아내고 있었다.**
 * 에러도 경고도 없다. 라우트가 실재하므로 대시보드에선 멀쩡했고, 그래서 아무도 몰랐다.
 *
 * ⚠️ 이 검사는 문자열이 아니라 **두 파일을 파싱해 계산**한다. 손으로 적은 목록을 또 만들면
 *   그 목록이 낡는 것이 이 구멍의 원인이었다.
 */
describe('⑨ 라우트 표에 구멍이 없다', () => {
  /** `seller.routes.tsx` 가 실제로 선언하는 경로 집합 — 시트가 열 수 있는 것의 전부다. */
  function pathsInSellerTable(): Set<string> {
    const src = readCode('src/routes/seller.routes.tsx')
    return new Set([...src.matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]))
  }

  it('App.tsx 에 /seller/* 라우트가 하나도 없다', () => {
    const app = readCode('src/App.tsx')
    const stray = [...app.matchAll(/<Route\s+path="(\/seller\/[^"]*)"/g)].map(m => m[1])
    expect(stray, `App.tsx 의 셀러 라우트는 시트가 못 여는 사각지대다: ${stray.join(', ')}`)
      .toEqual([])
  })

  it('색인·탭이 내주는 모든 셀러 경로가 그 표 안에 있다', () => {
    const table = pathsInSellerTable()
    // 색인(전체 도구) + 그룹 탭 + 검색 전용 — 사람이 실제로 누를 수 있는 전부.
    const offered = new Set<string>()
    for (const g of NAV_GROUPS) for (const it of g.items) offered.add(it.path)
    for (const g of SELLER_TAB_GROUPS) for (const it of g.tabs) offered.add(it.path)
    for (const it of SELLER_SEARCH_ONLY) offered.add(it.path)

    // 파라미터 경로(`/seller/products/:id/edit`)는 색인이 내주지 않는다 — 정적 경로만 본다.
    const missing = [...offered].filter(p => p.startsWith('/seller/') && !p.includes(':') && !table.has(p))
    expect(missing, `표 밖이면 시트가 마이를 튕겨낸다: ${missing.join(', ')}`).toEqual([])
    // 🛡️ 0개를 세고 통과하면 아무것도 보장하지 않는다.
    expect(offered.size, '색인이 비었다 — 검사가 고장난 것이다').toBeGreaterThan(20)
  })

  it('시트 안 화면이 throw 해도 마이가 하얘지지 않는다', () => {
    const sheet = readCode(TOOL_SHEET)
    expect(sheet, '바운더리가 없으면 한 화면의 크래시가 마이를 통째로 지운다')
      .toMatch(/<ErrorBoundary>[\s\S]{0,300}?\{SellerRoutes\(\)\}/)
  })
})

/**
 * ⑩ 시트 안에서 "화면 높이" 는 시트 높이다 (2026-09-27)
 *
 * 대시보드 화면 다수가 로딩·에러를 `if (loading) return <div className="min-h-screen …">` 로
 * **SellerLayout 밖에서** 조기 반환한다. 그래서 껍데기 벗기기가 그 상태엔 닿지 않고,
 * 86dvh 시트 안에 100vh 상자가 들어가 **헛스크롤**이 생기고 스피너가 가운데를 벗어난다.
 * 실측(빌드된 CSS + 실제 시트 기하): 규칙 없으면 폰 800px·PC 900px 상자에 스크롤 발생,
 * 규칙 있으면 480/540px 에 스크롤 없음.
 */
describe('⑩ 시트 안에서 화면높이는 시트 높이다', () => {
  it('시트가 스코프 클래스를 달고 있다', () => {
    expect(readCode(TOOL_SHEET), 'ur-embed-sheet 가 빠지면 CSS 규칙이 아무 데도 안 걸린다')
      .toMatch(/light-island[^"]*\bur-embed-sheet\b/)
  })

  it('CSS 가 네 가지 화면높이 유틸을 전부 되돌린다', () => {
    const css = readRaw('src/index.css')
    const block = css.slice(css.indexOf('.ur-embed-sheet .min-h-screen'))
      .slice(0, 400)
    expect(block, '규칙이 없다').toContain('.ur-embed-sheet')
    for (const util of ['.min-h-screen', '.h-screen', '.min-h-\\[100dvh\\]', '.h-\\[100dvh\\]']) {
      expect(block, `${util} 를 빠뜨리면 그 유틸을 쓰는 화면만 조용히 헛스크롤한다`).toContain(util)
    }
  })

  it('되돌린 값이 시트 스크롤 영역보다 작다 (헛스크롤 0)', () => {
    const css = readRaw('src/index.css')
    const m = /\.ur-embed-sheet \.h-\\\[100dvh\\\]\s*\{[^}]*min-height:\s*(\d+)dvh/.exec(css)
    expect(m, 'dvh 값으로 적혀 있어야 시트 높이와 비교할 수 있다 (100% 는 부모가 min-height 뿐이라 찌그러진다)').toBeTruthy()
    const val = Number(m![1])
    // 시트는 `lg:max-h-[86dvh]` 이고 머리(56px)가 그 안에서 자리를 먹는다 → 여유를 두고 작아야 한다.
    expect(val, '시트보다 크면 헛스크롤이 그대로다').toBeLessThan(80)
    expect(val, '너무 작으면 스피너가 위로 쏠린다').toBeGreaterThanOrEqual(40)
    expect(readCode('src/pages/user-profile/seller-section/Sheet.tsx'),
      '시트 높이가 바뀌면 위 값을 다시 계산해야 한다').toContain('lg:max-h-[86dvh]')
  })
})

/**
 * ⑪ 시트에서 열리는 화면이 폰 폭을 견딘다 (2026-09-27, 대표 "3번은 순서대로 해줘" — 1단계)
 *
 * 시트 안 화면은 **366px**(390 − bare 여백 12×2)에서 읽혀야 한다. 실측으로 고친 네 곳을 고정한다.
 * 🩸 이 값들은 추측이 아니라 브라우저 실측이다(설계문서 §8-e·§9). 세 번 예측이 뒤집혔다:
 *   · "5열 표가 잘린다" → 안 잘린다. 대신 행이 91px 로 부풀고 폭의 44%가 칸 패딩이었다.
 *   · "날짜 입력이 114px 에 안 들어간다" → 들어간다. 대신 placeholder 가 잘려 조용히 못 읽는다.
 *   · "3열 통계는 경계" → 가장 나빴다. 금액이 80px 폭에서 4줄로 감겨 타일이 161px 이 됐다.
 *
 * ## 이 검사가 **못** 하는 것
 * jsdom 은 레이아웃이 없어 "실제로 안 넘치는가" 를 못 잰다 — 여기서는 **처방이 남아 있는지**만 본다.
 * 실제 치수는 빌드된 CSS + 브라우저 프레임 측정이 판정한다(그 수치를 위에 적어 둔 이유다).
 */
describe('⑪ 시트에서 열리는 화면이 폰 폭을 견딘다', () => {
  it('예약 화면이 폰에서는 표가 아니라 카드다', () => {
    const c = readCode('src/pages/SellerAppointmentsPage.tsx')
    expect(c, '표가 폰에 그대로 뜨면 행이 91px 로 부푼다').toContain('<table className="hidden lg:table')
    expect(c, '폰 카드 목록이 사라지면 폰에 아무것도 안 뜬다').toMatch(/lg:hidden[^"]*divide-y/)
    // 카드에도 같은 일이 되어야 한다 — 표에만 있으면 폰에서 처리를 못 한다.
    const phone = c.slice(c.indexOf('lg:hidden'), c.indexOf('<table className="hidden lg:table'))
    for (const need of ['markComplete', 'markNoShow']) {
      expect(phone, `폰 카드에서 ${need} 를 못 하면 표시만 되고 일을 못 한다`).toContain(need)
    }
  })

  it('원장 송금 이력도 폰에서는 카드다', () => {
    const c = readCode('src/pages/MyLedgerPage.tsx')
    expect(c).toContain('<table className="hidden lg:table')
    expect(c).toMatch(/lg:hidden[^"]*divide-y/)
  })

  it('통계 타일이 폰에서 1열이다 (금액은 폭이 필요하다)', () => {
    const c = readCode('src/pages/SellerRealtimeDashboardPage.tsx')
    expect(c, '3열이면 금액이 80px 폭에서 감긴다 — 실측 타일 161px').toContain('grid-cols-1 sm:grid-cols-3')
    expect(c, '조건 없는 3열이 돌아왔다').not.toMatch(/className="grid grid-cols-3 gap-3"/)
  })

  it('쿠폰 폼 입력이 폰에서 1열이다 (placeholder 가 잘리지 않게)', () => {
    const c = readCode('src/pages/SellerCouponsPage.tsx')
    expect(c.match(/grid-cols-1 sm:grid-cols-3/g)?.length ?? 0,
      '두 줄 모두 접혀야 한다 — 한 줄만 고치면 나머지가 조용히 잘린다').toBeGreaterThanOrEqual(2)
    expect(c, '조건 없는 3열이 돌아왔다').not.toMatch(/className="grid grid-cols-3 gap-3"/)
  })
})
