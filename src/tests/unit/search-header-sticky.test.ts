import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** 주석 제거 — 배선은 **코드**에 있어야 한다(설명만 남아도 통과하는 함정 차단). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const read = (p: string) => strip(readFileSync(join(process.cwd(), p), 'utf8'))

const HEADER = read('src/components/search/SearchHeader.tsx')
const NAV = read('src/components/main/DesktopTopNav.tsx')

/**
 * 🔍 **검색 헤더가 전역 네비를 덮지 않는다** (2026-09-15 — 화면 고정 재조사).
 *
 * `DesktopTopNav` 는 `hidden md:block sticky top-0 z-40` 이다. 그런데 `/search` 의 자체 헤더도
 * `sticky top-0` 인 데다 **z-50 으로 더 높아서**, md+ 에서 스크롤하면 네비 위에 올라앉았다.
 * 실측 @900(스크롤 500): 네비 `0~114` 위로 검색바 `0~65` → **네비 아래 49px 만 남은 반쪽 바**.
 *
 * ## 왜 "오프셋 숫자"로 고치면 안 되는가 — 이 자리는 이미 한 번 그렇게 고쳤다가 틀어졌다
 * 2026-08 에 `md:top-[102px]`(그때 네비 높이)로 맞췄는데, 한 달 뒤 네비가 **114px** 로 자라며
 * 그 값이 조용히 틀려졌다. 오프셋은 **다른 파일의 높이를 외우는 것**이라 반드시 드리프트한다.
 * ⇒ 처방은 "md+ 에서 고정을 푼다"(`md:static`) — 그 구간엔 네비가 자체 검색창을 이미 띄운다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀 겹침. 브라우저가 필요하다(이번엔 로컬 dev 서버 +
 *   Playwright 로 쟀고, 고치기 전 `🔴 페이지바 0~65 z=50`, 고친 뒤 `✅ 페이지바 0` 이었다).
 *   여기서 고정하는 것은 **"두 고정 헤더가 같은 구간에서 같은 자리를 다투지 않는다"** 는 배선뿐이다.
 */
describe('🔍 /search 자체 헤더가 md+ 에서 전역 네비와 자리를 다투지 않는다', () => {
  it('🔒 전제 — 전역 네비는 md 부터 top-0 에 고정된다(이게 깨지면 이 테스트의 근거가 바뀐다)', () => {
    expect(NAV).toMatch(/desktop-topnav[^"]*hidden md:block[^"]*sticky top-0/)
  })

  it('🔒 검색 헤더는 md+ 에서 고정을 푼다 — 숫자 오프셋으로 때우지 않는다', () => {
    const root = HEADER.match(/<div className="sticky top-0[^"]*"/)?.[0] ?? ''
    expect(root, 'SearchHeader 루트의 sticky 선언을 못 찾았다 — 구조가 바뀌었으면 이 테스트도 갱신할 것').not.toBe('')
    // md+ 탈출구가 있어야 한다(고정 해제 또는 숨김). 없으면 네비를 덮는다.
    expect(root).toMatch(/md:static|md:relative|md:hidden/)
  })

  it('🔒 네비 높이를 외운 오프셋 금지 — 드리프트의 원인이었다', () => {
    const root = HEADER.match(/<div className="sticky top-0[^"]*"/)?.[0] ?? ''
    expect(root, '`md:top-[NNpx]` 는 다른 파일의 높이를 복사한 것이라 반드시 어긋난다').not.toMatch(/md:top-\[\d+px\]/)
  })

  it('🔒 모바일(<md)은 고정 그대로 — 거기엔 네비가 없다', () => {
    const root = HEADER.match(/<div className="sticky top-0[^"]*"/)?.[0] ?? ''
    expect(root).toMatch(/^<div className="sticky top-0\b/)
    expect(root).not.toMatch(/\bhidden\b/)   // 모바일에서 통째로 숨기면 검색창이 사라진다
  })
})
