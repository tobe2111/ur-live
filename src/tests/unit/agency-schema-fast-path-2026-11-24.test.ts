import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🩸 2026-11-24 — 대표 신고: 에이전시 콘솔 [매장 영입 링크] 의 [저장] 이 "수수료를 저장하지 못했어요".
 *
 * 원인: `ensureAgencyConsoleTables` 에는 빠른 경로(열이 이미 다 있으면 바로 return)와 느린 경로(첫 배포)가 있다.
 * 2026-11-11 에 더한 표 셋(`agency_share_defaults`·`agency_budget_defaults`·`agency_budget_terms`)이 **느린 경로에만**
 * 들어갔고, 라이브는 늘 빠른 경로를 타므로 표가 한 번도 생기지 않았다(라이브 D1 실측 `no such table`).
 * 그래서 수수료 저장뿐 아니라 사장님이 초대 링크를 여는 화면(그 표를 JOIN 한다)도 함께 깨져 있었다.
 *
 * 고정하는 것: 이 파일이 `CREATE TABLE` 하는 표는 **전부 빠른 경로의 return 보다 앞에서** 만들어진다.
 * 못 막는 것: 빠른 경로 앞에 있어도 그 묶음이 다른 이유로 실패하면 표가 안 생긴다(묶음 실패는 예외로 드러난다).
 */
const SRC = readFileSync('src/features/agency-console/api/agency-schema.ts', 'utf8')

function tablesCreated(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g)) out.add(m[1])
  return out
}

describe('ensureAgencyConsoleTables — 새 표는 빠른 경로에서도 만들어진다', () => {
  const marker = SRC.indexOf('_ensured.add(DB)\n    return')
  it('빠른 경로(early return)가 있다', () => {
    expect(marker).toBeGreaterThan(0)
  })
  it('파일이 만드는 표가 전부 early return 앞에 있다', () => {
    const before = tablesCreated(SRC.slice(0, marker))
    const all = tablesCreated(SRC)
    const missing = [...all].filter((t) => !before.has(t))
    expect(missing).toEqual([])
  })
  it('2026-11-24 사고의 세 표가 앞쪽 묶음에 있다', () => {
    const before = tablesCreated(SRC.slice(0, marker))
    for (const t of ['agency_share_defaults', 'agency_budget_defaults', 'agency_budget_terms']) expect(before.has(t)).toBe(true)
  })
})
