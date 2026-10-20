/**
 * 🏨 숙소 목록(`/stays`) 서버 첫 화면 — 2026-10-19
 *
 * 불변식
 *  ① 클래스·큐레이션 규칙은 화면과 워커가 **같은 상수**(`shared/stays-list.ts`)를 쓴다.
 *  ② 카드는 홈 첫 화면과 **같은 함수**(`cardHtml` — 진짜 카드와 시험으로 대조된 것)이고, 링크는 날짜·인원을 잇는다.
 *  ③ 칩 글자는 화면의 칩 표(`MAP_VOUCHER_DEFS`)·한국어 번역과 같다.
 *  ④ 워커 시드 주소 = 화면의 첫 검색 주소(byte-일치) — 갈리면 시드를 못 쓰고 카드가 한 번 사라진다.
 *  ⑤ 화면은 시드를 **기본 질의일 때만 · 한 번만** 첫 렌더에 쓴다.
 *  ⑥ 큐레이션 줄이 없거나 시드가 깨지면 '' (종전 로더로 — 무회귀). 워커 배선은 catch-all 앞, 폰에서만.
 *
 * ⚠️ 못 보는 것: 실제로 안 튀는지(박스 대조는 브라우저로 했다 — 상단 바 3줄·제목·첫 카드 박스·사진 주소가
 *    라이트·다크 모두 일치, 2026-10-19 라이브 시드) · PC(그리지 않는다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import { buildStaysFirstScreen } from '@/worker/utils/stays-first-screen'
import { cardHtml } from '@/worker/utils/home-first-screen'
import { STAYS_LIST, STAYS_CHIPS, buildStayCurations, stayCardHref, stayDateChipLabel } from '@/shared/stays-list'
import { defaultStaysQs, readStaysSeed, STAYS_SEED_ID } from '@/shared/stays-early'
import { MAP_VOUCHER_DEFS } from '@/pages/restaurant-map/voucher-types'
import { cssFirstApplies } from '@/worker/utils/css-first-boot'
import { stripComments } from '../helpers/source-text'

const LOADER = '<div style="min-height:100dvh">loader</div>'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const stay = (id: number, o: Record<string, unknown> = {}) => ({ id, name: `숙소${id}`, image_url: `https://media.ur-team.com/s${id}.jpg`, price_from: 89000, region_sido: '강원', region_sigungu: '속초시', ...o })
const SEED = JSON.stringify({ success: true, data: [stay(1), stay(2), stay(3), stay(4, { price_from: 150000 })] })
const code = (p: string) => stripComments(fs.readFileSync(p, 'utf8'))

describe('① 같은 상수 — 화면과 워커', () => {
  it('화면이 치수 클래스를 손으로 적지 않는다(상수에서 받는다)', () => {
    const page = code('src/pages/StaysSearchPage.tsx')
    for (const k of ['bar', 'titleRow', 'chipRow', 'quickRow', 'results', 'h1', 'back', 'filterBtn', 'quick'] as const) {
      expect(page, k).toContain(`STAYS_LIST.${k}`)
    }
    const cur = code('src/pages/stays/StayCurations.tsx')
    for (const k of ['row', 'cell', 'curations', 'rowTitle'] as const) expect(cur, k).toContain(`STAYS_LIST.${k}`)
    expect(cur).toContain('stayCardHref(')
  })
  it('큐레이션 규칙도 한 벌(화면은 공용 모듈을 다시 내보낸다)', () => {
    expect(code('src/pages/stays/StayCurations.tsx')).not.toMatch(/function buildStayCurations/)
  })
})

describe('② 첫 화면 — 첫 큐레이션 줄 + 같은 카드', () => {
  const html = buildStaysFirstScreen(SEED, LOADER, '2026-10-19', '2026-10-20')
  const row = buildStayCurations(JSON.parse(SEED).data)[0]
  it('첫 줄 제목과 그 줄의 카드 전부를 그린다', () => {
    expect(row.items.length).toBe(3)
    expect(html).toContain(`<h2 class="${STAYS_LIST.rowTitle}">${row.title}</h2>`)
    expect(html.match(new RegExp(`class="${STAYS_LIST.cell.replace(/[[\]%()]/g, '\\$&')}"`, 'g'))?.length).toBe(3)
  })
  it('카드 = 홈 첫 화면 카드 함수 · 첫 장만 eager · 링크는 날짜·인원을 잇는다', () => {
    const href = stayCardHref(1, '2026-10-19', '2026-10-20', 2)
    const first = cardHtml({ id: 1, name: '숙소1', price: 89000, image_url: 'https://media.ur-team.com/s1.jpg', category: 'stay_voucher', restaurant_address: '강원 속초시' }, true, href)
    expect(html).toContain(first)
    expect(html).toContain(`href="${href.replace(/&/g, '&amp;')}"`)
    expect(html.match(/loading="eager"/g)?.length).toBe(1)
  })
  it('상단 바 — 날짜 칩 글자 · 인원 · 숙소 칩만 켜짐', () => {
    expect(html).toContain(stayDateChipLabel('2026-10-19', '2026-10-20'))
    expect(html).toContain('성인 2명')
    expect(html.match(new RegExp(STAYS_LIST.chipOn, 'g'))?.length).toBe(1)
    // 켜진 칩이 '숙소' 여야 한다(화면은 숙소 페이지라 숙소 칩을 켠다)
    expect(html).toMatch(new RegExp(`${STAYS_LIST.chipOn}">[^<]*<span[^>]*></span>숙소<`))
  })
  it('노드 id 와 짧아진 로더', () => {
    expect(html.startsWith('<div id="ur-first-screen">')).toBe(true)
    expect(html).toContain('min-height:34dvh')
  })
})

describe('③ 칩 글자 = 화면의 칩 표', () => {
  it('키·한국어가 같다', () => {
    const ko = JSON.parse(fs.readFileSync('public/locales/ko/translation.json', 'utf8'))
    const get = (k: string) => k.split('.').reduce((o: Record<string, unknown>, x) => (o?.[x] as Record<string, unknown>), ko) as unknown as string
    expect(STAYS_CHIPS.map(c => c.key)).toEqual(MAP_VOUCHER_DEFS.map(d => d.key))
    STAYS_CHIPS.forEach((c, i) => expect(c.label).toBe(get(MAP_VOUCHER_DEFS[i].labelKey) ?? MAP_VOUCHER_DEFS[i].defaultLabel))
  })
})

describe('④ 워커 시드 주소 = 화면의 첫 검색', () => {
  it('화면 buildQs(기본 필터) 와 defaultStaysQs 가 같은 모양', () => {
    expect(defaultStaysQs(Date.UTC(2026, 9, 18, 16, 0))).toBe('check_in=2026-10-19&check_out=2026-10-20&guests=2&sort=recent')
  })
  it('워커가 그 함수로 시드를 받는다(STAYS 슬롯 — 주입 script id 가 화면이 읽는 id 와 같다)', () => {
    const w = code('src/worker/index.ts')
    expect(w).toMatch(/if \(url\.pathname === '\/stays'\) ssrExtra = \{ slot: 'STAYS', path: `\/api\/group-buy\/stays\/search\?\$\{defaultStaysQs\(\)\}` \}/)
    expect(STAYS_SEED_ID).toBe('__SSR_INITIAL_STAYS__')
  })
})

describe('⑤ 화면은 시드를 기본 질의일 때만 · 한 번만', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  const put = (json: string) => { const el = document.createElement('script'); el.id = STAYS_SEED_ID; el.type = 'application/json'; el.textContent = json; document.body.appendChild(el) }
  it('기본 질의 → 데이터, 두 번째는 undefined', () => {
    put(SEED)
    const qs = defaultStaysQs()
    expect(readStaysSeed(qs)?.length).toBe(4)
    expect(readStaysSeed(qs)).toBeUndefined()
  })
  it('다른 질의(지역 등)는 안 쓴다', () => {
    put(SEED)
    expect(readStaysSeed(defaultStaysQs() + '&region=서울')).toBeUndefined()
  })
  it('훅이 시드로 첫 렌더 + 마운트 뒤 한 번 새로 받는다', () => {
    const h = code('src/hooks/queries/useStaysSearch.ts')
    expect(h).toContain('initialData: () => readStaysSeed<StaySearchItem>(qs)')
    expect(h).toContain('initialDataUpdatedAt: 0')
  })
})

describe('⑥ 폴백과 배선', () => {
  it("큐레이션 줄이 없거나 시드가 깨지면 ''", () => {
    expect(buildStaysFirstScreen(JSON.stringify({ success: true, data: [stay(1)] }), LOADER, 'a', 'b')).toBe('')
    expect(buildStaysFirstScreen('{', LOADER, 'a', 'b')).toBe('')
    expect(buildStaysFirstScreen(JSON.stringify({ success: false, data: [] }), LOADER, 'a', 'b')).toBe('')
  })
  it('워커 — catch-all 앞, 폰 UA 에서만, 실패면 종전과 같다', () => {
    const w = code('src/worker/index.ts')
    const i = w.indexOf("} else if (url.pathname === '/stays' && ssrExtraPayload && shouldRenderMobileFirstScreen(")
    expect(i).toBeGreaterThan(0)
    const seg = w.slice(i, w.indexOf('} else {', i))
    expect(seg).toContain('staysFirst ? staysFirst + staysNs : staysNs + urdealLoaderHtml')
  })
  it('CSS 먼저 적용 표면에 /stays (첫 화면 CSS 로 그린다)', () => {
    expect(cssFirstApplies('/stays', IPHONE)).toBe(true)
    expect(cssFirstApplies('/stays', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })
})
