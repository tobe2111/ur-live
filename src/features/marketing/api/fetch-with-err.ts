import type { FetchBudget } from './influencer-discovery'
import { noteNaverCall } from './naver-api-usage'

/**
 * 🔎 fetch 예외 원문 보존 (2026-07-29) — 발굴/보강 경로가 `.catch(() => null)` 로 사유를 버려
 *   어드민에 "호출 실패 (네트워크)" 라는 뭉뚱그린 문구만 남던 것을 없앤다.
 *
 *   같은 인보케이션에서 유튜브는 `Too many subrequests` 를 내는데 네이버는 '네트워크'로 보이면
 *   **같은 원인인지 구분할 수 없다** — 실제로 그 상태가 라이브 진단을 막았다.
 *   AbortError=상대 무응답 / TypeError "Too many subrequests"=플랫폼 한도 / 그 외=DNS·TLS.
 */
export async function fetchWithErr(url: string, init?: RequestInit): Promise<{ res: Response | null; err?: string }> {
  // 📟 네이버 오픈API 계측 + 일일 목표(90%) 게이트. 실패한 호출도 쿼터를 먹으므로 **호출 전**에 센다.
  //   false = 오늘 목표 소진 → 쏘지 않는다. 사유를 err 로 남겨야 상태줄에서 '네트워크 실패'와 구분된다.
  if (!noteNaverCall(url)) return { res: null, err: 'NaverQuota: 일일 목표(90%) 소진' }
  try {
    return { res: await fetch(url, init) }
  } catch (e) {
    const x = e as { name?: string; message?: string } | null
    return { res: null, err: `${x?.name || 'Error'}: ${String(x?.message || '').slice(0, 160)}` }
  }
}

/** 예산·벽시계 소진 판정 — 발굴/보강 레인이 공유(influencer-discovery 에서 이동, 2026-07-29). */
export const outOfBudget = (b?: FetchBudget) => !!b && (b.left <= 0 || (!!b.deadline && Date.now() >= b.deadline))
/** 서브리퀘스트 1회 차감 — 호출 직전에 부른다(실패한 호출도 플랫폼은 카운트한다). */
export const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }
