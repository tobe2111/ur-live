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
 * ## 판정 (화면별, p75)
 *   - 위반: p75 가 SLO(구글 'Good' 경계)를 넘음
 *   - 회귀: p75 가 지난 7일 p75 중앙값보다 25% 이상 **그리고** 절대값으로 의미 있게(아래 MIN_DELTA) 나빠짐
 *     — SLO 안이어도 잡는다(나빠지는 방향을 일찍 보려고). 둘 다 표본 MIN_SAMPLES 이상일 때만.
 *
 * ## 못 보는 것
 *   - 표본이 적은 화면(하루 20개 미만) — 판정하지 않는다(조용히 통과가 아니라 '표본 부족' 으로 집계)
 *   - 원인 — 어느 커밋이 나쁘게 했는지는 모른다. 알림은 '어디가 언제부터' 까지다.
 */

/** 구글 Core Web Vitals 'Good' 경계. CLS 는 클라이언트가 ×1000 정수로 보낸다(web-vitals-report). */
export const VITALS_SLO: Record<string, number> = { LCP: 2500, INP: 200, CLS: 100, TTFB: 800 }
/** 회귀로 치는 최소 절대 변화(잡음 차단). */
export const MIN_DELTA: Record<string, number> = { LCP: 300, INP: 50, CLS: 30, TTFB: 150 }
export const MIN_SAMPLES = 20
export const REGRESSION_RATIO = 1.25

export function p75(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))]
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
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
 * @param today   metric → page → 오늘(판정일) 표본
 * @param history metric → page → 지난 날들의 p75 목록(표본 충분한 날만)
 */
export function evaluateVitals(
  today: Record<string, Record<string, number[]>>,
  history: Record<string, Record<string, number[]>>,
): { findings: SloFinding[]; judged: number; thin: number } {
  const findings: SloFinding[] = []
  let judged = 0
  let thin = 0
  for (const [metric, pages] of Object.entries(today)) {
    const slo = VITALS_SLO[metric]
    if (slo == null) continue
    for (const [page, samples] of Object.entries(pages)) {
      if (page.startsWith('colo:')) continue // 데이터센터 표본은 화면이 아니다
      if (samples.length < MIN_SAMPLES) { thin++; continue }
      judged++
      const v = p75(samples) as number
      const prior = history[metric]?.[page] ?? []
      const base = prior.length >= 3 ? median(prior) : null
      if (v > slo) {
        findings.push({ metric, page, kind: 'breach', p75: v, slo, baseline: base, samples: samples.length })
      } else if (base != null && v > base * REGRESSION_RATIO && v - base >= MIN_DELTA[metric]) {
        findings.push({ metric, page, kind: 'regression', p75: v, slo, baseline: base, samples: samples.length })
      }
    }
  }
  return { findings, judged, thin }
}

const fmt = (metric: string, v: number) => (metric === 'CLS' ? (v / 1000).toFixed(2) : `${Math.round(v)}ms`)

export function describeFinding(f: SloFinding): string {
  const base = f.baseline == null ? '' : ` (지난 7일 ${fmt(f.metric, f.baseline)})`
  return f.kind === 'breach'
    ? `${f.page} ${f.metric} p75 ${fmt(f.metric, f.p75)} > 기준 ${fmt(f.metric, f.slo)}${base} · 표본 ${f.samples}`
    : `${f.page} ${f.metric} p75 ${fmt(f.metric, f.p75)} 로 나빠짐${base} · 표본 ${f.samples}`
}
