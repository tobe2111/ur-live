/**
 * 🔎 **CI 를 92% 확률로 느린 길로 보내던 한 줄을 걷어낸 것을 고정한다** (2026-09-15)
 *
 * ## 무엇을 재고 왜 고쳤나 (실측)
 * Verify 최근 100 run: 성공 중앙값 **55.9분**(24건) vs 좁혀 돈 run **12.1분**(5건). 4.6배.
 * 머지 PR 25건 중 **23건이 전수**였고 이유는 `ALWAYS_FULL` 의 `'scripts/'` 접두사 하나였다:
 * 러너에 주입을 한 줄 더한 PR 11건 · `*-baseline.json` 같은 **판정 무관** 파일 6건 ·
 * `scripts/mutations/*` 3건. ⇒ `CLAUDE.md` 의 *"새 가드 → 주입 한 줄"* 을 **지킬수록 느려졌다.**
 *
 * ## 여기서 지키는 것
 *  ① 판정은 **이름 diff** 로 한다 — 새 주입·겨눈 자리가 바뀐 주입만. 설명 문구만 바뀐 건 안 고른다.
 *  ② **애매하면 전수**다 — 앵커 소실·base 실패는 전부 넓은 쪽으로 떨어진다.
 *  ③ **판정 자신**(scope·manifest-diff)이 바뀌면 전수. 그건 fail-safe 라 지운 적이 없어야 한다.
 *
 * ⚠️ **못 보는 것**: 실제 CI 가 몇 분 걸리는지. 그건 배포 후 run 시간으로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  changedInjectionNames, stripInlineManifest, runnerLogicChanged, testSpawnsSubprocess,
} from '../../../scripts/guard-mutations-manifest-diff.mjs'
import { ALWAYS_FULL, fullReasonFor, touchesGuardScripts } from '../../../scripts/guard-mutations-scope.mjs'

const M = (name: string, over: Record<string, string> = {}) => ({
  name, file: 'src/a.ts', find: 'A', replace: 'B', test: 'src/tests/unit/a.test.ts', why: 'w', ...over,
})

describe('① 바뀐 주입만 고른다', () => {
  it('새로 생긴 이름은 고른다 — 그 PR 에서 검증돼야 한다', () => {
    expect([...changedInjectionNames([M('a')], [M('a'), M('b')])]).toEqual(['b'])
  })

  it('겨눈 자리가 바뀌면 고른다 (file·find·replace·test)', () => {
    for (const k of ['file', 'find', 'replace', 'test']) {
      const got = changedInjectionNames([M('a')], [M('a', { [k]: 'CHANGED' })])
      expect([...got], `${k} 가 바뀌었는데 안 골랐다`).toEqual(['a'])
    }
  })

  it('🔴 설명(why)만 바뀐 건 안 고른다 — 주석 한 줄에 40분을 쓰지 않는다', () => {
    expect([...changedInjectionNames([M('a')], [M('a', { why: '다른 설명' })])]).toEqual([])
  })

  it('지워진 주입은 안 고른다 — 돌릴 것이 없다', () => {
    expect([...changedInjectionNames([M('a'), M('b')], [M('a')])]).toEqual([])
  })

  it('base 를 못 구했으면(null) head 를 전부 고른다 — 넓은 쪽', () => {
    expect([...changedInjectionNames(null, [M('a'), M('b')])]).toEqual(['a', 'b'])
  })
})

describe('② 애매하면 전수', () => {
  it('🔴 앵커가 없으면 판정을 포기한다 (null) — 조용히 틀리지 않는다', () => {
    expect(stripInlineManifest('앵커 없는 소스')).toBeNull()
    expect(stripInlineManifest(123 as unknown as string)).toBeNull()
  })

  it('🔴 앵커가 사라지면 로직이 바뀐 것으로 친다 (전수)', () => {
    expect(runnerLogicChanged('아무것도', '없는 소스')).toBe(true)
  })

  it('매니페스트 내용만 다르면 로직은 안 바뀐 것', () => {
    const withManifest = (body: string) => `머리\nconst MUTATIONS = [${body}]\nconst MUTATIONS_DIR = x\n꼬리`
    expect(runnerLogicChanged(withManifest('1'), withManifest('1,2,3'))).toBe(false)
  })

  it('🔴 매니페스트 밖이 바뀌면 전수', () => {
    const withTail = (tail: string) => `머리\nconst MUTATIONS = [1]\nconst MUTATIONS_DIR = x\n${tail}`
    expect(runnerLogicChanged(withTail('꼬리'), withTail('다른 꼬리'))).toBe(true)
  })
})

describe('③ fail-safe 는 살아 있다', () => {
  it('🔴 판정 자신이 바뀌면 전수 — 이 두 줄을 지우면 좁힘이 자기를 검사 못 한다', () => {
    expect(ALWAYS_FULL).toContain('scripts/guard-mutations-scope.mjs')
    expect(ALWAYS_FULL).toContain('scripts/guard-mutations-manifest-diff.mjs')
    expect(fullReasonFor(['scripts/guard-mutations-scope.mjs'])).toBeTruthy()
  })

  it('🔴 `scripts/` 통째 전수는 **되돌아오면 안 된다** — 그게 92% 를 느리게 만든 줄이다', () => {
    expect(ALWAYS_FULL).not.toContain('scripts/')
    expect(fullReasonFor(['scripts/mutations/x.mjs'])).toBeNull()
    expect(fullReasonFor(['scripts/check-guard-mutations.mjs'])).toBeNull()
  })

  it('러너 환경(package.json·verify.yml·테스트 헬퍼)은 여전히 전수', () => {
    for (const f of ['package.json', '.github/workflows/verify.yml', 'src/tests/helpers/source-text.ts']) {
      expect(fullReasonFor([f]), `${f} 가 전수를 안 부른다`).toBeTruthy()
    }
  })

  it('바뀐 파일이 0개면 믿지 않고 전수', () => {
    expect(fullReasonFor([])).toBeTruthy()
  })
})

describe('④ 하위 프로세스를 띄우는 테스트 구멍', () => {
  it('가드를 직접 돌리는 테스트를 알아본다', () => {
    expect(testSpawnsSubprocess("execFileSync('node', ['scripts/check-x.mjs'])")).toBe(true)
    expect(testSpawnsSubprocess('const x = 1')).toBe(false)
  })

  it('러너·매니페스트 밖의 scripts 변경만 이 구멍을 연다', () => {
    expect(touchesGuardScripts(['scripts/check-theme-consistency.mjs'])).toBe(true)
    expect(touchesGuardScripts(['scripts/mutations/a.mjs'])).toBe(false)
    expect(touchesGuardScripts(['scripts/check-guard-mutations.mjs'])).toBe(false)
  })
})

describe('⑤ 러너 배선', () => {
  const runner = readFileSync('scripts/check-guard-mutations.mjs', 'utf8')

  it('🔴 옛 base 러너를 부르지 않는다 — 모르는 플래그를 받으면 그쪽이 40분 전수를 돈다', () => {
    // 이 안전판이 없으면 하위 프로세스가 전수를 돌고 **소스에 주입까지** 한다(실제로 걸렸다).
    expect(runner).toMatch(/if \(!baseRunnerSrc\.includes\('--dump-manifest'\)\)/)
    expect(runner).toMatch(/timeout: 60_000/)
  })

  it('🔴 목록 덤프는 동기 write 다 — stdout 비동기면 큰 JSON 이 잘린다', () => {
    // 실측: `process.stdout.write` + `process.exit` 조합이 55,166자에서 끊겼다.
    expect(runner).toMatch(/fs\.writeSync\(1, JSON\.stringify\(/)
  })
})
