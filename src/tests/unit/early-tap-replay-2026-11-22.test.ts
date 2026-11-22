/**
 * 👆 2026-11-22 앱이 뜨기 전에 누른 것을 기억했다가 대신 눌러 준다 (대표 "유료 제외 모두 진행").
 *   느린 폰에서 앱 코드가 오기까지 약 2초 — 그동안 서버가 그린 첫 화면의 버튼(사진 크게 보기·리뷰 수)은 눌러도 반응이 없었다.
 *   ① 기록: 워커 부팅 스크립트가 첫 화면 안의 **링크 아닌** 클릭 자리만 적는다  ② 실행: 교체 뒤 같은 자리의 **버튼**만, 한 번만.
 * ⚠️ 못 막는 것: 교체 뒤 같은 자리에 *다른* 버튼이 오는 배치 변화(서버·앱 첫 화면이 같은 구조라는 기존 가드에 기댄다).
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cssFirstBootScript } from '@/worker/utils/css-first-boot'
import { replayEarlyTap, EARLY_TAP_MAX_AGE_MS, captureBootFirstScreen } from '@/lib/boot-first-screen'

type W = { __urTap?: { x: number; y: number; t: number; sy: number } | null }
const w = window as unknown as W

function runBootScript() {
  const js = cssFirstBootScript('n').replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
  new Function(js)()
}
function at(el: Element | null) { (document as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () => el }

beforeEach(() => { document.body.innerHTML = ''; w.__urTap = null; vi.restoreAllMocks() })

describe('① 기록 — 부팅 스크립트', () => {
  it('첫 화면 안의 버튼 클릭은 자리를 적고, 링크·첫 화면 밖은 안 적는다', () => {
    document.body.innerHTML = '<div id="root"><div id="ur-first-screen"><div role="button" id="photo"></div><a href="/" id="link"><span id="in-link">홈</span></a></div></div><button id="outside"></button>'
    runBootScript()
    document.getElementById('in-link')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }))
    expect(w.__urTap).toBeNull()
    document.getElementById('outside')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 5 }))
    expect(w.__urTap).toBeNull()
    document.getElementById('photo')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 150 }))
    expect(w.__urTap).toMatchObject({ x: 120, y: 150, sy: 0 })
  })
})

describe('② 실행 — 교체 뒤', () => {
  const tap = (over: Partial<NonNullable<W['__urTap']>> = {}) => { w.__urTap = { x: 120, y: 150, t: Date.now(), sy: 0, ...over } }
  const button = () => { const b = document.createElement('div'); b.setAttribute('role', 'button'); const inner = document.createElement('img'); b.appendChild(inner); document.body.appendChild(b); const clicked = vi.fn(); b.addEventListener('click', clicked); at(inner); return clicked }

  it('같은 자리의 버튼을 한 번만 누른다', () => {
    const clicked = button(); tap()
    expect(replayEarlyTap()).toBe(true)
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(replayEarlyTap()).toBe(false)
    expect(clicked).toHaveBeenCalledTimes(1)
  })
  it('오래된 누름 · 그 사이 화면을 내림 · 버튼이 아닌 자리 → 안 누른다', () => {
    const clicked = button()
    tap({ t: Date.now() - EARLY_TAP_MAX_AGE_MS - 1 }); expect(replayEarlyTap()).toBe(false)
    tap({ sy: 300 }); expect(replayEarlyTap()).toBe(false)
    const plain = document.createElement('p'); document.body.appendChild(plain); at(plain)
    tap(); expect(replayEarlyTap()).toBe(false)
    expect(clicked).not.toHaveBeenCalled()
  })
  it('아직 서버 첫 화면이 그 자리에 있으면(교체 전) 안 누른다', () => {
    document.body.innerHTML = '<div id="ur-first-screen"><div role="button" id="old"></div></div>'
    const old = document.getElementById('old')!; const clicked = vi.fn(); old.addEventListener('click', clicked); at(old)
    tap(); expect(replayEarlyTap()).toBe(false); expect(clicked).not.toHaveBeenCalled()
  })
  it('첫 화면 노드가 문서에서 빠지면 저절로 실행된다(폴백이 도로 붙이는 동안은 아님)', async () => {
    document.body.innerHTML = '<div id="root"><div id="ur-first-screen"></div></div>'
    const root = document.getElementById('root')!; const node = document.getElementById('ur-first-screen')!
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => { f(0); return 0 })
    captureBootFirstScreen()
    root.removeChild(node); root.appendChild(node) // 폴백이 같은 노드를 도로 붙임
    await new Promise((r) => setTimeout(r, 0))
    const clicked = button(); tap()
    expect(clicked).not.toHaveBeenCalled()
    root.removeChild(node) // 진짜 교체
    await vi.waitFor(() => expect(clicked).toHaveBeenCalledTimes(1))
  })
})
