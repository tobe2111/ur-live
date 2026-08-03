/**
 * ⏱️ 고비용 유어애즈 레인의 **회차 벽시계 마감선** (2026-08-03 — 대표 "다른 고비용 레인도 같은 방식으로")
 *
 * ## 공통 진단
 *
 * 이 레인들은 전부 **서브리퀘스트 예산**은 있는데 **시간을 재는 것이 없었다.**
 * 예산은 *요청 수*를 세지 응답이 얼마나 오래 걸리는지는 모른다 ⇒ 예산이 남아도 시간은 흐르고,
 * 부모 cron 이 CPU 한도로 죽으면 **매달린 자식이 전부 끌려간다**(`dispatch-budget.ts` 실측).
 *
 * 하트비트 실측(2026-08-03):
 * ```
 *   67s collect-hira · 60s maintenance-rescan · 31s sweep-kakao-phone · 31s scan-notices · 12.5s sweep-mx
 * ```
 * 앞 두 개는 같은 날 다른 세션이 편집 중이라 건드리지 않았다(파일 최종수정일로 판별).
 *
 * ## 🔑 마감선의 짝은 **구조에 따라 다르다** — 이걸 틀리면 기아를 만든다
 *
 * 마감선은 일을 줄이지 않고 **미룬다.** 그래서 "미뤄진 것이 다음에 반드시 잡히는가"를 봐야 한다:
 *
 * | 레인 | 대상 선택 방식 | 필요한 짝 |
 * |---|---|---|
 * | `scan-notices` | 고정 키워드 배열 순회 | **회전 커서** (없으면 뒤쪽 키워드 영구 미조회) |
 * | `sweep-mx` | 블록 ①→② **고정 순서** | **블록 선후 회전** (없으면 ②가 영구 미실행) |
 * | `sweep-kakao-phone` | `kakao_checked_at < now-30d` + **시도한 행만 도장** | **불필요** — 잘린 행은 도장이 없어 다음 라운드에 다시 잡힌다 |
 *
 * ⚠️ 마지막 줄이 중요하다. 여기에 회전을 덧붙이면 **없는 문제를 푸는 코드**가 늘 뿐이다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - 실제 소요 시간. 마감선 값의 타당성은 하트비트 `ms` 재측정으로만 안다.
 * - 외부 API 가 느려지는 것 자체 — 마감선은 그 영향을 **가둘** 뿐 없애지 못한다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => {
  const p = path.join(process.cwd(), rel)
  expect(fs.existsSync(p), `${rel} 이 없다 — 경로가 낡으면 통과가 아니라 실패다`).toBe(true)
  const raw = fs.readFileSync(p, 'utf8')
  // 주석을 걷어낸다 — 사고를 설명한 문장이 판정을 통과시키지 않게.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}

const MX = read('src/features/marketing/api/email-mx-sweep.ts')
const KAKAO = read('src/features/marketing/api/company-collect.ts')

describe('sweep-mx — 마감선 + 블록 선후 회전', () => {
  it('벽시계 마감선이 두 블록 모두에서 끊는다', () => {
    expect(MX).toMatch(/const startedAt = Date\.now\(\)/)
    expect(MX).toMatch(/const outOfTime = \(\) => Date\.now\(\) - startedAt > runDeadlineMs/)
    // 한 블록에만 넣으면 다른 블록이 시간을 무제한 쓴다.
    const hits = MX.match(/if \(outOfTime\(\)\) \{ stoppedBy = 'deadline'; break \}/g) || []
    expect(hits.length, '두 블록 모두에 마감선이 있어야 한다').toBe(2)
  })

  it('마감선이 요금제를 따른다 (유료 전환에 코드 변경 0)', () => {
    expect(MX).toMatch(/envPlanValue\(undefined, RUN_DEADLINE_MS, RUN_DEADLINE_MS_PAID, env\)/)
  })

  it('블록 선후를 회차마다 뒤집는다', () => {
    // 고정 순서면 마감선에 걸릴 때 ②(매장 후보)가 매 회차 굶어 cursorS 가 영원히 안 움직인다.
    expect(MX).toMatch(/const firstIsCompany = /)
    expect(MX).toMatch(/if \(firstIsCompany\) \{ await runCompany\(\); await runProspects\(\) \}/)
    expect(MX).toMatch(/await writeCursor\(BLOCK_ORDER, firstIsCompany \? 1 : 0\)/)
  })

  it('행 커서는 그대로 유지된다 (블록 안 진행은 이어져야 한다)', () => {
    expect(MX).toMatch(/writeCursor\(CURSOR_C, cursorC\)/)
    expect(MX).toMatch(/writeCursor\(CURSOR_S, cursorS\)/)
  })

  it('왜 멈췄는지 + 누가 선두였는지 남긴다', () => {
    expect(MX).toMatch(/stopped_by: stoppedBy/)
    expect(MX).toMatch(/first_block: firstIsCompany \? 'company' : 'prospects'/)
  })
})

describe('sweep-kakao-phone — 마감선만 (회전 불필요)', () => {
  it('벽시계 마감선이 조회 루프를 끊는다', () => {
    expect(KAKAO).toMatch(/const startedAt = Date\.now\(\)/)
    expect(KAKAO).toMatch(/if \(Date\.now\(\) - startedAt > runDeadlineMs\) \{ stoppedBy = 'deadline'; break \}/)
  })

  it('마감선이 요금제를 따른다', () => {
    expect(KAKAO).toMatch(/envPlanValue\(undefined, SWEEP_RUN_DEADLINE_MS, SWEEP_RUN_DEADLINE_MS_PAID, env\)/)
  })

  it('도장은 시도한 행에만 찍힌다 — 이것이 회전을 대신한다', () => {
    // 잘린 행은 kakao_checked_at 이 안 찍혀 다음 라운드에 다시 선택된다.
    // 이 성질이 깨지면(모든 행에 도장) 마감선이 곧 영구 누락이 된다 — 2026-07-28 에 이미 한 번 났다.
    expect(KAKAO).toMatch(/tried\.push\(r\.id\)/)
    expect(KAKAO).toMatch(/UPDATE ad_company_leads SET kakao_checked_at = datetime\('now'\) WHERE id IN \(\$\{tried\.join\(','\)\}\)/)
  })

  it('마감선이 예산 가드보다 뒤에 온다 (부기 몫 보존)', () => {
    // 예산 가드가 먼저여야 배치 쓰기용 예약분(SWEEP_BOOKKEEPING_RESERVE)이 유지된다.
    const budgetIdx = KAKAO.indexOf('budget.left <= SWEEP_BOOKKEEPING_RESERVE')
    const deadlineIdx = KAKAO.indexOf("Date.now() - startedAt > runDeadlineMs")
    expect(budgetIdx).toBeGreaterThan(-1)
    expect(deadlineIdx).toBeGreaterThan(budgetIdx)
  })

  it('왜 멈췄는지 남긴다', () => {
    expect(KAKAO).toMatch(/stopped_by: stoppedBy/)
  })
})
