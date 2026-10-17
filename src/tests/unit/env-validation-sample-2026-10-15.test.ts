/**
 * 🎲 환경값 검사(zod)는 운영에서 1% 표본만 (2026-10-15 — /stays 폭포 실측).
 *
 * SPA 에선 `load` 직후가 화면 데이터·사진을 받는 순간이라, load 뒤로 미뤄도 zod(약 15KB)가 그 자리에서 회선을 나눠 썼다.
 * 검사 대상은 빌드 때 정해지는 값이라 모든 방문자에게 같다 ⇒ 표본이면 설정 누락을 충분히 잡는다.
 * ⚠️ 못 막는 것: 실제 ms(배포 뒤 라이브) · 표본 비율이 적당한지(판단 사항).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const src = stripComments(readFileSync('src/main.tsx', 'utf8'))

describe('환경값 검사 표본', () => {
  it('운영에선 표본 밖이면 받지 않는다', () => {
    expect(src).toMatch(/const envSampled = import\.meta\.env\.DEV \|\| Math\.random\(\) < 0\.01/)
    expect(src, '표본 판정이 실행 경로를 막지 않는다 — 모든 방문자가 다시 zod 를 받는다')
      .toMatch(/if \(!envSampled\) \{[^}]*\}\s*else if \(typeof window === 'undefined' \|\| document\.readyState === 'complete'\) runEnvValidation\(\)/)
  })
  it('검사 자체는 사라지지 않는다(여전히 동적 import)', () => {
    expect(src).toMatch(/import\('@\/shared\/config\/env-validator'\)/)
  })
})
