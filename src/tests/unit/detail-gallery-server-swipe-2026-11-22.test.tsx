/**
 * 🖐️ 2026-11-22 (대표 *"유어딜 상세페이지에 사진 넘기는거 초반에 넘기려해도 잘 안넘어가"*) — 서버 첫 화면에서 넘긴 사진을 앱이 이어받는다.
 *
 * 라이브 실측(폰 4G · CPU 4배, /pass/3119 사진 3장): 1.2초에 넘기면 사진이 넘어가다가 **2.1초에 1번으로 되돌아갔다** —
 *   그때 앱이 서버 첫 화면(`#ur-first-screen`)을 통째로 갈아끼우고, 새 사진 줄은 늘 첫 장에서 시작했기 때문이다.
 *   2초 뒤에 넘기면 됐다(그래서 "초반에만"). 고친 빌드를 같은 조건으로 돌리면 0.6초·1.2초에 넘긴 장이 그대로 남는다.
 * 이 시험은 "앱이 첫 렌더 때 서버 화면의 위치를 읽어 그 장에서 시작한다" 를 jsdom 에서 고정한다.
 * ⚠️ 못 막는 것: ① 첫 장이 한 프레임 보였다가 넘어가는 깜빡임(useLayoutEffect 가 막는다 — jsdom 은 프레임을 못 본다) ②손가락이 **아직 화면에 닿아 있는 순간** 교체되면 그 한 번의 끌기는 끊긴다(놓은 뒤 위치만 이어받는다).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import DetailGallery from '@/pages/group-buy/DetailGallery'

const IMGS = ['https://media.ur-team.com/a.jpg', 'https://media.ur-team.com/b.jpg', 'https://media.ur-team.com/c.jpg']

function serverScreen(scrollLeft: number) {
  const fs = document.createElement('div'); fs.id = 'ur-first-screen'
  const sc = document.createElement('div'); sc.setAttribute('style', 'display:flex;overflow-x:auto;scroll-snap-type:x mandatory')
  Object.defineProperty(sc, 'clientWidth', { value: 390 }); sc.scrollLeft = scrollLeft
  Object.defineProperty(sc, 'scrollLeft', { value: scrollLeft })
  fs.appendChild(sc); document.body.appendChild(fs)
}
const scroller = (c: HTMLElement) => c.querySelector('[data-vt-hero]')?.parentElement as HTMLElement

afterEach(() => { document.getElementById('ur-first-screen')?.remove() })

describe('서버 첫 화면에서 넘긴 사진을 이어받는다', () => {
  it('서버 화면에서 2번째 장에 있었으면 앱도 2번째 장(scrollLeft = 1 × 폭)에서 시작한다', () => {
    serverScreen(390)
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 390 } })
    const { container } = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(scroller(container).scrollLeft).toBe(390)
  })
  it('서버 화면이 없거나 첫 장이면 첫 장에서 시작한다(앱 안 이동 · 안 넘긴 경우)', () => {
    const a = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(scroller(a.container).scrollLeft).toBe(0)
    a.unmount()
    serverScreen(0)
    const b = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(scroller(b.container).scrollLeft).toBe(0)
  })
  it('사진 수보다 큰 번호는 마지막 장으로 자른다', () => {
    serverScreen(390 * 9)
    const { container } = render(<DetailGallery images={IMGS} alt="가게" />)
    expect(scroller(container).scrollLeft).toBe(390 * 2)
  })
})
