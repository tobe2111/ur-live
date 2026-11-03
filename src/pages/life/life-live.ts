/**
 * 📣 생활 첫 화면 '실시간 한 줄' 문구 — 2026-11-03 대표 확정 안 5 · **C**
 *   (*"실제 기록이 있을 때만 보여 주기 + 없으면 지금 사실인 내용"*).
 *
 *   ① 최근 7일 안에 견적이 도착했으면: `3시간 전 마포구 간판 제작·교체에 견적 2건 도착`
 *   ② 없고 견적을 받는 업체가 있으면: `지금 업체 4곳이 견적 요청을 기다리고 있어요`
 *   ③ 둘 다 없으면 null — 줄을 숨긴다. **지어내지 않는다**(라이브 2026-11-03 실측: 요청 1건 · 견적 0건).
 *
 * 서버 값(`/api/home-service/config` 의 `live`)만 쓴다. 시각은 D1 의 `Z` 없는 UTC 문자열이다.
 */
import { categoryDef } from '@/shared/home-service'

export interface LifeLive {
  latest: { category: string; sigungu: string; quotes: number; at: string } | null
  proTotal: number
}

/** D1 `datetime('now')` 문자열(`YYYY-MM-DD HH:MM:SS`, UTC, Z 없음)을 ms 로. 못 읽으면 NaN. */
function utcMs(s: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`)
}

export function agoLabel(at: string, nowMs: number): string | null {
  const t = utcMs(at)
  if (!Number.isFinite(t)) return null
  const min = Math.max(0, Math.floor((nowMs - t) / 60000))
  if (min < 10) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return d === 1 ? '어제' : `${d}일 전`
}

export function lifeLiveLine(live: LifeLive | null | undefined, nowMs: number): { text: string; fresh: boolean } | null {
  if (!live) return null
  const l = live.latest
  if (l) {
    const ago = agoLabel(l.at, nowMs)
    const label = categoryDef(l.category)?.label
    if (ago && label) return { text: `${ago} ${l.sigungu} ${label}에 견적 ${l.quotes}건 도착`, fresh: true }
  }
  if (live.proTotal > 0) return { text: `지금 업체 ${live.proTotal}곳이 견적 요청을 기다리고 있어요`, fresh: false }
  return null
}
