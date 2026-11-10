/**
 * 🔎 검색 화면(`/search`) 서버 첫 화면 (2026-11-10 — 라이브 폰 첫 그림 2.25s · HTML 0.3~0.5s).
 *
 * 지키는 것:
 *   ① 서버 HTML 이 `shared/search-page.ts` 의 클래스·문구 **전부**를 쓰고, 뿌리는 `SEARCH_CLS.root` · 헤더가 첫 자식
 *   ② `SearchPage`·`SearchHeader`·`SearchStates` 도 같은 상수를 쓴다 — 손으로 다시 적은 클래스 문자열이 없다(갈리면 마운트 때 모양이 바뀐다)
 *   ③ 검색어가 있으면 입력창에 되돌려 넣고(이스케이프) 안내 그림·가드 스크립트는 없다 · 없으면 유달이(eager · 96px · 공개 주소) + 안내 + 최근 검색어 가드
 *   ④ PC 면 [네비 높이 예약] + [430 액자] — 게스트 탭과 같은 상수 · 폰은 종전 그대로
 *   ⑤ 워커 배선(UA 는 빌더 인자) · `firstScreenApplies` 폰·PC 모두 · 표면 이름 `search` ↔ 생성기 ROOTS
 * ⚠️ 못 보는 것: 실제 픽셀 위치(jsdom) · 최근 검색어가 있는 사람의 마운트 모양(React 가 칩을 그린다 — 서버는 그 자리를 비운다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildSearchFirstScreen, searchQueryOf, searchFirstScreenGuardScript } from '@/worker/utils/search-first-screen'
import { SEARCH_CLS, SEARCH_COPY, SEARCH_LENS, SEARCH_HERO_MASCOT, RECENT_SEARCHES_KEY, SEARCH_QUERY_MAX } from '@/shared/search-page'
import { UDAL_HELLO_SRC } from '@/shared/mascot-art'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { GUEST_PC_FRAME } from '@/worker/utils/guest-first-screen'
import { firstScreenApplies, criticalSurfaceOf, criticalCssFor } from '@/worker/utils/css-first-boot'
// @ts-expect-error — .mjs 생성기(타입 없음)
import { SURFACE_ROOTS } from '../../../scripts/generate-critical-css.mjs'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const PAGE = src('src/pages/SearchPage.tsx'), HEADER = src('src/components/search/SearchHeader.tsx'), STATES = src('src/components/search/SearchStates.tsx')
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d }

describe('① 서버 HTML = 상수 전부', () => {
  const html = buildSearchFirstScreen('', LOADER, 'n')
  it.each(Object.entries(SEARCH_CLS).filter(([k]) => !['lensOn', 'inputFocus'].includes(k)))('클래스 %s', (_k, v) => { expect(html).toContain(v) })
  it('문구 · 돋보기 path · 뿌리와 헤더 순서 · 로더는 아래(34dvh)', () => {
    for (const v of Object.values(SEARCH_COPY).filter((s) => s !== SEARCH_COPY.closeTyping)) expect(html).toContain(v)
    expect(html).toContain(SEARCH_LENS.lens); expect(html).toContain(SEARCH_LENS.arrow)
    const root = dom(html).querySelector('#ur-first-screen > div')!
    expect(root.getAttribute('class')).toBe(SEARCH_CLS.root)
    expect(root.firstElementChild!.getAttribute('class')).toBe(SEARCH_CLS.header)
    expect(root.children[1].getAttribute('class')).toBe(SEARCH_CLS.content)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</div>'))
  })
  it('쓰는 상태 클래스(ur-sm-on · 포커스 테두리)는 서버가 그리지 않는다 — 쉬는 상태만', () => {
    expect(html).not.toContain(SEARCH_CLS.lensOn); expect(html).not.toContain(SEARCH_CLS.inputFocus)
    expect(html).toContain(`${SEARCH_CLS.lensBtn} ${SEARCH_CLS.lensIdle}`); expect(html).toContain(`${SEARCH_CLS.inputBase} ${SEARCH_CLS.inputIdle}`)
  })
})

describe('② 화면 셋이 같은 상수를 쓴다', () => {
  it('SearchPage 뿌리·본문 칸', () => {
    expect(PAGE).toContain('className={SEARCH_CLS.root}'); expect(PAGE).toContain('className={SEARCH_CLS.content}')
    expect(PAGE).not.toContain('"bg-white dark:bg-[#11141C] pb-safe-nav')
  })
  it('SearchHeader — 헤더·줄·버튼·입력·돋보기 path·문구', () => {
    for (const k of ['header', 'headerRow', 'field', 'form', 'lensBtn', 'lensOn', 'lensIdle', 'lensSvg', 'inputBase', 'inputFocus', 'inputIdle', 'bagIcon', 'backIcon', 'iconBtn'] as const) {
      expect(HEADER, k).toContain(`SEARCH_CLS.${k}`)
      expect(HEADER, `손으로 적은 ${k}`).not.toContain(`"${SEARCH_CLS[k]}"`)
    }
    expect(HEADER).toContain('d={SEARCH_LENS.lens}'); expect(HEADER).toContain('d={SEARCH_LENS.arrow}')
    expect(HEADER).toContain('defaultValue: SEARCH_COPY.placeholder'); expect(HEADER).toContain('defaultValue: SEARCH_COPY.closeTyping')
  })
  it('SearchStates — 상태 칸·안내 머리·유달이(priority · 같은 폭)·저장 키', () => {
    for (const k of ['states', 'hero', 'heroTitle', 'heroSub', 'heroMascot'] as const) expect(STATES, k).toContain(`SEARCH_CLS.${k}`)
    expect(STATES).toContain('<Udal mood="hello" size={SEARCH_HERO_MASCOT.width} priority className={SEARCH_CLS.heroMascot} />')
    expect(STATES).toContain('{SEARCH_COPY.heroTitle}'); expect(STATES).toContain('{SEARCH_COPY.heroSub}')
    expect(STATES).toContain('const RECENT_KEY = RECENT_SEARCHES_KEY'); expect(RECENT_SEARCHES_KEY).toBe('recent_searches_v1')
  })
})

describe('③ 검색어 유무', () => {
  it('없음: 유달이(eager·high·96px·공개 주소) + 안내 두 줄 + 최근 검색어 가드', () => {
    const html = buildSearchFirstScreen('', LOADER, 'n')
    const img = dom(html).querySelector('[data-search-hero] img')!
    expect(img.getAttribute('src')).toBe(UDAL_HELLO_SRC); expect(img.getAttribute('loading')).toBe('eager'); expect(img.getAttribute('fetchpriority')).toBe('high')
    expect(img.getAttribute('width')).toBe(String(SEARCH_HERO_MASCOT.width)); expect(img.getAttribute('data-udal')).toBe('hello')
    const guard = searchFirstScreenGuardScript('n')
    expect(html).toContain(guard); expect(guard).toContain(`localStorage.getItem('${RECENT_SEARCHES_KEY}'`); expect(guard).toContain('[data-search-hero]')
    expect(dom(html).querySelector('input')!.getAttribute('value')).toBe('')
  })
  it('있음: 입력창에 되돌린다(이스케이프) · 안내 그림·가드 없음 · 본문은 로더 자리', () => {
    const html = buildSearchFirstScreen('돈가스 <b>"x"</b>', LOADER, 'n')
    expect(dom(html).querySelector('input')!.getAttribute('value')).toBe('돈가스 <b>"x"</b>')
    expect(html).not.toContain('<b>'); expect(html).not.toContain('data-search-hero'); expect(html).not.toContain(RECENT_SEARCHES_KEY)
    expect(html).toContain(SEARCH_COPY.placeholder); expect(html).not.toContain(SEARCH_COPY.heroTitle)
  })
  it('searchQueryOf — ?q= 그대로 · 제어문자 제거 · 상한', () => {
    expect(searchQueryOf('?q=%EB%8F%88%EA%B0%80%EC%8A%A4&scope=exchange')).toBe('돈가스')
    expect(searchQueryOf('?scope=exchange')).toBe(''); expect(searchQueryOf('')).toBe('')
    expect(searchQueryOf('?q=a%00b%0Ac')).toBe('abc')
    expect(searchQueryOf('?q=' + 'x'.repeat(500)).length).toBe(SEARCH_QUERY_MAX)
  })
})

describe('④ PC = 네비 높이 예약 + 430 액자 · 폰은 그대로', () => {
  it('PC', () => {
    const d = dom(buildSearchFirstScreen('', LOADER, 'n', false))
    const fs = d.querySelector('#ur-first-screen')!
    expect(fs.children[0].getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(fs.children[0].children[0].getAttribute('class')).toBe(PC_HOME_FS.topnavRow1); expect(fs.children[0].children[1].getAttribute('class')).toBe(PC_HOME_FS.topnavRow2)
    const frame = fs.children[1] as HTMLElement
    expect(frame.getAttribute('class')).toBe(GUEST_PC_FRAME.cls); expect(frame.getAttribute('style')).toBe(`--app-frame:${GUEST_PC_FRAME.width}`)
    expect(frame.firstElementChild!.getAttribute('class')).toBe(SEARCH_CLS.root)
  })
  it('폰·기본값: 액자 없음, 뿌리가 첫 자식', () => {
    const fs = dom(buildSearchFirstScreen('', LOADER, 'n')).querySelector('#ur-first-screen')!
    expect(fs.children.length).toBe(1); expect(fs.firstElementChild!.getAttribute('class')).toBe(SEARCH_CLS.root)
    expect(buildSearchFirstScreen('', LOADER, 'n')).toBe(buildSearchFirstScreen('', LOADER, 'n', true))
  })
})

describe('⑤ 배선', () => {
  it('워커: /search 분기 — UA 는 빌더 인자 · 검색어는 searchQueryOf', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8') // ⚠️ worker/index.ts 엔 stripComments 를 쓰지 않는다('/*' 라우트 문자열이 가운데를 날린다 — source-text 머리말)
    expect(w).toContain("url.pathname === '/search') { const searchFirst = buildSearchFirstScreen(searchQueryOf(url.search), urdealLoaderHtml, nonce, shouldRenderMobileFirstScreen(c.req.header('user-agent')), ssrTarget?.slot === 'SEARCH' ? searchResultsHtml(ssrPayload, searchScopeOf(url.search)) : '');")
  })
  it('첫 화면 CSS 자격: 폰·PC 둘 다 · 표면 이름 search ↔ 생성기', () => {
    expect(firstScreenApplies('/search', PHONE)).toBe(true); expect(firstScreenApplies('/search/', PHONE)).toBe(true)
    expect(firstScreenApplies('/search', PC)).toBe(true)
    expect(firstScreenApplies('/search/x', PHONE)).toBe(false)
    expect(criticalSurfaceOf('/search')).toBe('search'); expect(criticalSurfaceOf('/search/')).toBe('search')
    expect(criticalCssFor('/search', 'FULL', 'HOME', { search: 'S' })).toBe('S')
    expect(SURFACE_ROOTS.search).toEqual(['src/worker/utils/search-first-screen.ts'])
  })
})
