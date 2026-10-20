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
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
  /**
   * 🔁 2026-10-14 재조준 — 상담 FAB(`.seller-chat-fab`)은 2026-10-12 셀러 대시보드 삭제 때 **요소째** 사라졌다
   *   (`seller-dashboard-gone-2026-10-12` 가 고정). 그 뒤 남은 CSS 두 줄은 아무것도 안 그리는 죽은 규칙이라
   *   CSS 다이어트에서 지웠다. 지키려던 것(바와 FAB 이 겹치지 않는다)은 **FAB 이 없다**로 더 강하게 성립한다 —
   *   FAB 이 되살아나면 바 높이만큼 올리는 규칙도 같이 되살려야 하므로 여기서 빨간불을 낸다.
   */
  it('상담 FAB 이 없다 — 되살리면 바 높이만큼 올리는 규칙도 함께 되살릴 것', () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = `${d}/${n}`
        if (statSync(p).isDirectory()) { if (n !== 'tests') walk(p, out) } else if (/\.(tsx|ts)$/.test(n)) out.push(p)
      }
      return out
    }
    const users = walk('src').filter((f) => readFileSync(f, 'utf8').includes('seller-chat-fab'))
    expect(users).toEqual([])
    expect(CSS).not.toMatch(/\.seller-chat-fab/)
    // 하단 탭이 사라진 뒤 바는 바닥(safe-area)에서 잰다 — 이 줄은 FAB 과 무관하게 그대로 지킨다.
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
