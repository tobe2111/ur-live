/**
 * 🧾 **레인 귀속 + 폭주 레인만 자르기** (2026-09-15, 대표 *"이게 어떻게 무료버전일 때보다 더 아웃풋이
 * 안좋담,, 관리도 안되고"*).
 *
 * ## 이 시험이 지키는 것
 * 그전까지 유어애즈 예산 원장은 **계정 합계 하나**였고 보고에 레인 이름이 없었다. 그래서 넘치면
 * `budgetBlocked` 가 34개 레인을 통째로 세웠고, 넘긴 뒤에도 **누가 넘겼는지 아무도 몰랐다.**
 * 9/2 폭주 때 쓸 수 있는 처방이 "정상 수집까지 1/50 로 조이기" 뿐이었던 이유가 그것이다.
 *
 * ## 못 막는 것 (과신 방지 — 반드시 읽을 것)
 * · **첫 폭주 회차**는 여전히 끝까지 간다. 판정은 회차가 *보고한 뒤*에 난다.
 * · 예산을 **둘 다 끄면**(`ADS_DAILY_*_BUDGET=0`) 원장 자체를 안 부르므로 귀속도 차단도 없다.
 *   아래 `🚨 예산을 끄면 폭주 감지도 함께 꺼진다` 가 그 사실을 **시험으로 못 박아** 둔다 —
 *   "끄면 무제한"이라는 뜻이고, 몰라서 당하는 것과 알고 고르는 것은 다르다.
 * · 미들웨어가 실제 Hono 요청에서 도는지는 vitest 가 못 본다(워커를 못 올린다) → 소스 단언으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  laneLedgerKey, runawayRound, applyRead, laneCut, cutLaneNames, topLaneSpend,
  handleBudgetRequest, budgetBeatFields, READ_BUDGET_STORAGE_KEY,
  RUNAWAY_ROUND_WRITES, RUNAWAY_REL_FLOOR, RUNAWAY_REL_MULTIPLE, LANE_LEDGER_MAX,
  type ReadBudgetState,
} from '@/worker-ads/read-budget'
import { laneEntryBlock, entryLaneKey } from '@/worker-ads/lane-pause'
import { laneKey as domainLaneKey } from '@/worker-ads/lane-domains'

const GATE = readFileSync('src/worker-ads/lane-gate.ts', 'utf8')
const ALARM = readFileSync('src/worker-ads/lane-alarm.ts', 'utf8')
const SELF_BEAT = readFileSync('src/worker-ads/self-beat.ts', 'utf8')
const BUDGET = readFileSync('src/worker-ads/read-budget.ts', 'utf8')

/**
 * 주석을 지운 소스 — 설명에 쓴 단어가 코드 단언에 걸리는 사고가 이 레포에서 세 번 났다.
 *
 * 🩸 **정규식으로 하면 안 된다**(이번에 직접 밟았다): `/\*[\s\S]*?\*\//` 는 코드 안의
 *   `'/__ads/*'` 의 `/*` 를 주석 시작으로 보고 **거기서 다음 `*\/` 까지 진짜 코드를 통째로 먹는다**
 *   — lane-alarm.ts 11,180자가 3,615자로 줄어 배선 단언이 전부 헛돌았다(가짜 빨간불).
 *   ⇒ **줄이 `/*` 로 시작할 때만** 블록으로 본다. 문자열 안의 `/*` 는 줄 시작이 아니다.
 */
function code(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    const t = line.trim()
    if (inBlock) { if (t.endsWith('*/')) inBlock = false; continue }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue }
    if (t.startsWith('//')) continue
    out.push(line)
  }
  return out.join('\n')
}

/**
 * 📏 **라이브 실측 — 2026-09-15 어드민 하트비트 67레인, 회차당 쓴 행.**
 * 임계값의 근거는 이 표다. 여기 있는 값이 하나라도 폭주로 잡히면 정상 수집이 잘린다.
 */
const LIVE_NORMAL_ROUND_WRITES = [28814, 12078, 4937, 3779, 2934, 1504, 1006, 963, 518, 404, 132, 130, 93, 70]

function mkStorage(init?: ReadBudgetState) {
  let v = init
  return {
    async get<T>(): Promise<T | undefined> { return v as unknown as T | undefined },
    async put(_k: string, value: unknown): Promise<void> { v = value as ReadBudgetState },
    peek: () => v,
  }
}
const ENV = { ADS_DAILY_WRITE_BUDGET: '1200000', ADS_DAILY_READ_BUDGET: '1500000' }
const T = (iso: string) => Date.parse(iso)

describe('🧾 레인 이름 정규화 — 세 형태가 한 줄로 모인다', () => {
  it('하트비트·경로·맨이름이 같은 키가 된다', () => {
    for (const raw of ['ads:collect', '/__ads/collect', 'collect']) {
      expect(laneLedgerKey(raw), raw).toBe('collect')
    }
  })

  it('쿼리 변종을 떼어낸다 — 안 그러면 같은 레인이 원장에 여러 줄로 남는다', () => {
    expect(laneLedgerKey('reclassify-company?passes=5')).toBe('reclassify-company')
    expect(laneLedgerKey('ads:collect-localdata?mode=backfill')).toBe('collect-localdata')
    expect(laneLedgerKey('/__ads/collect-localdata?mode=backfill')).toBe('collect-localdata')
  })

  it('기존 두 규약(`lane-domains.laneKey`·경로 규약)과 어긋나지 않는다', () => {
    // 이 레포가 이미 겪은 사고다 — 같은 레인이 `never_fired` 와 `orphan_lanes` 에 동시에 떴다.
    for (const beat of ['collect', 'reclassify-company?passes=5', 'collect-localdata?mode=backfill']) {
      expect(laneLedgerKey(beat), beat).toBe(domainLaneKey(beat))
    }
    for (const path of ['/__ads/collect', '/__ads/enrich-influencer-2']) {
      expect(laneLedgerKey(path), path).toBe(entryLaneKey(path))
    }
  })

  it('쓰레기 입력이 원장을 오염시키지 않는다', () => {
    expect(laneLedgerKey('')).toBe('unknown')
    expect(laneLedgerKey(null)).toBe('unknown')
    expect(laneLedgerKey('  ')).toBe('unknown')
    expect(laneLedgerKey('!!!@@@')).toBe('unknown')
    expect(laneLedgerKey('x'.repeat(200)).length).toBe(40)
  })
})

describe('🚨 폭주 판정 — 정상과 폭주 사이에 선을 긋는다', () => {
  it('실측 정상 회차는 **하나도** 안 걸린다 (가장 중요한 단언)', () => {
    for (const w of LIVE_NORMAL_ROUND_WRITES) {
      // 기준선을 아주 낮게(1) 줘도 — 즉 배수 규칙이 최대한 예민한 상태에서도 — 안 걸려야 한다.
      expect(runawayRound(w, 1), `정상 회차 ${w} 가 폭주로 잘렸다`).toBe('')
    }
  })

  it('9/2 폭주 크기는 잡는다', () => {
    expect(runawayRound(100_000, 1000)).toBe('abs')
    expect(runawayRound(153_000, undefined)).toBe('abs')   // 기준선이 없어도 절대 규칙은 문다
    expect(runawayRound(3_500_000, 5000)).toBe('abs')
  })

  it('그 레인의 **첫 회차**는 절대 폭주가 아니다 — 새 레인이 태어나자마자 잘리면 안 된다', () => {
    expect(runawayRound(60_000, undefined)).toBe('')
    expect(runawayRound(60_000, 0)).toBe('')
    expect(runawayRound(RUNAWAY_ROUND_WRITES - 1, undefined)).toBe('')
  })

  it('배수 규칙은 **하한 위에서만** 문다 — 작은 레인이 조금 커진 것은 폭주가 아니다', () => {
    expect(runawayRound(RUNAWAY_REL_FLOOR - 1, 100), '하한 아래는 배수와 무관하게 정상').toBe('')
    expect(runawayRound(RUNAWAY_REL_FLOOR, 100), '하한 위 + 배수 초과 → 폭주').toBe('rel')
    expect(runawayRound(60_000, 20_000), '60,000 은 20,000 의 8배 미만 → 정상').toBe('')
    expect(runawayRound(60_000, 1_000), '60,000 은 1,000 의 8배 초과 → 폭주').toBe('rel')
  })

  it('하한과 배수가 서로 모순되지 않는다 — 하한이 실측 최대보다 커야 오탐이 구조적으로 0', () => {
    expect(RUNAWAY_REL_FLOOR).toBeGreaterThan(Math.max(...LIVE_NORMAL_ROUND_WRITES))
    expect(RUNAWAY_ROUND_WRITES).toBeGreaterThan(RUNAWAY_REL_FLOOR)
    expect(RUNAWAY_REL_MULTIPLE).toBeGreaterThan(1)
  })

  it('0·음수·NaN 은 폭주가 아니다', () => {
    expect(runawayRound(0, 1)).toBe('')
    expect(runawayRound(-5, 1)).toBe('')
    expect(runawayRound(NaN, 1)).toBe('')
  })
})

describe('🧾 원장 누적 — 레인별로 쌓이고, 날이 바뀌면 기준선만 남는다', () => {
  const now = T('2026-09-15T10:00:00Z')

  it('레인별 r/w/n 이 쌓인다', () => {
    let st = applyRead(null, 100, now, 200, 'collect')
    st = applyRead(st, 50, now, 20, 'collect')
    st = applyRead(st, 7, now, 3, 'collect-neis')
    expect(st.lanes?.collect).toMatchObject({ r: 150, w: 220, n: 2 })
    expect(st.lanes?.['collect-neis']).toMatchObject({ r: 7, w: 3, n: 1 })
    expect(st.used, '합계는 그대로 맞아야 한다').toBe(157)
    expect(st.written).toBe(223)
  })

  it('레인 이름을 안 주면 합계는 **종전과 동일**하고 귀속만 건너뛴다', () => {
    const withLane = applyRead(null, 100, now, 200, 'collect')
    const without = applyRead(null, 100, now, 200)
    expect(without.used).toBe(withLane.used)
    expect(without.written).toBe(withLane.written)
    expect(without.writtenMonth).toBe(withLane.writtenMonth)
    expect(Object.keys(without.lanes || {}), '이름 없는 보고가 유령 줄을 만들면 안 된다').toEqual([])
  })

  it('날이 바뀌면 오늘 계수와 `cut` 은 버리고 `base` 만 남는다', () => {
    let st = applyRead(null, 10, now, 5000, 'collect')
    st = applyRead(st, 10, now, 900_000, 'collect', 'abs')     // 잘림
    expect(cutLaneNames(st, now)).toEqual(['collect'])
    const next = applyRead(st, 1, T('2026-09-16T00:30:00Z'), 1, 'other-lane')
    expect(next.lanes?.collect?.cut, '하루 차단이 영구 차단이 되면 안 된다').toBeUndefined()
    expect(next.lanes?.collect?.w).toBe(0)
    expect(next.lanes?.collect?.base, '기준선까지 버리면 매일 아침 배수 규칙이 눈을 감는다').toBe(5000)
  })

  it('폭주 회차는 기준선을 **안 올린다** — 차단기가 스스로를 무디게 만들면 안 된다', () => {
    let st = applyRead(null, 0, now, 1000, 'x')
    const before = st.lanes?.x?.base
    st = applyRead(st, 0, now, 5_000_000, 'x', 'abs')
    expect(st.lanes?.x?.base, '폭주가 기준선에 섞였다').toBe(before)
  })

  it('정상 회차는 기준선을 천천히 배운다(EMA)', () => {
    let st = applyRead(null, 0, now, 1000, 'x')
    expect(st.lanes?.x?.base).toBe(1000)
    st = applyRead(st, 0, now, 2000, 'x')
    expect(st.lanes?.x?.base, '한 회차로 기준선이 통째로 튀면 안 된다').toBeGreaterThan(1000)
    expect(st.lanes?.x?.base).toBeLessThan(2000)
  })

  it('표가 상한을 넘으면 잘린 레인과 큰 손이 남는다', () => {
    let st: ReadBudgetState | null = null
    st = applyRead(st, 0, now, 999_999, 'runaway-lane', 'abs')
    for (let i = 0; i < LANE_LEDGER_MAX + 20; i++) st = applyRead(st, 0, now, 1, `filler-${i}`)
    st = applyRead(st, 0, now, 90_000, 'big-spender')
    expect(Object.keys(st.lanes || {}).length).toBeLessThanOrEqual(LANE_LEDGER_MAX)
    expect(st.lanes?.['runaway-lane'], '잘린 레인이 밀려나면 그 레인이 오늘 다시 돈다').toBeTruthy()
    expect(st.lanes?.['big-spender'], '큰 손이 밀려나면 귀속이 무의미해진다').toBeTruthy()
  })

  it('상위 지출 레인을 쓴 행 순으로 준다', () => {
    let st = applyRead(null, 0, now, 100, 'a')
    st = applyRead(st, 0, now, 900, 'b')
    st = applyRead(st, 0, now, 500, 'c')
    expect(topLaneSpend(st, 2).map(x => x.lane)).toEqual(['b', 'c'])
  })
})

describe('🚦 원장 핸들러 배선 — 순수 함수가 아니라 **실제 처리 경로**로 본다', () => {
  // 🩸 이 레포의 교훈: 순수 함수만 시험하면 그 함수를 핸들러에서 빼도 전부 초록이다(2026-09-08 실측).
  const now = T('2026-09-15T10:00:00Z')
  const url = (q: string) => new URL(`https://ur-ads/budget${q}`)

  it('폭주 회차를 보고하면 **그 레인만** 잘린다', async () => {
    const st = mkStorage()
    await handleBudgetRequest(url('?rr=10&rw=1000'), st, ENV, now)        // 기준선 학습
    const v = await handleBudgetRequest(url('?rr=10&rw=150000&lane=collect'), st, ENV, now)
    expect(v.cutLanes).toContain('collect')
    expect(laneCut(v, 'collect')).toBe(true)
    expect(laneCut(v, 'ads:collect'), '이름 형태가 달라도 매칭돼야 한다').toBe(true)
    expect(laneCut(v, 'collect-neis'), '남의 레인까지 자르면 종전의 전면 정지와 같다').toBe(false)
    expect(v.over, '폭주 차단은 계정 전면 정지와 별개 축이다').toBe(false)
  })

  it('정상 회차는 안 자른다 — 실측 최대 회차를 그대로 먹여 본다', async () => {
    const st = mkStorage()
    for (const w of LIVE_NORMAL_ROUND_WRITES) {
      const v = await handleBudgetRequest(url(`?rr=10&rw=${w}&lane=collect-neis`), st, ENV, now)
      expect(v.cutLanes, `정상 회차 ${w} 에서 잘렸다`).toEqual([])
    }
  })

  it('판정은 **이번 회차를 섞기 전** 기준선으로 한다', async () => {
    const st = mkStorage()
    // 기준선 1,000 을 만들고 → 60,000(=60배) 을 보내면 배수 규칙에 걸려야 한다.
    for (let i = 0; i < 5; i++) await handleBudgetRequest(url('?rr=1&rw=1000&lane=x'), st, ENV, now)
    const v = await handleBudgetRequest(url('?rr=1&rw=60000&lane=x'), st, ENV, now)
    expect(v.cutLanes, '섞은 뒤에 재면 폭주가 자기 기준선을 올려 스스로를 정상으로 만든다').toContain('x')
  })

  it('잘림은 그날 내내 유지되고, 다음 날 스스로 풀린다', async () => {
    const st = mkStorage()
    await handleBudgetRequest(url('?rr=1&rw=150000&lane=x'), st, ENV, now)
    const same = await handleBudgetRequest(url('?rr=1&rw=10&lane=y'), st, ENV, now)
    expect(same.cutLanes).toContain('x')
    const next = await handleBudgetRequest(url('?rr=1&rw=10&lane=y'), st, ENV, T('2026-09-16T00:10:00Z'))
    expect(next.cutLanes, '자동 해제가 없으면 되돌리는 것을 잊어 영영 묶인다').toEqual([])
  })

  it('기본 응답은 작다 — 전체 표는 물어볼 때만(레인 인보케이션마다 읽히는 값이다)', async () => {
    const st = mkStorage()
    await handleBudgetRequest(url('?rr=1&rw=10&lane=a'), st, ENV, now)
    const small = await handleBudgetRequest(url(''), st, ENV, now)
    expect(small.lanes).toBeUndefined()
    expect(small.top?.[0]?.lane).toBe('a')
    const full = await handleBudgetRequest(url('?full=1'), st, ENV, now)
    expect(full.lanes?.a).toBeTruthy()
  })

  it('이름 없는 보고도 합계는 종전대로 센다 — 옛 호출부가 원장을 안 깨뜨린다', async () => {
    const st = mkStorage()
    const v = await handleBudgetRequest(url('?rr=500&rw=700'), st, ENV, now)
    expect(v.used).toBe(500)
    expect(v.written).toBe(700)
    expect(v.cutLanes).toEqual([])
  })

  it('하트비트가 "누가 썼나 · 누가 잘렸나"를 싣는다', async () => {
    const st = mkStorage()
    await handleBudgetRequest(url('?rr=1&rw=1000&lane=big'), st, ENV, now)
    await handleBudgetRequest(url('?rr=1&rw=150000&lane=bad'), st, ENV, now)
    const f = budgetBeatFields(await handleBudgetRequest(url(''), st, ENV, now))
    expect(String(f.top), '누가 썼는지 안 보이면 처방이 또 전부 조이기로 돌아간다').toContain('bad')
    expect(String(f.cut)).toBe('bad')
    expect(f.cutn).toBe(1)
  })
})

describe('🚧 게이트 배선 — 세 진입로 모두', () => {
  it('폭주 사유를 계정 초과와 **다른 이름**으로 돌려준다', async () => {
    expect(await laneEntryBlock('/__ads/collect', {}, async () => 'runaway')).toBe('runaway')
    expect(await laneEntryBlock('/__ads/collect', {}, async () => 'budget')).toBe('budget')
  })

  it('레인 이름은 호출부가 준 것(`_beat`)이 이기고, 없으면 경로에서 뽑는다', async () => {
    let seen = ''
    const spy = async (_e: unknown, lane: string): Promise<''> => { seen = lane; return '' }
    await laneEntryBlock('/__ads/enrich-company-driver', {}, spy, 'enrich-company')
    expect(seen, '경로와 beat 이름이 다른 레인이 실제로 있다').toBe('enrich-company')
    await laneEntryBlock('/__ads/collect', {}, spy)
    expect(seen).toBe('collect')
  })

  it('면제 경로와 수동 정지는 여전히 원장을 묻지 않는다', async () => {
    const never = async (): Promise<''> => { throw new Error('원장을 물었다 — 서브리퀘스트 낭비') }
    expect(await laneEntryBlock('/__ads/health', { ADS_LANES_PAUSED: 'true' }, never)).toBe('')
    expect(await laneEntryBlock('/__ads/collect', { ADS_LANES_PAUSED: 'true' }, never)).toBe('paused')
  })

  it('🔗 HTTP 초크포인트가 `_beat` 를 넘기고 원장을 **한 번만** 읽는다', () => {
    const g = code(GATE)
    expect(g, 'beat 이름을 안 넘기면 잘린 레인이 게이트에서 매칭되지 않는다').toMatch(/readBeatParams\(c\.req\.url\)\?\.beat/)
    expect(g, '폭주 판정이 초크포인트에서 빠졌다').toMatch(/laneCut\(v, lane\)/)
    expect(g.match(/readBudgetState\(/g)?.length, '원장을 두 번 읽으면 레인마다 서브리퀘스트가 하나 더 붙는다').toBe(1)
  })

  it('🔗 DO 알람 경로에도 있다 — 거긴 미들웨어를 안 지난다', () => {
    const a = code(ALARM)
    // 알람은 `lane.run()` 을 직접 부른다. 여기가 비면 알람 레인은 폭주해도 안 잘린다.
    expect(a).toMatch(/budgetBlocked\(budgetView\) \|\| laneCut\(budgetView, this\.lane\)/)
    expect(a.match(/readBudgetState\(this\.env\)/g)?.length, '원장 조회가 늘면 알람마다 비용이 붙는다').toBe(1)
  })

  it('🔗 두 보고자 모두 레인 이름을 싣는다 — 하나라도 빠지면 그 레인이 합계에만 섞인다', () => {
    expect(code(ALARM)).toMatch(/reportReadUsage\(this\.env, this\.meter\.rr, this\.meter\.rw, this\.lane\)/)
    expect(code(SELF_BEAT)).toMatch(/reportReadUsage\(env, readEnvMeter\(env\)\?\.rr, readEnvMeter\(env\)\?\.rw, beat\)/)
  })

  it('🚨 예산을 끄면 폭주 감지도 함께 꺼진다 — 몰라서 당하지 않도록 못 박아 둔다', () => {
    // `reportReadUsage` 는 두 예산이 모두 0(=끔)이면 원장을 아예 안 부른다. 즉 `=0` 은 **무제한**이고
    // 귀속도 차단도 없다. 이 성질을 바꾸려면 시험부터 바꿔야 한다(모르는 채로 바뀌면 안 된다).
    expect(code(BUDGET)).toMatch(/if \(resolveReadBudget\(env\) <= 0 && resolveWriteBudget\(env\) <= 0\) return/)
  })
})

describe('📦 원장 저장 키는 안 바뀐다 — 바뀌면 라이브 누적이 통째로 0 에서 다시 시작한다', () => {
  it('storage key 고정', () => {
    expect(READ_BUDGET_STORAGE_KEY).toBe('readBudget')
  })
})
