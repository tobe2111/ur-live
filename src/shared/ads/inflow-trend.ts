/**
 * 📉 **유입 추세 판정** — "점점 줄어들고 있나?"를 화면이 스스로 답하게 한다
 *   (2026-08-19 대표 *"점점 양이 줄어드는지도 봐줘"* — 인플루언서·B2B 수집 페이지 공용).
 *
 * ## 왜 순수 모듈로 빼는가
 * 이 판정은 **두 곳에서 같은 규칙으로** 나와야 한다(인플루언서 풀 · 파트너 풀). 그리고 아래 두 함정은
 * 컴포넌트 안에 인라인으로 쓰면 반드시 다시 밟는다 — 이 레포가 이미 여러 번 밟았다.
 *
 * ## 🕳️ 함정 ① 진행 중인 오늘을 추세에 넣으면 **항상 하락으로 보인다**
 * 오늘 막대는 지금까지 쌓인 만큼만 있다. 오후에 보면 늘 전날보다 낮고, 그걸 평균에 넣으면
 * **멀쩡한 날도 하락 판정**이 난다. ⇒ `todayKst` 와 같은 날짜의 행은 추세 계산에서 **제외**한다.
 *
 * ## 🕳️ 함정 ② 좁은 창으로 단정하기
 * CLAUDE.md 유어애즈 절의 실측: 일별 유입은 **17배까지 요동**한다(하루는 1건이었다). 하루·이틀 비교는
 * 노이즈다. ⇒ **7일 평균 대 7일 평균**으로 보고, 양쪽에 최소 `MIN_HALF_DAYS` 일이 없으면 `unknown`
 * 을 돌려준다(모르면 모른다고 말한다 — 이 레포가 반복해 낸 오진이 "좁은 창으로 단정"이다).
 *
 * ## ⚠️ 날짜는 **문자열로만** 다룬다
 * `d` 는 서버가 `DATE(collected_at,'+9 hours')` 로 만든 **KST 날짜 문자열**이다. 여기서 `new Date()`
 * 로 파싱하면 브라우저 TZ 에 따라 9시간이 어긋난다(`check-utc-date-parse` 가 지키는 그 클래스).
 * 이 파일은 **문자열 비교만** 한다 — 그래서 TZ 무관하게 항상 같은 답을 낸다.
 */

/** 하루치 유입. `d` = KST 날짜 문자열(`YYYY-MM-DD`), `n` = 전체, `reachable` = 연락 가능(제안 보낼 수 있는 수). */
export interface InflowDay { d: string; n: number; reachable: number }

/** 한쪽 절반에 최소 이만큼은 있어야 비교한다. 3일 미만은 요동과 구분이 안 된다. */
export const MIN_HALF_DAYS = 3
/** 비교 창(일). 7 = 요일 주기를 한 바퀴 덮는 최소 단위. */
export const WINDOW_DAYS = 7
/** 이 폭 안이면 '보합' — ±10% 는 일별 진폭에 비하면 노이즈다. */
export const FLAT_BAND = 0.1

export type InflowVerdict = 'up' | 'flat' | 'down' | 'unknown'

export interface InflowTrend {
  verdict: InflowVerdict
  /** 최근 창 일평균(완료된 날만). */
  recentAvg: number
  /** 직전 창 일평균. */
  prevAvg: number
  /** (recent - prev) / prev. prev 가 0 이면 0. */
  deltaRatio: number
  recentDays: number
  prevDays: number
}

/**
 * 완료된 날짜만 남긴다 — **오늘(진행 중)은 뺀다.**
 * @param byDay 최신 → 과거 순(서버가 `ORDER BY d DESC` 로 준다). 순서가 뒤집혀 와도 여기서 정렬한다.
 * @param todayKst 서버가 준 KST 오늘 날짜. 없으면 아무것도 안 뺀다(모르면 건드리지 않는다).
 */
export function completedDays(byDay: readonly InflowDay[], todayKst?: string | null): InflowDay[] {
  return [...byDay]
    .filter(x => !!x?.d && (!todayKst || x.d !== todayKst))
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)) // 최신 우선
}

/** 평균(빈 배열이면 0). */
function avg(xs: readonly number[]): number {
  if (!xs.length) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/**
 * 최근 7일 평균 vs 직전 7일 평균으로 추세를 판정한다.
 *
 * ⚠️ **`n`(전체)이 아니라 무엇을 볼 것인가**: 기본은 전체 유입이다. 연락 가능 수로 보고 싶으면
 *   `pick` 으로 바꾼다 — CLAUDE.md 가 못 박은 대로 이 DB 의 성공 지표는 총원이 아니라 *제안 보낼 수
 *   있는 리드 수*라, 두 값이 갈릴 때 어느 쪽을 물었는지가 중요하다.
 */
export function summarizeInflow(
  byDay: readonly InflowDay[],
  todayKst?: string | null,
  pick: (x: InflowDay) => number = x => Number(x?.n) || 0,
): InflowTrend {
  const days = completedDays(byDay, todayKst)
  const recent = days.slice(0, WINDOW_DAYS).map(pick)
  const prev = days.slice(WINDOW_DAYS, WINDOW_DAYS * 2).map(pick)
  const recentAvg = avg(recent)
  const prevAvg = avg(prev)
  if (recent.length < MIN_HALF_DAYS || prev.length < MIN_HALF_DAYS) {
    return { verdict: 'unknown', recentAvg, prevAvg, deltaRatio: 0, recentDays: recent.length, prevDays: prev.length }
  }
  const deltaRatio = prevAvg > 0 ? (recentAvg - prevAvg) / prevAvg : 0
  const verdict: InflowVerdict = Math.abs(deltaRatio) <= FLAT_BAND ? 'flat' : deltaRatio > 0 ? 'up' : 'down'
  return { verdict, recentAvg, prevAvg, deltaRatio, recentDays: recent.length, prevDays: prev.length }
}
