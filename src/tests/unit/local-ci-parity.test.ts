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
 * 🩸 같은 날 후속 — 이 체계를 만든 커밋이 `verify.yml` 의 들여쓰기를 깨뜨렸다.
 *   결과는 CI 실패가 **아니라** 잡 0개로 즉시 종료였고, PR 엔 Verify 가 아예 안 뜬 채
 *   `Cloudflare Pages ✅` 하나만 남아 통과처럼 보였다("조용한 부재"). 그때 pre-push 게이트는
 *   목록을 **줄 단위 정규식**으로 뽑아 깨진 YAML 에서도 94개를 통과시켰다.
 *   ⇒ ④ 워크플로 파싱 · ⑤ 정규식↔파서 분류 대조를 더했다.
 *
 * ⚠️ 이 테스트가 **못 하는 것**: `.git/hooks/pre-push` 가 실제로 설치됐는지는 못 본다
 *   (훅은 클론에 안 딸려 온다). 원격 세션은 세션마다 `bash scripts/install-git-hooks.sh`
 *   를 다시 돌려야 한다 — CLAUDE.md '개발 환경 셋업' 참조.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ciStrictGuards,
  ciWarnGuards,
  guardsIn,
  guardsMentioned,
  localGateGuards,
  localGateSteps,
  workflowFiles,
  workflowYamlErrors,
  EXCLUDE,
} from '../../../scripts/local-ci-parity.mjs'

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

describe('④ 워크플로가 실제로 GitHub 가 읽을 모양이다', () => {
  it('모든 워크플로가 YAML 로 파싱된다 — 깨지면 CI 는 빨간불이 아니라 아예 안 돈다', () => {
    expect(workflowYamlErrors()).toEqual([])
  })

  it('워크플로 파일을 실제로 찾는다 (측정 0 은 통과가 아니다)', () => {
    expect(workflowFiles().length).toBeGreaterThan(2)
  })
})

describe('⑤ 정규식과 파서가 같은 것을 본다', () => {
  // ⚠️ 아래 둘은 **빈 배열이면 저절로 통과**하는 모양이다(filter → []).
  //    그래서 두 입력 모두 "0 이면 실패" 를 먼저 못 박는다 — 이 레포가 반복해 당한
  //    "검사가 실패할 수 없게 되는" 클래스를 이 테스트 자신이 다시 만들지 않도록.
  it('두 추출기 모두 실제로 무언가를 센다 (측정 0 은 통과가 아니다)', () => {
    expect(guardsMentioned().length).toBeGreaterThan(30)
    expect(ciWarnGuards().length).toBeGreaterThan(0)
  })

  it('verify.yml 에 언급된 가드는 전부 strict 나 warn 으로 분류된다', () => {
    const classified = new Set([...ciStrictGuards(), ...ciWarnGuards()])
    expect(guardsMentioned().filter((g) => !classified.has(g))).toEqual([])
  })

  it('경고 전용 가드는 게이트가 돌리지 않는다 — CI 가 안 막는 걸 로컬이 막으면 그것도 불일치다', () => {
    const gate = new Set(localGateGuards())
    expect(ciWarnGuards().filter((g) => gate.has(g))).toEqual([])
  })
})

describe('③ 게이트가 실제로 설치·실행된다', () => {
  it('설치 스크립트가 pre-push 훅을 만든다', () => {
    expect(INSTALLER).toContain('$HOOK_DIR/pre-push')
    expect(INSTALLER).toContain('pre-push-gate.mjs')
  })

  it('게이트는 가드가 0개면 통과가 아니라 실패한다', () => {
    // ⚠️ **변수 이름에 앵커를 걸지 말 것.** 2026-09-14 에 여기 `guards.length === 0` 을
    //    박아 뒀는데, 게이트가 이름 대신 CI 명령을 통째로 돌도록 고쳐지며 `steps` 로
    //    바뀌자 뜻은 그대로인데 빨간불이 났다(이 레포의 단골 "앵커가 이름을 가리킴").
    //    지키려는 것은 **측정 0 이면 통과가 아니라 실패한다**는 것 하나다.
    // 🩸 그리고 첫 수정은 **헐거웠다** — `/\.length === 0\)/` 는 파일 뒤쪽의
    //    `failed.length === 0` 에도 걸려서, 0-측정 분기를 통째로 꺼도 초록이었다.
    //    주입이 그걸 잡았다. ⇒ "0 이면 실패" 메시지 **바로 앞**에 길이-0 검사가 있어야 한다.
    const zeroIdx = GATE.indexOf('파서가 낡았다')
    expect(zeroIdx, '0-측정 실패 메시지가 사라졌다').toBeGreaterThan(-1)
    expect(GATE.slice(Math.max(0, zeroIdx - 300), zeroIdx)).toMatch(/\.length === 0\)\s*\{/)
    expect(GATE).toMatch(/process\.exit\(1\)/)
  })

  it('게이트는 실패를 삼키지 않는다 — 빨간불이면 종료코드 1', () => {
    expect(GATE).toContain('failed.length === 0')
  })
})

describe('⑥ 게이트는 CI 와 **같은 모드**로 돌린다 (이름만 뽑으면 절반이 헛돈다)', () => {
  // 🩸 2026-09-14 실사고: 게이트가 `node scripts/<이름>` 을 맨손으로 돌렸다. CI 는
  //    `--changed-only -s` 나 `STRICT_FILE_SIZE: 1` 로 strict 를 켜는데 둘 다 버려져서,
  //    그 가드들이 로컬에서 **경고 모드로 통과**했다. 게이트는 "94개 통과"를 찍었고
  //    CI 가 43분 뒤에 막았다 — 이 게이트가 없애려던 바로 그 루프를, 게이트가 만들었다.
  it('플래그·env 를 실제로 들고 있다 (측정 0 은 통과가 아니다)', () => {
    const steps = localGateSteps()
    expect(steps.length).toBeGreaterThan(30)
    const withFlags = steps.filter((s: { run: string }) =>
      /check-[a-z0-9-]+\.(mjs|sh)\s+\S/.test(s.run),
    )
    const withEnv = steps.filter(
      (s: { env: Record<string, string> }) => Object.keys(s.env ?? {}).length > 0,
    )
    expect(withFlags.length, 'CI 가 플래그로 strict 를 켜는 스텝이 하나도 없을 리 없다').toBeGreaterThan(10)
    expect(withEnv.length, 'CI 가 env 로 strict 를 켜는 스텝이 하나도 없을 리 없다').toBeGreaterThan(0)
  })

  it('게이트가 명령·env 를 그대로 실행한다 (이름으로 조립 금지)', () => {
    expect(GATE).toContain('localGateSteps')
    expect(GATE).toMatch(/step\.run/)
    expect(GATE).toMatch(/\.\.\.step\.env/)
    // 옛 방식(이름으로 경로를 조립)이 되살아나면 플래그·env 가 다시 사라진다.
    expect(GATE).not.toMatch(/`scripts\/\$\{g\}`/)
  })

  it('게이트 대상은 CI strict 집합과 정확히 같다 (EXCLUDE 제외)', () => {
    const fromSteps = new Set(
      localGateSteps().flatMap((s: { guards: string[] }) => s.guards),
    )
    expect([...fromSteps].sort()).toEqual([...new Set(localGateGuards())].sort())
  })
})

describe('⑦ npm 스크립트에 감싸인 차단 가드도 보인다 (2026-10-18)', () => {
  // 🩸 왜: `verify.yml` 의 `Bundle size budget` 은 strict 인데 `npm run check:bundle:budget`
  //   으로 호출돼 파서에 **0건**으로 보였고, 그 이름이 보이는 유일한 자리는 같은 파일의
  //   보고·아티팩트 스텝(`continue-on-error: true`)이라 `check-bundle-size.mjs` 가 통째로
  //   "CI 경고" 로 분류됐다 — 차단 가드가 로컬 게이트에서 **조용히 빠진** 채 parity 는 "건강".
  it('npm run 뒤에 숨은 check-* 를 풀어낸다', () => {
    expect(guardsIn('node scripts/ci-run.mjs npm run check:bundle:budget')).toContain('check-bundle-size.mjs')
  })
  it('리터럴 경로는 종전대로 줍는다', () => {
    expect(guardsIn('node scripts/check-exec-cost.mjs')).toEqual(['check-exec-cost.mjs'])
  })
  it('🔴 npm 해석은 generate-* 를 가드로 세지 않는다 — 세면 푸시 게이트가 빌드를 돌린다', () => {
    // `npm run build:worker` 는 generate-route-chunk-map.mjs 를 돌리는 **빌드**다.
    // 이 규칙 없이 측정했을 때 로컬 게이트 스텝이 100 → 101 로 늘었다(실측).
    expect(guardsIn('npm run build:worker')).toEqual([])
    expect(localGateSteps().some((s: { run: string }) => s.run.includes('build:worker'))).toBe(false)
  })
  it('그래서 bundle-size 는 이제 strict 로 분류되고, 제외라면 사유가 있다', () => {
    expect(ciStrictGuards()).toContain('check-bundle-size.mjs')
    expect(Object.keys(EXCLUDE)).toContain('check-bundle-size.mjs')
    expect(String(EXCLUDE['check-bundle-size.mjs']).length).toBeGreaterThan(20)
  })
})
