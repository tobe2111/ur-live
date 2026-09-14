/**
 * 🛡️ 2026-09-14 — "CI 가 막는 것은 로컬도 막는다"
 *
 * 배경(실측): 가드 121개 중 **91개가 CI strict ↔ 로컬 무방비**였다 —
 *   pre-commit 에 아예 없거나(63) `|| true` 로 경고만(28).
 *   그래서 위반 하나가 CI 한 바퀴(**실측 57분**)를 태웠고, 2026-09-14 하루에
 *   그 루프를 두 번 돌았다(주석 제거기 · 파일크기 래칫). 둘 다 로컬 1초면 알 수 있었다.
 *   그 91개를 실제로 재 보니 **전부 합쳐 20초**다 — 느려서 못 넣은 게 아니라 아무도 안 넣었다.
 *
 * ⇒ `scripts/pre-push-gate.mjs` 가 푸시 직전에 그 집합을 전부 돌린다.
 *   목록은 손으로 관리하지 않는다 — `verify.yml` 에서 매번 뽑는다(낡은 손목록 금지).
 *
 * ⚠️ 이 테스트가 **못 하는 것**: `.git/hooks/pre-push` 가 실제로 설치됐는지는 못 본다
 *   (훅은 클론에 안 딸려 온다). 원격 세션은 세션마다 `bash scripts/install-git-hooks.sh`
 *   를 다시 돌려야 한다 — CLAUDE.md '개발 환경 셋업' 참조.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ciStrictGuards, localGateGuards, EXCLUDE } from '../../../scripts/local-ci-parity.mjs'

const INSTALLER = readFileSync('scripts/install-git-hooks.sh', 'utf8')
const GATE = readFileSync('scripts/pre-push-gate.mjs', 'utf8')

describe('① CI strict 집합을 실제로 뽑아낸다', () => {
  it('measurement 0 은 통과가 아니다 — 100개 안팎이 나와야 한다', () => {
    expect(ciStrictGuards().length).toBeGreaterThan(30)
  })
})

describe('② 모든 CI strict 가드는 로컬에서 돌거나, 사유가 적힌 제외여야 한다', () => {
  it('사각지대가 0 이다', () => {
    const gate = new Set(localGateGuards())
    const blind = ciStrictGuards().filter((g) => !gate.has(g) && !(g in EXCLUDE))
    expect(blind).toEqual([])
  })

  it('제외 항목은 전부 사유를 갖는다', () => {
    for (const [g, why] of Object.entries(EXCLUDE)) {
      expect(why.trim().length, `${g} 의 제외 사유가 비었다`).toBeGreaterThan(10)
    }
  })

  it('제외 항목은 verify.yml 에 실제로 있다 (낡은 지도 차단)', () => {
    const strict = new Set(ciStrictGuards())
    for (const g of Object.keys(EXCLUDE)) {
      expect(strict.has(g), `${g}: EXCLUDE 에 있는데 verify.yml 엔 없다`).toBe(true)
    }
  })
})

describe('③ 게이트가 실제로 설치·실행된다', () => {
  it('설치 스크립트가 pre-push 훅을 만든다', () => {
    expect(INSTALLER).toContain('$HOOK_DIR/pre-push')
    expect(INSTALLER).toContain('pre-push-gate.mjs')
  })

  it('게이트는 가드가 0개면 통과가 아니라 실패한다', () => {
    expect(GATE).toMatch(/guards\.length === 0/)
    expect(GATE).toMatch(/process\.exit\(1\)/)
  })

  it('게이트는 실패를 삼키지 않는다 — 빨간불이면 종료코드 1', () => {
    expect(GATE).toContain('failed.length === 0')
  })
})
