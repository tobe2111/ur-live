import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  judgeInflow, fillDays, INFLOW_AXES, sampleAxis,
  RECENT_DAYS, BASELINE_DAYS, DOWN_RATIO, WARN_RATIO,
} from '@/features/marketing/api/inflow-watchdog'
import type { InflowDay } from '@/features/marketing/api/inflow-watchdog'

/**
 * 🐕 **유입량 감시** — "무너졌는데 아무도 몰랐다"를 끝내는 장치.
 *
 * 오경보는 곧 무시이고, 무시당한 감시는 없는 것과 같다. 그래서 여기서 고정하는 것의 절반은
 * *"울려야 할 때 울리는가"* 가 아니라 **"울리지 말아야 할 때 조용한가"** 다.
 *
 * ## 못 막는 것
 * - 임계(50%/70%)가 옳은지 — 라이브 오경보 빈도를 봐야 안다.
 * - Discord 전송 자체 — 웹훅 미설정이면 no-op 이다.
 */
const days = (ns: number[]): InflowDay[] => ns.map((n, i) => ({ d: `2026-08-${String(i + 1).padStart(2, '0')}`, n }))

describe('judgeInflow — 울려야 할 때', () => {
  it('🩸 라이브 실측(B2B) — 08-17 시점에 이미 경보가 떴어야 한다', () => {
    // 실제 일별: 08-08~08-17. 이 날 아무도 몰랐고, 내가 다음 날 손으로 찾아냈다.
    const live = [8104, 9184, 13368, 13409, 13135, 12756, 12035, 9705, 9638, 4223]
    const v = judgeInflow(days(live))
    // ⚠️ 이 시점의 정직한 판정은 'down' 이 아니라 'warn' 이다 — 최근 3일 중 둘(9,705·9,638)이
    //   아직 정상이라 평균이 62%다. **처음엔 'down' 을 기대했고 그건 내 가정이었다.**
    expect(v.level).toBe('warn')
    expect(v.ratio!).toBeLessThan(WARN_RATIO)
    // 그리고 하루만 더 나빠지면 'down' 으로 올라간다(실제로 08-18 은 ~3,500 페이스였다).
    expect(judgeInflow(days([...live, 3500])).level).toBe('down')
  })

  it('🩸 완만한 하락도 잡는다 — 먼 기준선이 있어야 가능하다(합성 표본)', () => {
    // 매일 5%씩 새는 모양. 직전 7일과만 비교하면 기준선도 같이 내려가 76% 로 보여 안 걸린다.
    const slide = Array.from({ length: 17 }, (_, i) => Math.round(6000 * 0.95 ** i))
    const v = judgeInflow(days(slide))
    expect(v.ratio!).toBeLessThan(WARN_RATIO)
    expect(v.reason).toContain('전 중앙값')   // 먼 기준선이 채택됐다는 표시
  })

  it('🔒 먼 기준선이 없으면(짧은 이력) 가까운 것만으로 판정한다 — 근거 없이 엄해지지 않는다', () => {
    const slide = Array.from({ length: 17 }, (_, i) => Math.round(6000 * 0.95 ** i))
    const short = judgeInflow(days(slide.slice(-10)))
    const long = judgeInflow(days(slide))
    expect(short.ratio!).toBeGreaterThan(long.ratio!)
  })

  it('🩸 완전 정지를 잡는다 — 행이 없어서 조용히 통과하면 안 된다', () => {
    const v = judgeInflow(days([9000, 9000, 9000, 9000, 9000, 9000, 9000, 0, 0, 0]))
    expect(v.level).toBe('down')
    expect(v.recent).toBe(0)
  })
})

describe('judgeInflow — 울리지 말아야 할 때 (오경보 = 감시 실패)', () => {
  it('🔒 17배 진폭에도 스파이크 하나로 하락이 되지 않는다 — 기준선이 중앙값이라서', () => {
    // 실측 스파이크를 그대로 쓴다: 07-21 **12,533** (평시 1,700~1,900대, 07-30 은 1건).
    // ⚠️ 처음엔 스파이크를 5,000 대비 12,533 으로 잡았는데, 그 정도로는 평균/중앙값 차이가
    //   임계를 못 넘어 **평균으로 바꿔도 이 테스트가 통과했다**(주입해 보고 알았다).
    //   가드가 실제로 잡으려면 픽스처가 실제 진폭을 담아야 한다.
    const base = [1700, 12533, 1800, 1900, 1750, 1850, 1900]
    const v = judgeInflow(days([...base, 1800, 1750, 1900]))
    expect(v.level).toBe('ok')
    // 같은 표본을 평균으로 재면 3,348 이 되어 비율 54% — 정상인데 경보가 뜬다.
    const meanBaseline = base.reduce((a, b) => a + b, 0) / base.length
    expect(1817 / meanBaseline).toBeLessThan(WARN_RATIO)
  })

  it('🔒 근거가 얇으면 침묵한다', () => {
    expect(judgeInflow(days([100, 100, 100])).level).toBe('unknown')
    expect(judgeInflow([]).level).toBe('unknown')
  })

  it('🔒 원래 유입이 없던 축은 판정하지 않는다(0으로 나누지 않는다)', () => {
    const v = judgeInflow(days([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    expect(v.level).toBe('unknown')
    expect(v.ratio).toBeNull()
  })

  it('🔒 정상 변동(하루 반토막)은 통과 — 하루로 판정하지 않는다', () => {
    const v = judgeInflow(days([5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 2500, 5000]))
    expect(v.level).toBe('ok')
  })
})

describe('fillDays — 구멍이 곧 사고다', () => {
  it('🩸 없는 날짜는 0 으로 채운다 — 이게 없으면 완전 정지가 "정상"으로 읽힌다', () => {
    const filled = fillDays([{ d: '2026-08-10', n: 900 }], '2026-08-18', 10)
    expect(filled).toHaveLength(10)
    expect(filled.map(r => r.d)).toEqual([
      '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11', '2026-08-12',
      '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17',
    ])
    expect(filled.find(r => r.d === '2026-08-10')!.n).toBe(900)
    expect(filled.filter(r => r.n === 0)).toHaveLength(9)
  })

  it('🔒 오늘(진행 중)은 빠진다 — 넣으면 매일 아침 오경보가 뜬다', () => {
    const filled = fillDays([{ d: '2026-08-18', n: 3 }], '2026-08-18', 5)
    expect(filled.some(r => r.d === '2026-08-18')).toBe(false)
    expect(filled.at(-1)!.d).toBe('2026-08-17')
  })

  it('망가진 날짜에도 죽지 않는다', () => {
    expect(fillDays([], 'not-a-date', 5)).toEqual([])
  })
})

describe('sampleAxis — 모르면 하락이라고 하지 않는다', () => {
  const failDB = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('x') } }), all: async () => { throw new Error('x') } }) } as unknown as D1Database
  it('쿼리가 실패하면 null(침묵)', async () => {
    expect(await sampleAxis(failDB, INFLOW_AXES[0])).toBeNull()
  })
  it('행이 하나도 없으면 오늘을 몰라 침묵한다', async () => {
    const emptyDB = { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database
    expect(await sampleAxis(emptyDB, INFLOW_AXES[0])).toBeNull()
  })
})

describe('🔌 배선 — 감시가 실제로 돌고, B2B 를 본다', () => {
  const src = readFileSync('src/features/marketing/api/inflow-watchdog.ts', 'utf8')
  const runners = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')

  it('🩸 B2B 축이 감시 대상이다 — 기존 경보가 못 보던 바로 그 축이다', () => {
    expect(INFLOW_AXES.map(a => a.table)).toContain('ad_company_leads')
    expect(INFLOW_AXES.map(a => a.table)).toContain('ad_influencer_leads')
  })

  it('매시간 도는 레인에 걸려 있다 — 일 1회 레인이면 놓친 날이 통째로 빈다', () => {
    // ⚠️ 고정 오프셋으로 자르지 않는다 — 이 블록 앞뒤에 코드가 붙을 때마다 창이 밀려
    //   불변식은 멀쩡한데 테스트만 빨간불이 난다(이 세션에서 두 번 겪었다). 다음 레인 키까지로.
    const mStart = runners.indexOf('  maintenance: {')
    const mEnd = runners.indexOf('\n  collect: {', mStart)
    const maint = runners.slice(mStart, mEnd > mStart ? mEnd : mStart + 3000)
    expect(maint).toContain('maybeAlertInflow')
    // rescan 양보(early return)보다 앞이어야 그 시각에도 감시가 돈다
    expect(maint.indexOf('maybeAlertInflow')).toBeLessThan(maint.indexOf('RESCAN_HOUR_UTC'))
  })

  it('오늘 날짜는 SQL 에서 받는다 — 워커 TZ 는 UTC 라 JS 로 만들면 9시간 어긋난다', () => {
    expect(src).toContain("date('now', '+9 hours')")
  })

  it('전면 fail-soft — 감시가 수집을 멈추게 하면 감시가 사고다', () => {
    expect(src).toMatch(/catch \{\s*\n\s*return \{ ran: false \}/)
    expect(runners).toMatch(/catch \{ \/\* 감시가 정비를 멈추게 하지 않는다 \*\/ \}/)
  })

  it('날짜 도장은 전송 성공 여부와 무관하게 찍는다(전송 실패로 매시간 재판정하면 폭주)', () => {
    const i = src.indexOf("bind(STATE_KEY")
    const j = src.indexOf('sendDiscordAlert')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
  })

  it('상수 관계가 성립한다', () => {
    expect(DOWN_RATIO).toBeLessThan(WARN_RATIO)
    expect(RECENT_DAYS).toBeGreaterThan(1)
    expect(BASELINE_DAYS).toBeGreaterThanOrEqual(RECENT_DAYS)
  })
})

describe('🔕 경보 반복 억제 — 무시당한 감시는 없는 것과 같다', () => {
  const src = readFileSync('src/features/marketing/api/inflow-watchdog.ts', 'utf8')
  it('상태가 바뀔 때만 알린다(무너진 동안 매일 보내지 않는다)', () => {
    expect(src).toContain('const escalated = prev !== v.level')
    expect(src).toContain('if (!escalated) continue')
  })
  it('악화(warn → down)는 새 정보라 다시 알린다', () => {
    expect(src).toContain("!(prev === 'down' && v.level === 'warn')")
  })
  it('회복은 한 번 알리고 상태를 지운다', () => {
    expect(src).toMatch(/delete alerts\[axis\.key\][\s\S]{0,120}회복/)
  })
})

describe('🎯 발송 가능 리드 — 대표가 정한 유일한 지표', () => {
  it('🩸 수집일별로 세면 안 된다 — 이메일은 나중에 채워져 최근이 늘 낮아 보인다', async () => {
    const { totalsToDaily } = await import('@/features/marketing/api/inflow-watchdog')
    // 누계 스냅샷의 증분으로 재면 보강 지연과 무관하다.
    const all = { '2026-08-15': { influencer: 100, company: 10 }, '2026-08-16': { influencer: 140, company: 12 }, '2026-08-17': { influencer: 150, company: 12 } }
    expect(totalsToDaily(all, 'influencer')).toEqual([{ d: '2026-08-16', n: 40 }, { d: '2026-08-17', n: 10 }])
  })

  it('🔒 반송 억제로 누계가 줄어도 하락으로 세지 않는다(청소할 때마다 경보가 뜨면 안 된다)', async () => {
    const { totalsToDaily } = await import('@/features/marketing/api/inflow-watchdog')
    const all = { '2026-08-16': { influencer: 200, company: 5 }, '2026-08-17': { influencer: 150, company: 5 } }
    expect(totalsToDaily(all, 'influencer')[0].n).toBe(0)
  })

  it('🔒 어제 값이 없으면 증분을 지어내지 않는다', async () => {
    const { totalsToDaily } = await import('@/features/marketing/api/inflow-watchdog')
    expect(totalsToDaily({ '2026-08-17': { influencer: 9, company: 9 } }, 'influencer')).toEqual([])
  })

  it('오래된 날짜는 버린다 — 이 칸이 무한히 자라면 안 된다', async () => {
    const { pruneTotals, TOTALS_KEEP_DAYS } = await import('@/features/marketing/api/inflow-watchdog')
    const all: Record<string, { influencer: number; company: number }> = {}
    for (let i = 0; i < TOTALS_KEEP_DAYS + 10; i++) all[`2026-07-${String(i + 1).padStart(2, '0')}`] = { influencer: i, company: i }
    expect(Object.keys(pruneTotals(all))).toHaveLength(TOTALS_KEEP_DAYS)
  })

  it('🔒 누계를 못 재면 기록하지 않는다 — 0 으로 적으면 다음 날 증분이 거짓 급등이 된다', async () => {
    const { readSendableTotals } = await import('@/features/marketing/api/inflow-watchdog')
    const failDB = { prepare: () => ({ first: async () => null }) } as unknown as D1Database
    expect(await readSendableTotals(failDB)).toBeNull()
  })

  it('깨진 저장값에도 죽지 않는다', async () => {
    const { parseTotals } = await import('@/features/marketing/api/inflow-watchdog')
    expect(parseTotals('not json')).toEqual({})
    expect(parseTotals('[1,2]')).toEqual({})
    expect(parseTotals(null)).toEqual({})
  })

  it('🔌 배선 — 발송 가능 축이 경보 대상에 들어 있다', () => {
    const src = readFileSync('src/features/marketing/api/inflow-watchdog.ts', 'utf8')
    expect(src).toContain("key: 'sendable_influencer'")
    expect(src).toContain("key: 'sendable_company'")
    expect(src).toContain('judgeSendable(DB, today)')
  })
})

describe('🗄️ 리드 DB 이사 — 감시가 옛 DB를 보면 안 된다', () => {
  it('🩸 감시에 넘기는 핸들이 `adsLeadsDb` 라우터를 거친다', () => {
    // ad_influencer_leads·ad_company_leads 는 ADS_DB 로 이사했다. env.DB 를 그대로 넘기면
    // 바인딩 후 "테이블이 없다"로 조용히 깨지고, **감시가 가장 먼저 눈이 먼다**.
    const runners = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
    expect(runners).toContain('maybeAlertInflow(env, adsLeadsDb(env as never) as never)')
    expect(runners).not.toContain('maybeAlertInflow(env, env.DB)')
  })
  it('감시가 읽는 두 테이블이 실제 이사 목록에 있다(전제 확인)', async () => {
    const { ADS_LEADS_TABLES } = await import('@/shared/ads/leads-db')
    for (const a of INFLOW_AXES) expect(ADS_LEADS_TABLES as readonly string[]).toContain(a.table)
  })
})
