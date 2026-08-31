/**
 * 🩹 **놓친 하루치 만회** — 안전 성질을 시험으로 못박는다 (2026-08-31).
 *
 * 이 기능은 돈을 만지는 배치(정산 성숙·원장 정합·교환권 재발송)를 **더 자주** 돌린다.
 * 그래서 "잘 도는가"보다 **"엉뚱할 때 돌지 않는가"** 가 훨씬 중요하다. 아래 시험은 그쪽에 쏠려 있다.
 *
 * ⚠️ **못 막는 것**: 실제 Cloudflare 가 :55 틱을 울리는지, 서브리퀘스트 예산이 정말 버티는지는
 *    여기서 알 수 없다. 그건 배포 후 하트비트로만 판정된다(인계에 판정 명령 기재).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CATCHUP_MINUTE, CATCHUP_MAX_JOBS,
  parseSlotExpr, periodStartMs, ranThisPeriod, beginCatchup, catchupOpens, claimCatchupJob,
  type CatchupState,
} from '@/worker/cron-catchup'

const at = (iso: string) => Date.parse(iso)
/** 2026-08-31 은 월요일이다(주간 슬롯 시험에 쓴다). */
const MON = '2026-08-31'

function fakeDB(rows: { key: string; value: string }[] | null) {
  return {
    prepare: () => ({
      all: async () => {
        if (rows === null) throw new Error('D1 down')
        return { results: rows }
      },
    }),
  } as unknown as D1Database
}
const hb = (name: string, iso: string) => ({ key: `cron_hb:${name}`, value: JSON.stringify({ at: iso, ok: true }) })

describe('parseSlotExpr — 만회 대상은 하루/한 주에 한 번인 것뿐', () => {
  it('일간 슬롯을 읽는다', () => {
    expect(parseSlotExpr('40 9 * * *')).toEqual({ minute: 40, hour: 9 })
    expect(parseSlotExpr('0 18 * * *')).toEqual({ minute: 0, hour: 18 })
  })

  it('주간 슬롯은 요일까지 읽는다', () => {
    expect(parseSlotExpr('45 0 * * 1')).toEqual({ minute: 45, hour: 0, dow: 1 })
  })

  it('시간당 이하는 만회 대상이 아니다 (이미 기회가 24번 이상)', () => {
    // 이걸 열어 주면 5분 작업이 만회 틱마다 한 번 더 도는 낭비가 된다.
    expect(parseSlotExpr('*/5 * * * *')).toBeNull()
    expect(parseSlotExpr('25 * * * *')).toBeNull()
    expect(parseSlotExpr('5,20,35,50 * * * *')).toBeNull()
  })

  it('월간·깨진 식은 읽지 않는다 (모르는 것은 만회하지 않는다)', () => {
    expect(parseSlotExpr('0 3 1 * *')).toBeNull()
    expect(parseSlotExpr('말도 안 되는 값')).toBeNull()
    expect(parseSlotExpr('')).toBeNull()
    expect(parseSlotExpr(undefined)).toBeNull()
  })
})

describe('periodStartMs — 주기는 그날(UTC) 안으로 닫는다', () => {
  const spec = { minute: 40, hour: 9 }

  it('슬롯 시각 전이면 null (어제 것을 끌어오지 않는다)', () => {
    expect(periodStartMs(at('2026-08-31T09:35:00Z'), spec)).toBeNull()
    // 🔑 자정 직후 = 어제 18시 블록이 통째로 죽었어도 만회하지 않는다. 경계가 있는 편이
    //    "언제 두 번 도는지 모르는" 것보다 낫다(모듈 상단 '못 하는 것' 참조).
    expect(periodStartMs(at('2026-08-31T00:05:00Z'), { minute: 0, hour: 18 })).toBeNull()
  })

  it('슬롯 시각 이후면 오늘 그 시각을 돌려준다', () => {
    expect(periodStartMs(at('2026-08-31T23:55:00Z'), spec)).toBe(at('2026-08-31T09:40:00Z'))
    expect(periodStartMs(at('2026-08-31T09:40:00Z'), spec)).toBe(at('2026-08-31T09:40:00Z'))
  })

  it('주간 슬롯은 그 요일에만 열린다', () => {
    const weekly = { minute: 45, hour: 0, dow: 1 }
    expect(new Date(`${MON}T00:00:00Z`).getUTCDay()).toBe(1) // 전제 확인
    expect(periodStartMs(at(`${MON}T12:00:00Z`), weekly)).toBe(at(`${MON}T00:45:00Z`))
    expect(periodStartMs(at('2026-09-01T12:00:00Z'), weekly)).toBeNull() // 화요일
  })
})

describe('beginCatchup — 만회는 :55 틱에서만, 그리고 확신할 때만', () => {
  it('정시 틱에서는 절대 켜지지 않는다 (정시 경로 무변경 보장)', async () => {
    for (const m of [0, 5, 10, 25, 30, 35, 40, 45, 50]) {
      const t = at(`2026-08-31T09:${String(m).padStart(2, '0')}:00Z`)
      expect(await beginCatchup(t, fakeDB([])), `:${m} 에서 만회가 켜졌다`).toBeNull()
    }
  })

  it(`:${CATCHUP_MINUTE} 틱에서 켜진다`, async () => {
    const s = await beginCatchup(at(`2026-08-31T09:${CATCHUP_MINUTE}:00Z`), fakeDB([hb('x', '2026-08-31T09:40:00Z')]))
    expect(s).not.toBeNull()
    expect(s!.lastRun.get('x')).toBe(at('2026-08-31T09:40:00Z'))
  })

  it('하트비트를 못 읽으면 만회하지 않는다 (fail-closed)', async () => {
    // 빈 맵을 돌려주면 "아무도 안 돌았다"로 읽혀 **이미 끝난 정산을 다시 돌린다.**
    expect(await beginCatchup(at(`2026-08-31T09:${CATCHUP_MINUTE}:00Z`), fakeDB(null))).toBeNull()
    expect(await beginCatchup(at(`2026-08-31T09:${CATCHUP_MINUTE}:00Z`), undefined)).toBeNull()
  })

  it('스케줄 시각을 모르면 만회하지 않는다', async () => {
    expect(await beginCatchup(undefined, fakeDB([]))).toBeNull()
    expect(await beginCatchup(Number.NaN, fakeDB([]))).toBeNull()
  })
})

describe('claimCatchupJob — 이번 주기에 이미 돈 것은 다시 돌리지 않는다', () => {
  const now = at(`2026-08-31T18:${CATCHUP_MINUTE}:00Z`)
  const fresh = (rows: [string, string][]): CatchupState => ({ lastRun: new Map(rows.map(([n, iso]) => [n, at(iso)])), started: 0 })

  it('오늘 슬롯 이후에 돌았으면 건너뛴다', () => {
    const s = fresh([['ledger-integrity-check', '2026-08-31T18:00:05Z']])
    expect(claimCatchupJob(s, 'ledger-integrity-check', '0 18 * * *', now)).toBe(false)
    expect(s.started).toBe(0) // 건너뛴 것은 예산도 안 쓴다
  })

  it('어제 돌고 오늘 안 돌았으면 만회한다', () => {
    const s = fresh([['ledger-integrity-check', '2026-08-30T18:00:05Z']])
    expect(claimCatchupJob(s, 'ledger-integrity-check', '0 18 * * *', now)).toBe(true)
    expect(s.started).toBe(1)
  })

  it('기록이 아예 없으면 만회한다 (그게 만회의 취지)', () => {
    expect(claimCatchupJob(fresh([]), '처음-보는-작업', '0 18 * * *', now)).toBe(true)
  })

  it('한 틱이 새로 시작하는 작업 수를 제한한다 (만회가 예산을 또 말리면 안 된다)', () => {
    const s = fresh([])
    const ran = Array.from({ length: CATCHUP_MAX_JOBS + 3 }, (_, i) => claimCatchupJob(s, `job${i}`, '0 18 * * *', now))
    expect(ran.filter(Boolean).length).toBe(CATCHUP_MAX_JOBS)
    expect(s.started).toBe(CATCHUP_MAX_JOBS)
  })

  it('아직 오늘 주기가 안 왔으면 만회하지 않는다', () => {
    const early = at(`2026-08-31T09:${CATCHUP_MINUTE}:00Z`)
    expect(claimCatchupJob(fresh([]), 'j', '0 18 * * *', early)).toBe(false)
  })

  it('슬롯이 아닌 식은 만회하지 않는다', () => {
    expect(claimCatchupJob(fresh([]), 'j', '*/5 * * * *', now)).toBe(false)
  })
})

describe('catchupOpens / ranThisPeriod', () => {
  it('만회 상태가 없으면(정시 틱) 언제나 닫혀 있다', () => {
    expect(catchupOpens(null, at('2026-08-31T18:55:00Z'), { minute: 0, hour: 18 })).toBe(false)
  })

  it('주기가 시작됐을 때만 연다', () => {
    const s: CatchupState = { lastRun: new Map(), started: 0 }
    expect(catchupOpens(s, at('2026-08-31T18:55:00Z'), { minute: 0, hour: 18 })).toBe(true)
    expect(catchupOpens(s, at('2026-08-31T09:55:00Z'), { minute: 0, hour: 18 })).toBe(false)
  })

  it('ranThisPeriod 는 경계를 포함한다', () => {
    expect(ranThisPeriod(100, 100)).toBe(true)
    expect(ranThisPeriod(99, 100)).toBe(false)
    expect(ranThisPeriod(undefined, 100)).toBe(false)
  })
})

describe('scheduled.ts 배선 — 도구만 있고 안 불리면 없는 것과 같다', () => {
  const SRC = readFileSync('src/worker/scheduled.ts', 'utf8')

  it('소스가 비어 있지 않다 (경로가 옮겨가면 통과가 아니라 실패)', () => {
    expect(SRC.length).toBeGreaterThan(5000)
  })

  it('일간·주간 슬롯 게이트가 slotOpen 을 쓴다', () => {
    // 하나라도 옛 `slotDue` 단독으로 되돌아가면 그 블록만 조용히 만회에서 빠진다.
    const daily = [
      '{ minute: 10, hour: 18 }', '{ minute: 30, hour: 18 }', '{ minute: 40, hour: 18 }',
      '{ minute: 30, hour: 3 }', '{ minute: 35, hour: 3 }', '{ minute: 40, hour: 9 }',
      '{ minute: 45, hour: 0, dow: 1 }',
    ]
    for (const spec of daily) {
      expect(SRC.includes(`slotOpen(${spec})`), `${spec} 가 만회 배선에서 빠졌다`).toBe(true)
    }
  })

  it('전용 트리거 블록(18시·19시)도 만회로 열린다', () => {
    expect(SRC.includes("cron === '0 18 * * *' || catchupOpens(catchup, nowMs, { minute: 0, hour: 18 })")).toBe(true)
    expect(SRC.includes("cron === '0 19 * * *' || catchupOpens(catchup, nowMs, { minute: 0, hour: 19 })")).toBe(true)
  })

  it('전용 트리거 블록의 작업이 slotCron 을 거친다 (안 그러면 이미 돈 것을 또 돌린다)', () => {
    // 만회 틱에 이 블록이 열렸을 때, 자기 슬롯을 아는 래퍼만이 '이미 돌았다'를 판단할 수 있다.
    expect(SRC.includes("run: slotCron('0 18 * * *')")).toBe(true)
    expect((SRC.match(/slotCron\('0 19 \* \* \*'\)\(/g) || []).length).toBeGreaterThanOrEqual(10)
  })

  it(`:${CATCHUP_MINUTE} 분은 만회 전용이다 — 다른 슬롯 게이트가 쓰지 않는다`, () => {
    // 같은 분에 정시 슬롯을 두면 만회와 **같은 인보케이션**이 되어 예산을 나눠 쓴다.
    // 만회를 가장 한산한 틱에 둔 이유가 사라지므로, 여기서 못박는다.
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
    const mins = [...code.matchAll(/minute:\s*(\d+)/g)].map((m) => Number(m[1]))
    expect(mins.length, '슬롯 spec 을 하나도 못 읽었다 — 통과 아님').toBeGreaterThan(5)
    expect(mins.includes(CATCHUP_MINUTE), `:${CATCHUP_MINUTE} 에 정시 슬롯이 생겼다 — 만회 틱과 겹친다`).toBe(false)
  })

  it('만회는 5분 캐리어에서만 만들어진다', () => {
    expect(SRC.includes("cron === '*/5 * * * *'\n    ? await beginCatchup(event.scheduledTime, env.DB)")).toBe(true)
  })
})
