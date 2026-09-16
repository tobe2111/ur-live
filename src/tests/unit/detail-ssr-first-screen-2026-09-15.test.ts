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
import { buildDetailFirstScreen, DETAIL_CRUMB_CLASS, DETAIL_TITLE_STYLES, DETAIL_ONNURI_CLASS } from '@/worker/utils/detail-ssr-body'
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

  it('🔴 h1 스타일이 페이지의 모바일 h1 과 **한 값도 안 다르다** (갈리면 마운트 때 제목이 튀다)', () => {
    // 페이지는 React inline style 객체다 → 숫자는 px, `lineHeight` 는 단위없음으로 직렬된다.
    const m = page.match(/<h1 style=\{\{([^}]+)\}\}/)
    expect(m, '페이지의 h1 inline style 을 못 찾았다 — 이 시험이 낡았다').toBeTruthy()
    const expected = m![1]
      .split(',')
      .map(kv => kv.trim())
      .filter(Boolean)
      .map(kv => {
        const i = kv.indexOf(':')
        const key = kv.slice(0, i).trim().replace(/[A-Z]/g, c => '-' + c.toLowerCase())
        let val = kv.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
        // 단위없음으로 직렬되는 속성 밖의 순수 숫자는 React 가 px 를 붙인다.
        if (/^-?\d+(\.\d+)?$/.test(val) && !['line-height', 'font-weight', 'opacity', 'z-index', 'flex'].includes(key)) val += 'px'
        return `${key}:${val}`
      })
      .join(';')
    expect(DETAIL_TITLE_STYLES.h1).toBe(expected)
  })

  it('🔴 매장명·온누리·오픈예정 뱃지의 토큰이 페이지에 그대로 있다', () => {
    expect(page).toContain(DETAIL_ONNURI_CLASS)
    expect(page).toContain('오픈 예정 · 사전 응모 받는 중')
    expect(page).toContain("padding: '14px 18px 0'")   // 제목 블록 wrap
    expect(DETAIL_TITLE_STYLES.wrap).toBe('padding:14px 18px 0')
  })

  it('온누리·오픈예정은 시드가 말할 때만 그린다 (기본은 없음)', () => {
    const plain = buildDetailFirstScreen(seed(), LOADER)
    expect(plain).not.toContain('온누리 사용 가능')
    expect(plain).not.toContain('오픈 예정')
    const rich = buildDetailFirstScreen(seed({ onnuri_merchant: true, prelaunch: 1 }), LOADER)
    expect(rich).toContain('온누리 사용 가능')
    expect(rich).toContain('오픈 예정 · 사전 응모 받는 중')
  })

  it('매장명이 없으면 그 줄을 안 그린다 — 컴포넌트와 같은 조건', () => {
    expect(page).toContain('{detail.restaurant_name && (')
    const html = buildDetailFirstScreen(seed({ restaurant_name: null }), LOADER)
    expect(html).toContain('<h1 ')
    expect(html).not.toContain(DETAIL_TITLE_STYLES.merchant)
  })
})

describe('③-2 제목 위에 per-user 블록이 남아 있으면 안 된다', () => {
  const page = readCode('src/pages/GroupBuyDetailPage.tsx')

  it('🔴 `ShareRewardBanner` 는 제목 **아래**에 있다 (위에 있으면 딜 보유자에게만 제목이 밀린다)', () => {
    const banner = page.indexOf('<ShareRewardBanner')
    const h1 = page.indexOf('<h1 style=')
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
    expect(html).toContain('id="ur-first-screen" class="gbd"')
    expect(html).toContain('background:var(--gbd-card)')
    expect(html).toContain('color:var(--gbd-ink)')
  })

  it('페이지 루트가 쓰는 값과 같다', () => {
    const page = readCode('src/pages/GroupBuyDetailPage.tsx')
    expect(page).toContain('className="gbd"')
    expect(page).toContain("background: 'var(--gbd-card)'")
    expect(page).toContain("color: 'var(--gbd-ink)'")
  })

  it('로더가 사진 **아래**에 남고, 화면 높이를 다 먹지 않는다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html.indexOf('urdeal.')).toBeGreaterThan(html.indexOf('aspect-ratio:3/2'))
    expect(html).not.toContain('min-height:100dvh')
    expect(html).toContain('min-height:34dvh')
  })

  it('🔴 주소·가격은 여전히 안 그린다 — 주소 줄의 `· N km` 는 per-user 라 되감길 수 있다', () => {
    const html = buildDetailFirstScreen(seed(), LOADER)
    expect(html).not.toContain('16,500')
    expect(html).not.toContain('결제 즉시 교환권 발급')
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
    const fallback = worker.indexOf('el.setInnerContent(urdealLoaderHtml, { html: true })')
    expect(mine).toBeGreaterThan(0)
    expect(fallback).toBeGreaterThan(mine)
  })

  it('🔴 `/vouchers/:id`(교환권)에는 안 그린다 — 같은 슬롯이지만 다른 페이지다', () => {
    expect(worker).toContain("url.pathname.startsWith('/group-buy/')")
  })

  it('실패 시 로더 폴백이 배선돼 있다', () => {
    expect(worker).toContain('firstScreen || urdealLoaderHtml')
  })
})
