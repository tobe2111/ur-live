import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// 🩸 2026-08-27: 자체 codeOnly 가 **라인 주석 속 `/*`** 에 걸려 파일 절반을 삼켰다(실측 4곳).
//   공용 스캐너로 통일 — 경위는 `helpers/source-text.ts`.
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🏪 2026-08-27 — **유어샵 카드 통일 + 소개비 귀속 보존** (대표 신고 2건).
 *
 * ## ① 카드가 두 세대로 갈려 있었다
 * 2026-08-19 에 카드를 한 벌(`GroupBuyFeedCard` + `DealCardMedia`)로 합쳤는데 **홈만** 갈아 끼웠고
 * 유어샵은 7월에 통일했던 `BrowseProductCard` 그대로였다. 대표가 화면을 보고 알았다 —
 * 각각은 멀쩡해 보여서 **나란히 놓고 봐야만** 드러나는 클래스다(8/19 통일과 같은 함정).
 *
 * ## ② ⚠️ 이 통일이 돈을 조용히 새게 할 수 있었다
 * 유어샵의 **담은 핀**은 반드시 `/u/{handle}/p/{productId}` 로 가야 한다 — 그 경로가 클릭을
 * 기록하고 `?aff=` 귀속을 붙인다(`curator.routes.ts` 의 redirect). 그런데 `GroupBuyFeedCard` 는
 * 목적지를 **스스로**(`canonicalDetailPath`) 정한다. 그대로 갈아 끼우면 화면은 똑같은데
 * **소개비 귀속이 사라진다** — 에러도 안 나고 아무도 모른다.
 * 그래서 `to` prop 을 additive 로 열고, 핀 호출부 2곳이 그걸 **반드시 넘기는지** 여기서 고정한다.
 *
 * ## 못 막는 것
 *   - 실제 렌더 결과(여긴 소스 검사다). 시각 회귀는 사람이 본다.
 *   - `curator.routes.ts` 의 redirect 가 `?aff=` 를 실제로 붙이는지 — 그건 별개 경로다.
 */
const CARD = 'src/pages/main-home/GroupBuyFeedCard.tsx'
const VOUCHERS = 'src/pages/seller-public/VouchersTab.tsx'
const PINS = 'src/pages/seller-public/CuratorPinsSection.tsx'
const CURATOR = 'src/pages/CuratorPage.tsx'
const read = (f: string) => readFileSync(f, 'utf-8')


describe('① 유어샵이 홈과 같은 카드를 쓴다', () => {
  for (const [label, f] of [['이용권 그리드', VOUCHERS], ['담은 핀(사업자)', PINS], ['담은 핀(일반유저)', CURATOR]] as const) {
    it(`${label} — GroupBuyFeedCard 를 렌더한다`, () => {
      const src = read(f)
      // ⚠️ import 줄만 보면 `<div>` 로 바꿔도 통과한다(2026-08-19 에 실제로 그렇게 헛돌았다).
      //    JSX 여는 태그로 앵커한다.
      expect(src).toMatch(/<GroupBuyFeedCard\b/)
    })
    it(`${label} — 옛 카드(BrowseProductCard)를 더는 렌더하지 않는다`, () => {
      expect(codeOnly(read(f))).not.toMatch(/<BrowseProductCard\b/)
    })
  }
})

describe('② 담은 핀은 귀속 경로를 잃지 않는다 (돈이 새는 회귀)', () => {
  it('카드가 `to` 를 받아 기본 목적지보다 우선한다', () => {
    const src = read(CARD)
    expect(src).toContain('to?: string')
    // 기본값은 SSOT 유지 — `to` 는 덮어쓰기일 뿐 SSOT 를 대체하지 않는다.
    expect(src).toContain('to={to ?? canonicalDetailPath(p)')
  })

  for (const [label, f] of [['사업자 유어샵', PINS], ['일반유저 유어샵', CURATOR]] as const) {
    it(`${label} — 핀 카드에 /u/{handle}/p/{id} 를 넘긴다`, () => {
      const src = read(f)
      // 카드 호출부에 그 형태의 to 가 실제로 붙어 있는지 (문자열이 파일 어딘가 있는 것으로는 부족)
      const call = src.slice(src.indexOf('<GroupBuyFeedCard'), src.indexOf('<GroupBuyFeedCard') + 400)
      expect(call).toMatch(/to=\{`\/u\/\$\{handle\}\/p\/\$\{pin\.product_id\}`\}/)
    })
  }

  it('매장 자기 이용권 그리드는 `to` 를 넘기지 않는다 (귀속 대상이 아니다)', () => {
    // 여기에 핀 경로를 넘기면 남의 귀속이 붙는다 — 반대 방향의 사고.
    expect(codeOnly(read(VOUCHERS))).not.toMatch(/to=\{/)
  })
})

describe('③ 이용권이 쇼핑 상세를 거쳐 튕기지 않는다', () => {
  it('유어샵 이용권 그리드가 /products/:id 로 보내지 않는다', () => {
    // 종전 `to={/products/:id}` 는 canonicalDetailPath 가 /group-buy 로 되돌릴 때까지
    // 페이지 한 장을 헛로드했다.
    expect(codeOnly(read(VOUCHERS))).not.toContain('/products/${')
  })
})

describe('④ 소개자 카탈로그는 비로그인도 둘러볼 수 있다', () => {
  const ROUTES = 'src/features/group-buy/api/marketing.routes.ts'
  it('discoverApp 은 라우터 레벨에서 optionalAuth 다', () => {
    const src = read(ROUTES)
    expect(src).toMatch(/discoverApp\.use\('\*',\s*optionalAuth\(\)\)/)
    // 🩸 라우트에 optionalAuth 를 덧붙이는 것으로는 상위 requireAuth 를 못 푼다(2026-08-27 실사고).
    expect(codeOnly(src)).not.toMatch(/discoverApp\.use\('\*',\s*requireAuth\(\)\)/)
  })
  it('응답이 로그인 여부를 실어 보낸다 (비로그인이 "내 딜 없음"으로 오해하지 않게)', () => {
    expect(read('src/features/group-buy/api/marketing/discovery.ts')).toContain('authed: !!me?.id')
  })
})
