/**
 * 💸 **이미 연락처를 가진 재조우는 보강하지 않는다** — 발굴 모듈에 넘기는 D1 훅 (2026-07-29).
 *
 * ## 왜 필요한가
 * 저장(`saveLeadsBatch`)은 **빈 칸만** COALESCE 백필한다. 그래서 이미 이메일/인스타/링크가 채워진 리드를
 * 보강하면 그 fetch 는 결과가 통째로 버려진다 — 순수 낭비다. 그런데 이 레인의 병목이 정확히 그
 * fetch 예산이다: 실측 `spent 40/40` · 라운드당 키워드 3개 · 활성 키워드 210개면 **한 바퀴 70시간**.
 * 게다가 풀이 38,813 까지 자라 재조우 비중이 계속 커진다(실측 `yt: found 148 → saved 2`) —
 * 낭비도 같이 커지는 구조다.
 *
 * ⇒ **조회 1회로 보강 fetch 최대 8(YT)/5(네이버)** 를 없앤다. 재조우가 다수인 지금 항상 이득이다.
 *
 * ## 🧾 이 조회도 예산에서 뺀다
 * D1 호출도 서브리퀘스트인데 `budget.left` 는 발굴 fetch 만 센다 — 그 비대칭이 이 레인이 자기 마감 기록을
 * 잃던 근본 원인이었다(#784). **아끼자고 만든 장치가 같은 함정을 다시 파면 안 되므로** 여기서 정직하게 1 을 쓴다.
 *   · 최악(재조우 0인 키워드): 2 손해   · 최선: 13 절약
 *
 * ⚠️ '연락처 있음' 만 건너뛴다 — 연락처가 **비어 있는** 재조우는 보강 대상이 맞다(백필이 실제로 채운다).
 * ⚠️ 조회 실패/예산 바닥이면 **빈 집합**을 돌려 보강을 그대로 진행한다(최적화가 수집을 막으면 안 된다).
 */
import type { AlreadyContacted, FetchBudget } from './influencer-discovery'

/** 한 번에 되묻는 키 상한 — IN 절 바인딩 폭주 방지(발굴 1회 결과가 이보다 크지 않다). */
const MAX_KEYS = 200

/**
 * @param DD     D1
 * @param pool   공용 풀 account_id
 * @param budget 이 실행의 fetch 예산 — 조회 1건도 여기서 뺀다(위 🧾 참조)
 */
export function makeAlreadyContacted(DD: D1Database, pool: number, budget: FetchBudget): AlreadyContacted {
  return async (platform: string, keys: string[]): Promise<Set<string>> => {
    const uniq = Array.from(new Set(keys.filter(Boolean))).slice(0, MAX_KEYS)
    if (!uniq.length || budget.left <= 1) return new Set() // 예산이 바닥이면 조회조차 안 한다
    budget.left -= 1 // 🧾 D1 도 서브리퀘스트 — 발굴 fetch 와 같은 지갑에서 뺀다
    // 플랫폼마다 신원 키가 다르다: 유튜브=channel_id · 네이버 블로그=handle(블로그 id).
    const col = platform === 'naver_blog' ? 'handle' : 'channel_id'
    const ph = uniq.map(() => '?').join(',')
    const r = await DD.prepare(
      `SELECT ${col} AS k FROM ad_influencer_leads
        WHERE account_id = ? AND platform = ? AND ${col} IN (${ph})
          AND (COALESCE(email,'') <> '' OR COALESCE(instagram,'') <> '' OR COALESCE(links,'') <> '')`,
    ).bind(pool, platform, ...uniq).all<{ k: string }>().catch(() => null)
    return new Set((r?.results || []).map(x => x.k).filter(Boolean))
  }
}
