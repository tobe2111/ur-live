/**
 * 🕑 매장 "빈 시간대" 계산 (2026-10-19 대표 "남은 3가지도 다 해줘" — ① 빈 시간대 리포트).
 *
 * 왜: 사장님은 "언제 손님이 없는지" 를 감으로만 안다. 이용권이 실제로 **사용된 시각**
 * (`vouchers.used_at`)은 우리가 이미 갖고 있으니, 그걸 요일 × 시간으로 모아
 * "평일 오후 2~5시가 가장 한가해요 — 이 시간 전용 이용권을 내보세요" 를 말해 준다.
 *
 * 규칙(서버·화면 공용 순수 함수 — 워커가 그대로 import 한다):
 *   · 입력은 KST 요일(0=일 … 6=토) × 시(0~23) × 사용 수. 집계는 SQL 이 한다.
 *   · 영업시간은 **사용 기록이 한 번이라도 있는 첫 시 ~ 마지막 시**로 본다(가게마다 다르다).
 *   · 평일/주말로 나누고 3시간 묶음으로 본다(한 시간 단위는 표본이 너무 얇다).
 *   · 평일은 5일, 주말은 2일이라 **하루 평균**으로 비교한다(합계로 비교하면 평일이 늘 바쁘다).
 *   · 사용이 20건 미만이면 판정하지 않는다 — 얇은 표본으로 "이 시간이 한가하다" 고 말하면 거짓이 된다.
 *
 * ⚠️ 이 모듈은 **말만 만든다** — 가격·결제·이용권 생성은 하지 않는다(머니 경로 무접촉).
 */

export interface UsageCell { dow: number; hour: number; n: number }

export type DayType = 'weekday' | 'weekend'

export interface HourBlock {
  dayType: DayType
  from: number   // 포함
  to: number     // 미포함 (from+3, 영업 끝을 넘지 않음)
  perDay: number // 하루 평균 사용 수 (소수 1자리)
  share: number  // 영업시간 전체 사용 중 이 묶음 비율 % (정수)
}

export interface IdleHoursReport {
  total: number
  enough: boolean
  openFrom: number | null
  openTo: number | null
  quietest: HourBlock | null
  busiest: HourBlock | null
}

export const IDLE_MIN_SAMPLES = 20
export const IDLE_BLOCK_HOURS = 3

const DAYS_IN: Record<DayType, number> = { weekday: 5, weekend: 2 }

export function dayTypeOf(dow: number): DayType {
  return dow === 0 || dow === 6 ? 'weekend' : 'weekday'
}

function clampInt(v: unknown, lo: number, hi: number): number | null {
  const n = Math.trunc(Number(v))
  if (!Number.isFinite(n) || n < lo || n > hi) return null
  return n
}

/** SQL 행(문자열이 섞여 올 수 있다)을 안전한 셀로 바꾼다. 범위 밖·음수는 버린다. */
export function normalizeCells(rows: Array<Record<string, unknown>>): UsageCell[] {
  const out: UsageCell[] = []
  for (const r of rows || []) {
    const dow = clampInt(r.dow, 0, 6)
    const hour = clampInt(r.hour, 0, 23)
    const n = clampInt(r.n, 0, 1_000_000)
    if (dow == null || hour == null || n == null || n === 0) continue
    out.push({ dow, hour, n })
  }
  return out
}

export function buildIdleHoursReport(cells: UsageCell[]): IdleHoursReport {
  const total = cells.reduce((s, c) => s + c.n, 0)
  const empty: IdleHoursReport = { total, enough: false, openFrom: null, openTo: null, quietest: null, busiest: null }
  if (total < IDLE_MIN_SAMPLES) return empty

  const hours = cells.map(c => c.hour)
  const openFrom = Math.min(...hours)
  const openTo = Math.max(...hours) + 1
  if (openTo - openFrom < IDLE_BLOCK_HOURS) return { ...empty, openFrom, openTo }

  const sumBy = new Map<string, number>()
  for (const c of cells) {
    const k = `${dayTypeOf(c.dow)}:${c.hour}`
    sumBy.set(k, (sumBy.get(k) || 0) + c.n)
  }

  // 그 요일 종류에 사용이 한 번도 없으면 "쉬는 날" 이다 — 평일만 여는 가게에 "주말이 가장 한가" 는 틀린 말.
  const typeTotal: Record<DayType, number> = { weekday: 0, weekend: 0 }
  for (const c of cells) typeTotal[dayTypeOf(c.dow)] += c.n

  const blocks: HourBlock[] = []
  for (const dayType of ['weekday', 'weekend'] as DayType[]) {
    if (typeTotal[dayType] === 0) continue
    for (let from = openFrom; from + IDLE_BLOCK_HOURS <= openTo; from += IDLE_BLOCK_HOURS) {
      let sum = 0
      for (let h = from; h < from + IDLE_BLOCK_HOURS; h++) sum += sumBy.get(`${dayType}:${h}`) || 0
      blocks.push({
        dayType, from, to: from + IDLE_BLOCK_HOURS,
        perDay: Math.round((sum / DAYS_IN[dayType]) * 10) / 10,
        share: Math.round((sum / total) * 100),
      })
    }
  }
  if (!blocks.length) return { ...empty, openFrom, openTo }

  // 한가한 순 — 동률이면 평일 먼저(평일 낮 공석이 사장님에게 더 아프다), 그다음 이른 시각.
  const byQuiet = [...blocks].sort((a, b) =>
    a.perDay - b.perDay || (a.dayType === b.dayType ? 0 : a.dayType === 'weekday' ? -1 : 1) || a.from - b.from)
  const byBusy = [...blocks].sort((a, b) => b.perDay - a.perDay || a.from - b.from)

  return { total, enough: true, openFrom, openTo, quietest: byQuiet[0], busiest: byBusy[0] }
}

/** "평일 오후 2~5시" — 화면·알림이 같은 말을 쓰게 한 곳에서 만든다. */
export function blockLabel(b: Pick<HourBlock, 'dayType' | 'from' | 'to'>): string {
  const day = b.dayType === 'weekday' ? '평일' : '주말'
  const sameHalf = (b.from < 12) === (b.to <= 12)
  return `${day} ${hourLabel(b.from)}~${hourLabel(b.to, sameHalf)}`
}

function hourLabel(h: number, bare = false): string {
  const hh = ((h % 24) + 24) % 24
  const ampm = hh < 12 ? '오전' : '오후'
  const n = hh % 12 === 0 ? 12 : hh % 12
  return bare ? `${n}시` : `${ampm} ${n}시`
}
