/**
 * ⏱️ 로더 즉시 표시 (2026-11-09) — HTML 이 shy 창(0.5초)보다 늦게 왔으면 로더의 0.5초 숨김을 다시 기다리지 않는다.
 *
 * 라이브 스크린샷 실측(폰 4G·CPU 4배, /cart): HTML 0.48s 도착 → 흰 화면 → 뼈대 **+0.7s**. 느린 회선일수록 "이미 기다린" 손님에게
 * 0.5초를 더 숨겼다. 지키는 것:
 *   ① 워커 head 스크립트가 responseStart > LOADER_EARLY_REVEAL_MS 면 :root 에 --ur-ldr-in-d:0s + window.__urLdrEarly
 *   ② 그 값은 shy 창과 같다(0.5초 = 500ms) — 둘이 다르면 "0.5초 안에 끝나면 안 보인다" 가 두 뜻
 *   ③ 앱 BrandLoader 도 그 표식을 읽어 바로 보인다(교체 순간 다시 숨지 않게) — loaderPhaseVars(early)
 *   ④ applyCssFirstBoot 가 켜질 때마다 넣는다(첫 화면 표면·로더-먼저 표면 둘 다)
 * ⚠️ 못 보는 것: 실제 화면에 뼈대가 몇 ms 에 보이는지(스크린샷 — scratchpad/ldrshot.cjs 방식).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { loaderEarlyRevealScript, applyCssFirstBoot } from '@/worker/utils/css-first-boot'
import { loaderPhaseVars, LOADER_EARLY_REVEAL_MS, LOADER_REVEAL_S } from '@/shared/brand-loader-markup'

describe('⏱️ 로더 즉시 표시', () => {
  it('① 스크립트: responseStart 가 상한을 넘으면 :root 변수 0s + 표식', () => {
    const s = loaderEarlyRevealScript('N')
    expect(s).toMatch(/^<script nonce="N">/)
    expect(s).toContain(`n.responseStart>${LOADER_EARLY_REVEAL_MS}`)
    expect(s).toContain("document.documentElement.style.setProperty('--ur-ldr-in-d','0s')")
    expect(s).toContain('window.__urLdrEarly=1')
    expect(s).toMatch(/try\{[\s\S]*\}catch\(e\)\{\}/) // 실패해도 종전 로더
  })
  it('② 상한 = shy 창', () => {
    expect(LOADER_EARLY_REVEAL_MS).toBe(LOADER_REVEAL_S * 1000)
    expect(LOADER_EARLY_REVEAL_MS).toBe(500)
  })
  it('③ 앱 로더도 표식을 읽는다', () => {
    expect(loaderPhaseVars(0.1, true)['--ur-ldr-in-d']).toBe('0.000s')
    expect(loaderPhaseVars(0.1, false)['--ur-ldr-in-d']).toBe('0.400s')
    expect(loaderPhaseVars(0.1)['--ur-ldr-in-d']).toBe('0.400s') // 기본값은 종전 그대로
    const bl = stripComments(readFileSync('src/components/brand/BrandLoader.tsx', 'utf8'))
    expect(bl).toMatch(/__urLdrEarly/)
    expect(bl).toMatch(/loaderPhaseVars\(sinceFirstPaintS\(\), early\)/)
  })
  it('④ applyCssFirstBoot 가 head 에 넣는다', () => {
    const on: Array<[string, { element: (el: unknown) => void }]> = []
    const rw = { on(sel: string, h: { element: (el: unknown) => void }) { on.push([sel, h]); return rw } }
    applyCssFirstBoot(rw as unknown as HTMLRewriter, 'N', true, '', ':root{--brand:#000}')
    let html = ''
    on.find(([sel]) => sel === 'head')![1].element({ prepend: (h: string) => { html = h } })
    expect(html).toContain(loaderEarlyRevealScript('N'))
    expect(html.indexOf(loaderEarlyRevealScript('N'))).toBeLessThan(html.indexOf('<style id="ur-critical">'))
  })
})
