import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  pickStalest, effectiveAgeMs, runAtMs, LOW_YIELD_STALENESS_DISCOUNT,
  type StalenessRow,
} from '@/features/marketing/api/influencer-keyword-staleness'

/**
 * ⏳ **순환 편식 수리** (2026-08-24 대표 *"순환 편식은 수리해"*).
 *
 * ## 라이브 증거 (이 파일이 지키려는 것)
 * ```
 *   활성 658 · 회차당 7.8 · 시간당 1회차  ⇒  한 바퀴 3.5일이어야 한다
 *   실제 평균 5.6일 · 최악 28.1일 · 7일+ 밀린 것 168개(26%)
 *   집중 축은 25개인데 최악 13.6일 — 하루 24회차면 못 도는 게 불가능한 크기다
 * ```
 * 원인은 예산이 아니라 **선택**이었다: 위치 커서(`pool[(cursor+i) % pool.length]`)를 **길이가 변하는 풀**에
 * 썼다(저수율 억제가 5회차 중 4회차 솎아내고, 승격/은퇴가 멤버십을 바꾼다).
 *
 * ⚠️ **이 테스트가 못 하는 것**: 옛 커서가 라이브에서 *얼마나* 편식했는지는 재현하지 않는다 — 그 값은
 *   실제 억제·승격·예산 패턴의 산물이라 토이 시뮬레이션으로 흉내 내면 숫자만 그럴듯한 거짓이 된다.
 *   여기서 고정하는 건 **새 선택이 상한을 갖는가**(아래 시뮬레이션)와 순서 규칙 자체다.
 *   라이브 판정 기준은 절대값으로: `worst_days 28.1 → 한 바퀴(≈3.5일)의 2배 이내` · `avg 5.6 → ≈3.5일`.
 */

const HOUR = 3600_000
const T0 = Date.UTC(2026, 7, 24, 0, 0, 0)
/** D1 `datetime('now')` 형식(`Z` 없는 UTC). */
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const row = (id: number, ranMs: number | null, low = false): StalenessRow => ({
  id, last_run_at: ranMs == null ? null : stamp(ranMs),
  ...(low ? { nb_measured: 200, nb_contacts: 10 } : { nb_measured: 200, nb_contacts: 100 }),
})

describe('시각 파싱 — D1 의 UTC-naive 를 로컬로 읽지 않는다', () => {
  /**
   * ⚠️ **TZ 를 KST 로 바꾸지 않으면 이 검사는 절대 실패할 수 없다.** CI 컨테이너 TZ 는 UTC 라
   *   `Date.parse('… 03:00:00')`(로컬 해석)과 UTC 해석이 **같은 값**이 되기 때문이다 —
   *   이 레포가 이름 붙인 "헛도는 가드" 그대로다(실제로 첫 판이 그랬고, 되돌려-검증에서 잡혔다).
   */
  const TZ = process.env.TZ
  beforeAll(() => { process.env.TZ = 'Asia/Seoul' })
  afterAll(() => { process.env.TZ = TZ })

  it('`Z` 없는 문자열도 UTC 로 해석한다 (이 레포의 9시간 어긋남 클래스)', () => {
    // 이 줄이 먼저 깨지면 TZ 주입이 안 먹은 것 — 위 경고대로 검사가 무의미해진다.
    expect(Date.parse('2026-08-24 03:00:00'), 'TZ 주입 실패').not.toBe(Date.UTC(2026, 7, 24, 3))
    expect(runAtMs('2026-08-24 03:00:00')).toBe(Date.UTC(2026, 7, 24, 3))
    expect(runAtMs('2026-08-24T03:00:00Z')).toBe(Date.UTC(2026, 7, 24, 3))
  })
  it('부재/쓰레기는 null — 미실행으로 취급된다(예외 아님)', () => {
    expect(runAtMs(null)).toBeNull()
    expect(runAtMs('')).toBeNull()
    expect(runAtMs('어제')).toBeNull()
  })
})

describe('선택 순서 — 가장 오래 굶은 것부터', () => {
  it('미실행(last_run_at NULL)이 무조건 1순위 — 나이 ∞', () => {
    expect(effectiveAgeMs(row(1, null), T0)).toBe(Number.POSITIVE_INFINITY)
    const picked = pickStalest([row(1, T0 - 100 * HOUR), row(2, null)], 1, T0)
    expect(picked.map(k => k.id)).toEqual([2])
  })

  it('오래된 것 → 최근 것 순', () => {
    const pool = [row(1, T0 - 1 * HOUR), row(2, T0 - 50 * HOUR), row(3, T0 - 10 * HOUR)]
    expect(pickStalest(pool, 3, T0).map(k => k.id)).toEqual([2, 3, 1])
  })

  /** ⚠️ `∞ − ∞ = NaN` 이라 뺄셈 비교자를 쓰면 미실행끼리 순서가 엔진 마음대로가 된다. */
  it('미실행이 여럿이면 id 순 — 결정적이어야 한다', () => {
    const pool = [row(9, null), row(3, null), row(7, null)]
    expect(pickStalest(pool, 3, T0).map(k => k.id)).toEqual([3, 7, 9])
    expect(pickStalest(pool, 2, T0).map(k => k.id)).toEqual([3, 7])
  })

  it('시계 역행(마지막 실행이 미래)이 순서를 뒤집지 못한다', () => {
    const pool = [row(1, T0 + 100 * HOUR), row(2, T0 - 1 * HOUR)]
    expect(pickStalest(pool, 1, T0).map(k => k.id)).toEqual([2])
  })

  it('요청이 풀보다 크면 풀 전체 — 슬롯을 버리지 않는다', () => {
    const pool = [row(1, T0 - HOUR), row(2, T0 - 2 * HOUR)]
    expect(pickStalest(pool, 9, T0)).toHaveLength(2)
    expect(pickStalest(pool, 0, T0)).toEqual([])
    expect(pickStalest([], 3, T0)).toEqual([])
  })
})

describe('저수율 할인 — 억제가 죽은 손잡이가 되지 않게', () => {
  it('할인은 0 과 1 사이 — 1 이면 억제 무력화, 0 이면 영구 배제', () => {
    expect(LOW_YIELD_STALENESS_DISCOUNT).toBeGreaterThan(0)
    expect(LOW_YIELD_STALENESS_DISCOUNT).toBeLessThan(1)
  })

  it('저수율은 더 늙어야 순번이 온다 — 1/할인 배 미만이면 진다', () => {
    const need = 1 / LOW_YIELD_STALENESS_DISCOUNT
    const normal = row(1, T0 - 100 * HOUR)
    const notYet = row(2, T0 - Math.round(100 * (need - 0.2)) * HOUR, true)
    const enough = row(3, T0 - Math.round(100 * (need + 0.5)) * HOUR, true)
    expect(pickStalest([normal, notYet], 1, T0).map(k => k.id)).toEqual([1])
    expect(pickStalest([normal, enough], 1, T0).map(k => k.id)).toEqual([3])
  })
})

/**
 * 🔁 **상한이 생기는가** — 이 시뮬레이션이 이 파일의 핵심이다.
 *
 * 풀을 라이브처럼 **흔든다**: ① 저수율은 5회차 중 4회차 보이지 않는다(억제) ② 회차마다 예산이 달라
 * 뽑아 놓고 못 도는 픽이 생긴다 ③ 새 키워드가 뒤에 붙는다(승격). 위치 커서가 무너지는 조건 그대로다.
 *
 * 나이순 선택의 성질: 건너뛰어진 키워드는 `last_run_at` 이 안 갱신되므로 **더 굶어서 스스로 앞으로 온다.**
 * ⇒ 최악 나이가 한 바퀴의 상수배 안에 갇힌다. 그게 여기서 재는 값이다.
 */
describe('공평성 — 풀이 흔들려도 최악 대기가 한 바퀴의 상수배 안', () => {
  it('굶는 키워드가 없다 · 최악 대기 ≤ 한 바퀴의 2배 · 저수율은 실제로 뒤로 밀린다', () => {
    const LOW = new Set([3, 8, 14, 21, 29, 33])
    const pool: StalenessRow[] = []
    for (let id = 1; id <= 40; id++) pool.push(row(id, null, LOW.has(id)))

    const ROUNDS = 1200 // ≫ 한 바퀴(≈30회차) — 초기 미실행 물결이 완전히 소진된 뒤의 정상 상태를 본다
    let now = T0
    let processedTotal = 0
    let nextId = 41
    for (let r = 0; r < ROUNDS; r++) {
      now += HOUR
      // ① 억제: 저수율은 탐침 회차(5의 배수)에만 보인다
      const visible = r % 5 === 0 ? pool : pool.filter(k => !LOW.has(k.id))
      // ② 계획은 2픽, 실제 처리는 예산에 따라 1~2 (뽑고도 못 도는 픽이 생긴다)
      const picks = pickStalest(visible, 2, now)
      const done = r % 3 === 0 ? 2 : 1
      for (const p of picks.slice(0, done)) { p.last_run_at = stamp(now); processedTotal++ }
      // ③ 승격: 새 키워드가 뒤에 붙는다(위치 커서를 무너뜨리던 조건)
      if (r > 0 && r % 300 === 0) { pool.push(row(nextId++, null)); }
    }

    const ages = pool.map(k => ({ id: k.id, low: LOW.has(k.id), h: (now - (runAtMs(k.last_run_at) ?? T0 - 1e9)) / HOUR }))
    expect(ages.every(a => Number.isFinite(a.h)), '한 번도 안 돈 키워드가 남았다').toBe(true)

    // 한 바퀴(회차 단위) = 유효 키워드 수 ÷ 회차당 처리량. 할인 때문에 저수율은 1/할인 배로 센다.
    const perRound = processedTotal / ROUNDS
    const effective = pool.length - LOW.size + LOW.size / (1 / LOW_YIELD_STALENESS_DISCOUNT)
    const cycle = effective / perRound
    const worstNormal = Math.max(...ages.filter(a => !a.low).map(a => a.h))
    expect(worstNormal, `최악 대기 ${worstNormal.toFixed(1)}회차 > 한 바퀴(${cycle.toFixed(1)})의 2배`)
      .toBeLessThanOrEqual(cycle * 2)

    // 할인이 실제로 순번을 늦춘다 — 이 비교가 없으면 할인을 지워도 초록이다.
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1)
    const avgLow = avg(ages.filter(a => a.low).map(a => a.h))
    const avgNormal = avg(ages.filter(a => !a.low).map(a => a.h))
    expect(avgLow, '저수율이 일반과 같은 속도로 돈다 — 억제가 무력화됐다').toBeGreaterThan(avgNormal * 1.2)
  })
})
