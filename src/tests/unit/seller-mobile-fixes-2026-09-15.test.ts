/**
 * 📱 셀러 모바일 결함 4건 (2026-09-15, 대표 신고 — 스크린샷 3장).
 *
 *   ① *"왜 내 매장 부분에 로딩이 걸리는거지?"*        → 두 요청이 서로를 기다렸다
 *   ② *"모바일로 볼 때는 왜 매장 등록하는게 안보이지?"* → 폰 홈에서 매장 블록을 통째로 안 그렸다
 *   ③ *"3번째 이미지에선 내 매장 관리가 가능해야"*      → 카드에 위임·삭제로 가는 길이 없었다
 *   ④ *"버튼들이 겹치는 경우도 있고"*                  → 상담 FAB 과 하단 고정 바가 같은 띠를 썼다
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 픽셀 겹침은 브라우저만 안다. 여기서는 **셋이 같은 숫자를 쓰는지**와
 *   배선만 고정한다(그 숫자가 화면에서 맞는지는 폰으로 눈 확인).
 *
 * 주입 매니페스트: scripts/mutations/seller-mobile-fixes.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { SELLER_TABBAR_H } from '../../components/seller-layout/SellerBottomTabs'
import { SELLER_BOTTOM_BAR_H } from '../../components/seller-layout/SellerBottomBar'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PANEL = read('src/pages/seller-page/MyStoresPanel.tsx')
const PAGE = read('src/pages/SellerPage.tsx')
const LAYOUT = read('src/components/SellerLayout.tsx')
const BAR = read('src/components/seller-layout/SellerBottomBar.tsx')
const GB = read('src/pages/SellerGroupBuyPage.tsx')
const CSS = readFileSync('src/index.css', 'utf8')

describe('① 내 매장 로딩 — 두 요청이 서로를 기다리지 않는다', () => {
  it('매장 목록과 좌석 판정을 함께 await 하지 않는다', () => {
    // 종전: `await Promise.allSettled([A, B])` → 느린 쪽이 끝나야 목록이 그려졌다.
    expect(PANEL).not.toContain('Promise.allSettled')
  })
  it('각 요청이 자기 결과만 따로 반영한다', () => {
    expect(PANEL).toMatch(/api\.get\('\/api\/seller\/my-stores'\)\s*\.then\(/)
    expect(PANEL).toMatch(/api\.get\('\/api\/seller\/stores\/context'\)\s*\.then\(/)
  })
  it('둘 다 실패해도 스피너에 갇히지 않는다 (각각 catch)', () => {
    // 🩸 첫 판은 앵커에서 260자를 잘라 `.catch(` 를 찾았는데, **그 창이 다음 요청의 catch 까지 먹어서**
    //   my-stores 의 catch 를 통째로 지워도 초록이었다(주입이 잡았다). ⇒ catch 를 **자기 setter 에 묶어** 본다.
    expect(PANEL).toMatch(/api\.get\('\/api\/seller\/my-stores'\)[\s\S]{0,200}?\.catch\(\(\) => setStores/)
    expect(PANEL).toMatch(/api\.get\('\/api\/seller\/stores\/context'\)[\s\S]{0,240}?\.catch\(\(\) => setSeatReady/)
  })
  it('목록이 오면 좌석 판정을 안 기다린다 — 등록 매장이 0일 때만 기다린다', () => {
    expect(PANEL).toMatch(/const loading = stores === null \|\| \(registered\.length === 0 && seatReady === undefined\)/)
  })
  it("'판정 중'과 '판정 실패'를 구분한다 (게이트 깜빡임 차단)", () => {
    expect(PANEL).toMatch(/useState<boolean \| null \| undefined>\(undefined\)/)
  })
})

describe('② 폰 홈에 매장 진입점이 있다', () => {
  it('매장 패널을 폰에서 숨기지 않는다', () => {
    expect(PAGE).toContain('<MyStoresPanel')
    // 종전: gateOnly={!isPc} — 폰에서는 등록 매장이 있으면 아무것도 안 그렸다.
    expect(PAGE).not.toMatch(/gateOnly=\{!isPc\}/)
    expect(PAGE).not.toMatch(/<MyStoresPanel[^>]*gateOnly/)
  })
  it('패널에 매장 추가 버튼이 그대로 있다', () => {
    expect(PANEL).toMatch(/seller\.stores\.addStore/)
  })
})

describe('③ 내 매장 카드에서 관리로 갈 수 있다', () => {
  it('카드가 매장 관리 페이지로 연결된다', () => {
    expect(PANEL).toMatch(/to="\/seller\/stores"/)
  })
})

describe('④ 상담 FAB 과 하단 고정 바가 같은 띠를 쓰지 않는다', () => {
  it('FAB 위치를 Tailwind 고정값으로 박지 않는다 (CSS 가 정한다)', () => {
    const at = LAYOUT.indexOf('seller-chat-fab')
    expect(at).toBeGreaterThan(0)
    const cls = LAYOUT.slice(at, at + 400)
    expect(cls).not.toMatch(/\bbottom-24\b/)   // 96px 고정 — safe-area 도 무시했다
  })
  it('바가 자기 존재를 body 에 켜고, 사라질 때 끈다', () => {
    expect(BAR).toMatch(/classList\.add\('seller-has-bottom-bar'\)/)
    expect(BAR).toMatch(/classList\.remove\('seller-has-bottom-bar'\)/)
  })
  it('CSS 가 그 신호를 보고 FAB 을 올린다', () => {
    expect(CSS).toMatch(/body\.seller-has-bottom-bar \.seller-chat-fab/)
  })
  it('🔢 CSS 숫자가 TS 상수와 같다 — 한쪽만 바뀌면 다시 겹친다', () => {
    const block = CSS.slice(CSS.indexOf('.seller-chat-fab'))
    const lifted = block.match(/body\.seller-has-bottom-bar \.seller-chat-fab \{ bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\) \+ (\d+)px/)
    expect(lifted).toBeTruthy()
    expect(Number(lifted![1])).toBe(SELLER_TABBAR_H)
    expect(Number(lifted![2])).toBe(SELLER_BOTTOM_BAR_H)
  })
  it('바 스페이서가 바 높이와 같은 상수를 쓴다 (마지막 행이 안 가린다)', () => {
    expect(BAR).toMatch(/height: SELLER_BOTTOM_BAR_H/)
  })
})

describe('⑤ 이용권이 없을 때 등록 버튼이 둘 뜨지 않는다', () => {
  it('목록이 비면 고정 바를 안 그린다 (빈 상태 카드가 이미 CTA 를 세운다)', () => {
    expect(GB).toMatch(/products\.length > 0 && \(\s*<SellerBottomBar>/)
  })
  it('고정 바는 손으로 그리지 않고 공용 부품을 쓴다', () => {
    expect(GB).toContain('SellerBottomBar')
    expect(GB).not.toMatch(/fixed inset-x-0 z-\[40\]/)
  })
})
