/**
 * 🩺 **레인 건강 요약** — "왜 줄었는지"를 파헤치지 않고도 알게 한다 (2026-08-19).
 *
 * ## 왜 (실측)
 * 어제 넣은 회차 이력(`ads_lane_runs:*`)이 원인을 확정해 줬는데, **그걸 보려면 사람이 손으로
 * 스크립트를 짜야 했다.** 한 줄로 요약하면 이렇게 나온다:
 * ```
 * collect-commerce   12회 중 9회 실패   "등록현황: 네트워크 오류 | 등록상세: 네트워크 오류"
 * collect-hira       12회 중 5회 실패   "네트워크 오류: The operation was aborted due to timeout"
 * collect-nps         1회 중 1회 실패   "API: HTTP 503"
 * collect-storeinfo  12회 전부 성공 · 수확 0                      ← 소진
 * collect-neis       12회 전부 성공 · 수확 24,115                 ← 최대 생산자
 * ```
 * 🔑 이 표가 **공급자 단위 패턴**을 드러낸다 — 공공데이터포털 계열(commerce·hira·nps)이 동시에
 *   불안정하고, 네이버·카카오 계열은 멀쩡하다. 레인 하나만 보면 절대 안 보이는 사실이다.
 *
 * ⚠️ 그래서 유입 경보에 이 요약을 **함께 실어 보낸다.** 경보가 "줄었다"만 말하면 받는 사람은
 *   다시 처음부터 파야 한다 — 그건 경보가 아니라 숙제다.
 */
import type { LaneRunEntry } from '@/worker-ads/lane-run-history'

export interface LaneHealth {
  lane: string
  runs: number
  fails: number
  saved: number
  /** 대표 오류 한 줄(가장 최근 실패). 없으면 빈 문자열. */
  err: string
  /** 성공하는데 수확이 0 — 소진. 실패와 처방이 정반대라 따로 표시한다. */
  barren: boolean
}

/** 실패율이 이 위면 경보에 싣는다. */
export const REPORT_FAIL_RATIO = 0.34
/** 경보에 싣는 최대 줄 수 — 길면 안 읽힌다. */
export const REPORT_MAX_LINES = 4

/** 이력 JSON 하나를 요약. 깨진 값은 `null`(관측 실패가 경보를 막지 않는다). */
export function summarizeLane(lane: string, raw: string | null | undefined): LaneHealth | null {
  let hist: LaneRunEntry[]
  try { hist = JSON.parse(String(raw || '')) as LaneRunEntry[] } catch { return null }
  if (!Array.isArray(hist) || !hist.length) return null
  const runs = hist.length
  const fails = hist.filter(h => h && !h.ok).length
  const saved = hist.reduce((a, h) => a + (h && h.ok && typeof h.n === 'number' ? h.n : 0), 0)
  const err = hist.find(h => h && !h.ok && h.e)?.e || ''
  return { lane, runs, fails, saved, err, barren: fails === 0 && saved === 0 }
}

/**
 * 경보에 실을 줄. **실패한 레인만** — 소진은 손해가 아니라 완료라서 매일 알릴 일이 아니다
 * (그건 `isBarren` 감속이 조용히 처리한다).
 */
export function reportLines(all: readonly LaneHealth[], max = REPORT_MAX_LINES): string[] {
  return all
    .filter(h => h.runs > 0 && h.fails / h.runs >= REPORT_FAIL_RATIO)
    .sort((a, b) => (b.fails / b.runs) - (a.fails / a.runs))
    .slice(0, max)
    .map(h => `• \`${h.lane}\` ${h.runs}회 중 **${h.fails}회 실패** — ${h.err.slice(0, 70) || '사유 미기록'}`)
}

const KEY_PREFIX = 'ads_lane_runs:'

/** 모든 레인의 이력을 읽어 요약. 실패하면 빈 배열 — 관측이 경보를 막으면 안 된다. */
export async function summarizeLaneHealth(DB: D1Database): Promise<LaneHealth[]> {
  const rs = await DB.prepare('SELECT key, value FROM platform_settings WHERE key LIKE ?')
    .bind(`${KEY_PREFIX}%`).all<{ key: string; value: string }>().catch(() => null)
  const out: LaneHealth[] = []
  for (const r of rs?.results || []) {
    const h = summarizeLane(String(r.key).slice(KEY_PREFIX.length), r.value)
    if (h) out.push(h)
  }
  return out
}
