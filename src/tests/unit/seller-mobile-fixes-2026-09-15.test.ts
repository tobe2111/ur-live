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
import { SELLER_BOTTOM_BAR_H } from '../../components/seller-layout/SellerBottomBar'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const LAYOUT = read('src/components/SellerLayout.tsx')
const BAR = read('src/components/seller-layout/SellerBottomBar.tsx')
const GB = read('src/pages/SellerGroupBuyPage.tsx')
const CSS = readFileSync('src/index.css', 'utf8')

describe('④ 상담 FAB 과 하단 고정 바가 같은 띠를 쓰지 않는다', () => {
  it('바가 자기 존재를 body 에 켜고, 사라질 때 끈다', () => {
    expect(BAR).toMatch(/classList\.add\('seller-has-bottom-bar'\)/)
    expect(BAR).toMatch(/classList\.remove\('seller-has-bottom-bar'\)/)
  })
  it('CSS 가 그 신호를 보고 FAB 을 올린다', () => {
    expect(CSS).toMatch(/body\.seller-has-bottom-bar \.seller-chat-fab/)
  })
  it('🔢 CSS 숫자가 TS 상수와 같다 — 한쪽만 바뀌면 다시 겹친다', () => {
    const block = CSS.slice(CSS.indexOf('.seller-chat-fab'))
    // 🧱 2026-10-12 4단계: 하단 탭(60px)이 사라져 FAB·바 모두 바닥(safe-area)에서 잰다 — 남은 숫자는 바 높이 하나다.
    const lifted = block.match(/body\.seller-has-bottom-bar \.seller-chat-fab \{ bottom: calc\(env\(safe-area-inset-bottom\) \+ (\d+)px/)
    expect(lifted).toBeTruthy()
    expect(Number(lifted![1])).toBe(SELLER_BOTTOM_BAR_H)
    // 없어진 탭 높이가 CSS·바에 남으면 바와 FAB 이 탭 자리만큼 허공에 뜬다(마이 시트 안에서 실제로 떠 있었다).
    expect(block.slice(0, 600)).not.toMatch(/calc\(60px/)
    expect(BAR).toMatch(/bottom: 'env\(safe-area-inset-bottom\)'/)
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
