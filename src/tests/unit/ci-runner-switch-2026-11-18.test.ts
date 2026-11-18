/**
 * 🖥️ 2026-11-18 (대표 *"일단 그렇게 하자"*) — 실행기를 저장소 변수 하나(`CI_RUNNER`)로 고른다.
 *
 * 배경: 대표가 복사 방지 목적으로 코드 저장소를 **비공개**로 바꾸려 한다. 비공개 저장소는 GitHub 기계가
 * 월 2,000분까지만 무료인데 실측 사용량은 하루 4,211분(2026-11-17)이다 ⇒ 무거운 검사·배포를 대표 PC 의
 * 자체 실행기로 보낸다. 그 전환이 **스위치 하나**로 켜지고 꺼져야 한다(PC 가 준비되기 전·꺼져 있을 때).
 *
 * 지키는 것:
 *   ① 변수가 비어 있으면 종전 그대로 `ubuntu-24.04` — 이 PR 만으로는 아무것도 안 바뀐다.
 *   ② 포크에서 온 PR 은 언제나 GitHub 기계 — 남의 코드를 대표 PC 에서 돌리지 않는다.
 *   ③ 비상구가 있다 — PR 은 제목 `[ci-hosted]`, 배포·전수는 수동 실행 `runner=hosted`.
 *   ④ 정해진 시간에 도는 가벼운 워크플로(생존 확인·SNS 등)는 스위치를 타지 않는다 — PC 가 꺼지면 멎는다.
 *
 * ## ⚠️ 못 보는 것
 * - 변수 값 자체(저장소 설정)와 자체 실행기의 실제 상태 — 레포 밖이다. Actions 이력으로만 판정된다.
 * - 자체 실행기 환경이 `ubuntu-24.04` 와 같은지(브라우저·apt). 설치 안내가 WSL2 Ubuntu 24.04 를 전제한다.
 * - GitHub 식(`&&`/`||`)의 실제 평가 — 여기서는 같은 논리를 손으로 옮겨 진리표만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const WF = '.github/workflows'
const read = (f: string) => readFileSync(join(WF, f), 'utf8')
const live = (f: string) => read(f).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')
const runsOn = (f: string) => [...live(f).matchAll(/^\s*runs-on:\s*(.+)$/gm)].map((m) => m[1].trim())

const PR_EXPR = "${{ (vars.CI_RUNNER == '' || contains(github.event.pull_request.title, '[ci-hosted]') || github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-24.04' || vars.CI_RUNNER }}"
const PUSH_EXPR = "${{ (vars.CI_RUNNER == '' || github.event.inputs.runner == 'hosted') && 'ubuntu-24.04' || vars.CI_RUNNER }}"

/** 스위치를 타는 워크플로 — 무거운 검사와 배포. */
const SWITCHED_PUSH = ['main.yml', 'worker-deploy.yml', 'deploy-ads.yml', 'guard-mutations-full.yml']

describe('실행기 스위치', () => {
  it('PR 검사(verify.yml)의 모든 잡이 같은 식을 쓴다', () => {
    const all = runsOn('verify.yml')
    expect(all.length).toBeGreaterThanOrEqual(7)
    for (const v of all) expect(v).toBe(PR_EXPR)
  })

  it('배포·전수의 모든 잡이 같은 식을 쓴다', () => {
    for (const f of SWITCHED_PUSH) {
      const all = runsOn(f)
      expect(all.length, f).toBeGreaterThan(0)
      for (const v of all) expect(v, f).toBe(PUSH_EXPR)
    }
  })

  it('수동 실행에 비상구 입력(runner)이 있다', () => {
    for (const f of SWITCHED_PUSH) expect(live(f), f).toMatch(/workflow_dispatch:\n {4}inputs:\n(?: {6}.*\n)*? {6}runner:\n/)
  })

  it('진리표 — 변수가 비면 GitHub 기계 · 포크 PR 은 언제나 GitHub 기계 · 비상구가 이긴다', () => {
    // GitHub 식과 같은 논리를 그대로 옮긴 것(식 문자열이 위 상수와 같다는 것은 앞 시험이 본다).
    const pr = (v: string, title: string, fork: boolean) => ((v === '' || title.includes('[ci-hosted]') || fork) ? 'ubuntu-24.04' : v)
    const push = (v: string, input: string) => ((v === '' || input === 'hosted') ? 'ubuntu-24.04' : v)
    expect(pr('', 'fix: x', false)).toBe('ubuntu-24.04')              // ① 변수 없음 = 종전 그대로
    expect(pr('self-hosted', 'fix: x', false)).toBe('self-hosted')
    expect(pr('self-hosted', 'fix: x', true)).toBe('ubuntu-24.04')    // ② 포크
    expect(pr('self-hosted', 'fix: x [ci-hosted]', false)).toBe('ubuntu-24.04') // ③ 비상구
    expect(push('', '')).toBe('ubuntu-24.04')
    expect(push('self-hosted', '')).toBe('self-hosted')
    expect(push('self-hosted', 'hosted')).toBe('ubuntu-24.04')
    // 식 자체에 그 세 갈래가 다 들어 있다
    expect(PR_EXPR).toContain("vars.CI_RUNNER == ''")
    expect(PR_EXPR).toContain('github.event.pull_request.head.repo.full_name != github.repository')
    expect(PR_EXPR).toContain("'[ci-hosted]'")
    expect(PUSH_EXPR).toContain("github.event.inputs.runner == 'hosted'")
  })

  it('정해진 시간에 도는 워크플로는 스위치를 타지 않는다 — PC 가 꺼지면 생존 확인·예약 작업이 멎는다', () => {
    const scheduled = readdirSync(WF).filter((f) => /\.ya?ml$/.test(f) && /^\s*schedule:/m.test(live(f)) && !SWITCHED_PUSH.includes(f))
    expect(scheduled.length).toBeGreaterThan(5)
    const bad = scheduled.filter((f) => runsOn(f).some((v) => v.includes('CI_RUNNER')))
    expect(bad).toEqual([])
  })
})
