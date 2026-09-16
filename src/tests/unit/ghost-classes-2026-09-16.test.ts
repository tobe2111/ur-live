/**
 * 👻 **소스에 썼는데 CSS 에 없는 클래스** — 판정 동작을 직접 잰다 (2026-09-16).
 *
 * ## 왜 이 테스트가 따로 있나
 * 가드 본체(`scripts/check-ghost-classes.mjs`)는 `dist/` 산출물이 있어야 돌아서 CI 에서 **build 뒤**에만
 * 실행된다. 그런데 주입 러너(`check-guard-mutations`)는 **build 앞**에서 돌기 때문에, 그 가드를
 * 주입 대상으로 삼으면 dist 가 없어 **무조건 빨간불** → "잡았다"는 판정이 헛돈다.
 * 그래서 판정의 핵심을 `scripts/ghost-classes-core.mjs` 로 빼고, 여기서 **동작을 실제로 재고**
 * 주입은 이 테스트에 건다.
 *
 * ## 이 검사가 못 하는 것
 * 라이브 CSS 전체와의 대조는 여기서 안 한다(그건 가드 본체의 일이다). 여기서는 **판정 함수가
 * 잡아야 할 것을 잡고 잡지 말아야 할 것을 안 잡는지**만 본다.
 */
import { describe, it, expect } from 'vitest'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — 가드와 공유하는 순수 모듈(.mjs)
import { generatedClasses, sourceTokens, utilityRoots, findGhosts } from '../../../scripts/ghost-classes-core.mjs'

const CSS = `
.bg-white\\/95{background-color:rgb(255 255 255/.95)}
.dark\\:bg-\\[\\#1D1F29\\]\\/95:is(.dark *){background-color:rgb(29 31 41/.95)}
.h-\\[52px\\]{height:52px}
.shadow-xl{box-shadow:0 1px 2px #000}
.w-full{width:100%}
.bg-white{background-color:#fff}
.text-brand-text{color:var(--brand-text)}
.opacity-70{opacity:.7}
.content-\\[\\'\\2022\\'\\]::before{content:'•'}
.animate-fade-in{animation:ur-fade-in .28s}
`

const gen = generatedClasses(CSS)
const roots = utilityRoots(gen)
const ghosts = (src: string, allow: string[] = []) => {
  const tokens = sourceTokens(src).map((t: { tok: string; line: number }) => ({ ...t, file: 'x.tsx' }))
  return [...findGhosts({ generated: gen, roots, tokens, allow: new Set(allow) }).keys()]
}

describe('생성된 CSS 에서 클래스명 복원', () => {
  it('variant 접두를 떼고 base 로 센다', () => {
    expect(gen.has('bg-[#1D1F29]/95')).toBe(true)   // dark: 가 붙어 있어도
  })

  it('🔒 유니코드 이스케이프를 먼저 푼다 — 안 그러면 임의값이 영영 안 맞는다', () => {
    // `\2022` 를 나중에 풀면 `\2` 가 문자 `2` 로 먼저 먹혀 content-['2022'] 가 된다.
    // 실제로 이 순서 때문에 오탐이 났던 자리다.
    expect(gen.has("content-['•']")).toBe(true)
  })

  it('임의값 대괄호도 복원된다', () => {
    expect(gen.has('h-[52px]')).toBe(true)
  })
})

describe('유령 판정 — 잡아야 할 것', () => {
  it('오타 클래스를 잡는다 (실사고: 모달 6개가 배경 없이 떠 있었다)', () => {
    expect(ghosts('<div className="border bg-white-xl w-full" />')).toContain('bg-white-xl')
  })

  it('var 색 + 불투명도를 잡는다 (알파를 못 붙여 색이 아예 안 먹는다)', () => {
    expect(ghosts('<p className="text-brand-text/70" />')).toContain('text-brand-text/70')
  })

  it('스케일 밖 크기를 잡는다', () => {
    expect(ghosts('<i className="w-4.5 h-13" />').sort()).toEqual(['h-13', 'w-4.5'])
  })
})

describe('유령 판정 — 잡지 말아야 할 것 (오탐이 많으면 아무도 안 켠다)', () => {
  it('정상 클래스는 통과', () => {
    expect(ghosts('<div className="bg-white/95 h-[52px] shadow-xl text-brand-text opacity-70" />')).toEqual([])
  })

  it('variant 가 붙어도 통과', () => {
    expect(ghosts('<div className="dark:bg-[#1D1F29]/95 hover:bg-white" />')).toEqual([])
  })

  it('Tailwind 유틸이 아닌 커스텀 클래스는 안 센다', () => {
    expect(ghosts('<div className="ur-pin-disc dash-phone-title" />')).toEqual([])
  })

  it('런타임 조립은 판정 대상이 아니다', () => {
    expect(ghosts('<div className={`bg-${c}-500 p-2`} />')).toEqual([])
  })

  it('allow 에 등록된 것은 통과', () => {
    expect(ghosts('<div className="bg-white-xl" />', ['bg-white-xl'])).toEqual([])
  })
})

describe('🔒 가드가 실제로 실행 경로에 있다', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const verify = readFileSync('.github/workflows/verify.yml', 'utf8')

  it('verify.yml 에 strict 로 등록돼 있다', () => {
    expect(verify).toMatch(/STRICT_GHOST_CLASSES: '1'/)
    expect(verify).toMatch(/node scripts\/check-ghost-classes\.mjs/)
  })

  it('🔴 build 뒤에 있다 — 앞에 두면 dist 가 없어 **항상** 빨간불이다', () => {
    expect(verify.indexOf('run: npm run build:client')).toBeLessThan(verify.indexOf('check-ghost-classes.mjs'))
  })
})
