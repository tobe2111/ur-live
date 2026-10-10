/**
 * ⚡ 추첨 배지 움직임 + 프로모 띠 캐시 (2026-10-10, 대표 "페이지 로딩은 전반적으로 느리고").
 *
 * 라이브 실측: 배지의 `text-shadow` 무한 애니메이션이 홈·지도의 메인 스레드를 상시 24% 점유했다
 * (5초에 레이아웃 300회 · 4배 스로틀 메인 스레드 작업 10.4초 → 이것만 끄면 0.06초).
 * 에러가 안 나고 화면도 멀쩡해서 아무도 모른다 — 그래서 시험으로 박는다.
 *
 * ⚠️ 이 시험이 못 보는 것: 다른 파일의 무한 애니메이션 · 인라인 style 애니메이션 ·
 *    실제로 몇 ms 빨라졌는지(그건 브라우저 실측만 판정한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const css = stripComments(readFileSync('src/index.css', 'utf-8'))
const keyframes = (name: string) => {
  const i = css.indexOf(`@keyframes ${name}`)
  expect(i, `@keyframes ${name} 를 못 찾았다 — 이름이 바뀌었으면 이 시험도 옮길 것`).toBeGreaterThan(-1)
  let depth = 0
  for (let j = css.indexOf('{', i); j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}' && --depth === 0) return css.slice(i, j + 1)
  }
  throw new Error('닫는 중괄호 없음')
}
// 컴포지터가 돌릴 수 있는 속성만 — 그 밖은 매 프레임 스타일·레이아웃·페인트를 다시 돈다.
const COMPOSITOR_ONLY = new Set(['transform', 'opacity'])
const animatedProps = (block: string) =>
  [...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !/^\d/.test(p))

describe('추첨 배지 — 무한 애니메이션은 컴포지터 속성만', () => {
  for (const name of ['fcfs-spark', 'fcfs-flame']) {
    it(`${name} 는 transform·opacity 만 바꾼다`, () => {
      const props = animatedProps(keyframes(name).replace(/^[^{]*\{/, ''))
      expect(props.length, '속성을 하나도 못 읽으면 통과가 아니라 고장이다').toBeGreaterThan(0)
      expect(props.filter((p) => !COMPOSITOR_ONLY.has(p))).toEqual([])
    })
  }
  it('불꽃이 배지마다 상시 레이어를 잡지 않는다(will-change 없음)', () => {
    const i = css.indexOf('.animate-fcfs-flame {')
    expect(i).toBeGreaterThan(-1)
    const rule = css.slice(i, css.indexOf('}', i))
    expect(rule).not.toMatch(/will-change/)
  })
  it('스파크의 글로우는 남아 있다(고정) — 움직임만 바꿨지 강조를 지운 게 아니다', () => {
    const i = css.indexOf('.animate-fcfs-spark {')
    expect(i).toBeGreaterThan(-1)
    expect(css.slice(i, css.indexOf('}', i))).toMatch(/text-shadow/)
  })
})

describe('프로모 띠 — 꺼져 있어도 캐시된다', () => {
  const src = stripComments(readFileSync('src/worker/routes/public-utility.routes.ts', 'utf-8'))
  const start = src.indexOf("get('/api/promo-bar'")
  const body = src.slice(start, src.indexOf('publicUtilityRoutes.', start + 10))
  it('꺼진 응답(empty)을 돌려주기 전에 Cache-Control 을 붙인다', () => {
    expect(start).toBeGreaterThan(-1)
    const header = body.indexOf("c.header('Cache-Control'")
    const earlyReturn = body.indexOf('return c.json(empty)')
    expect(header).toBeGreaterThan(-1)
    expect(earlyReturn).toBeGreaterThan(-1)
    expect(header, '헤더가 꺼진 응답보다 뒤에 있으면 평소(꺼짐) 요청은 매번 D1 을 읽는다').toBeLessThan(earlyReturn)
  })
})
