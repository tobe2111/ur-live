/**
 * 🦦 유달이(마스코트) 화면 배치 규칙 (2026-10-07 대표 *"유달이 서비스 화면에 넣는 개발 시작해줘"*)
 *
 * SSOT: `docs/design/urdeal-mascot-otter-2026-10.md` — 쓰는 자리 / 안 쓰는 자리 / 표정 시트.
 * 부품: `src/components/mascot/Udal.tsx` (화면은 표정이 아니라 **상황(mood)** 을 고른다).
 *
 * 이 시험이 막는 것:
 *  ① 화면이 이미지 파일을 직접 import 해 부품을 우회한다 → 같은 상황이 화면마다 다른 얼굴이 된다
 *  ② 안 쓰는 자리(대시보드·어드민·도매몰·결제 위젯)에 유달이가 들어간다 — 문서가 금지한 자리
 *  ③ 상황표에 빈칸이 생기거나 가리키는 파일이 사라진다 → 그 화면만 깨진 이미지가 된다(에러 0)
 *  ④ 움직임 줄이기 사용자에게도 계속 흔들린다
 *  ⑤ 배선한 화면이 조용히 원래 아이콘으로 되돌아간다
 *
 * ⚠️ 못 보는 것: 그림이 그 자리에 어울리는지 · 크기가 적당한지 — 그건 렌더해서 눈으로 본다
 *    (`node scripts/visual-preview.mjs --route=/없는주소`). 그리고 한 화면에 두 마리가 서는 것은
 *    파일 단위로만 막는다(같은 파일에 `<Udal` 이 둘이면 빨간불, 서로 다른 부품이 한 화면에 겹치는 것은 못 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { readCode } from '../helpers/source-text'

const COMPONENT = 'src/components/mascot/Udal.tsx'

function trackedSources(): string[] {
  const out = execSync("git ls-files 'src/*.tsx' 'src/**/*.tsx' 'src/*.ts' 'src/**/*.ts'", { encoding: 'utf8' })
  return [...new Set(out.split('\n').filter(Boolean))].filter((f) => !f.startsWith('src/tests/'))
}

describe('🦦 유달이 — 부품 하나로만 그린다', () => {
  const files = trackedSources()

  it('검사 대상이 비어 있지 않다(0 이면 통과가 아니라 고장)', () => {
    expect(files.length).toBeGreaterThan(1000)
  })

  it('① 마스코트 이미지를 직접 import 하는 곳은 부품뿐이다', () => {
    const bad = files.filter((f) => f !== COMPONENT && /from '@\/assets\/mascot\//.test(readCode(f)))
    expect(bad, `부품을 우회해 이미지를 직접 쓴다: ${bad.join(', ')}`).toEqual([])
  })

  it('② 안 쓰는 자리(대시보드·어드민·도매몰·결제 위젯)에는 없다', () => {
    const FORBIDDEN = [
      /^src\/pages\/(Admin|Seller|Agency|Wholesale|Supplier)[^/]*\.tsx$/,
      /^src\/pages\/(admin|seller|agency|wholesale|supplier)[^/]*\//,
      /^src\/components\/(admin|seller|seller-layout|wholesale|dashboard)\//,
      /^src\/components\/(AdminLayout|SellerLayout|MarketingDashboardShell)\.tsx$/,
      /^src\/components\/payments\/TossPaymentWidget\.tsx$/,
      /^src\/pages\/TossWidgetPayPage\.tsx$/,
    ]
    const users = files.filter((f) => f !== COMPONENT && /from '@\/(components\/mascot\/Udal|shared\/udal-loader)'/.test(readFileSync(f, 'utf8')))
    expect(users.length, '배선한 화면이 하나도 안 잡힌다 — 검사가 헛돈다').toBeGreaterThan(3)
    const bad = users.filter((f) => FORBIDDEN.some((re) => re.test(f)))
    expect(bad, `문서가 금지한 자리에 유달이: ${bad.join(', ')}`).toEqual([])
  })

  it('② 한 파일에 한 마리', () => {
    const many = files
      .filter((f) => f !== COMPONENT)
      .map((f) => [f, (readCode(f).match(/<Udal\b/g) || []).length] as const)
      .filter(([, n]) => n > 1)
    // 검색 상태 부품은 서로 배타적인 분기(오류 · 빈 검색어 · 0건) 셋이라 예외다 — 한 번에 하나만 그려진다.
    const allowed = new Set(['src/components/search/SearchStates.tsx'])
    const bad = many.filter(([f]) => !allowed.has(f))
    expect(bad, `한 화면에 두 마리: ${bad.map(([f, n]) => `${f}(${n})`).join(', ')}`).toEqual([])
  })
})

describe('🦦 유달이 — 상황표가 온전하다', () => {
  const src = readCode(COMPONENT)

  it('③ 상황 10가지가 모두 그림을 가진다', () => {
    const moods = [...src.matchAll(/\|\s*'(\w+)'/g)].map((m) => m[1])
    expect(moods.length).toBe(10)
    const table = src.slice(src.indexOf('const ART'), src.indexOf('\n}', src.indexOf('const ART')))
    for (const m of moods) expect(table, `상황 '${m}' 에 그림이 없다`).toMatch(new RegExp(`\\b${m}:\\s*\\{\\s*src:\\s*\\w+,\\s*w:\\s*\\d+,\\s*h:\\s*\\d+`))
  })

  it('③ 가리키는 이미지 파일이 전부 실재한다', () => {
    const imports = [...src.matchAll(/from '@\/assets\/mascot\/([\w-]+\.webp)'/g)].map((m) => m[1])
    expect(imports.length).toBe(9)
    for (const f of imports) expect(existsSync(`src/assets/mascot/${f}`), `${f} 없음`).toBe(true)
  })

  it('③ 자리가 밀리지 않게 width·height 를 같이 준다', () => {
    expect(src).toMatch(/width=\{size\}/)
    expect(src).toMatch(/height=\{Math\.round\(\(size \* art\.h\) \/ art\.w\)\}/)
  })

  it('④ 움직임 줄이기 사용자에게는 멈춘다', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/@keyframes ur-udal-bob/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.ur-udal-bob,\s*\.ur-udal-hop\s*\{\s*animation:\s*none/)
  })
})

describe('🦦 유달이 — 배선한 화면이 되돌아가지 않는다', () => {
  const WIRED: Array<[string, string]> = [
    ['src/pages/NotFoundPage.tsx', 'lost'],
    ['src/components/ErrorBoundary.tsx', 'oops'],
    ['src/components/ui/list-load-error.tsx', 'oops'],
    ['src/pages/WishlistPage.tsx', 'empty'],
    ['src/components/search/SearchStates.tsx', 'notFound'],
    ['src/components/voucher/VoucherRedeemModal.tsx', 'done'],
    ['src/pages/my-vouchers/WalletEmpty.tsx', 'empty'],
    ['src/pages/PaymentSuccessPage.tsx', 'paid'],
    ['src/pages/my-vouchers/QRModal.tsx', 'showQr'],
    ['src/components/onboarding/WelcomeOnboardingModal.tsx', 'hello'],
    ['src/pages/restaurant-map/RestaurantList.tsx', 'notFound'],
    ['src/pages/restaurant-map/NearbyEmptyBanner.tsx', 'notFound'],
    ['src/pages/main-home/GroupBuyFeed.tsx', 'empty'],
    ['src/pages/pc-home/PcHomeAppBand.tsx', 'showQr'],
    // 2026-10-10 (대표 "다 해줘")
    ['src/pages/GiftClaimPage.tsx', 'yay'],
    ['src/pages/LoginPage.tsx', 'hello'],
    ['src/pages/MyReviewsPage.tsx', 'tip'],
    ['src/pages/MyFollowsPage.tsx', 'notFound'],
  ]
  it.each(WIRED)('⑤ %s 에 유달이(%s)가 있다', (file, mood) => {
    expect(readCode(file)).toMatch(new RegExp(`<Udal[^>]*mood="${mood}"`))
  })

  // 상황에 따라 얼굴이 바뀌는 자리 — 두 얼굴이 모두 올바른 상황에 붙어 있는가
  it('⑤-2 결제 실패는 oops, 사용자 취소는 hello', () => {
    const src = readCode('src/pages/PaymentFailPage.tsx')
    expect(src).toMatch(/const heroMood = isUserCancel \? 'hello' : 'oops'/)
    expect(src).toMatch(/<Udal mood=\{heroMood\}/)
  })
  it('⑤-3 주문 0건은 empty, 검색 0건은 notFound', () => {
    const src = readCode('src/components/mypage/OrdersTab.tsx')
    expect(src).toMatch(/<Udal mood=\{searching \? 'notFound' : 'empty'\}/)
  })
})

describe('🦦 로딩 화면의 유달이 — 정적 로더와 앱 로더가 같은 그림', () => {
  const shared = readCode('src/shared/udal-loader.ts')
  const src = /UDAL_LOADER_SRC = '([^']+)'/.exec(shared)?.[1] ?? ''

  it('경로가 실재하는 파일을 가리킨다(public 고정 경로 — 워커는 해시를 모른다)', () => {
    expect(src).toMatch(/^\/assets\/mascot\/udal-loader-v\d+\.webp$/)
    expect(existsSync(`public${src}`), `public${src} 없음 — 로더에 깨진 그림`).toBe(true)
  })

  it('index.html 이 바로 그 파일을 미리 받는다(경로가 갈리면 preload 가 헛돈다)', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain(`<link rel="preload" as="image" href="${src}"`)
  })

  it('워커 정적 로더와 BrandLoader 가 같은 SSOT 를 읽는다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/src="\$\{UDAL_LOADER_SRC\}"/)
    expect(readCode('src/components/brand/BrandLoader.tsx')).toMatch(/src=\{UDAL_LOADER_SRC\}/)
  })

  it('로더 그림 원본 비율과 SSOT 높이 계산이 같다(그림이 오기 전 자리 예약이 맞다)', () => {
    expect(shared).toMatch(/udalLoaderWidth\(logoSize\) \* \(220 \/ 204\)/)
  })

  it('대시보드 로더(forceLight)에는 유달이가 없다', () => {
    expect(readCode('src/components/brand/BrandLoader.tsx')).toMatch(/const showUdal = !forceLight/)
  })
})
