/**
 * 🕑 빈 시간대 리포트 (2026-10-19) — 판정 순수 함수 + 서버 배선 + 화면 배선.
 *
 * 이 시험이 못 보는 것: 실제 D1 의 `used_at` 형식(UTC naive 라고 가정한다) · 화면 생김새.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildIdleHoursReport, normalizeCells, blockLabel, dayTypeOf, IDLE_MIN_SAMPLES, type UsageCell,
} from '@/shared/idle-hours'

const read = (p: string) => readFileSync(p, 'utf8')

/** 평일 11~20시 영업, 점심·저녁 붐빔, 14~17시 한가 */
function weekdayShape(): UsageCell[] {
  const out: UsageCell[] = []
  for (let dow = 1; dow <= 5; dow++) {
    for (let h = 11; h < 20; h++) {
      const n = h >= 14 && h < 17 ? 1 : h < 14 ? 6 : 5
      out.push({ dow, hour: h, n })
    }
  }
  return out
}

describe('① 판정', () => {
  it('표본이 20건 미만이면 판정하지 않는다', () => {
    // 영업시간(11~20시)은 충분히 넓게 — 표본 하한만이 판정을 막게 한다.
    const cells: UsageCell[] = Array.from({ length: IDLE_MIN_SAMPLES - 1 }, (_, i) => ({ dow: 1 + (i % 5), hour: 11 + (i % 9), n: 1 }))
    const r = buildIdleHoursReport(cells)
    expect(r.enough).toBe(false)
    expect(r.quietest).toBeNull()
    expect(r.total).toBe(IDLE_MIN_SAMPLES - 1)
  })

  it('평일 오후 2~5시를 가장 한가한 묶음으로 고른다', () => {
    const r = buildIdleHoursReport(weekdayShape())
    expect(r.enough).toBe(true)
    expect(r.openFrom).toBe(11)
    expect(r.openTo).toBe(20)
    // 주말 기록이 0 이면 쉬는 날이다 — "주말이 가장 한가" 라고 말하면 안 된다.
    expect(r.quietest!.dayType).toBe('weekday')
    expect(r.quietest!.from).toBe(14)
    expect(r.quietest!.to).toBe(17)
    expect(r.busiest!.from).toBe(11)
  })

  it('평일/주말을 하루 평균으로 비교한다 (합계로 비교하면 평일이 늘 바쁘다)', () => {
    const cells: UsageCell[] = [...weekdayShape()]
    // 주말 이틀, 같은 시간대에 하루 3건씩 → 하루 평균 3. 평일 14~17시는 하루 평균 3(1×3h).
    for (const dow of [0, 6]) for (let h = 11; h < 20; h++) cells.push({ dow, hour: h, n: h >= 14 && h < 17 ? 2 : 4 })
    const r = buildIdleHoursReport(cells)
    expect(r.quietest).not.toBeNull()
    // 평일 14~17: 합 15 / 5일 = 3.0 · 주말 14~17: 합 12 / 2일 = 6.0 → 평일이 더 한가
    expect(r.quietest!.dayType).toBe('weekday')
    expect(r.quietest!.from).toBe(14)
    expect(r.quietest!.perDay).toBe(3)
  })

  it('가장 바쁜 묶음은 하루 평균이 가장 큰 것', () => {
    const cells: UsageCell[] = [...weekdayShape()]
    for (const dow of [0, 6]) for (let h = 11; h < 20; h++) cells.push({ dow, hour: h, n: 10 })
    const r = buildIdleHoursReport(cells)
    expect(r.busiest!.dayType).toBe('weekend')
    expect(r.busiest!.perDay).toBe(30)
  })

  it('영업시간이 3시간 미만이면 판정하지 않는다', () => {
    const r = buildIdleHoursReport([{ dow: 1, hour: 12, n: 30 }, { dow: 2, hour: 13, n: 30 }])
    expect(r.enough).toBe(false)
  })

  it('normalizeCells — 문자열·범위 밖·0 은 정리한다', () => {
    const c = normalizeCells([
      { dow: '1', hour: '14', n: '3' }, { dow: 7, hour: 1, n: 1 }, { dow: 1, hour: 24, n: 1 },
      { dow: 2, hour: 3, n: 0 }, { dow: -1, hour: 3, n: 4 },
    ])
    expect(c).toEqual([{ dow: 1, hour: 14, n: 3 }])
  })

  it('요일 0·6 은 주말', () => {
    expect(dayTypeOf(0)).toBe('weekend')
    expect(dayTypeOf(6)).toBe('weekend')
    expect(dayTypeOf(3)).toBe('weekday')
  })

  it('라벨 — 정오를 넘으면 오전/오후를 둘 다 적는다', () => {
    expect(blockLabel({ dayType: 'weekday', from: 14, to: 17 })).toBe('평일 오후 2시~5시')
    expect(blockLabel({ dayType: 'weekend', from: 11, to: 14 })).toBe('주말 오전 11시~오후 2시')
  })
})

describe('② 서버 배선', () => {
  const src = read('src/features/seller/api/seller-analytics.routes.ts')
  it('인증 + 셀러 판정 + 내 상품만', () => {
    const i = src.indexOf("'/idle-hours'")
    expect(i).toBeGreaterThan(0)
    const block = src.slice(i, i + 1400)
    expect(block).toMatch(/requireAuth\(\)/)
    expect(block).toMatch(/getSellerId\(c\)/)
    expect(block).toMatch(/p\.seller_id = \?/)
    expect(block).toMatch(/v\.status = 'used'/)
  })
  it('KST 로 변환해서 모은다 (UTC 그대로면 9시간 어긋난다)', () => {
    const i = src.indexOf("'/idle-hours'")
    const block = src.slice(i, i + 1400)
    expect((block.match(/'\+9 hours'/g) || []).length).toBe(2)
  })
  it('판정은 SSOT 함수로 한다', () => {
    expect(src).toMatch(/buildIdleHoursReport\(cells\)/)
  })
})

describe('③ 화면 배선', () => {
  it('판매가 있는 셀러의 매출 요약에만 뜬다', () => {
    const page = read('src/pages/SellerAnalyticsPage.tsx')
    expect(page).toMatch(/tab === 'revenue' && everSold && <IdleHoursCard \/>/)
  })
  it('표본 부족이면 판정 대신 남은 건수를 말한다', () => {
    const card = read('src/pages/seller-analytics/IdleHoursCard.tsx')
    expect(card).toMatch(/!data\.enough/)
    expect(card).toMatch(/seller\.idleHours\.notEnough/)
  })
  it('6개 언어에 문구가 있다', () => {
    for (const l of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(read(`public/locales/${l}/translation.json`))
      expect(j.seller?.idleHours?.quietHeadline, l).toBeTruthy()
      expect(j.seller?.idleHours?.notEnough, l).toBeTruthy()
    }
  })
})
