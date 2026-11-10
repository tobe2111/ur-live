/**
 * 🗄️ 2026-11-10 — "필수 칸이 빠진 저장" 검사가 라이브에 없는 컬럼으로 거짓 경고를 내지 않는다.
 *
 * 실측: 매 커밋마다 `search_logs.search_query` · `order_refund_history.amount` 누락 경고 2건이 떴다.
 * 라이브 D1 을 조회하니 두 표 모두 그 컬럼이 **없고**(각각 `query` · `refund_amount`) 검색 기록은 575건이 정상 저장 중이었다.
 * 마이그레이션 파일에 같은 표의 옛 정의가 남아 있어 생긴 오탐이다 — 거짓 경보가 계속 뜨면 진짜 경보를 안 읽게 된다.
 *
 * ## ⚠️ 못 보는 것
 * - 라이브 사진(`live-schema.snapshot.json`)이 낡았을 때: 새로 생긴 NOT NULL 컬럼을 사진이 모르면 걸러 버린다.
 *   라이브에 표·컬럼을 더한 뒤엔 `node scripts/snapshot-live-schema.mjs` 로 다시 찍을 것.
 * - 거르는 조건이 지나치게 넓어지는 회귀(사진에 있는 컬럼까지 거르기)는 이 시험이 못 잡는다 — 조건 문자열만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

describe('NOT NULL INSERT 검사 — 라이브 사진으로 오탐 제거', () => {
  it('지금 코드에서 0건이고, 실제로 분석을 했다', () => {
    const out = execSync('node scripts/check-sql-not-null-insert.mjs', { encoding: 'utf8' })
    expect(out).toMatch(/NOT NULL 컬럼 미포함 INSERT 없음/)
    const analyzed = Number(out.match(/analyzed=(\d+)/)?.[1] ?? 0)
    expect(analyzed, '분석한 INSERT 가 너무 적다 — 검사가 헛돈다').toBeGreaterThan(300)
  })
  it('사진에 그 표가 있고 그 컬럼이 없을 때만 거른다', () => {
    const src = readFileSync('scripts/check-sql-not-null-insert.mjs', 'utf8')
    expect(src).toMatch(/if \(liveCols\(table\) && !liveCols\(table\)\.has\(colName\)\) continue/)
  })
})
