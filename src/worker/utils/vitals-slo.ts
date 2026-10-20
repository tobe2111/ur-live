/**
 * 📈 실사용 성능 SLO 판정 (순수) — 2026-10-14 대표 *"대기업 수준의 인프라 … 앞으로 기능이 늘어나도
 *    최적화된 상태여야"*.
 *
 * ## 왜 있나
 * 실사용 수치(web-vitals → `/api/analytics/vitals` → KV)는 **쌓이기만 했다.** 누가 `summary` 를
 * 열어 봐야 나빠진 걸 알았고, 실제로 교환권 CLS p75 0.14(기준 0.1 초과)는 **사람이 우연히 재서**
 * 찾았다. 빌드 단계 예산(`check-surface-budgets`)은 바이트만 본다 — 같은 바이트라도 무거운 실행,
 * 늦은 API, 밀리는 레이아웃은 **사용자 기기에서만** 보인다. 그 숫자를 매일 기계가 대조한다.
 *
 * ## 🪟 창은 하루가 아니라 7일이다 (2026-10-15 — 라이브 실측으로 뒤집은 것)
 *
 * 처음엔 **어제 하루**를 판정했다. 그런데 그렇게 돌린 첫 회차가 이것을 남겼다:
 *
 *     vitals-slo · 2026-10-15 09:21 KST · ok=true
 *     "2026-10-14: 판정 0건(표본 부족 30)"
 *
 * 즉 **표본 20을 넘긴 화면이 하나도 없어서 판정을 한 번도 못 했다** — 가장 트래픽이 많은 홈조차
 * LCP 14 · CLS 13 · TTFB 18 이었다. 감시가 *"이상 없음"* 과 **구분이 안 되는 상태**로 돌고 있었고,
 * 그 침묵이 실제 위반을 가리고 있었다(7일 누적 실측: 홈 LCP p75 **3,532ms** > 기준 2,500, 7일 내내).
 *
 * ⇒ 하루 대신 **`WINDOW_DAYS` 일 누적 표본**을 모아 판정한다. 7일 누적이면 판정 가능 조합이
 *    **0 → 6개**가 된다(실측). 기준선도 그 **직전 같은 길이의 창**을 모아 p75 로 잡는다 —
 *    종전의 *"일별 p75 의 중앙값"* 보다 표본이 다섯 배 많은 더 단단한 통계다.
 *
 * 🔑 **창은 양방향으로 옳다**: 홈 CLS 는 하루 최악이 0.199(기준 0.1 초과)였는데 7일 누적은
 *    **0.063** 으로 통과한다 — 하루치로 보면 거짓 경보가 날 자리였다.
 *
 * ⚠️ **대가: 창은 느리다.** 어제 생긴 회귀는 며칠 뒤에 보인다. 트래픽이 늘면 창을 **줄이는 것이
 *    개선**이다(1일로 되돌리는 쪽이 민감하다). 창 길이를 늘리는 방향으로 손대지 말 것 —
 *    그건 둔감해지는 쪽이고, 둔감한 감시는 침묵과 같다.
 *
 * ## 판정 (화면별, p75)
 *   - 위반: p75 가 SLO(구글 'Good' 경계)를 넘음
 *   - 회귀: p75 가 **직전 창**의 p75 보다 25% 이상 **그리고** 절대값으로 의미 있게(아래 MIN_DELTA) 나빠짐
 *     — SLO 안이어도 잡는다(나빠지는 방향을 일찍 보려고). 둘 다 표본 MIN_SAMPLES 이상일 때만.
 *
 * ## 🔔 판정 0건은 '통과' 가 아니다
 *
 * 창을 쓴 뒤로 *"판정 0건"* 은 **비정상**이다(수집이 멎었거나 트래픽이 무너졌다). 그래서 조용히
 * 반환하지 않고 **알림을 낸다** — 이 레포의 규칙 그대로다(*"측정 대상 0건이면 통과가 아니라 실패"*).
 * 그리고 원인을 섞지 않는다: **표본 0 = 수집이 멎음** / **표본은 있는데 전부 얇음 = 트래픽 부족**.
 * 종전 메시지는 후자인데도 *"수집이 멎었는지 확인"* 이라고 적어, 멀쩡한 수집기를 찾아보게 만들었다.
 *
 * ## 못 보는 것
 *   - 표본이 적은 화면(창 전체에서 MIN_SAMPLES 미만) — 판정하지 않는다('표본 부족' 으로 집계)
 *   - 원인 — 어느 커밋이 나쁘게 했는지는 모른다. 알림은 '어디가 언제부터' 까지다.
 *   - 어제 하루만의 급변 — 창이 섞어 버린다(위 ⚠️).
 */

/** 구글 Core Web Vitals 'Good' 경계. CLS 는 클라이언트가 ×1000 정수로 보낸다(web-vitals-report). */
export const VITALS_SLO: Record<string, number> = { LCP: 2500, INP: 200, CLS: 100, TTFB: 800 }
/** 회귀로 치는 최소 절대 변화(잡음 차단). */
export const MIN_DELTA: Record<string, number> = { LCP: 300, INP: 50, CLS: 30, TTFB: 150 }
export const MIN_SAMPLES = 20
export const REGRESSION_RATIO = 1.25
/**
 * 🪟 누적 판정 창(일). 현 트래픽에서 하루(=1)로는 판정이 0건이다 — 위 머리말의 실측.
 * ⚠️ 트래픽이 늘면 **줄이는 것이 개선**이다. 늘리면 둔감해진다.
 */
export const WINDOW_DAYS = 7

export function p75(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))]
}

/**
 * 🪟 여러 날의 표본을 한 창으로 합친다(순수). 같은 (지표, 화면) 키의 배열을 이어 붙인다.
 * 🔑 일별 p75 를 평균하지 않는다 — 표본 수가 날마다 다르면 그 평균은 가중이 틀린다.
 *    **표본 자체를 모아** 한 번만 p75 를 낸다.
 */
export function poolDays(
  days: Record<string, Record<string, number[]>>[],
): Record<string, Record<string, number[]>> {
  const out: Record<string, Record<string, number[]>> = {}
  for (const day of days) {
    for (const [metric, pages] of Object.entries(day)) {
      for (const [page, samples] of Object.entries(pages)) {
        ;((out[metric] ||= {})[page] ||= []).push(...samples)
      }
    }
  }
  return out
}

export interface SloFinding {
  metric: string
  page: string
  kind: 'breach' | 'regression'
  p75: number
  slo: number
  baseline: number | null
  samples: number
}

/**
 * @param current  metric → page → **판정 창 누적** 표본
 * @param baseline metric → page → **직전 창 누적** 표본(같은 길이). 얇으면 회귀 판정을 건너뛴다.
 *
 * `samples` 는 창에서 실제로 본 표본 수(colo 제외)다 — 호출부가 **표본 0(수집이 멎음)** 과
 * **표본은 있는데 전부 얇음(트래픽 부족)** 을 가르는 데 쓴다. 둘을 한 메시지로 묶으면
 * 멀쩡한 수집기를 찾아보게 된다(실제로 그랬다).
 */
export function evaluateVitals(
  current: Record<string, Record<string, number[]>>,
  baseline: Record<string, Record<string, number[]>>,
): { findings: SloFinding[]; judged: number; thin: number; samples: number } {
  const findings: SloFinding[] = []
  let judged = 0
  let thin = 0
  let samples = 0
  for (const [metric, pages] of Object.entries(current)) {
    const slo = VITALS_SLO[metric]
    if (slo == null) continue
    for (const [page, pageSamples] of Object.entries(pages)) {
      if (page.startsWith('colo:')) continue // 데이터센터 표본은 화면이 아니다
      samples += pageSamples.length
      if (pageSamples.length < MIN_SAMPLES) { thin++; continue }
      judged++
      const v = p75(pageSamples) as number
      const prior = baseline[metric]?.[page] ?? []
      // 기준선도 같은 문턱을 넘겨야 쓴다 — 얇은 기준선과 비교하면 회귀가 잡음이 된다.
      const base = prior.length >= MIN_SAMPLES ? (p75(prior) as number) : null
      if (v > slo) {
        findings.push({ metric, page, kind: 'breach', p75: v, slo, baseline: base, samples: pageSamples.length })
      } else if (base != null && v > base * REGRESSION_RATIO && v - base >= MIN_DELTA[metric]) {
        findings.push({ metric, page, kind: 'regression', p75: v, slo, baseline: base, samples: pageSamples.length })
      }
    }
  }
  return { findings, judged, thin, samples }
}

const fmt = (metric: string, v: number) => (metric === 'CLS' ? (v / 1000).toFixed(2) : `${Math.round(v)}ms`)

export function describeFinding(f: SloFinding): string {
  const base = f.baseline == null ? '' : ` (직전 ${WINDOW_DAYS}일 ${fmt(f.metric, f.baseline)})`
  return f.kind === 'breach'
    ? `${f.page} ${f.metric} p75 ${fmt(f.metric, f.p75)} > 기준 ${fmt(f.metric, f.slo)}${base} · 표본 ${f.samples}`
    : `${f.page} ${f.metric} p75 ${fmt(f.metric, f.p75)} 로 나빠짐${base} · 표본 ${f.samples}`
}
