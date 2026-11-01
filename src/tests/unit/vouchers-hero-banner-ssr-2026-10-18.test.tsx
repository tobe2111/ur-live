/**
 * 🖼️ 교환권 머리 배너 — 2026-10-18 에 서버 첫 화면으로 당겼고, **2026-11-01 에 통째로 걷었다.**
 *
 * ## 이력 (지우지 않는 이유)
 * 2026-10-18: `/vouchers` 의 LCP 가 머리 배너 사진인데 요청이 3.8초에야 출발해(화면 코드 → `/api/banners`
 *   응답 뒤에야 `<img>` 생성) LCP 4.3초였다. 그래서 워커가 배너를 보조 시드로 받아 판 안에 첫 장을 그렸다.
 * 2026-11-01: 대표 *"이용권 페이지 UI 별로야. **배너 없는게 낫겠고**"* → 시안 넷 중 **A안(한 줄 머리)**.
 *   머리가 196px 배너 → 56px 한 줄이 되면서 **그릴 배너 자체가 없어졌다.**
 *
 * ⇒ 그 LCP 수리는 무효가 된 것이 아니라 **문제가 사라진 것**이다(머리에 큰 사진이 없으니 LCP 는 상품 타일).
 *   시험은 지우지 않고 **방향을 뒤집는다** — 지우면 다음 세션이 "교환권에도 배너를 달자"로 조용히 되돌리고,
 *   그러면 첫 상품이 다시 y=432 로 내려간다(라이브 실측). 시안·근거: `docs/design/vouchers-no-banner-2026-11.md`.
 *
 * ## 🔴 홈 배너는 멀쩡히 살아 있다
 * 보조 시드 장치(`__SSR_INITIAL_${slot}__`)와 `useHomeBanners` 는 홈이 계속 쓴다. 교환권만 빠졌다.
 * 그 둘까지 같이 지우면 **홈 상단 배너가 첫 렌더에서 사라진다** — 아래 ②가 그 방향을 막는다.
 *
 * ## 못 막는 것
 * - jsdom 엔 레이아웃이 없다 — 첫 상품이 실제로 올라왔는지는 라이브 프레임이 판정한다(E4).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { buildVouchersFirstScreen, VOUCHERS_FS_CLASS } from '@/worker/utils/vouchers-first-screen'
import { BANNERS_SEED_PATH } from '@/shared/home-strip-banners'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(fs.readFileSync(p, 'utf8'))
const LOADER = '<div class="ur-loader" style="min-height:100dvh">loader</div>'
const ROW = { id: 1, name: '아메리카노', price: 2000, original_price: 4500, image_url: 'https://bizimg.giftishow.com/a.jpg', brand_name: '메가', category: '커피/음료', deal_only: 1 }
const SEED = JSON.stringify({ success: true, data: [ROW] })

describe('① 교환권 머리에 배너가 없다 (A안, 2026-11-01)', () => {
  const html = buildVouchersFirstScreen(SEED, LOADER, 'n')

  it('서버 첫 화면이 머리를 그리되 배너 판·캐러셀은 없다', () => {
    expect(html, '첫 화면 자체가 비면 이 시험은 아무것도 판정하지 못한다').toContain(VOUCHERS_FS_CLASS.topRow)
    const host = document.createElement('div')
    host.innerHTML = html
    // 배너 캐러셀의 표식 — 하나라도 남아 있으면 머리가 종전으로 돌아간 것이다.
    expect(host.querySelector('[aria-roledescription="carousel"]')).toBeNull()
    expect(html).not.toContain('h-[196px]')
    expect(html).not.toContain('이벤트 배너')
  })

  it('워커가 교환권에서 `/api/banners` 보조 시드를 받지 않는다 (self-fetch 하나가 줄었다)', () => {
    const W = code('src/worker/index.ts')
    expect(W).not.toMatch(/ssrExtra = \{ slot: 'BANNERS'/)
    // 첫 화면 빌더도 배너를 인자로 받지 않는다 — 받으면 다시 그릴 수 있다는 뜻이다.
    expect(buildVouchersFirstScreen.length, 'bannersJson 인자가 되살아났다').toBe(3)
    const fs2 = code('src/worker/utils/vouchers-first-screen.ts')
    expect(fs2).not.toContain('heroBannerHtml')
    expect(fs2).not.toContain('bannersOfSlot')
  })

  it('화면도 교환권에서 배너 부품을 쓰지 않는다', () => {
    const v = code('src/pages/VouchersPage.tsx')
    expect(v).not.toContain('HomeBannerStrip')
    expect(v).not.toContain('VouchersHero')
  })
})

describe('② 홈 보조 시드 장치는 그대로 (교환권만 빠졌다)', () => {
  const W = code('src/worker/index.ts')

  it('보조 시드 script id 는 슬롯 이름을 따른다 — 홈(SECTIONS) 종전 그대로', () => {
    expect(W).toMatch(/__SSR_INITIAL_\$\{ssrExtra\?\.slot \?\? 'SECTIONS'\}__/)
  })

  /**
   * 🔴 **BANNERS 보조 시드는 통째로 걷혔다 — 읽는 코드까지.**
   *
   * 종전 이 자리는 *"앱이 그 시드를 읽는 경로는 살아 있다"* 를 단언했는데, A안으로 머리에 배너가
   * 없어지면서 **워커가 그 시드를 아예 안 싣는다**(주입처 0 — 위 ① 이 고정). 그러면 읽는 코드는
   * 늘 `undefined` 를 내는 죽은 가지이고, 남겨 두면 다음 세션이 *"시드가 온다"* 고 읽는다.
   *
   * ⚠️ 이 단언엔 결함 주입이 없다 — 리더를 되살려도 **행동이 안 변한다**(주입처가 없으니 늘
   *   `undefined`). 즉 출력으로 판정할 수 없는 자리이고, 이건 행동 가드가 아니라 **근거 정확성**
   *   가드다(선례: `blog-dates-honest-2026-10-12`). 주입을 다시 만들려 하지 말 것.
   */
  it('교환권 BANNERS 시드는 주입처도 리더도 없다 (죽은 가지를 남기지 않는다)', () => {
    expect(W).not.toContain('__SSR_INITIAL_BANNERS__')
    expect(code('src/components/home/useHomeBanners.ts')).not.toContain('__SSR_INITIAL_BANNERS__')
  })

  /**
   * 🔴 **반대 방향** — BANNERS 를 걷으면서 홈의 *살아 있는* 시드 경로까지 같이 걷지 않았는가.
   * 홈 상단 배너는 섹션 시드(`strip_banners`)로 먼저 서고, 응답이 오면 그 값으로 바뀐다.
   * 그 쌍(서버 마크업 ↔ `placeholderData`)의 주인은 `home-strip-banner-ssr-2026-10-14` 이므로
   * 여기선 **중복 잠금을 만들지 않고** 이 훅이 그 경로를 아직 쓰는지만 본다.
   */
  it('홈은 섹션 시드(strip_banners)로 첫 배너를 세운다 — 그 경로는 남아 있다', () => {
    const h = code('src/components/home/useHomeBanners.ts')
    expect(h).toContain('readHomeSectionsSeedRaw()')
    expect(h).toContain('stripBannersOf(raw)')
  })

  it('배너 예열 키도 살아 있다 — 홈이 그 캐시를 쓴다', () => {
    expect(BANNERS_SEED_PATH).toBe('/api/banners')
    expect(code('src/worker/cron/cache-prewarm.ts')).toContain("'/api/banners'")
  })
})
