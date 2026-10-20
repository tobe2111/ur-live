/**
 * 🚨 **"주입 중엔 커밋 금지" 가드가 자기 자신을 잡던 것** (2026-08-31).
 *
 * ## 이 가드가 지키는 것
 * `check-guard-mutations.mjs` 는 소스에 결함을 **일부러 주입했다가 되돌린다.** 그 사이 커밋하면
 * 주입된 결함이 그대로 올라간다 — 2026-08-25 에 실제로 났다(커밋 `721edf1`).
 *
 * ## 그런데 가드 자신이 오탐을 냈다
 * 판정이 argv **어디에든** 그 파일 이름이 있으면 잡는 방식이라,
 * `bash -c '... node --check scripts/check-guard-mutations.mjs && git commit ...'` 처럼
 * **한 명령줄에 이름을 언급만 해도** 멀쩡한 커밋이 막혔다. 이 레포가 반복해 만난
 * "검사가 자기 자신을 잡는" 클래스인데, 하필 그걸 막으라고 만든 검사기가 그러고 있었다.
 *
 * ## 이 시험이 보는 것
 * **양쪽 다** 본다 — 오탐(막으면 안 되는데 막음)과 누락(막아야 하는데 통과) 둘 다.
 * 실제 프로세스를 띄우지 않고 `--stdin` 이음매로 프로세스 목록만 흉내낸다.
 *
 * ⚠️ 못 보는 것: 실제 `ps` 출력 형식(플랫폼차). 판정 로직만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

/** 가짜 프로세스 목록을 판정기에 먹인다. @returns 종료코드(0=커밋 허용, 1=차단) */
function judge(procs: string[]): number {
  try {
    execFileSync('bash', ['scripts/check-no-injection-in-progress.sh', '--stdin'],
      { input: procs.join('\n'), stdio: ['pipe', 'pipe', 'pipe'] })
    return 0
  } catch (e) { return (e as { status?: number }).status ?? -1 }
}

describe('🚫 막아야 하는 경우 — 주입이 실제로 도는 중', () => {
  it('🔒 주입 실행 중이면 커밋을 막는다 (이게 이 가드의 존재 이유다)', () => {
    expect(judge(['node scripts/check-guard-mutations.mjs -s'])).toBe(1)
  })

  it('🔒 절대경로 node 로 띄워도 막는다', () => {
    expect(judge(['/opt/node22/bin/node scripts/check-guard-mutations.mjs --only "x"'])).toBe(1)
  })

  it('🔒 다른 프로세스에 섞여 있어도 찾아낸다', () => {
    expect(judge([
      '/bin/bash -c npm test',
      'node scripts/check-guard-mutations.mjs',
      'git status',
    ])).toBe(1)
  })
})

describe('✅ 막으면 안 되는 경우 — 소스를 안 건드리는데 막혔다', () => {
  it('🔒 셸 argv 에 **이름만** 있는 커밋은 통과한다(이게 오탐이었다)', () => {
    expect(judge([
      `/bin/bash -c eval 'node --check scripts/check-guard-mutations.mjs && git add -A && git commit -F msg'`,
    ])).toBe(0)
  })

  it('🔒 커밋 메시지에 그 이름이 들어가도 통과한다', () => {
    expect(judge([`git commit -m "fix: check-guard-mutations.mjs 앵커 재조준"`])).toBe(0)
  })

  it.each([
    ['--map-only', '지도 점검 — 주입하지 않는다'],
    ['--verify-clean', '잔재 확인 — 주입하지 않는다'],
    ['--check', '구문 검사 — node 의 플래그다'],
  ])('🔒 `%s` 는 소스를 안 건드리므로 통과 — %s', (flag) => {
    expect(judge([`node scripts/check-guard-mutations.mjs ${flag}`])).toBe(0)
  })

  it('아무것도 안 돌면 당연히 통과', () => {
    expect(judge(['/bin/bash -c git status', 'sshd'])).toBe(0)
  })
})
