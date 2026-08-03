/**
 * ⏱️ 마지막 두 고비용 레인 — `collect-hira`(67s) · `maintenance-rescan`(60s) (2026-08-03)
 *
 * 대표 "나머지 두 레인도 해줘. 끝까지". 앞선 PR 에서 다른 세션이 이 파일들을 편집 중이라 미뤘던
 * 것들이고, 그 작업(`6017e3b64`)이 main 에 머지된 뒤 손댔다.
 *
 * ## 여기서도 짝이 다르다 — 이게 이 시리즈의 핵심 교훈이다
 *
 * | 레인 | 잘린 일감이 다음에 잡히는가 | 필요한 짝 |
 * |---|---|---|
 * | `maintenance-rescan` | ❌ 하위작업 3개가 **고정 순서** → 마지막(`naver`)은 하루 1회 레인이라 **영구 미실행** | **선두 회전** |
 * | `collect-hira` | ✅ `page` 커서가 **저장 성공 뒤에만** 전진, 실패 시 `break` | 불필요 |
 *
 * ## 건드리지 않은 것 — 남의 실험
 *
 * `collect-hira` 의 per-fetch `AbortSignal.timeout(25000)` 은 다른 세션의 **재시도 실험 변수**다
 * (`diag.retry` 로 "페이지 크기 문제인가"를 가르는 중). 여기서 바꾸면 그 실험이 오염된다.
 * 이 마감선은 **페이지 수**를 묶을 뿐이라 실험과 직교한다.
 *
 * ## 이 테스트가 **못 막는 것**
 * - 실제 소요 시간. 마감선 값의 타당성은 배포 후 하트비트 `ms` 재측정으로만 안다.
 * - 심평원 API 가 25초씩 걸리는 것 자체 — 그건 위 실험이 밝힐 몫이다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeOrder, nextOrder, rotatedOrder } from '@/features/marketing/api/rescan-rotation'

const read = (rel: string) => {
  const p = path.join(process.cwd(), rel)
  expect(fs.existsSync(p), `${rel} 이 없다 — 경로가 낡으면 통과가 아니라 실패다`).toBe(true)
  return fs.readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}

const HIRA = read('src/features/marketing/api/hira-hospital-collect.ts')
const MAINT = read('src/features/marketing/api/influencer-maintenance.ts')

describe('collect-hira — 마감선만 (회전 불필요)', () => {
  it('새 페이지를 시작하기 전에 시간을 본다', () => {
    // 이미 늦었으면 25초짜리를 하나 더 열지 않는다 — 루프 맨 앞이어야 의미가 있다.
    expect(HIRA).toMatch(/for \(let i = 0; i < Math\.max\(1, maxPages\); i\+\+\) \{\s*\n\s*if \(Date\.now\(\) - startedAt > runDeadlineMs\) \{ stoppedBy = 'deadline'; break \}/)
  })

  it('마감선이 요금제를 따른다', () => {
    expect(HIRA).toMatch(/envPlanValue\(undefined, HIRA_DEADLINE_MS, HIRA_DEADLINE_MS_PAID, env\)/)
  })

  it('남의 실험 변수(per-fetch 25초)를 건드리지 않았다', () => {
    // 이 값은 다른 세션이 원인을 가르는 중인 변수다. 바꾸면 실험이 오염된다.
    expect(HIRA).toMatch(/shoot\(numRows, 25000\)/)
  })

  it('페이지 커서는 저장 성공 뒤에만 전진한다 — 이것이 회전을 대신한다', () => {
    // 실패 시 break 이므로 잘린 페이지는 다음 회차가 같은 자리에서 다시 집는다.
    expect(HIRA).toMatch(/if \(!res \|\| !res\.ok\) \{ lastMsg = res \? `HTTP \$\{res\.status\}` : netMsg; break \}/)
    expect(HIRA).toMatch(/saved \+= await saveProspects\(DB, rows, todayYmd\)[\s\S]{0,40}?\n\s*page\+\+/)
  })

  it('왜 멈췄는지 남긴다', () => {
    expect(HIRA).toMatch(/stopped_by: stoppedBy/)
  })
})

describe('maintenance-rescan — 마감선 + 하위작업 선두 회전', () => {
  it('하위작업을 배열로 돌리며 각 시작 전에 시간을 본다', () => {
    expect(MAINT).toMatch(/const jobs: Array<\{ name: string; run: \(\) => Promise<unknown> \}>/)
    expect(MAINT).toMatch(/if \(Date\.now\(\) - startedAt > runDeadlineMs\) \{ out\.stopped_by = 'deadline'; break \}/)
  })

  it('선두를 회차마다 돌린다', () => {
    // 고정 순서면 마지막 naver 가 (하루 1회 레인이라) 영원히 안 돈다.
    // 회전 정책은 `rescan-rotation.ts` 로 추출됐다(600줄 캡) — 배선이 살아 있는지를 본다.
    expect(MAINT).toMatch(/for \(const idx of rotatedOrder\(from, jobs\.length\)\)/)
    expect(MAINT).toMatch(/RESCAN_ORDER_KEY, String\(nextOrder\(from, ran, jobs\.length\)\)/)
    // 커서를 읽지 않으면 회전이 아니라 매번 같은 자리에서 시작하는 것과 같다.
    expect(MAINT).toMatch(/const from = normalizeOrder\(ordRaw\?\.value, jobs\.length\)/)
  })

  it('셋 다 그대로 실행 대상이다 (작업을 빼지 않았다)', () => {
    for (const n of ['rescan', 'refetch', 'naver']) {
      expect(MAINT).toMatch(new RegExp(`name: '${n}'`))
    }
    expect(MAINT).toMatch(/runCategoryRescan\(env\)/)
    expect(MAINT).toMatch(/runYtLiveRefetch\(env, 4\)/)
    expect(MAINT).toMatch(/enrichNaverActivity\(DB, \{ left: 150 \}, 60\)/)
  })

  it('한 작업의 실패가 나머지를 막지 않는다 (기존 동작 보존)', () => {
    expect(MAINT).toMatch(/try \{ out\[j\.name\] = await j\.run\(\) \} catch \(e\) \{ out\[`\$\{j\.name\}_error`\] = /)
  })

  it('lease 해제는 그대로 finally 에 있다', () => {
    // 마감선으로 중간에 빠져나가도 lease 를 물고 있으면 다음 회차가 통째로 막힌다.
    expect(MAINT).toMatch(/\} finally \{ await releaseLease\(DB, MAINTAIN_LEASE_KEY\) \}/)
  })
})

describe('회전 산술 — 하루 1회 레인에서 셋이 모두 선두를 받는가', () => {
  const N = 3
  // ⚠️ 산술을 여기서 다시 짜면 **테스트가 자기 구현을 검증**할 뿐이다 — 실제 모듈을 돌린다.
  const walk = (perRun: number, runs: number) => {
    const led = new Set<number>()
    let from = 0
    for (let r = 0; r < runs; r++) {
      for (const idx of rotatedOrder(from, N).slice(0, perRun)) led.add(idx)
      from = nextOrder(from, perRun, N)
    }
    return led
  }

  it('깨진 커서(음수·NaN·문자·범위초과)도 유효 범위로 접힌다', () => {
    for (const bad of [null, undefined, '', 'x', '-1', '99']) {
      const v = normalizeOrder(bad, N)
      expect(v, `커서 ${String(bad)} 이 범위를 벗어났다`).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(N)
    }
  })

  it('한 회차에 같은 작업을 두 번 돌리지 않는다', () => {
    for (let from = 0; from < N; from++) {
      expect(new Set(rotatedOrder(from, N)).size).toBe(N)
    }
  })

  it('회차당 1개만 돌아도 3회차면 셋 다 돈다 (최악)', () => {
    expect(walk(1, 3).size).toBe(N)
  })

  it('회차당 2개면 2회차에 셋 다 돈다', () => {
    expect(walk(2, 2).size).toBe(N)
  })

  it('고정 시작이면 마지막은 영원히 안 돈다 — 회전을 빼면 이 상태', () => {
    const led = new Set<number>()
    for (let r = 0; r < 365; r++) for (let i = 0; i < 2; i++) led.add(i)
    expect(led.has(2)).toBe(false)   // naver 가 1년 내내 한 번도 안 돈다
  })
})
