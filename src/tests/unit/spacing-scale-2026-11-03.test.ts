/**
 * 📏 손님 화면 공백 체계 — 2026-11-03 대표 *"손님 화면 공백 체계 시안 그대로 해줘"*(캔버스 S0~S6 · `docs/design/spacing-system-2026-11-03.md`).
 *   여섯 단계 **4 · 8 · 12 · 20 · 32 · 48** (tailwind 1·2·3·5·8·12). 변환 `scripts/codemods/spacing-scale.mjs`.
 *
 *  ① 사이(gap·space)·바깥(m*)에 체계 밖 값(16·24·28·36·40·56·64)이 **늘지 않는다**(래칫 — 남은 75는 결제 잠금 파일 ·
 *     여러 줄 클래스뿐이다. 예외는 없다 — 대표 *"맞춰 다 통일을 해야지"*: 마이 구역 제목 24→32 · 홈 띠 28→32 ·
 *     유어샵 이름 줄·진열 줄 16→12 도 체계로, 그 값에 묶인 계산(STRIP_GAP_PX·이름 칸 298px)을 함께 고쳤다).
 *  ② 변환기가 체계 값을 다시 안 바꾼다(두 번 돌려도 같다) · 콘텐츠 폭 상자만 가장자리 20 · 위아래 안쪽은 안 바꾼다.
 * ⚠️ 못 보는 것: 인라인 style · CSS 파일 · 줄 안쪽(py) 값 · 실제로 보기 좋은지(그려서 볼 것).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
// @ts-expect-error — .mjs 변환기
import { convertClassString } from '../../../scripts/codemods/spacing-scale.mjs'

const files = execSync("git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter((f) => /^src\/pages\/(user-profile|agency-console)\//.test(f) || !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))
  .filter((f) => !/\/tests?\//.test(f))
const code = (f: string) => readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')
const OFF = '(?:4|6|7|9|10|14|16)'
const count = (re: RegExp) => files.reduce((n, f) => n + (code(f).match(re) || []).length, 0)

/** 🔒 2026-11-03 적용 직후 실측. 줄이면 내린다 — 올리지 말 것. */
const BASELINE = 75

describe('① 체계 밖 값이 늘지 않는다', () => {
  it('검사 범위가 손님 화면 전체다(헛돌지 않는다)', () => { expect(files.length).toBeGreaterThan(500) })
  it(`사이·바깥 체계 밖 값 ≤ ${BASELINE}`, () => {
    const gap = count(new RegExp(`(?:^|[\\s"'\`])(?:[a-z0-9]+:)*(?:gap(?:-[xy])?|space-[xy])-${OFF}(?=[\\s"'\`])`, 'g'))
    const out = count(new RegExp(`(?:^|[\\s"'\`])(?:[a-z0-9]+:)*m[tblrxy]?-${OFF}(?=[\\s"'\`])`, 'g'))
    expect(gap + out).toBeLessThanOrEqual(BASELINE)
  })
})

describe('② 변환 규칙', () => {
  it('사이는 좁게 · 바깥은 넓게', () => {
    expect(convertClassString('flex gap-4 mt-4')).toBe('flex gap-3 mt-5')
    expect(convertClassString('space-y-6 mb-6')).toBe('space-y-5 mb-8')
    expect(convertClassString('lg:gap-10 lg:mt-10')).toBe('lg:gap-8 lg:mt-12')
  })
  it('체계 값은 다시 안 바뀐다(두 번 돌려도 같다)', () => {
    const once = convertClassString('gap-4 mt-6 mx-auto px-4')
    expect(convertClassString(once)).toBe(once)
  })
  it('가장자리 20 은 콘텐츠 폭 상자만 · 위아래 안쪽·음수는 그대로', () => {
    expect(convertClassString('max-w-3xl mx-auto px-4')).toBe('max-w-3xl mx-auto px-5')
    expect(convertClassString('h-9 px-4 rounded-full')).toBe('h-9 px-4 rounded-full')
    expect(convertClassString('py-4 pt-6 -mx-4')).toBe('py-4 pt-6 -mx-4')
    expect(convertClassString('rounded-2xl p-4')).toBe('rounded-2xl p-5')
  })
})
