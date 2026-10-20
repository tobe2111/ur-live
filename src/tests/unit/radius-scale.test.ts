/**
 * 📐 모서리(radius) 위계 불변식 (2026-08-30 신설)
 *
 * ■ 막으려는 사고 (실제로 났던 것)
 *   `--radius: 0.75rem` 이 `rounded-lg` 를 12px 로 올렸는데, Tailwind 기본 `rounded-xl`
 *   도 12px 다. 즉 **lg 와 xl 이 완전히 같은 값**이었고, 소스에서 그 둘을 쓰는 자리가
 *   합쳐 3,716곳이었다 — 작은 칩도, 버튼도, 카드도 전부 같은 곡률로 그려졌다.
 *   사람이 만든 화면에는 위계가 있다(작은 것은 조이고 큰 것은 푼다). 전부 같으면
 *   "기계가 한 번에 찍어낸" 인상이 되고, 대표가 본 것이 그것이다.
 *
 * ■ 왜 테스트로 박는가
 *   이 회귀는 **에러를 내지 않는다.** 누군가 `--radius` 를 0.75rem 으로 되돌리거나
 *   xl 정의를 지우면 화면은 조용히 다시 평평해지고 빌드는 초록불이다. CLAUDE.md
 *   "규율은 문서가 아니라 테스트로" 가 정확히 이 클래스를 위한 규칙이다.
 *
 * ■ 이 테스트가 못 막는 것
 *   - 개별 컴포넌트가 `rounded-[13px]` 같은 임의값을 쓰는 것은 안 본다.
 *   - 값이 위계를 이룬다는 것만 보고, 그 값이 **예쁜지**는 판단하지 않는다.
 *   - 실제 브라우저 렌더는 안 본다(눈 검증은 scripts/visual-preview.mjs 가 짝).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const cfg = readFileSync(resolve(root, 'tailwind.config.js'), 'utf-8')
const css = readFileSync(resolve(root, 'src/index.css'), 'utf-8')

/** `--radius` 는 lg 의 앵커이고 md/sm 이 여기서 파생된다. */
function radiusAnchorRem(): number {
  const m = css.match(/--radius:\s*([0-9.]+)rem/)
  expect(m, '`--radius` 선언을 src/index.css 에서 찾지 못했다 — 앵커가 사라지면 이 검사 자체가 무의미해진다').toBeTruthy()
  return parseFloat(m![1])
}

/** tailwind.config.js 의 borderRadius 확장에서 리터럴 rem 값을 읽는다. */
function configRem(key: string): number | null {
  const block = cfg.match(/borderRadius:\s*\{([\s\S]*?)\}/)
  expect(block, 'tailwind.config.js 에 borderRadius 확장이 없다').toBeTruthy()
  const re = new RegExp(`['"]?${key}['"]?:\\s*['"]([0-9.]+)rem['"]`)
  const m = block![1].match(re)
  return m ? parseFloat(m[1]) : null
}

describe('모서리 스케일 — 크기마다 다른 곡률이어야 한다', () => {
  const anchor = radiusAnchorRem()
  // Tailwind 기본값(rem). 설정에서 덮어쓰지 않으면 이 값이 쓰인다.
  const TW_DEFAULT: Record<string, number> = { xl: 0.75, '2xl': 1, '3xl': 1.5 }

  const scale = {
    sm: anchor - 0.25,   // calc(var(--radius) - 4px)
    md: anchor - 0.125,  // calc(var(--radius) - 2px)
    lg: anchor,
    xl: configRem('xl') ?? TW_DEFAULT.xl,
    '2xl': configRem('2xl') ?? TW_DEFAULT['2xl'],
    '3xl': configRem('3xl') ?? TW_DEFAULT['3xl'],
  }

  it('lg 와 xl 이 같은 값이면 안 된다 — 이것이 실제로 났던 붕괴다', () => {
    expect(scale.lg).not.toBe(scale.xl)
  })

  it('sm→3xl 이 단조 증가해야 한다 (같은 값 허용 안 함)', () => {
    const order: (keyof typeof scale)[] = ['sm', 'md', 'lg', 'xl', '2xl', '3xl']
    for (let i = 1; i < order.length; i++) {
      const prev = scale[order[i - 1]]
      const cur = scale[order[i]]
      expect(cur, `rounded-${order[i]}(${cur}rem) 가 rounded-${order[i - 1]}(${prev}rem) 보다 커야 한다`).toBeGreaterThan(prev)
    }
  })

  it('여섯 단계가 모두 서로 다른 값이어야 한다', () => {
    const vals = Object.values(scale)
    expect(new Set(vals).size).toBe(vals.length)
  })

  it('버튼(.ur-btn) 곡률은 컨트롤(lg)과 카드(xl) 사이에 있어야 한다 — 중첩 규칙: 안쪽 ≤ 바깥쪽', () => {
    const btnLg = css.match(/\.ur-btn-lg\s*\{[^}]*border-radius:\s*([0-9.]+)rem/)
    expect(btnLg, '.ur-btn-lg 의 border-radius 를 찾지 못했다').toBeTruthy()
    const v = parseFloat(btnLg![1])
    expect(v).toBeGreaterThanOrEqual(scale.lg)
    expect(v).toBeLessThanOrEqual(scale.xl)
  })
})
