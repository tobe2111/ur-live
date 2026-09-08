/**
 * ⏱️ **PR 은 좁게, 전수는 따로** — 이 둘은 반드시 짝이다 (2026-09-08 대표 "모두 다 순서대로 진행").
 *
 * ## 실측이 시킨 일
 * Verify 48분 29초 중 `check-guard-mutations -s` 가 **37분 24초 = 77%**
 * (job 101957335695 스텝 타이밍). 항목이 950건을 넘어 선형으로 는다.
 * 그 길이의 2차 피해가 더 컸다 — CI 가 도는 동안 main 이 움직이고, 거의 모든 PR 이 그 매니페스트를
 * 건드리니 **머지마다 충돌**했다(2026-09-08 하루 머지 시도 4번 중 3번이 405 conflict).
 *
 * ## 🔴 이 테스트가 지키는 단 하나
 * **좁히기와 전수는 같이 있어야 한다.** `verify.yml` 이 `--changed` 를 쓰는데 전수 워크플로가
 * 사라지면, 전수는 **어디서도 안 돌고** 아무 에러도 안 난다 — 이 레포가 반복해 당한
 * "검사가 실패하는 게 아니라 아예 안 도는" 클래스 그대로다.
 * (2026-09-08 이전에는 전수가 `verify.yml` **한 곳에서만** 돌았다. 그래서 좁히기만 했으면
 *  그 순간 전수가 통째로 사라졌을 것이다 — 이 파일은 그 실수를 못 하게 만든다.)
 *
 * ## 이 테스트가 못 막는 것
 * - 야간 cron 이 실제로 발화하는지(GitHub 사정) — 그건 Actions 이력으로만 안다.
 * - `--changed` 가 고른 집합이 "충분한지" — 원리상 못 고르는 경우가 있어 전수가 필요한 것이고,
 *   그 필요를 여기서 문서로 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readRaw } from '../helpers/source-text'
// 🔴 **텍스트가 아니라 동작을 잰다.** 이 레포가 반복해 당한 "문자열만 맞고 실제로는 안 도는" 가드가
//    되지 않으려면 판정 함수를 실제로 불러야 한다 — 그래서 순수 모듈로 뽑았다.
import { ALWAYS_FULL, fullReasonFor, inScope, changedScope } from '../../../scripts/guard-mutations-scope.mjs'

// 🩸 **워크플로는 `readRaw` 로 읽는다.** `readCode` 를 쓰면 `paths-ignore: ['docs/**', …]` 의
//    `/**` 를 블록 주석 시작으로 읽어 **파일 가운데가 통째로 사라진다**(헬퍼 주석이 경고한 그 지뢰를
//    이 파일을 쓰면서 실제로 밟았다 — 첫 판이 그래서 빨간불이었다). YAML 은 `#` 주석이라
//    `^` 앵커나 정확한 문자열로 판정하면 주석에 속지 않는다.
/**
 * YAML 은 `#` 주석뿐이라 줄 단위로 걷어내면 정확하다.
 * 🩸 이게 없으면 **설명 주석에 속는다** — 전수 워크플로에 *"`--changed` 를 붙이지 말 것"* 이라고
 *    적어 둔 그 문장 때문에 `not.toMatch(/--changed/)` 가 빨간불이 났다(첫 판이 실제로 그랬다).
 *    이 레포가 반복해 당한 "주석이 코드 행세를 한다" 클래스의 반대 방향이다.
 */
const yamlCode = (t: string) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

const VERIFY = yamlCode(readRaw('.github/workflows/verify.yml'))
const FULL = yamlCode(readRaw('.github/workflows/guard-mutations-full.yml'))
// 러너는 .mjs 라 readCode 가 맞지만, 여기서 찾는 문자열이 **설명 주석에도** 있어(전수/좁힘을 길게
// 설명해 뒀다) 주석만 남아도 통과하는 함정이 생긴다. 그래서 코드만 남긴 사본을 쓴다.
const RUNNER = readRaw('scripts/check-guard-mutations.mjs')

describe('PR 은 변경분만 돈다', () => {
  it('verify.yml 이 --changed 로 부른다', () => {
    expect(VERIFY).toMatch(/check-guard-mutations\.mjs --changed -s/)
  })

  it('러너가 --changed 를 실제로 해석하고 루프에서 거른다', () => {
    expect(RUNNER).toMatch(/const CHANGED = process\.argv\.includes\('--changed'\)/)
    expect(RUNNER, '판정 모듈을 안 쓴다').toMatch(/from '\.\/guard-mutations-scope\.mjs'/)
    expect(RUNNER, '루프에 필터가 없다').toMatch(/if \(!inScope\(m, SCOPE\)\) continue/)
  })
})

describe('🔴 전수는 반드시 어딘가에서 돈다', () => {
  it('전수 워크플로가 존재하고 --changed 없이 부른다', () => {
    expect(FULL).toMatch(/check-guard-mutations\.mjs -s/)
    expect(FULL, '전수 워크플로가 좁혀 돌면 전수가 사라진다').not.toMatch(/--changed/)
  })

  it('main push 와 야간에 돈다 — 둘 중 하나만으로는 부족하다', () => {
    // main push 만: main 이 조용한 날 전수가 며칠씩 안 돈다.
    // 야간만: 머지된 조합이 하루 동안 검증 없이 산다.
    expect(FULL).toMatch(/push:\s*\n\s*branches: \[main\]/)
    expect(FULL).toMatch(/schedule:/)
    expect(FULL).toMatch(/cron: '[^']+'/)
  })

  it('전수 잡에 타임아웃이 있다 — 무한 대기로 조용히 안 끝나면 안 돈 것과 같다', () => {
    expect(FULL).toMatch(/timeout-minutes: \d+/)
  })
})

describe('🔴 애매하면 전수 (fail-safe) — 실제로 함수를 돌린다', () => {
  it('가드 자신을 고치면 전수다 — 안 그러면 새 주입이 그 PR 에서 검증되지 않는다', () => {
    expect(fullReasonFor(new Set(['scripts/check-guard-mutations.mjs']))).toBeTruthy()
    expect(fullReasonFor(new Set(['scripts/guard-mutations-scope.mjs']))).toBeTruthy()
  })

  it('러너 환경·공용 헬퍼가 바뀌어도 전수다', () => {
    for (const f of ['package.json', 'package-lock.json', 'vitest.config.ts',
                     '.github/workflows/verify.yml', 'src/tests/helpers/source-text.ts']) {
      expect(fullReasonFor(new Set([f])), `${f} 에서 전수로 안 간다`).toBeTruthy()
    }
    expect(ALWAYS_FULL.length).toBeGreaterThanOrEqual(5)
  })

  it('🔴 바뀐 파일 0개는 "돌 것 없음" 이 아니라 전수다', () => {
    // base 계산이 틀려도 0 개가 나온다. 믿으면 **하나도 안 돌리고 초록**이 뜬다.
    expect(fullReasonFor(new Set())).toBeTruthy()
    expect(fullReasonFor(null)).toBeTruthy()
  })

  it('평범한 소비자 파일만 바뀌면 좁힌다', () => {
    expect(fullReasonFor(new Set(['src/pages/VideosPage.tsx', 'src/shared/urshorts.ts']))).toBeNull()
  })

  it('base 를 못 구하면(shallow clone) 전수로 폴백한다', () => {
    const scope = changedScope({ enabled: true, run: () => { throw new Error('fatal: no merge base') } })
    expect(scope.full).toBe(true)
    expect((scope as { why: string }).why).toContain('fetch-depth')
  })

  it('--changed 가 아니면 언제나 전수다', () => {
    expect(changedScope({ enabled: false, run: () => '' }).full).toBe(true)
  })
})

describe('무엇을 고르나 — 실제 선택', () => {
  const m = { file: 'src/pages/VideosPage.tsx', test: 'src/tests/unit/urshorts-viewer-chrome.test.ts' }

  it('바뀐 파일을 고치는 주입은 고른다', () => {
    const files = new Set(['src/pages/VideosPage.tsx'])
    expect(inScope(m, { full: false, files })).toBe(true)
  })

  it('그 주입의 **테스트**가 바뀌어도 고른다 — 테스트를 헛돌게 만드는 변경이 그 자리다', () => {
    const files = new Set(['src/tests/unit/urshorts-viewer-chrome.test.ts'])
    expect(inScope(m, { full: false, files })).toBe(true)
  })

  it('무관한 파일만 바뀌면 안 고른다 (이게 48분을 줄이는 부분)', () => {
    const files = new Set(['src/pages/AdminUrShortsPage.tsx'])
    expect(inScope(m, { full: false, files })).toBe(false)
  })

  it('전수 스코프면 무조건 고른다', () => {
    expect(inScope(m, { full: true })).toBe(true)
  })

  it('git 응답을 그대로 먹여 봤을 때 — 커밋분과 작업트리를 합친다', () => {
    const scope = changedScope({
      enabled: true,
      run: (args: string[]) => (args[0] === 'merge-base' ? 'abc123\n'
        : args.includes('HEAD') ? 'src/pages/VideosPage.tsx\n' : 'src/shared/urshorts.ts\n'),
    })
    expect(scope.full).toBe(false)
    const files = (scope as { files: Set<string> }).files
    expect([...files].sort()).toEqual(['src/pages/VideosPage.tsx', 'src/shared/urshorts.ts'])
  })
})

describe('좁혀 돌 때 그 사실을 말한다', () => {
  it('초록불의 의미가 다르다고 화면에 적는다', () => {
    expect(RUNNER).toMatch(/guard-mutations\(--changed\)/)
    expect(RUNNER).toMatch(/여기서 초록이라고 전수가 초록인 건 아니다/)
  })
})
