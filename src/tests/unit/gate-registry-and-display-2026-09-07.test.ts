/**
 * 🧱 **두 클래스를 닫는 가드를 시험이 감싼다** (2026-09-07 대표 *"둘 다 해줘"*).
 *
 * 어제 고친 것은 인스턴스였다. 클래스는 이랬다:
 *   ① 새 게이트를 `OPS_GATES` 에 안 넣으면 `ops-gate-reachable` 의 검사 범위 밖으로 남는다.
 *      → `check-gate-registry` 가 **등재 자체를 강제**한다. 처음 돌렸을 때 미등재 5개를 찾았다.
 *   ② 새 목록 API 가 `referral_enabled` 를 실으면 꺼진 적립을 다시 약속하게 된다.
 *      → `check-affiliate-display-gate` 가 소비자 표면의 carrier 를 래칫으로 묶는다.
 *
 * 이 파일은 두 스크립트를 **실제로 실행**해 초록인지 보고, 스캐너가 눈멀지 않았는지(측정 수)도 본다.
 *
 * ## ⚠️ 못 막는 것
 * - `=== 'owner'` 같은 enum 게이트와 `!== 'false'` 킬스위치 — 표현이 제각각이라 기계로 좁히면 오탐.
 * - 소비자 네임스페이스 밖(어드민·셀러).
 * - 필드를 안 싣고 **서버가 직접 계산**하는 경로(`stays-public` — 기준선에 사유가 적혀 있다).
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function run(script: string): string {
  return execFileSync('node', [script], { encoding: 'utf8' })
}

describe('게이트 등재 + 적립 표시 게이트 (2026-09-07)', () => {
  it('① strict-true 게이트가 전부 OPS_GATES 에 등재돼 있다', () => {
    const out = run('scripts/check-gate-registry.mjs')
    expect(out, `미등재 게이트가 있다:\n${out}`).toContain('✅')
  })

  it('① 스캐너가 실제로 게이트를 보고 있다 (측정 0 = 실패)', () => {
    const n = Number(run('scripts/check-gate-registry.mjs').match(/게이트 (\d+)개/)?.[1] ?? 0)
    expect(n, '게이트를 거의 못 찾았다 — 패턴이나 경로가 바뀌었다').toBeGreaterThanOrEqual(8)
  })

  it('② 소비자 표면의 referral_enabled 가 전부 게이트/기준선 안에 있다', () => {
    const out = run('scripts/check-affiliate-display-gate.mjs')
    expect(out, `게이트 없는 경로가 있다:\n${out}`).toContain('✅')
  })

  it('② 기준선 항목은 사유를 적어야 한다 (빈 등재 금지)', () => {
    const base = JSON.parse(readFileSync('scripts/affiliate-display-gate-baseline.json', 'utf8'))
    const files = Object.keys(base)
    expect(files.length, '기준선이 비었다 — 파일이 사라졌거나 경로가 바뀌었다').toBeGreaterThan(0)
    for (const f of files) {
      expect(String(base[f].reason ?? ''), `${f} 에 사유가 없다`).not.toHaveLength(0)
      expect(Number(base[f].carriers), `${f} 의 carriers 가 숫자가 아니다`).toBeGreaterThan(0)
    }
  })

  it('③ 두 가드가 실행 경로에 등록돼 있다 (파일만 있고 안 도는 것 방지)', () => {
    const gate = readFileSync('scripts/audit-gate.sh', 'utf8')
    for (const s of ['check-gate-registry', 'check-affiliate-display-gate']) {
      expect(gate, `${s} 가 audit-gate.sh 에 없다 — 만들고 안 돌리는 그 사고다`).toContain(s)
    }
  })
})
