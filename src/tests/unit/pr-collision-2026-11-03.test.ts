/**
 * 🚧 큰 PR · 열린 PR 과의 겹침 경고 (2026-11-03) · 근거: scripts/check-pr-collision.mjs 머리말
 * (#2139 348파일 · 12시간 · 하루 충돌 8번 — 다른 세션 PR #2159 가 같은 파일을 고치고 있었다)
 * ⚠️ 못 보는 것: 실제 GitHub 응답 — 조회 실패는 조용히 넘어간다(안내).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { judgeSize, judgeOverlap, MAX_FILES, MAX_AGE_HOURS } from '../../../scripts/check-pr-collision.mjs'

describe('큰 PR', () => {
  it('파일이 많거나 오래 묵으면 알린다 — #2139 모양', () => {
    expect(judgeSize({ files: 348, ageHours: 12 })).toHaveLength(2)
    expect(judgeSize({ files: MAX_FILES + 1, ageHours: 0 })).toHaveLength(1)
    expect(judgeSize({ files: 1, ageHours: MAX_AGE_HOURS + 1 })).toHaveLength(1)
  })
  it('작고 새로우면 조용하다', () => {
    expect(judgeSize({ files: 12, ageHours: 1 })).toEqual([])
  })
})

describe('열린 PR 과의 겹침', () => {
  const others = [
    { number: 2159, title: '모션 21차', files: ['src/components/ui/sub-page-header.tsx', 'src/pages/CouponClaimPage.tsx', 'public/locales/ko/translation.json'] },
    { number: 2001, title: '무관', files: ['src/worker-ads/x.ts'] },
  ]
  it('같은 파일을 고치는 PR 을 번호와 파일로 알린다', () => {
    const r = judgeOverlap({ mine: ['src/components/ui/sub-page-header.tsx', 'src/pages/CouponClaimPage.tsx', 'src/a.ts'], others })
    expect(r).toEqual([{ number: 2159, title: '모션 21차', files: ['src/components/ui/sub-page-header.tsx', 'src/pages/CouponClaimPage.tsx'] }])
  })
  it('git 이 알아서 합치는 파일(번역·인계·시안 줄)은 겹쳐도 알리지 않는다', () => {
    expect(judgeOverlap({ mine: ['public/locales/ko/translation.json', 'docs/handoff/x.md'], others })).toEqual([])
  })
  it('푸시 게이트가 부르고, 실패해도 푸시를 막지 않는다', () => {
    const g = readFileSync('scripts/pre-push-gate.mjs', 'utf8')
    const i = g.indexOf("execFileSync('node', ['scripts/check-pr-collision.mjs']")
    expect(i).toBeGreaterThan(0)
    expect(g.slice(i, i + 300)).toMatch(/\} catch \{\n\s+\/\* 안내일 뿐/)
  })
})
