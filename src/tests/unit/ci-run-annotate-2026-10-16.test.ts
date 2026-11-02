/**
 * 🔎 **CI 실패가 API 로 읽히는가** (2026-10-16 — 못 읽어서 25분을 쓴 뒤 만들었다).
 *
 * ## 왜 생겼나 (실측)
 * `Bundle budget (main)` 의 실행비용 래칫이 머지 `0e58ab293` 에서 빨간불인데 **무엇이 얼마나
 * 넘었는지 아무도 못 봤다**: 그 가드는 숫자를 stdout 으로만 말하고
 * `actions/jobs/<id>/logs` 는 blob 으로 302 되며(이 환경의 `gh` 는 api.github.com 밖으로 안 간다)
 * 아티팩트 0건 · check-run `output` 비어 있음 · annotation 은 `Process completed with exit code 1`.
 * ⇒ 워크플로가 지시하는 *"로그의 실측을 읽고 기준을 올려라"* 를 세션은 **구조적으로 못 한다.**
 * 그래서 로컬 재현 + **직전 커밋 대조군 재빌드**(빌드 2 · 측정 2 ≈ 25분)로 겨우 무죄를 밝혔다.
 *
 * ## 이 시험이 지키는 것
 * ① 래칫 여섯 자리가 전부 래퍼를 지난다(새 가드가 조용히 새면 다시 눈먼다)
 * ② 래퍼가 종료코드를 **삼키지 않는다** — 가드를 통과시키면 그게 더 큰 사고다
 * ③ 실패할 때만 annotation 을 낸다 · 로컬에서는 안 낸다
 * ④ 이스케이프 규칙(`%`→`%25` 먼저) — 순서가 틀리면 줄바꿈이 깨져 메시지가 뭉개진다
 * ⑤ `CI_RUN_NOTICE=1`(**main 전용**)이면 성공해도 숫자를 남긴다 — PR 에는 안 준다
 *
 * ## 못 보는 것
 * - GitHub 가 그 annotation 을 실제로 저장·노출하는지(플랫폼 동작 — 배포 후 API 로만 확인)
 * - annotation 총량 상한에 걸려 잘리는 경우
 * - 래칫의 **판정**이 옳은지(그건 각 가드의 몫이다)
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { escapeData, escapeProp, annotationLine, emitAnnotation } from '../../../scripts/lib/ci-annotate.mjs'
import { tail, exitCodeOf, TAIL_CHARS } from '../../../scripts/ci-run.mjs'
import { runSteps } from '../../../scripts/local-ci-parity.mjs'

const read = (p: string) => fs.readFileSync(p, 'utf8')
/** 래칫 스텝의 `run:` 줄 — 워크플로 둘 × 가드 셋 */
const RATCHETS = ['check:bundle:budget', 'check-surface-budgets.mjs', 'check-exec-cost.mjs']
const WORKFLOWS = ['.github/workflows/bundle-budget-main.yml', '.github/workflows/verify.yml']

describe('① 래칫 여섯 자리가 전부 래퍼를 지난다', () => {
  for (const wf of WORKFLOWS) {
    for (const g of RATCHETS) {
      it(`${wf.split('/').pop()} · ${g}`, () => {
        const lines = read(wf).split('\n').filter((l) => l.includes('run:') && l.includes(g))
        expect(lines.length, `${g} 의 run: 줄을 못 찾았다 — 경로가 바뀌었으면 이 시험을 재조준할 것`).toBeGreaterThan(0)
        for (const l of lines) {
          expect(l, `래퍼를 안 지난다 → 그 실패는 다시 API 로 안 읽힌다:\n${l.trim()}`).toContain('scripts/ci-run.mjs')
        }
      })
    }
  }
  // 🔁 2026-11-01 재조준: 총량을 고정하던 것(`toBe(6)`)을 **래칫 자리**로 좁혔다. 래퍼는 래칫 전용
  //   장치가 아니라 **실패 이유를 PR annotation 으로 띄우는 것**이라(이 시험이 생긴 이유가 정확히
  //   "로그를 못 읽어 25분 썼다"다) 다른 strict 가드도 쓰는 것이 옳다. 지키려던 것(래칫 셋이 양쪽
  //   워크플로에 **다** 배선됐는가)은 그대로이고, 위 6개 it 과 아래 둘이 그걸 각각 다른 각도로 잠근다.
  //   ⚠️ 총량을 다시 `toBe(n)` 으로 박지 말 것 — 래퍼를 쓰는 가드가 하나 늘 때마다 낡고,
  //      그러면 "숫자를 올리는" 수정이 관례가 되어 래칫 누락을 못 잡는다.
  it('래칫 자리가 정확히 여섯이다(한쪽 워크플로만 배선하면 반쪽이다)', () => {
    const ratchet = WORKFLOWS.flatMap((wf) =>
      read(wf).split('\n').filter((l) => l.includes('scripts/ci-run.mjs') && RATCHETS.some((g) => l.includes(g))))
    expect(ratchet.length, `래칫×워크플로 = 3×2 = 6 이어야 한다:\n${ratchet.join('\n')}`).toBe(6)
  })

  it('래퍼를 쓰는 비-래칫 가드는 **알려진 것뿐**이다(조용히 늘지 않게)', () => {
    // 래칫이 아닌데 래퍼를 쓰는 자리는 여기 적힌 것만. 늘리려면 **왜 annotation 이 필요한지**를
    // 함께 적을 것(실패 메시지가 숫자·목록이라 로그만으로는 못 읽는 가드가 그 대상이다).
    const KNOWN = [
      // 렌더 중 window 접근 검사(2026-11-01) — 실패 메시지가 "어느 결함 N건" 목록이라 annotation 이 필요하다.
      'check-ssr-render-window.mjs',
    ]
    const others = WORKFLOWS.flatMap((wf) =>
      read(wf).split('\n').filter((l) => l.includes('scripts/ci-run.mjs') && !RATCHETS.some((g) => l.includes(g))))
    for (const l of others) {
      expect(KNOWN.some((k) => l.includes(k)), `래퍼를 쓰는 새 자리가 등록 없이 생겼다:\n${l.trim()}`).toBe(true)
    }
    // 🛡️ 측정 0 = 통과가 아니다 — 이 시험이 아무것도 안 보는 상태로 굳는 것을 막는다.
    expect(others.length).toBeGreaterThan(0)
  })
})

describe('② 종료코드를 삼키지 않는다 — 래퍼가 가드를 통과시키면 안 된다', () => {
  const run = (code: string, env: Record<string, string> = {}) => {
    try {
      execFileSync('node', ['scripts/ci-run.mjs', 'node', '-e', code], { encoding: 'utf8', env: { ...process.env, ...env } })
      return { status: 0, out: '' }
    } catch (e: any) {
      return { status: e.status as number, out: String(e.stdout || '') + String(e.stderr || '') }
    }
  }
  it('실패를 그대로 전달한다', () => expect(run('process.exit(3)').status).toBe(3))
  it('성공은 0 이고 annotation 을 안 낸다', () => {
    const r = run("console.log('초록')", { GITHUB_ACTIONS: 'true' })
    expect(r.status).toBe(0)
    expect(r.out).not.toContain('::error')
  })
  it('신호로 죽으면 0 이 아니다(가장 조용한 실패 모드)', () => {
    expect(run("process.kill(process.pid,'SIGKILL')").status).not.toBe(0)
  })
})

describe('③ annotation 은 CI 에서만 · 실패할 때만', () => {
  it('GITHUB_ACTIONS 가 아니면 안 찍는다', () => {
    const seen: string[] = []
    expect(emitAnnotation('error', 'x', {}, { GITHUB_ACTIONS: undefined } as any, (s: string) => seen.push(s))).toBe(false)
    expect(seen).toEqual([])
  })
  it('CI 면 찍는다', () => {
    const seen: string[] = []
    expect(emitAnnotation('error', 'x', {}, { GITHUB_ACTIONS: 'true' } as any, (s: string) => seen.push(s))).toBe(true)
    expect(seen[0]).toContain('::error::x')
  })
  it('실패 출력이 annotation 본문에 실린다(숫자를 읽으려고 만든 것이다)', () => {
    let out = ''
    try {
      execFileSync('node', ['scripts/ci-run.mjs', 'node', '-e', "console.error('어드민: 529.8 → 541.1 KB'); process.exit(1)"],
        { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' } })
    } catch (e: any) { out = String(e.stdout || '') + String(e.stderr || '') }
    expect(out).toContain('::error')
    expect(out).toContain('541.1 KB')
  })
  it('성공하면 기본값에서는 아무것도 안 찍는다(PR 화면을 덮지 않는다)', () => {
    const out = execFileSync('node', ['scripts/ci-run.mjs', 'node', '-e', "console.log('홈 322.7 KB')"],
      { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', CI_RUN_NOTICE: '' } })
    expect(out).toContain('홈 322.7 KB')   // tee 는 그대로
    expect(out).not.toContain('::notice')  // annotation 은 없다
    expect(out).not.toContain('::error')
  })
  it('CI_RUN_NOTICE=1 이면 성공해도 숫자가 notice 로 남는다', () => {
    const out = execFileSync('node', ['scripts/ci-run.mjs', 'node', '-e', "console.log('홈 322.7 → 325.1 KB (3회: 324/325.1/326)')"],
      { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', CI_RUN_NOTICE: '1' } })
    expect(out).toContain('::notice')
    expect(out).toContain('3회: 324/325.1/326')  // 판정에 쓰는 바로 그 값
    expect(out).not.toContain('::error')         // 통과를 빨강으로 오독하게 만들지 않는다
  })
  it('실패는 NOTICE 가 켜져 있어도 error 로 낸다(통과로 위장되지 않는다)', () => {
    let out = ''
    try {
      execFileSync('node', ['scripts/ci-run.mjs', 'node', '-e', "console.error('넘었다'); process.exit(1)"],
        { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', CI_RUN_NOTICE: '1' } })
    } catch (e: any) { out = String(e.stdout || '') + String(e.stderr || '') }
    expect(out).toContain('::error')
    expect(out).not.toContain('::notice')
  })
})

describe('⑤ notice 는 main 전용 — PR 워크플로엔 안 붙인다', () => {
  // 🔑 YAML 은 parity 모듈의 공용 리더로 읽는다(파서를 두 벌 만들지 않는다).
  const steps = (f: string) =>
    runSteps(`.github/workflows/${f}`).filter((st) => st.run.includes('ci-run.mjs'))
  it('main 예산 워크플로의 두 래칫이 CI_RUN_NOTICE=1 을 받는다', () => {
    const on = steps('bundle-budget-main.yml').filter((st) => st.env.CI_RUN_NOTICE === '1')
    expect(on.length).toBeGreaterThanOrEqual(2)
    expect(on.map((st) => st.name)).toContain('First-screen execution cost budget')
  })
  it('🔴 verify.yml(PR)에는 하나도 없다 — 초록 PR 을 notice 로 덮지 않는다', () => {
    const v = steps('verify.yml')
    expect(v.length).toBeGreaterThanOrEqual(3)           // 0건이면 통과가 아니라 측정 실패
    expect(v.filter((st) => st.env.CI_RUN_NOTICE === '1')).toEqual([])
  })
  it('래퍼가 그 env 를 실제로 읽는다(워크플로만 고치고 코드가 안 읽으면 조용히 무효)', () => {
    expect(read('scripts/ci-run.mjs')).toContain("process.env.CI_RUN_NOTICE === '1'")
  })
})

describe('④ 이스케이프 — 순서가 틀리면 메시지가 뭉개진다', () => {
  it('% 를 먼저 바꾼다(안 그러면 %0A 가 다시 먹힌다)', () => {
    expect(escapeData('50%\n줄')).toBe('50%25%0A줄')
  })
  it('CR 도 바꾼다', () => expect(escapeData('a\r\nb')).toBe('a%0D%0Ab'))
  it('속성 값은 : 와 , 까지 막는다(구분자다)', () => {
    expect(escapeProp('a:b,c')).toBe('a%3Ab%2Cc')
  })
  it('허용 속성만 싣는다(모르는 키로 명령을 깨뜨리지 않는다)', () => {
    const l = annotationLine('error', 'm', { title: 't', bogus: 'x' } as any)
    expect(l).toContain('title=t')
    expect(l).not.toContain('bogus')
  })
  it('빈 속성은 아예 안 싣는다', () => expect(annotationLine('warning', 'm', { title: '' })).toBe('::warning::m'))
})

describe('⑤ 꼬리 자르기 — 끝이 결론이라 뒤를 남긴다', () => {
  it('짧으면 그대로', () => expect(tail('abc', 10)).toBe('abc'))
  it('길면 뒤를 남기고 자른 사실을 말한다', () => {
    const t = tail('x'.repeat(50) + 'END', 10)
    expect(t.endsWith('END')).toBe(true)
    expect(t).toContain('생략')
  })
  it('상한이 0 이 아니다(0 이면 annotation 이 비어 다시 눈먼다)', () => {
    expect(TAIL_CHARS).toBeGreaterThan(500)
  })
})

describe('⑥ 신호 변환', () => {
  it('정상 종료는 그 코드', () => expect(exitCodeOf(7, null)).toBe(7))
  it('신호는 128+', () => expect(exitCodeOf(null, 'SIGKILL')).toBe(137))
  it('둘 다 없으면 1(0 으로 떨어지지 않는다)', () => expect(exitCodeOf(null, null)).toBe(1))
})
