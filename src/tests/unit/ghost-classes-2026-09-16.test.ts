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
import { generatedClasses, sourceTokens, wideTokens, utilityRoots, findGhosts } from '../../../scripts/ghost-classes-core.mjs'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — `.mjs` 가드들이 공유하는 주석 제거기 SSOT
import { stripComments } from '../../../scripts/comment-strip.mjs'

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
.ease-out{transition-timing-function:cubic-bezier(0,0,.2,1)}
.gap-2{gap:.5rem}
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

/**
 * 🕳️ **`className=` 밖**의 클래스 뭉치 (2026-10-13 신설)
 *
 * 좁은 스캔은 속성 리터럴만 본다. 그래서 조회 표·상수·토큰 표에 사는 유령을 **구조적으로**
 * 못 봤고, 실제로 셋이 숨어 있었다(그중 `bg-brand-tint/40` 은 `/about/print` 첫 톤 구역을
 * 라이트에서 통째로 투명하게 만든 **라이브 시각 결함**이었다).
 *
 * 아래 "안 잡는다" 쪽이 이 스캔의 값이다 — 넓힌 스캔은 오탐이 나면 바로 꺼지기 때문에,
 * 걸러내기 규칙 하나하나가 실제로 일하는지 **출력으로** 재 둔다.
 */
describe('🕳️ className= 밖의 클래스 뭉치도 본다', () => {
  const wide = (src: string, allow: string[] = []) => {
    const tokens = wideTokens(src, gen, stripComments).map(
      (t: { tok: string; line: number }) => ({ ...t, file: 'x.tsx' }),
    )
    return [...findGhosts({ generated: gen, roots, tokens, allow: new Set(allow) }).keys()]
  }

  it('조회 표에 든 유령을 잡는다 (좁은 스캔은 못 본다)', () => {
    const src = "const toneBg = { brand: 'bg-white/97 w-full', gray: 'bg-white w-full' }"
    expect(ghosts(src)).toEqual([])          // ← className= 가 없으니 좁은 스캔은 0
    expect(wide(src)).toEqual(['bg-white/97'])
  })

  it('export const 와 삼항도 본다', () => {
    expect(wide("export const BAD = 'text-brand-text/50 w-full'")).toEqual(['text-brand-text/50'])
    expect(wide("className={on ? 'shadow-xl h-[52px]' : 'shadow-2xl h-[52px]'}")).toEqual(['shadow-2xl'])
  })

  it('🔴 산문은 안 잡는다 — 생성된 클래스가 하나도 없는 문자열은 뭉치가 아니다', () => {
    expect(wide("const msg = '결제가 완료되었습니다 다시-시도 해주세요'")).toEqual([])
  })

  it('🔴 주석 속 인용은 안 잡는다 — 백틱 인용이 템플릿 리터럴과 모양이 같다', () => {
    // 이 레포의 문서 주석은 클래스명을 백틱으로 인용한다. 주석을 안 걷으면 산문이 유령이 된다.
    expect(wide('/* 🩸 `bg-surface/95 w-full` 는 CSS 가 안 나온다 */\nconst a = 1')).toEqual([])
    expect(wide('// `px-6/8 w-full` 로 적어 두었다\nconst a = 1')).toEqual([])
  })

  it('🔴 문자열 안의 HTML 은 안 잡는다 — 워커 SSR 빌더가 class="…" 를 조립한다', () => {
    // 🩸 픽스처가 그 경우를 **담아야** 한다 — 첫 판은 토큰의 루트가 전부 `class` 라
    //    규칙을 지워도 초록이었다(주입 러너가 잡았다). 속성 안 두 번째 클래스(`w-full`)는
    //    따옴표가 안 붙어 깨끗하고, 마지막 토큰(`shadow-xl">x</div>`)이 진짜 판정 대상이다.
    expect(wide(`const html = '<div class="flex w-full shadow-xl">x</div>'`)).toEqual([])
  })

  it('🔴 런타임 조립 조각은 안 잡는다', () => {
    expect(wide("const c = cls.replace('text-', 'bg-') + ' w-full shadow-xl'")).toEqual([])
  })

  it('🔴 inline CSS 값 목록은 안 잡는다 — 꼬리 쉼표를 떼고 본다', () => {
    expect(wide("const t = 'opacity 220ms ease-out, filter 200ms ease-out'")).toEqual([])
  })

  it('🔒 뭉치 증명을 없애면 산문이 쏟아진다 (이 단언이 그 규칙을 지킨다)', () => {
    // 토큰이 하나뿐이면 뭉치로 안 본다 — 클래스처럼 생긴 낱말 하나는 어디에나 있다.
    expect(wide("const k = 'bg-white/97'")).toEqual([])
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

  /* 🩸 아래 둘은 **주입 러너가 시켜서** 생겼다 (2026-10-13): 넓힌 스캔을 가드 본체에서
     통째로 꺼도 이 테스트가 초록이었다 — 여기서 재던 것은 *순수 모듈*뿐이고 **배선은 아무도
     안 보고 있었다.** 이 레포가 반복해 당한 "계산은 하는데 아무도 안 쓴다" 클래스다. */
  const body = readFileSync('scripts/check-ghost-classes.mjs', 'utf8')

  it('🔴 가드 본체가 넓힌 스캔을 실제로 쓴다 (계산만 하고 버리면 사각지대가 돌아온다)', () => {
    expect(body).toMatch(/for \(const t of wideTokens\([^)]*\)\) tokens\.push/)
  })

  it('🔴 넓힌 스캔에 주석 제거기를 넘긴다 (안 넘기면 문서 주석 산문이 유령이 된다)', () => {
    expect(body).toMatch(/wideTokens\(src, generated, stripComments\)/)
    expect(body).toMatch(/from '\.\/comment-strip\.mjs'/)
  })
})
