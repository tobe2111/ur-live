/**
 * ⏱️ PR 에서 주입 전수가 걸리면 16대에 나눠 돈다 — 그리고 **우회 구멍이 없다** (2026-11-01 대표
 * *"이번에 머지,배포 왜이리 느려?"* → *"끝까지 다 이상적으로 하고 머지까지 해줘"*).
 *
 * 실측: PR 에서 전수가 걸리면 주입 5천 건을 `Verify` 한 잡이 **한 대에서 순서대로** 돌아 약 3시간이 걸렸다.
 * 야간 전수는 같은 일을 16대가 대당 9~15분에 끝낸다. 그 3시간 사이 main 이 움직여 충돌 → 재푸시 →
 * 처음부터를 반복했다(#2069 가 Verify 를 8번 돌렸고 끝까지 간 건 1번).
 *
 * 🔴 **이 변경의 위험은 속도가 아니라 우회다.** 필수 검사는 `Verify` 하나이고 GitHub 은 **건너뛴(skipped)
 *    필수 검사를 통과로 친다.** 그래서 이 시험이 지키는 것:
 *   ① `Verify` 는 **언제나** 돈다(`if: always()`) — 조각이 실패했다고 건너뛰면 실패한 PR 이 머지된다
 *   ② `Verify` 의 첫 단계가 판정·조각 결과를 **명시적으로** 대조해 성공이 아니면 `exit 1`
 *   ③ 좁은 PR 은 종전 그대로 `--changed` 를 돈다(조건이 뒤집히면 **좁은 PR 이 주입 0건**으로 통과한다)
 *   ④ 분할 잡은 strict(`-s`)이고 판정은 러너 **자신의** 스코프(`--scope-json`)다
 *   ⑤ `--scope-json` 이 실제로 판정 JSON 을 낸다(실행해서 본다)
 *
 * ⚠️ 못 보는 것: GitHub 이 실제로 matrix 를 펼치고 `needs.*.result` 를 채우는지 — 그건 이 PR 의 CI 자신이
 * 첫 시험이다(PR 워크플로는 PR 의 정의로 돈다). YAML 을 텍스트로 읽으므로 들여쓰기가 바뀌면 재조준할 것.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readRaw } from '../helpers/source-text'

const WF = readRaw('.github/workflows/verify.yml')
/** `jobs:` 아래 2칸 들여쓴 잡 하나의 본문(다음 잡 머리 전까지). */
function job(name: string): string {
  const i = WF.indexOf(`\n  ${name}:\n`)
  expect(i, `${name} 잡이 없다`).toBeGreaterThan(-1)
  const rest = WF.slice(i + 1)
  const next = rest.slice(1).search(/\n  [a-z][a-z0-9-]*:\n/)
  return next === -1 ? rest : rest.slice(0, next + 1)
}
/** 잡 머리(steps: 전까지) — 잡 수준 키만 본다. */
const header = (body: string) => body.slice(0, body.indexOf('\n    steps:'))

describe('① Verify 는 언제나 돈다 — 건너뛴 필수 검사 = 통과 라는 구멍', () => {
  it('needs 로 판정·분할 잡을 기다리고 if: always() 다', () => {
    const h = header(job('verify'))
    expect(h).toMatch(/\n    needs: \[mutation-plan, mutation-shards\]/)
    expect(h).toMatch(/\n    if: always\(\)\n/)
    expect(h).toMatch(/\n    name: Verify\n/)
  })
  it('잡 수준 if 는 always() 하나뿐이다 (조건을 붙이면 건너뛸 수 있다)', () => {
    const ifs = [...header(job('verify')).matchAll(/\n    if: (.+)/g)].map((m) => m[1].trim())
    expect(ifs).toEqual(['always()'])
  })
})

describe('② 첫 단계가 결과를 대조해 성공이 아니면 실패한다', () => {
  const v = job('verify')
  const first = v.slice(v.indexOf('\n    steps:'), v.indexOf('\n      - uses: actions/checkout@v4'))
  it('첫 단계가 대조 단계다 (다른 단계보다 앞)', () => {
    expect(first).toContain('주입 범위 판정·전수 조각 결과 대조')
  })
  it('판정 잡이 성공이 아니면 exit 1', () => {
    expect(first).toMatch(/needs\.mutation-plan\.result \}\}" != "success" \]; then\n\s+echo "❌[^\n]*"; exit 1/)
  })
  it('전수인데 조각이 성공이 아니면 exit 1 (실패·취소·건너뜀 전부)', () => {
    expect(first).toMatch(/outputs\.full \}\}" = "true" \] && \[ "\$\{\{ needs\.mutation-shards\.result \}\}" != "success" \]; then\n\s+echo "❌[^\n]*"; exit 1/)
  })
  it('판정 출력이 비면 exit 1 (판정이 헛돈 경우)', () => {
    expect(first).toMatch(/!= "true" \] && \[ "\$\{\{ needs\.mutation-plan\.outputs\.full \}\}" != "false" \]; then\n\s+echo "❌[^\n]*"; exit 1/)
  })
})

describe('③ 좁은 PR 은 종전대로 --changed 를 돈다', () => {
  it("변경분 단계의 조건이 정확히 full != 'true' 다 (뒤집히면 좁은 PR 이 주입 0건으로 통과)", () => {
    const v = job('verify')
    const i = v.indexOf('- name: 가드 주입 검증 (변경분, strict)')
    const step = v.slice(i, i + 400)
    expect(step).toMatch(/\n\s+if: needs\.mutation-plan\.outputs\.full != 'true'\n/)
    expect(step).toContain('run: node scripts/check-guard-mutations.mjs --changed -s')
    expect(step).toContain('continue-on-error: false')
  })
})

describe('④ 분할 잡 · 판정 잡', () => {
  it("분할 잡은 전수일 때만, strict 로, fail-fast 없이 돈다", () => {
    const s = job('mutation-shards')
    expect(header(s)).toMatch(/\n    if: needs\.mutation-plan\.outputs\.full == 'true'\n/)
    expect(s).toMatch(/run: node scripts\/check-guard-mutations\.mjs -s --shard \$\{\{ matrix\.shard \}\}\/\$\{\{ needs\.mutation-plan\.outputs\.total \}\}/)
    expect(s).toContain('fail-fast: false')
    expect(s).toContain('run: npm ci')
  })
  it('판정 잡은 러너 자신의 스코프를 쓴다 (워크플로가 흉내 내면 갈라진다)', () => {
    const p = job('mutation-plan')
    expect(p).toContain('node scripts/check-guard-mutations.mjs --changed --scope-json')
    expect(p).toContain('fetch-depth: 0') // merge-base 계산이 필요하다
    expect(p).toMatch(/echo "full=\$FULL" >> "\$GITHUB_OUTPUT"/)
  })
})

describe('⑤ --scope-json 이 실제로 판정을 낸다', () => {
  it('JSON 에 boolean full 과 주입 총수가 있다', () => {
    const out = execFileSync('node', ['scripts/check-guard-mutations.mjs', '--scope-json'], { encoding: 'utf8' })
    const j = JSON.parse(out)
    expect(typeof j.full).toBe('boolean')
    expect(j.full, '--changed 없이 부르면 언제나 전수다').toBe(true)
    expect(j.total).toBeGreaterThan(1000)
  })
})
