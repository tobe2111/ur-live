/**
 * 🛡️ 세션 시작 시 git 검사 자동 설치 — 2026-11-01 (대표 *"모든 세션에서 배포하는 과정이 순탄하지가
 * 않아 … 왜 이러는거지?"* → *"모두 다 해줘"*).
 *
 * 원격 세션의 컨테이너는 매번 새로 만들어지고 `.git/hooks/` 는 클론에 안 딸려 온다. 종전엔
 * "세션마다 `bash scripts/install-git-hooks.sh` 를 직접 돌려라" 라고 **문서에만** 적혀 있었고
 * (`CLAUDE.md` 개발 환경 셋업 · `.claude/agents/dev.md`), 시작 스크립트는 스크래퍼만 깔았다.
 * 잊은 세션은 로컬 검사 없이 커밋하고 오류를 **CI 에서야** 처음 봤다.
 *
 * 이 시험이 지키는 것:
 *   ① 시작 스크립트가 설치 스크립트를 부른다
 *   ② 그 호출이 **첫 `exit 0` 보다 앞**에 있다 — 그 아래는 스크래퍼가 이미 돌거나 의존성 설치가
 *      실패하면 중간에 끝난다. 뒤에 두면 그 경우 **조용히 안 깔린다**(에러 0).
 *   ③ 원격 세션 판정(`CLAUDE_CODE_REMOTE`) **뒤**에 있다 — 로컬 개발자의 훅을 덮어쓰지 않는다.
 *   ④ 설치 스크립트가 실재한다(경로가 낡으면 `[ -f ]` 가 조용히 건너뛴다).
 *
 * ⚠️ **못 보는 것**: 실제 세션에서 훅이 깔리는지(그건 컨테이너 시작 시점이라 레포가 못 본다 —
 * 2026-11-01 에 검사 없는 새 클론에서 시작 스크립트를 직접 돌려 `pre-commit`·`pre-push` 가 생기는 것을
 * 확인했다). 그리고 설치가 실패하면 시작은 계속된다(경고만 낸다) — 세션을 못 켜게 막는 쪽이 더 나쁘다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const START = '.claude/hooks/session-start.sh'
const INSTALL = 'scripts/install-git-hooks.sh'
const src = readFileSync(START, 'utf8')
/** 주석 줄을 뺀 실행 본문 — 주석이 호출을 *언급만* 해도 통과하는 일을 막는다. */
const code = src
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

describe('세션 시작 시 git 검사를 자동 설치한다', () => {
  it('① 시작 스크립트가 설치 스크립트를 실제로 부른다(주석이 아니라 코드에서)', () => {
    // 🩸 첫 판은 `/bash scripts\/install-git-hooks\.sh/` 였는데 **설치 호출을 지워도 통과했다** —
    //   실패 시 안내 문구(`echo "… 직접: bash scripts/install-git-hooks.sh"`)에 같은 글자가 있었다.
    //   주입이 잡았다. 그래서 *실제로 실행되는 형태*(서브셸에서 cd 후 실행)만 인정한다.
    expect(code, '설치 호출이 없다 — 문서 규칙만 남는다').toMatch(/\(\s*cd [^)]*&&\s*bash scripts\/install-git-hooks\.sh/)
  })

  it('② 그 호출이 첫 `exit 0` 보다 앞에 있다 (뒤에 두면 조용히 안 깔린다)', () => {
    const call = code.indexOf('install-git-hooks.sh')
    const remoteGate = code.indexOf('CLAUDE_CODE_REMOTE')
    // 원격 판정 블록의 exit 다음에 나오는 첫 exit 0 = 스크래퍼 쪽 중간 종료
    const firstScraperExit = code.indexOf('exit 0', code.indexOf('fi', remoteGate) + 2)
    expect(call, '설치 호출을 못 찾았다').toBeGreaterThan(-1)
    expect(firstScraperExit, '스크래퍼 쪽 exit 0 을 못 찾았다 — 구조가 바뀌었으면 이 시험을 재조준할 것').toBeGreaterThan(-1)
    expect(call, '설치 호출이 중간 종료 뒤에 있다').toBeLessThan(firstScraperExit)
  })

  it('③ 원격 세션 판정 뒤에 있다 (로컬 개발자 환경을 건드리지 않는다)', () => {
    expect(code.indexOf('install-git-hooks.sh')).toBeGreaterThan(code.indexOf('CLAUDE_CODE_REMOTE'))
  })

  it('④ 설치 스크립트가 실재한다', () => {
    expect(existsSync(INSTALL), `${INSTALL} 이 없다 — 시작 스크립트의 [ -f ] 가 조용히 건너뛴다`).toBe(true)
  })
})
