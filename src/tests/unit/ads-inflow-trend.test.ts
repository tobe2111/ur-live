import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  summarizeInflow, completedDays, WINDOW_DAYS, MIN_HALF_DAYS, FLAT_BAND, type InflowDay,
} from '@/shared/ads/inflow-trend'

const TIMELINE = readFileSync(join(process.cwd(), 'src/pages/admin/partner-pool/InflowTimeline.tsx'), 'utf8')
const STATS = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-pool-stats.ts'), 'utf8')
const PAGE = readFileSync(join(process.cwd(), 'src/pages/admin/AdminInfluencerPoolPage.tsx'), 'utf8')

/** 최신 → 과거 순으로 날짜 문자열을 만든다(서버 `ORDER BY d DESC` 와 같은 순서). */
function days(counts: number[], start = 19): InflowDay[] {
  return counts.map((n, i) => ({ d: `2026-08-${String(start - i).padStart(2, '0')}`, n, reachable: Math.round(n / 4) }))
}

/**
 * 📉 **유입 추세 판정** (2026-08-19 대표 *"인플루언서 수집 페이지도 B2B 처럼 14일치를 · 점점 줄어드는지도"*).
 *
 * 이 파일이 지키는 것은 두 함정이다. 둘 다 **화면이 거짓말을 하게 만드는** 종류다:
 *   ① 진행 중인 오늘을 평균에 넣으면 오후마다 "폭락"으로 읽힌다(실측: 13:47 시점 누적은 하루치의 57%)
 *   ② 좁은 창으로 단정 — 일별 유입은 17배까지 요동한다(CLAUDE.md 유어애즈 절)
 */
describe('유입 추세 — 화면이 "줄고 있나"에 답한다', () => {
  it('🕳️ ① 진행 중인 오늘은 추세에서 뺀다 — 안 그러면 멀쩡한 날이 하락으로 보인다', () => {
    // 14일 모두 1,000 인데 오늘만 아직 100(=하루의 10%). 오늘을 넣으면 '감소', 빼면 '보합'.
    const rows = days([100, ...Array(13).fill(1000)])
    const withToday = summarizeInflow(rows) // todayKst 없음 = 오늘도 그대로 센다
    const excluded = summarizeInflow(rows, '2026-08-19')
    expect(withToday.verdict, '오늘을 넣으면 하락으로 읽힌다(이게 함정)').toBe('down')
    expect(excluded.verdict, '오늘을 빼면 실제대로 보합').toBe('flat')
  })

  it('🕳️ ② 표본이 모자라면 단정하지 않는다 — unknown', () => {
    expect(summarizeInflow(days([1000, 900]), '2026-08-19').verdict).toBe('unknown')
    // 한쪽만 채워져도 안 된다(최근 7일은 찼지만 직전 창이 2일뿐)
    const lopsided = summarizeInflow(days(Array(WINDOW_DAYS + MIN_HALF_DAYS - 1).fill(1000)))
    expect(lopsided.verdict).toBe('unknown')
  })

  it('📉 7일 평균 대 7일 평균으로 감소를 잡는다', () => {
    // 최근 7일 3,000 · 직전 7일 6,000 → −50%
    const t = summarizeInflow(days([...Array(7).fill(3000), ...Array(7).fill(6000)]))
    expect(t.verdict).toBe('down')
    expect(t.recentAvg).toBe(3000)
    expect(t.prevAvg).toBe(6000)
    expect(t.deltaRatio).toBeCloseTo(-0.5, 6)
  })

  it('📈 증가도 같은 규칙으로 잡는다', () => {
    expect(summarizeInflow(days([...Array(7).fill(6000), ...Array(7).fill(3000)])).verdict).toBe('up')
  })

  it('〰️ 밴드 안(±10%)은 보합 — 일별 진폭에 비하면 노이즈다', () => {
    // 최근 7,050 vs 직전 7,000 → +0.7%
    expect(summarizeInflow(days([...Array(7).fill(7050), ...Array(7).fill(7000)])).verdict).toBe('flat')
    // 경계 바로 밖(+11%)은 증가로 잡혀야 한다 — 밴드가 통째로 넓어지면 감소를 놓친다
    expect(FLAT_BAND).toBeLessThan(0.11)
    expect(summarizeInflow(days([...Array(7).fill(7770), ...Array(7).fill(7000)])).verdict).toBe('up')
  })

  it('🔤 날짜는 문자열로만 다룬다 — 순서가 뒤집혀 와도 같은 답', () => {
    const rows = days([...Array(7).fill(3000), ...Array(7).fill(6000)])
    expect(summarizeInflow([...rows].reverse()).verdict, '오래된 순으로 와도 정렬해서 본다').toBe('down')
    expect(completedDays(rows, '2026-08-19').some(x => x.d === '2026-08-19')).toBe(false)
  })

  it('🎯 무엇을 보는지 바꿀 수 있다 — 총원 vs 연락 가능(이 DB 의 진짜 지표)', () => {
    // 총원은 유지인데 이메일만 반토막 나는 경우: 총원으로 보면 보합, reachable 로 보면 감소.
    const rows: InflowDay[] = days(Array(14).fill(4000)).map((x, i) => ({ ...x, reachable: i < 7 ? 400 : 1000 }))
    expect(summarizeInflow(rows).verdict).toBe('flat')
    expect(summarizeInflow(rows, null, x => x.reachable).verdict).toBe('down')
  })

  /**
   * 🔌 **배선 불변식** — 순수 함수가 맞아도 화면에 안 걸리면 아무 일도 안 일어난다.
   *   이 레포가 반복해 낸 사고가 정확히 그것("계산해 놓고 안 쓰는 계측" · #930 클래스)이라,
   *   서버가 보내고 · 페이지가 받고 · 컴포넌트가 쓰는 세 지점을 소스로 고정한다.
   *   ⚠️ 이 검사가 못 막는 것: 실제 렌더 결과(값이 맞는지)는 안 본다 — 그건 위 순수 검사들의 몫이다.
   */
  it('🔌 서버가 by_day·today_kst 를 보내고, 인플루언서 페이지가 받아 컴포넌트에 넘긴다', () => {
    // ① 서버: KST 경계로 세고, 연락 가능 = 이메일(링크는 발송 채널이 아니다)
    expect(STATS, '14일 유입 집계가 KST 경계로 잘려야 한다').toMatch(/DATE\(collected_at,'\+9 hours'\) AS d/)
    expect(STATS).toMatch(/AS reachable/)
    expect(STATS, "today_kst 를 서버가 정해야 한다(클라가 구하면 9시간 어긋남)").toMatch(/DATE\('now','\+9 hours'\) AS today_kst/)
    expect(STATS).toMatch(/by_day: byDay/)
    // ② 페이지: 응답을 상태로 넣고 컴포넌트에 넘긴다
    expect(PAGE).toMatch(/by_day/)
    expect(PAGE, 'todayKst 를 안 넘기면 진행중 표시도 추세 배지도 안 뜬다').toMatch(/<InflowTimeline[^>]*todayKst=\{todayKst\}/)
    // ③ 컴포넌트: 추세는 SSOT 를 쓰고, 오늘 막대는 진행 중으로 구분한다
    expect(TIMELINE).toMatch(/summarizeInflow\(byDay, todayKst\)/)
    expect(TIMELINE, "오늘 막대를 구분 안 하면 절반짜리 막대가 '폭락'으로 읽힌다").toMatch(/진행 중/)
  })
})
