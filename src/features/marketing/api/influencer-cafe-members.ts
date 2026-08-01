/**
 * 🏘️ **네이버 카페 회원수 채우기** (2026-07-29 대표 신고 — "카페 회원수는 반영이 안되고 있음(카운팅이 안됨)").
 *
 *   ## 왜 항상 0 이었나
 *   카페는 네이버 검색 오픈API 의 `cafearticle.json`(글 검색)으로 발굴한다. 그 응답에는 카페 이름·주소만
 *   있고 **회원수 필드가 아예 없다.** 그래서 저장 시 `subscriber_count: 0` 을 넣고 끝이었다
 *   (`influencer-discovery.ts` 의 카페 분기). 즉 "카운팅이 안 되는" 게 아니라 **한 번도 세어본 적이 없다.**
 *   화면의 0 은 "회원 0명"이 아니라 "모름"이었고, 그 둘이 구분되지 않던 것이 진짜 문제다.
 *
 *   ## 어디서 가져오나
 *   카페 홈(`cafe.naver.com/{handle}`)의 공개 HTML 에 멤버 수가 노출된다. 표기가 한 가지가 아니라
 *   (`멤버수 12,345` · `멤버 12,345명` · `회원수 12,345`) 여러 형태를 받는다.
 *   ⚠️ 숫자만 있는 곳(글 수·방문자)과 구분해야 하므로 **'멤버/회원' 단어를 반드시 요구**한다 —
 *   느슨하게 잡으면 글 수를 회원수로 적어 넣는다(0 보다 나쁜 실패다).
 *
 *   ## 비용
 *   카페 1곳당 fetch 1. 카페는 3,142개뿐이고 **한 번 채우면 다시 안 잰다**(`subscriber_count > 0` 이면 제외)
 *   — 전수 1회 훑는 성격이라 정기 부담이 아니다.
 *   ⚠️ 회원수는 늘지만 재측정하지 않는다. 발송 판단에 쓰는 값이 아니라 **규모 감**을 보는 값이고,
 *   재측정하면 3,142 fetch 를 매번 되풀이하게 된다(그 비용은 블로거 측정에서 나온다).
 */
import type { D1Database } from '@cloudflare/workers-types'
/**
 * 예산은 **최소 형태**만 받는다 — 발굴 레인의 `FetchBudget` 과 정비 레인의 `OpBudget` 둘 다
 * 이 모양을 만족한다. 한쪽 타입에 묶으면 다른 레인에서 못 쓴다(어댑터를 새로 만들게 된다).
 */
type Spendable = { left: number; deadline?: number }

/** 카페 홈 HTML → 회원수. 못 찾으면 null(0 으로 덮어쓰지 않는다 — '모름'과 '0명'은 다르다). */
export function parseCafeMembers(html: string): number | null {
  if (!html) return null
  // '멤버수 12,345' / '멤버 12,345명' / '회원수 12,345' / '회원 12,345명'
  const m = /(?:멤버|회원)\s*수?\s*[:：]?\s*([0-9][0-9,]{0,12})\s*명?/.exec(html)
  if (!m) return null
  const n = parseInt(m[1]!.replace(/,/g, ''), 10)
  // 상한: 네이버 최대 카페도 1천만 미만. 그보다 크면 글 수/조회수를 잘못 집은 것이다.
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? n : null
}

export interface CafeMemberDiag { tried: number; filled: number; failed: number; selected: number }

/**
 * 회원수 미측정 카페를 골라 채운다. 커서 불필요 — 채워진 행은 `subscriber_count > 0` 이라 다음 회차가
 * 자연히 다음 구간을 잡는다(지역 백필과 같은 방식).
 */
export async function fillCafeMemberCounts(DB: D1Database, poolId: number, budget: Spendable, max = 20): Promise<CafeMemberDiag> {
  const diag: CafeMemberDiag = { tried: 0, filled: 0, failed: 0, selected: 0 }
  if (max <= 0) return diag
  const rows = (await DB.prepare(`SELECT id, handle, url FROM ad_influencer_leads
      WHERE account_id = ? AND platform = 'naver_cafe' AND COALESCE(subscriber_count, 0) = 0
      ORDER BY id ASC LIMIT ?`).bind(poolId, Math.min(max, 30))
    .all<{ id: number; handle: string | null; url: string | null }>().catch(() => null))?.results || []
  diag.selected = rows.length
  if (!rows.length) return diag

  const ups: ReturnType<D1Database['prepare']>[] = []
  for (const r of rows) {
    if (budget.left <= 0 || (budget.deadline && Date.now() >= budget.deadline)) break
    const handle = (r.handle || '').trim() || (r.url || '').replace(/^https?:\/\/(?:m\.)?cafe\.naver\.com\//i, '').replace(/[/?#].*$/, '')
    if (!handle) continue
    budget.left -= 1
    diag.tried++
    let n: number | null = null
    try {
      const res = await fetch(`https://cafe.naver.com/${encodeURIComponent(handle)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) n = parseCafeMembers((await res.text()).slice(0, 200_000))
    } catch { /* 실패는 다음 회차가 재시도(멱등) */ }
    if (n == null) { diag.failed++; continue }
    ups.push(DB.prepare('UPDATE ad_influencer_leads SET subscriber_count = ? WHERE id = ? AND account_id = ?').bind(n, r.id, poolId))
    diag.filled++
  }
  for (let i = 0; i < ups.length; i += 50) await DB.batch(ups.slice(i, i + 50)).catch(() => null)
  return diag
}
