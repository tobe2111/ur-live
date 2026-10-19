/**
 * 🔬 LCP 쪼개기 표본(2026-10-19) — 수집(`analytics.routes`)·요약 화면·SLO 경보(`cron/vitals-slo`)가 같은 함수를 쓴다.
 *
 * 표본 한 개 = `[ttfb, lrd, ld, erd, img]` — 첫 바이트 · 사진 요청 시작까지 · 사진 받기 · 그리기까지(ms) · 사진이면 1.
 * 넷의 합이 그 표본의 LCP 다(`src/lib/web-vitals-report.ts` `lcpBreakdown`). 판정은 하지 않는다 —
 * 경보가 "홈 LCP 가 느리다" 고 말할 때 **어디가** 느린지를 같이 적기 위한 것이다.
 */
export interface LcpPartsBody { ttfb?: unknown; lrd?: unknown; ld?: unknown; erd?: unknown; img?: unknown }

/** LCP 쪼개기 표본 한 개 = [ttfb, lrd, ld, erd, img(0|1)] — 값이 이상하면 버린다(보고 자체는 받는다). */
export function lcpPartsTuple(parts: LcpPartsBody | undefined | null): number[] | null {
  if (!parts || typeof parts !== 'object') return null
  const nums = [parts.ttfb, parts.lrd, parts.ld, parts.erd]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 120_000)) return null
  return [...(nums as number[]).map((n) => Math.round(n)), parts.img === 1 ? 1 : 0]
}

/** 쪼개기 표본 묶음 → 부분별 p75 · 사진 비율. 요약 화면과 시험이 같은 함수를 쓴다. */
export function summarizeLcpParts(tuples: number[][]): { ttfb: number; lrd: number; ld: number; erd: number; imgShare: number; samples: number } | null {
  const rows = tuples.filter((t) => Array.isArray(t) && t.length === 5)
  if (!rows.length) return null
  const p75 = (i: number) => {
    const sorted = rows.map((r) => r[i]).sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]
  }
  return {
    ttfb: p75(0), lrd: p75(1), ld: p75(2), erd: p75(3),
    imgShare: Math.round((rows.filter((r) => r[4] === 1).length / rows.length) * 100) / 100,
    samples: rows.length,
  }
}

/** 경보 한 줄 — "↳ 첫 바이트 600 · 사진 시작 대기 900 · 사진 받기 700 · 그리기 300 ms (사진 92% · 표본 40)" */
export function describeLcpParts(s: ReturnType<typeof summarizeLcpParts>): string {
  if (!s) return ''
  return `  ↳ 어디서 늦나(p75): 첫 바이트 ${s.ttfb} · 사진 요청까지 ${s.lrd} · 사진 받기 ${s.ld} · 그리기 ${s.erd} ms ` +
    `(사진이 LCP ${Math.round(s.imgShare * 100)}% · 표본 ${s.samples})`
}
