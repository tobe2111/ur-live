/**
 * ⏱️ **CPU 상한을 호출부에서 지킨다** — 2026-08-04 (대표 "유료 전환 전에 더 잘게 쪼개기").
 *
 * ## 왜 또 필요한가 — 벽시계로는 못 막는다는 게 실측으로 확정됐다
 *
 * `ads-cpu-work-cap`(07-31)이 교리를 세웠다: *"막아야 하는 건 페이지 크기가 아니라
 * **인보케이션당 총 작업량**"*. 그런데 08-03 에 두 레인에 붙인 처방은 **벽시계 마감선**이었고,
 * 08-04 라이브에서 **둘 다 자기 마감선에 닿기도 전에** CPU 한도로 죽었다:
 *
 * ```
 *   ads:reclassify-company?passes=5   ms=1316   마감선 1,800ms   ← 못 닿고 죽음
 *   ads:sweep-kakao-chain             ms=6640   마감선 12,000ms  ← 못 닿고 죽음
 *   ads:collect-company               ms= 985
 *   ads:collect-hira                  ms=6409
 * ```
 *
 * **CPU 시간은 벽시계를 넘을 수 없다.** 985ms 만에 한도를 넘었다면 그건 대기가 아니라 계산이다.
 * 그리고 대기가 거의 없는 경로(DB-only 정규식 루프 · 대량 행 역직렬화)에서는 **벽시계가 안 흐르는데
 * CPU 만 탄다** — 근사가 가장 나쁘게 어긋나는 자리다. 같은 날 성공한 레인이 19초를 살았다는 것이
 * 반증이다(그건 I/O 라 CPU 를 안 썼다).
 *
 * ⇒ 두 호출부를 **양(量)으로** 묶는다. 시간 상한은 제거가 아니라 병행 — 먼저 닿는 쪽이 멈춘다.
 *
 * ## ⚠️ 이 시험이 못 막는 것 (과신 금지)
 * - **이 처방이 실제로 통했는지.** 판정은 라이브 하트비트(`cron_hb:ads:*` 의 `ok`)로만 난다.
 *   여기서 초록이어도 CPU 가 여전히 터질 수 있다.
 * - **행 하나가 비정상적으로 무거운 경우**(초장문 본문). 행 수로는 안 잡힌다.
 * - 나머지 두 레인(`collect-company` · `collect-hira`)은 **아직 안 건드렸다.**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rowsWorthReading, reclassifyWorkPlan, companyRunDeadlineMs } from '@/features/marketing/api/collect-budget'
import { CPU_WALL_MS } from '@/worker/utils/cron-heartbeat'

const read = (rel: string) => {
  const p = join(process.cwd(), rel)
  const s = readFileSync(p, 'utf8')
  expect(s.length, `${rel} 이 비었다 — 경로가 낡으면 통과가 아니라 실패다`).toBeGreaterThan(0)
  return s
}

describe('rowsWorthReading — 예산이 못 쓸 행은 안 읽는다', () => {
  it('예산보다 훨씬 큰 상한은 예산 쪽으로 잘린다', () => {
    expect(rowsWorthReading(50, 600)).toBe(54)        // 50 + slack 4
    expect(rowsWorthReading(50, 600, 0)).toBe(50)
  })

  it('상한을 절대 넘지 않는다 — 예산이 커도 호출부 천장이 이긴다', () => {
    expect(rowsWorthReading(10_000, 600)).toBe(600)
  })

  it('바닥은 1 — 0/음수 예산에도 한 행은 시도한다(영구 정지 방지)', () => {
    expect(rowsWorthReading(0, 600)).toBe(4)
    expect(rowsWorthReading(-100, 600)).toBe(1)
    expect(rowsWorthReading(-100, 600, 0)).toBe(1)
  })

  it('모르면 줄이지 않는다 — 손상값에 조용히 축소하면 처리량이 말없이 죽는다', () => {
    expect(rowsWorthReading(NaN, 600)).toBe(600)
    expect(rowsWorthReading(Infinity, 600)).toBe(600)
  })
})

describe('reclassifyWorkPlan — 무료는 총량으로 묶는다', () => {
  it('무료 총량이 종전(5,000행)보다 확실히 작다 — 안 줄이면 이 변경의 의미가 없다', async () => {
    const free = await reclassifyWorkPlan(undefined)
    expect(free.maxRows).toBeLessThan(5_000)
    expect(free.rowsPerPass).toBeLessThanOrEqual(free.maxRows)
  })

  it('유료는 종전 그대로 — 요금제를 올린 사람이 손해 보면 안 된다', async () => {
    const paid = await reclassifyWorkPlan({ ADS_PLAN: 'paid' })
    expect(paid.rowsPerPass).toBe(1_000)
    expect(paid.maxRows).toBe(5_000)
  })

  it('시간 상한이 살아 있다 — 행 상한으로 **대체**하면 느린 D1 회차를 못 막는다', async () => {
    expect((await reclassifyWorkPlan(undefined)).deadlineMs).toBeGreaterThan(0)
  })
})

describe('🚧 배선 — 순수함수만 만들고 호출부에 안 걸면 아무 일도 안 일어난다', () => {
  it('카카오 스윕이 예산으로 좁힌 상한으로 SELECT 한다', () => {
    const src = read('src/features/marketing/api/company-collect.ts')
    expect(src).toMatch(/const rowCap = rowsWorthReading\(budget\.left - SWEEP_BOOKKEEPING_RESERVE, cap\)/)
    // ⚠️ 예전 형태(`.bind(cap)`)로 되돌아가면 600행을 다시 읽는다. 같은 줄로 좁혀 본다
    //   — `[^;]*` 로 쓰면 세미콜론 없는 이 코드베이스에서 다음 문장까지 넘어간다(오늘까지 4번 밟은 함정).
    expect(src).toMatch(/\.bind\(rowCap\)[^\n]*\.all</)
  })

  it('예산 계산이 SELECT **앞**에 있다 — 뒤에 있으면 좁힐 값이 없다', () => {
    const src = read('src/features/marketing/api/company-collect.ts')
    const budget = src.indexOf('const budget: FetchBudget = { left: budgetTotal - schemaSpent }')
    // ⚠️ 2026-08-05: SQL 자체가 `kakao-sweep-query.ts` 로 이사했다 — 여기선 **호출부**를 집는다
    //   (이 시험이 지키는 건 SQL 문구가 아니라 "예산이 먼저 계산되는가"라는 순서다).
    const select = src.indexOf('DB.prepare(KAKAO_SWEEP_SQL)')
    expect(budget, '예산 선언을 못 찾았다 — 이름이 바뀌었으면 이 시험을 고쳐라').toBeGreaterThan(0)
    expect(select, '스윕 SELECT 를 못 찾았다').toBeGreaterThan(0)
    expect(budget).toBeLessThan(select)
  })

  // 🗺️ 2026-08-05 읽기 대상 이사 — 재분류 본문이 index.ts 인라인에서 `reclassify-lane.ts` 로
  //   추출됐다(DO 알람 이관: cron·알람 두 경로가 같은 본문을 불러야 해서). 계약은 그대로 —
  //   main(#1076)의 cpu-quantum 배선(`await … env.DB`)도 추출 모듈에서 그대로 지킨다.
  it('재분류 루프가 행 총량으로도 멈춘다 — 시간 조건만 남으면 08-04 상태 그대로다', () => {
    const src = read('src/features/marketing/api/reclassify-lane.ts')
    expect(src).toMatch(/const \{ rowsPerPass, maxRows, deadlineMs \} = await reclassifyWorkPlan\(env, env\.DB\)/)
    expect(src).toMatch(/rows < maxRows/)
    // 고정 1000 이 루프에 다시 박히면 요금제가 닿을 길이 없다
    expect(src).not.toMatch(/reclassifyCompanyLeads\(env\.DB, 1000/)
  })

  it('무엇이 멈췄는지 남긴다 — "행에서 끊겼다"와 "시간에서 끊겼다"가 같아 보이면 조정할 수 없다', () => {
    expect(read('src/features/marketing/api/reclassify-lane.ts')).toMatch(/stopped_by: last\.done \? 'done' : \(rows >= maxRows \? 'rows'/)
  })
})

describe('companyRunDeadlineMs — 27.4초가 "성공"으로 기록되던 자리', () => {
  it('무료 마감선이 실측 사망 기준선보다 확실히 아래다 — 아니면 넣으나 마나다', () => {
    expect(companyRunDeadlineMs(undefined)).toBeLessThan(CPU_WALL_MS)
  })

  it('유료가 무료보다 길다 — 요금제를 올린 사람이 손해 보면 안 된다', () => {
    expect(companyRunDeadlineMs({ ADS_PLAN: 'paid' })).toBeGreaterThan(companyRunDeadlineMs(undefined))
  })

  it('🚧 배선 — 키워드 루프와 이메일 크롤 블록 **둘 다** 마감선을 본다', () => {
    const src = read('src/features/marketing/api/company-collect.ts')
    expect(src).toMatch(/const startedAt = Date\.now\(\), runDeadlineMs = companyRunDeadlineMs\(env\)/)
    // 루프: 기존 예산 조건에 마감선이 **더해져** 있어야 한다(대체가 아니다 — 둘 다 필요하다)
    expect(src).toMatch(/if \(outOfBudget\(budget\) \|\| budget\.limitHit \|\| Date\.now\(\) - startedAt > runDeadlineMs\) break/)
    // 이메일 크롤은 루프 뒤에 따라오는 **가장 비싼 꼬리**(사이트 15건 크롤)라 여기가 빠지면 마감선이 무의미하다
    expect(src).toMatch(/if \(!outOfBudget\(budget\) && Date\.now\(\) - startedAt < runDeadlineMs\) \{/)
  })

  it('무엇 때문에 멈췄는지 남긴다 — 안 남기면 조정할 근거가 없다', () => {
    expect(read('src/features/marketing/api/company-collect.ts')).toMatch(/run_ms: Date\.now\(\) - startedAt, deadline_hit:/)
  })
})
