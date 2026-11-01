/**
 * 🎲 첫 화면 청크 수 래칫이 **1% 표본**에 흔들리지 않는다 — 2026-11-01.
 * `src/main.tsx` 가 환경변수 검사기(zod)를 운영에서 방문 1% 에만 불러와, 측정이 그 표본에 걸리면
 * `env-validator`·`validation` 이 더 실려 무작위 빨간불이 났다(PR #2080 CI 교환권 26 > 25 · 로컬 main·PR 모두 24).
 */
import { describe, it, expect } from 'vitest'
import { dropSampled } from '../../../scripts/check-surface-chunk-runtime.mjs'
import { readCode } from '../helpers/source-text'

describe('표본 청크', () => {
  it('env-validator 가 왔으면 그것과 딸려 온 validation 을 뺀다', () => {
    expect(dropSampled(['index', 'env-validator', 'validation', 'VouchersPage'])).toEqual(['index', 'VouchersPage'])
  })
  it('🔴 validation 이 **혼자** 오면 그대로 센다 — zod 를 첫 화면에 eager 로 들인 진짜 회귀', () => {
    expect(dropSampled(['index', 'validation'])).toEqual(['index', 'validation'])
  })
  it('표본이 없으면 그대로', () => {
    expect(dropSampled(['index', 'app-shell'])).toEqual(['index', 'app-shell'])
  })
  it('검사기가 청크 수를 세기 전에 이 함수를 거친다', () => {
    expect(readCode('scripts/check-surface-chunk-runtime.mjs')).toContain('const chunks = dropSampled([...new Set(res.chunks.map(stem))])')
  })
  it('표본의 근거가 아직 그 자리에 있다 (없어지면 이 예외도 걷어야 한다)', () => {
    expect(readCode('src/main.tsx')).toMatch(/Math\.random\(\) < 0\.01/)
  })
})
