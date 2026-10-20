/**
 * 🔔 **완료 감지 폴링 — 집계를 안 도는 문** (2026-08-31).
 *
 * ## 무엇을 지키나
 * 레인 실행 버튼은 완료를 감지하려고 **5초마다 36번** 폴링한다. 예전엔 그게 `/stats` 였는데
 * `/stats` 는 전수 집계 8번(**호출 1회 3,317,537행**, 통제 실험으로 측정)이라
 * **버튼 한 번에 약 1억 1,900만 행**을 읽었다 — 업체 DB 하루 읽기(~1억)가 거기서 나왔다.
 *
 * ## 이 시험이 지키는 두 가지
 * 1. **폴링 루프가 `/run-status` 를 쓴다** — `/stats` 로 되돌아가면 곱셈이 그대로 돌아온다.
 * 2. **응답 모양이 `STAT_PICK` 과 맞는다** — 여기서 필드 이름이 어긋나면 완료 감지가 **조용히**
 *    안 된다(에러 없이 "아직 진행 중" 토스트만 뜬다). 그래서 두 표를 직접 대조한다.
 *
 * ## ⚠️ 못 막는 것
 * 라이브에서 실제로 읽기가 줄었는지는 `meta.rows_read` 로만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { RUN_STATUS_FIELDS } from '@/features/marketing/api/partner-pool-run-status'
import { STAT_PICK } from '@/pages/admin/partner-pool/job-completion'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const PAGE = SRC('src/pages/admin/AdminPartnerPoolPage.tsx')
const ROUTE = SRC('src/features/marketing/api/partner-pool-run-status.ts')

describe('폴링 경로 — 집계를 안 탄다', () => {
  it('🔒 완료 감지 루프가 `/run-status` 를 부른다 (`/stats` 로 돌아가면 버튼 한 번 1.19억 행)', () => {
    const i = PAGE.indexOf('for (let i = 0; i < maxPolls; i++)')
    expect(i, '폴링 루프를 못 찾았다 — 모양이 바뀌었으면 이 시험도 함께 갱신할 것').toBeGreaterThan(0)
    const loop = PAGE.slice(i, i + 900)
    expect(loop).toContain('await fetchRunStatus(')
    expect(loop, '루프 안에서 무거운 집계를 다시 부르면 분리한 의미가 없다').not.toContain('await loadStats()')
  })

  it('경량 조회가 실제로 그 엔드포인트를 가리킨다', () => {
    expect(SRC('src/pages/admin/partner-pool/job-completion.ts'))
      .toMatch(/RUN_STATUS_URL = '\/api\/admin\/partner-pool\/run-status'/)
  })

  it('🔒 서버는 **한 번의 쿼리**로 읽는다 — 키마다 왕복하면 폴링에서 다시 비용이 된다', () => {
    expect(ROUTE).toMatch(/WHERE key IN \(\$\{keys\.map\(\(\) => '\?'\)\.join\(','\)\}\)/)
    expect(ROUTE, '집계 함수가 이 경로에 들어오면 분리가 무너진다').not.toContain('companyStats')
  })
})

describe('🔗 응답 모양이 STAT_PICK 과 맞는다 — 어긋나면 완료 감지가 조용히 죽는다', () => {
  /** `pick('x')` 는 `d.x.run`, 나머지 셀렉터는 `d.field` 를 직접 읽는다. 그 둘을 표와 대조한다. */
  const wrapped = new Set(RUN_STATUS_FIELDS.filter(f => f.wrap).map(f => f.field))
  const flat = new Set(RUN_STATUS_FIELDS.filter(f => !f.wrap).map(f => f.field))

  it.each(Object.keys(STAT_PICK))('버튼 `%s` 의 결과를 이 응답에서 고를 수 있다', (path) => {
    // 셀렉터를 가짜 응답에 실제로 태워 본다 — 이름 대조보다 강하다(모양까지 본다).
    const fake: Record<string, unknown> = {}
    for (const f of RUN_STATUS_FIELDS) fake[f.field] = f.wrap ? { run: { last_run: '2026-08-31 00:00:00' } } : { last_run: '2026-08-31 00:00:00' }
    const got = STAT_PICK[path](fake)
    expect(got, `'${path}' 의 결과를 못 고른다 — RUN_STATUS_FIELDS 에 그 키가 빠졌거나 wrap 이 틀렸다`).toBeTruthy()
  })

  it('표에 최소한 이 필드들이 있다(하나라도 빠지면 그 버튼만 조용히 감지 실패)', () => {
    for (const f of ['collect', 'storeinfo', 'commerce', 'franchise', 'nara', 'nps', 'nts', 'mx']) expect(wrapped).toContain(f)
    for (const f of ['enrichLast', 'enrichBurst', 'runAll']) expect(flat).toContain(f)
  })

  it('🔒 진행 중 표시도 함께 준다 — 없으면 페이지를 떠났다 오면 무엇이 도는지 못 본다', () => {
    expect(ROUTE).toMatch(/out\.running = running/)
  })
})
