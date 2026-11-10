/**
 * 🔎 검색 결과 줄을 서버가 그린다 (2026-11-10).
 *   라이브 실측: 시드(#2293)·썸네일 preload(#2296) 뒤에도 결과 LCP 2.8~3.7s — 사진이 0.6s 에 와 있어도 줄이 앱 마운트 뒤에 그려졌다.
 *
 * 지키는 것:
 *   ① 서버 줄 = `RestaurantRow` 와 같은 클래스(`ROW_CLS`)·같은 사진 주소(`ROW_THUMB_OPTS`)·같은 문구(매장 접두 제거·가격·할인율)
 *   ② 고르는 줄 = `SearchPage` 첫 렌더와 같다(범위 필터 + 가격 기본 범위, 응답 순서) · 개수 = 그 줄 수 · 앞 `SR_SERVER_ROWS` 줄만
 *   ③ 화면(줄·정렬 줄·검색 화면)이 같은 상수를 쓴다 · 정렬 버튼 모양이 `Select` 소스와 같다 · 핀 그림이 아이콘 소스와 같다
 *   ④ 움직임은 한 번: 서버 목록이 `ur-sr-list` 로 올라오고, 앱은 서버가 그린 첫 목록을 다시 움직이지 않는다(검색어·정렬이 바뀌면 다시 움직인다)
 *   ⑤ 시드가 없거나 보일 줄이 0이면 종전(헤더 + 로더) · 줄을 그리면 로더는 없다 · 워커 배선
 * ⚠️ 못 보는 것: 실제 픽셀(2026-11-10 로컬 렌더 ↔ 라이브 앱 대조: 줄·정렬 줄·제목·가격 위치 일치) · 언어가 한국어가 아닌 사용자의 '총/개/관련도순'.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildSearchFirstScreen, searchResultsHtml } from '@/worker/utils/search-first-screen'
import { ROW_CLS, ROW_THUMB_OPTS, ROW_PIN, ROW_NO_ADDRESS } from '@/shared/row-thumb'
import { SR_CLS, SR_COPY, SR_SERVER_ROWS, SR_LIST_MOTION_CSS, SR_PRICE_RANGE, SR_SERVER_ROWS_ATTR } from '@/shared/search-page'
import { cfImage } from '@/utils/cf-image'

const read = (f: string) => readFileSync(f, 'utf8')
const ROW = read('src/pages/restaurant-map/RestaurantRow.tsx')
const BAR = read('src/components/search/SortFilterBar.tsx')
const PAGE = read('src/pages/SearchPage.tsx')
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const item = (id: number, over: Record<string, unknown> = {}) => ({ id, name: `가게${id} · 메뉴${id}`, restaurant_name: `가게${id}`, restaurant_address: `서울 ${id}길`, price: 7500, original_price: 14500, discount_rate: 0, image_url: `https://media.ur-team.com/up/${id}.jpg`, deal_only: 0, category: 'meal_voucher', ...over })
const seed = (rows: unknown[]) => JSON.stringify({ success: true, data: rows })
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }

describe('① 서버 줄 = RestaurantRow', () => {
  const d = dom(searchResultsHtml(seed([item(1), item(2, { image_url: null, restaurant_address: '', original_price: 7500 })]), 'voucher'))
  const rows = d.querySelectorAll(`[${SR_SERVER_ROWS_ATTR}] > div`)
  it('클래스 · 사진 주소 · 문구', () => {
    const r = rows[0]
    expect(r.getAttribute('class')).toBe(`${ROW_CLS.btn} ${ROW_CLS.btnIdle}`)
    const img = r.querySelector('img')!
    expect(img.getAttribute('class')).toBe(ROW_CLS.thumb)
    expect(img.getAttribute('src')).toBe(cfImage('https://media.ur-team.com/up/1.jpg', ROW_THUMB_OPTS))
    expect(img.getAttribute('loading')).toBe('eager')
    expect(r.querySelector(`[class="${ROW_CLS.title}"]`)!.textContent).toBe('메뉴1') // 매장 접두 제거(stripStorePrefix)
    expect(r.querySelector(`[class="${ROW_CLS.store}"]`)!.textContent).toBe('가게1')
    expect(r.querySelector(`[class="${ROW_CLS.addr}"]`)!.textContent).toBe('서울 1길')
    expect(r.querySelector(`[class="${ROW_CLS.discount}"]`)!.textContent).toBe('48%')
    expect(r.querySelector(`[class="${ROW_CLS.price}"]`)!.textContent).toBe('7,500원')
    expect(r.querySelector(`[class="${ROW_CLS.original}"]`)!.textContent).toBe('14,500원')
  })
  it('사진·주소·정가가 없는 줄', () => {
    const r = rows[1]
    expect(r.querySelector('img')).toBeNull(); expect(r.querySelector(`[class="${ROW_CLS.thumbEmpty}"]`)).not.toBeNull()
    expect(r.querySelector(`[class="${ROW_CLS.addr}"]`)!.textContent).toBe(ROW_NO_ADDRESS)
    expect(r.querySelector(`[class="${ROW_CLS.discount}"]`)).toBeNull(); expect(r.querySelector(`[class="${ROW_CLS.original}"]`)).toBeNull()
  })
  it('글자는 이스케이프한다', () => {
    const h = searchResultsHtml(seed([item(1, { name: '<b>x</b>', restaurant_name: 'a&b' })]), 'voucher')
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt;'); expect(h).toContain('a&amp;b'); expect(h).not.toContain('<b>x</b>')
  })
})

describe('② 고르는 줄 = SearchPage 첫 렌더', () => {
  it('범위 필터 · 가격 범위 · 응답 순서 · 개수 · 앞 줄만', () => {
    const rows = [item(1), item(2, { deal_only: 1 }), item(3, { category: 'fashion' }), item(4, { price: SR_PRICE_RANGE.max + 1, original_price: 0 }), ...Array.from({ length: 12 }, (_, i) => item(10 + i))]
    const d = dom(searchResultsHtml(seed(rows), 'voucher'))
    expect(d.querySelector(`[class="${SR_CLS.countNum}"]`)!.textContent).toBe('13') // 1 + 12 (교환권·쇼핑·범위 밖 제외)
    const drawn = [...d.querySelectorAll(`[${SR_SERVER_ROWS_ATTR}] > div`)]
    expect(drawn.length).toBe(SR_SERVER_ROWS)
    expect(drawn[0].textContent).toContain('메뉴1'); expect(drawn[1].textContent).toContain('메뉴10')
    expect(drawn.filter((r) => r.querySelector('img')!.getAttribute('loading') === 'eager').length).toBe(4)
    const ex = dom(searchResultsHtml(seed(rows), 'exchange'))
    expect(ex.querySelector(`[class="${SR_CLS.countNum}"]`)!.textContent).toBe('1'); expect(ex.textContent).toContain('메뉴2')
  })
  it('화면이 같은 가격 범위를 쓴다', () => { expect(PAGE).toContain('useState<{ min: number; max: number }>({ ...SR_PRICE_RANGE })') })
})

describe('③ 화면이 같은 상수를 쓴다', () => {
  it('RestaurantRow — 손으로 적은 클래스 0', () => {
    for (const k of Object.keys(ROW_CLS) as Array<keyof typeof ROW_CLS>) { expect(ROW, k).toContain(`ROW_CLS.${k}`); expect(ROW, `손으로 적은 ${k}`).not.toContain(`"${ROW_CLS[k]}"`) }
    expect(ROW.match(/ROW_NO_ADDRESS/g)!.length).toBe(3)
  })
  it('SortFilterBar · SearchPage', () => {
    for (const k of ['bar', 'barRow', 'countWrap', 'countText', 'countNum', 'sortWrap', 'sortBtn'] as const) expect(BAR, k).toContain(`SR_CLS.${k}`)
    for (const k of ['prefix', 'suffix', 'sortRelevance'] as const) expect(BAR, k).toContain(`defaultValue: SR_COPY.${k}`)
    expect(PAGE).toContain('${SR_CLS.list}'); expect(PAGE).toContain('${SR_CLS.listMotion}')
    expect(PAGE).toContain('${SR_LIST_MOTION_CSS}${SR_LIST_MOTION_REDUCE_CSS}')
  })
  it('정렬 버튼 모양 = Select 소스 · 핀 = 아이콘 소스', () => {
    const sel = read('src/components/ui/select.tsx')
    expect(sel).toContain('className={`${className} ' + SR_CLS.sortBtnTail + '`}')
    expect(sel).toContain('<span className={`' + SR_CLS.sortLabel + '${')
    expect(sel).toContain(`<ChevronDown className="${SR_CLS.sortChevron}"`)
    const icons = read('src/components/icons/urdeal-icons.tsx')
    expect(icons).toContain(`<path d="${ROW_PIN.path}"`); expect(icons).toContain(`<circle cx="${ROW_PIN.cx}" cy="${ROW_PIN.cy}" r="${ROW_PIN.r}"`)
    const h = searchResultsHtml(seed([item(1)]), 'voucher')
    expect(h).toContain(`<span class="${SR_CLS.sortBtn} ${SR_CLS.sortBtnTail}"><span class="${SR_CLS.sortLabel}">${SR_COPY.sortRelevance}</span>`)
    expect(h).toContain(ROW_PIN.path)
  })
})

describe('④ 움직임은 한 번', () => {
  it('서버 목록이 움직임 클래스·CSS 를 갖는다', () => {
    const h = searchResultsHtml(seed([item(1)]), 'voucher')
    expect(h).toContain(`<style>${SR_LIST_MOTION_CSS}`); expect(h).toContain(`class="${SR_CLS.list} ${SR_CLS.listMotion}" ${SR_SERVER_ROWS_ATTR}=""`)
    expect(SR_LIST_MOTION_CSS).toContain('.ur-sr-list > *:nth-child(-n+8)')
  })
  it('앱은 서버가 그린 첫 목록만 움직임을 생략한다', () => {
    expect(PAGE).toContain("const SERVER_DREW_ROWS = typeof document !== 'undefined' && !!document.querySelector(`#ur-first-screen [${SR_SERVER_ROWS_ATTR}]`)")
    expect(PAGE).toContain('if (`${query}|${sortBy}` !== firstListKey.current) leftFirstList.current = true')
    expect(PAGE).toContain('const skipListMotion = SERVER_DREW_ROWS && !leftFirstList.current')
    expect(PAGE).toContain("className={`${SR_CLS.list}${skipListMotion ? '' : ` ${SR_CLS.listMotion}`}`}")
  })
})

describe('⑤ 없으면 종전 · 배선', () => {
  it.each([[null], [''], ['{bad'], [seed([])], [seed([item(1, { deal_only: 1 })])], [JSON.stringify({ success: false })]])('줄 없음: %s', (p) => { expect(searchResultsHtml(p as string | null, 'voucher')).toBe('') })
  it('줄을 그리면 로더가 없고, 없으면 로더가 있다', () => {
    const withRows = buildSearchFirstScreen('돈가스', LOADER, 'n', true, searchResultsHtml(seed([item(1)]), 'voucher'))
    expect(withRows).not.toContain('LOADER'); expect(withRows).toContain(SR_SERVER_ROWS_ATTR)
    const without = buildSearchFirstScreen('돈가스', LOADER, 'n', true, '')
    expect(without).toContain('LOADER'); expect(without).toContain('min-height:34dvh')
    expect(buildSearchFirstScreen('', LOADER, 'n', true, 'X')).not.toContain('X</div>') // 검색어가 없으면 결과 자리는 없다
  })
  it('워커 배선 — SEARCH 시드일 때만', () => {
    expect(read('src/worker/index.ts')).toContain("ssrTarget?.slot === 'SEARCH' ? searchResultsHtml(ssrPayload, searchScopeOf(url.search)) : '');")
  })
})
