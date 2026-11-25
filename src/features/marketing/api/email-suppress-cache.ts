/**
 * 🚫 보내면 안 되는 이메일(`ad_email_suppress`) — 수집 저장 관문이 쓰는 **메모리 사본** (2026-11-25)
 *
 * 왜: 업체 리드에서 반송 이메일을 지우면(📵 버튼 · 주간 정리) 다음 수집이 같은 주소를 다시 채웠다
 * (`company-save.ts` 의 `email = COALESCE(기존, 새값)` — 기존이 비었으니 새값이 들어간다). 주간 정리가 다시 지울 때까지
 * 그 주소는 내보내기 파일에 실린다.
 *
 * 왜 메모리인가: 저장 관문은 모든 수집 소스가 지나는 길이고, 워커 한 번 실행의 외부 요청(DB 포함) 수가 빠듯하다.
 * 청크마다 차단 표를 묻는 문장을 더하면 저장 비용이 1.5배가 된다. 차단 표는 작다(라이브 17건) — 10분에 한 번 통째로 읽어
 * 메모리에서 거른다. 표가 `SUPPRESS_CACHE_CAP` 을 넘으면 넘는 만큼은 못 거른다(주간 정리가 맡는다).
 * 읽기가 실패하면 빈 목록 — 수집을 멈추지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export const SUPPRESS_CACHE_TTL_MS = 10 * 60_000
export const SUPPRESS_CACHE_CAP = 5000

let cache: { at: number; set: Set<string> } | null = null

export async function suppressedEmails(DB: D1Database, nowMs = Date.now()): Promise<Set<string>> {
  if (cache && nowMs - cache.at < SUPPRESS_CACHE_TTL_MS) return cache.set
  try {
    const rows = (await DB.prepare(`SELECT email FROM ad_email_suppress ORDER BY rowid DESC LIMIT ${SUPPRESS_CACHE_CAP}`).all<{ email: string }>())?.results || []
    cache = { at: nowMs, set: new Set(rows.map((r) => String(r.email || '').trim().toLowerCase()).filter(Boolean)) }
  } catch {
    cache = { at: nowMs, set: new Set() }
  }
  return cache.set
}

/** 시험용 — 사본 비우기. */
export function _resetSuppressCache(): void { cache = null }
