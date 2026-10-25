/**
 * 🖼️ 서버가 이용권 상세의 첫 화면을 그린다 〔2026-09-15〕
 *
 * 대표: *"꼭 로딩이 걸려야 해?"* → *"없어지는게 좋으면 없애도 돼. 그게 가장 이상적이야?"*
 *
 * 실측: HTML 은 0.2초에 **상품을 담고** 도착하고 히어로 사진은 0.5초에 preload 로 도착하는데,
 * React 는 1.4초에야 마운트한다(그 1초는 앱 코드가 아니라 V8 파싱 — `(program) 967ms`).
 * ⇒ 서버가 [빵부스러기 + 히어로]까지 그리고 그 아래에만 로더를 둔다.
 *
 * ## 이 시험이 지키는 것 — **두 벌이 갈리지 않는가**
 * React 는 `createRoot`(비-hydrate)라 마운트 때 `#root` 를 통째로 갈아엎는다. 서버가 그린 것과
 * React 첫 렌더가 어긋나면 그 자리가 **튄다**(대표가 2026-07-01 에 금지한 "로딩 화면 2~3개").
 * 그래서 서버 문자열과 **실제 컴포넌트 소스**를 대조한다 — 사람이 약속하는 대신 기계가 잰다.
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제로 안 튀는지 → **프레임 캡처**만이 판정한다(배포 후 라이브).
 * - PC(lg+) 레이아웃 — 서버는 PC 히어로를 안 그린다(빵부스러기 + 로더).
 * - 마운트 전 터치 — 히어로는 배경이라 원래 링크가 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildDetailFirstScreen, DETAIL_CRUMB_CLASS, DETAIL_ONNURI_CLASS } from '@/worker/utils/detail-ssr-body'
import { buildDetailNoscript } from '../../worker/utils/crawler-noscript'
import { PASS_HEAD, PASS_PAGE_BG } from '@/shared/pass-head'
import { DETAIL_HERO_MOBILE_WIDTH, detailHeroMobileUrl } from '@/shared/detail-hero-image'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

const LOADER = '<div style="min-height:100dvh;display:flex">urdeal.</div>'
const seed = (over: Record<string, unknown> = {}) => JSON.stringify({
  data: {
    id: 2888, name: '치즈돈가스 2인 세트', price: 16500, original_price: 25000,
    image_url: 'https://ldb-phinf.pstatic.net/a.jpg', category: 'meal_voucher',
    restaurant_name: '행복돈가스', ...over,
  },
})

describe('① 히어로 — 화면이 실제로 그리는 것과 같은 URL·같은 프레임', () => {
  it('🔴 URL 이 `DetailGallery` 와 **같은 SSOT 함수**로 나온다 (갈리면 사진을 두 번 받는다)', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    const expected = detailHeroMobileUrl('https://ldb-phinf.pstatic.net/a.jpg', DETAIL_HERO_MOBILE_WIDTH)
    expect(expected).toBeTruthy()
    expect(html).toContain(expected)
  })

  it('🔴 프레임 3:2 — 갤러리의 `aspectRatio: \'3/2\'` 와 같은 값', () => {
    expect(readCode('src/pages/group-buy/DetailGallery.tsx')).toContain("aspectRatio: '3/2'")
    expect(buildDetailFirstScreen(seed(), LOADER)).toContain('aspect-ratio:3/2')
  })

  it('슬라이드 바탕색·채우기가 갤러리와 같다 (다르면 사진 도착 전후로 톤이 바뀐다)', () => {
    const gal = readCode('src/pages/group-buy/DetailGallery.tsx')
    expect(gal).toContain("backgroundColor: '#1D1F29'")
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).toContain('background-color:#1D1F29')
    expect(html).toContain('background-size:cover')
    expect(html).toContain('background-position:center')
  })

  it('히어로는 모바일 전용(`lg:hidden`) — PC 는 레이아웃이 달라 안 그린다', () => {
    expect(buildDetailFirstScreen(seed(), LOADER)).toContain('class="relative lg:hidden"')
  })
})

describe('② 빵부스러기 — 클래스와 라벨이 컴포넌트와 같다', () => {
  it('🔴 클래스 문자열이 `DetailBreadcrumb`(overlayHeader) 과 **한 글자도 안 다르다**', () => {
    const src = readCode('src/components/deal/DetailBreadcrumb.tsx')
    const m = src.match(/className=\{`([^`]+)`\}/)
    expect(m, 'DetailBreadcrumb 의 className 템플릿을 못 찾았다 — 이 시험이 낡았다').toBeTruthy()
    const rendered = m![1]
      .replace('${overlayHeader ? \'pt-[64px]\' : \'pt-3\'}', 'pt-[64px]')
      .trim()
    expect(DETAIL_CRUMB_CLASS).toBe(rendered)
  })

  it('🔴 모바일에선 안 보인다 — 컴포넌트와 워커 둘 다 `hidden lg:block` 으로 감싼다 (2026-10-11 D안)', () => {
    expect(readCode('src/pages/GroupBuyDetailPage.tsx')).toContain('<div className="hidden lg:block"><DetailBreadcrumb')
    expect(buildDetailFirstScreen(seed(), LOADER)).toContain('<div class="hidden lg:block"><nav')
  })

  it('라벨은 명칭 SSOT 에서 온다 — "식사권" 같은 옛 어휘가 되살아나지 않게', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(getVoucherShortLabel('meal_voucher'))
    expect(html).not.toContain('식사권')
    expect(html).not.toContain('공구권')
  })

  it('카테고리를 모르면 경로가 아니다 — 컴포넌트처럼 안 그린다', () => {
    const html = buildDetailFirstScreen(seed({ category: null }), LOADER)
    expect(html).not.toContain('<nav')
    expect(html).toContain('aspect-ratio:3/2')   // 사진은 그대로 그린다
  })
})

describe('③ 제목 — 컴포넌트와 같은 값으로 그린다', () => {
  const page = readCode('src/pages/GroupBuyDetailPage.tsx')

  it('🔴 매장명·제목이 본문으로 나온다 (서버가 이제 제목까지 그린다)', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).toContain('<h1 ')
    expect(html).toContain('치즈돈가스 2인 세트')
    expect(html).toContain('행복돈가스')
  })

  // 🔁 2026-10-11 (D안): 제목은 inline style 두 벌 → **같은 클래스 상수**(`PASS_HEAD`)를 둘 다 import.
  //   손으로 옮긴 값을 대조하던 시험을, 같은 상수를 실제로 쓰는지 보는 시험으로 바꿨다.
  const head = readCode('src/pages/group-buy/PassHeadCard.tsx')

  it('🔴 머리 카드·매장명·제목 클래스가 컴포넌트와 **같은 상수**다 (갈리면 마운트 때 제목이 튀다)', () => {
    for (const k of ['card', 'merchant', 'h1', 'prelaunch', 'onnuri'] as const) {
      expect(head, `PassHeadCard 가 PASS_HEAD.${k} 를 안 쓴다`).toContain(`PASS_HEAD.${k}`)
    }
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(`<div class="${PASS_HEAD.card}">`)
    expect(html).toContain(`<div class="${PASS_HEAD.merchant}">`)
    expect(html).toContain(`<h1 class="${PASS_HEAD.h1}">`)
    expect(DETAIL_ONNURI_CLASS).toBe(PASS_HEAD.onnuri)
  })

  it('🔴 페이지가 모바일 제목을 머리 카드로만 그린다 (h1 이 두 벌이면 서버와 어긋난다)', () => {
    expect(page).toContain('<PassHeadCard ')
    expect(page).not.toMatch(/<h1 style=\{\{/)
    expect(head).toContain('오픈 예정 · 사전 응모 받는 중')
  })

  it('온누리·오픈예정은 시드가 말할 때만 그린다 (기본은 없음)', () => {
    const plain = buildDetailFirstScreen(seed(), LOADER)
    expect(plain).not.toContain('온누리 사용 가능')
    expect(plain).not.toContain('오픈 예정')
    const rich = buildDetailFirstScreen(seed({ onnuri_merchant: true, prelaunch: 1 }), LOADER)
    expect(rich).toContain('온누리 사용 가능')
    expect(rich).toContain('오픈 예정 · 사전 응모 받는 중')
  })

  // 🔁 2026-10-24 (대표 승인 "그루폰식"): 그 줄이 [가게 · 종류 · 지역] 으로 넓어졌다 — 셋 다 없을 때만 안 그린다.
  //   서버·클라가 **같은 함수**(`passSubLine`)로 만들고, 제목(h1)이 그 줄보다 **위**다.
  // 🔤 2026-10-25 대표 확정 D안: 가게 줄이 **제목 위**로 — 순서 불변식이 뒤집혔다(서버·클라가 같은 순서인 것은 그대로).
  it('가게·종류·지역 줄 — 같은 함수 · 셋 다 없을 때만 안 그린다 · 제목 위', () => {
    const card = readCode('src/pages/group-buy/PassHeadCard.tsx')
    expect(card).toContain('{sub && (')
    expect(card).toContain('passSubLine(')
    expect(readCode('src/worker/utils/detail-ssr-body.ts')).toContain('passSubLine(d)')
    const none = buildDetailFirstScreen(seed({ restaurant_name: null, category: null, restaurant_address: null }), LOADER)
    expect(none).toContain('<h1 ')
    expect(none).not.toContain(PASS_HEAD.merchant)
    const full = buildDetailFirstScreen(seed({ restaurant_name: '부용한우곱창', category: 'meal_voucher', restaurant_address: '경기 파주시 가재울로94번길 10' }), LOADER)
    expect(full).toContain('부용한우곱창 · 식사 · 파주시')
    expect(full.indexOf(PASS_HEAD.merchant), '가게 줄이 제목보다 아래로 내려갔다').toBeLessThan(full.indexOf('<h1 '))
    expect(card.indexOf('{sub && ('), '컴포넌트도 가게 줄이 먼저여야 서버와 같다').toBeLessThan(card.indexOf('<h1 '))
  })
})

describe('③-2 제목 위에 per-user 블록이 남아 있으면 안 된다', () => {
  const page = readCode('src/pages/GroupBuyDetailPage.tsx')

  it('🔴 `ShareRewardBanner` 는 제목 **아래**에 있다 (위에 있으면 딜 보유자에게만 제목이 밀린다)', () => {
    const banner = page.indexOf('<ShareRewardBanner')
    const h1 = page.indexOf('<PassHeadCard ')
    expect(banner).toBeGreaterThan(0)
    expect(h1).toBeGreaterThan(0)
    expect(banner).toBeGreaterThan(h1)
  })

  it('배너가 null 이면 그 칸이 통째로 접힌다 (`empty:hidden`) — 안 그러면 16px 빈칸이 남는다', () => {
    const line = page.split('\n').find(l => l.includes('<ShareRewardBanner'))
    expect(line).toBeTruthy()
    expect(line!).toContain('empty:hidden')
  })

  it('🔴 `?ref=` 일 때는 제목을 접는다 — 추천 배너가 제목 위에 끼는 유일한 경우', () => {
    expect(page).toContain("searchParams.get('ref')")
    const withRef = buildDetailFirstScreen(seed(), LOADER, '?ref=42')
    expect(withRef).not.toContain('<h1 ')
    expect(withRef).toContain('aspect-ratio:3/2')     // 히어로는 그대로(09-15 동작)
    const noRef = buildDetailFirstScreen(seed(), LOADER, '?utm_source=kakao')
    expect(noRef).toContain('<h1 ')
  })
})

describe('③-3 감싸는 노드가 페이지와 같은 표면을 들고 다닌다', () => {
  it('🔴 `class="gbd"` — 없으면 `--gbd-*` 가 안 풀려 제목이 기본색이 된다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).toContain(`id="ur-first-screen" class="gbd ${PASS_PAGE_BG}"`)
    expect(html).toContain('color:var(--gbd-ink)')
  })

  it('페이지 루트가 쓰는 값과 같다 — 바탕은 같은 상수(`PASS_PAGE_BG`)', () => {
    const page = readCode('src/pages/GroupBuyDetailPage.tsx')
    expect(page).toContain('className={`gbd ${PASS_PAGE_BG}`}')
    expect(page).toContain("color: 'var(--gbd-ink)'")
  })

  it('로더가 사진 **아래**에 남고, 화면 높이를 다 먹지 않는다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html.indexOf('urdeal.')).toBeGreaterThan(html.indexOf('aspect-ratio:3/2'))
    expect(html).not.toContain('min-height:100dvh')
    expect(html).toContain('min-height:34dvh')
  })

  it('🔴 주소·가격은 여전히 **보이는 화면**에 안 그린다 — 주소 줄의 `· N km` 는 per-user 라 되감길 수 있다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    // 🔀 2026-10-11 재조준: 지키려던 것(**마운트 때 되감길 줄을 서버가 그리지 않는다**)은 그대로다.
    //   같은 날 붙은 `<noscript>` 본문 요약은 JS 가 돌면 렌더되지 않아 밀림을 만들 수 없으므로
    //   판정 대상에서 뺀다. 떼는 방법은 정규식이 아니라 **빌더 출력 그대로**(갈릴 수 없다).
    const ns = buildDetailNoscript(JSON.parse(seed()).data)
    const visible = ns ? html.replace(ns, '') : html
    expect(visible, 'noscript 가 안 떼졌다 — 빌더와 갈렸다').not.toContain('<noscript')
    expect(visible).not.toContain('16,500')
    expect(visible).not.toContain('결제 즉시 교환권 발급')
  })

  it('🔴 크롤러용 요약은 `<noscript>` 안에만 있다 — 사람 화면에는 한 글자도 안 샌다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    const i = html.indexOf('<noscript>')
    expect(i, '요약이 아예 없다 — 네이버가 본문을 49자로 보던 수리가 사라졌다').toBeGreaterThan(-1)
    const inner = html.slice(i + 10, html.indexOf('</noscript>'))
    expect(inner, '가격이 요약에 없다').toContain('16,500')
    expect(inner, '요약에 사진·높이를 넣지 말 것').not.toMatch(/<img|style=|height/)
  })
})

describe('④ 못 그리면 조용히 로더로 — 무회귀', () => {
  it.each([
    ['빈 문자열', ''],
    ['깨진 JSON', '{'],
    ['data 없음', '{}'],
    ['이름 없음', JSON.stringify({ data: { id: 1, image_url: 'https://x/a.jpg' } })],
    ['사진 없음', seed({ image_url: '', images: null })],
  ])('%s → `\'\'`', (_label, payload) => {
    expect(buildDetailFirstScreen(payload as string, LOADER)).toBe('')
  })
})

describe('⑤ 배선 — 워커가 실제로 이걸 쓰고, 교환권과 가른다', () => {
  const worker = readCode('src/worker/index.ts')

  it('🔴 `#root` DETAIL 분기가 존재하고 catch-all 로더 **앞**에 있다', () => {
    const mine = worker.indexOf('buildDetailFirstScreen(ssrPayload')
    // 🧭 2026-10-12 재조준: catch-all 이 `setInnerContent(staticNs + urdealLoaderHtml)` 가 됐다
    //   (`/faq`·`/about`·`/region/*` 의 크롤러 `<noscript>` 요약이 **덧붙은** 것 — 로더는 그대로다).
    //   지키려던 불변식(**DETAIL 분기가 catch-all 앞에 있다**)은 그대로이므로 앵커만 넓힌다.
    //   ⚠️ 느슨해지지 않는다: `urdealLoaderHtml` 이 그 자리에 **반드시** 있어야 맞는다.
    const m = /el\.setInnerContent\((?:[A-Za-z_$][\w$]*\s*\+\s*)?urdealLoaderHtml, \{ html: true \}\)/.exec(worker)
    expect(mine).toBeGreaterThan(0)
    expect(m, 'catch-all 로더 주입이 사라졌다').not.toBeNull()
    expect(m!.index).toBeGreaterThan(mine)
  })

  it('🔴 `/vouchers/:id`(교환권)에는 안 그린다 — 같은 슬롯이지만 다른 페이지다', () => {
    expect(worker).toContain("url.pathname.startsWith('/group-buy/')")
  })

  it('실패 시 로더 폴백이 배선돼 있다', () => {
    expect(worker).toContain('firstScreen || urdealLoaderHtml')
  })
})
