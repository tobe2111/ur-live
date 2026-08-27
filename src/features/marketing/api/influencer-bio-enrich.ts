/**
 * 🔗 **링크인바이오 체인 보강** — `influencer-enrich-lane.ts` 에서 분리 (2026-08-27, 600줄 래칫).
 *
 *   프로필 링크가 linktr.ee 류인 리드의 그 페이지를 열어 이메일/인스타를 추출한다.
 *   `bio_checked_at` 스탬프로 1인 1회(재선택 없음). 못 찾아도 스탬프(허위 재시도 방지).
 *
 * ⚠️ **로직은 이동뿐 — 한 줄도 바꾸지 않았다.** 호출부는 레인이 그대로 재수출하므로 계약 불변.
 *
 * ## 대상 선택이 왜 이 모양인가 (2026-08-27 라이브 실측으로 교정)
 * ```
 *   교정 전:  rows_read 153,223 · 168ms · 결과 0건   ← 매 회차
 *   전체 153,312 · bio_checked_at IS NULL 153,221(99.9%) · links 보유 2,410(1.6%) · 진짜 대상 74(0.05%)
 * ```
 * `idx_ad_inf_leads_bio(account_id, bio_checked_at)` 는 99.9%를 통과시켜 **거르는 일을 못 한다**.
 * 거기에 `ORDER BY subscriber_count DESC`(인덱스 밖)가 붙어 그 전부를 임시 B-트리로 정렬했다.
 * 그리고 **결과가 0건이라 상태줄엔 흔적이 없다** — 조용히 CPU 를 태우는 모양이었다.
 *
 * ⇒ 부분 인덱스 `idx_ad_inf_leads_bio_links (account_id, id) WHERE links IS NOT NULL AND bio_checked_at IS NULL`
 *   (`influencer-schema.ts`) + `ORDER BY id DESC`(그 인덱스를 역순으로 그대로 탄다).
 *
 * ⚠️ **WHERE 절이 부분 인덱스 조건을 함의해야** 인덱스가 쓰인다 — `links IS NOT NULL` 이나
 *   `bio_checked_at IS NULL` 중 하나만 빠져도 전수 스캔으로 돌아가고 **결과는 같아서 눈에 안 보인다.**
 * ⚠️ `LIKE '%linktr.ee%'` 는 앞에 `%` 라 어떤 인덱스도 못 돕는다 — 인덱스가 노리는 것은 그 앞 단계다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { extractContacts, pickBusinessEmail, fetchLinkInBioText, type FetchBudget } from './influencer-discovery'
import { POOL_ACCOUNT_ID } from './influencer-auto-collect'

/** 링크인바이오 플랫폼 자체 메일(안내/noreply) — 인플루언서 연락처가 아니라 저장 금지. */
const PLATFORM_EMAIL_RE = /@(linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|taplink\.cc|link\.bio)$/i

export async function enrichPoolFromLinkInBio(DB: D1Database, budget: FetchBudget, max: number): Promise<number> {
  if (max <= 0 || budget.left <= 0) return 0
  const rows = (await DB.prepare(`SELECT id, links, email, instagram, tiktok FROM ad_influencer_leads
    WHERE account_id = ? AND bio_checked_at IS NULL AND (email IS NULL OR instagram IS NULL)
      AND links IS NOT NULL AND (links LIKE '%linktr.ee%' OR links LIKE '%litt.ly%' OR links LIKE '%inpock.co.kr%' OR links LIKE '%litelink.at%' OR links LIKE '%link.bio%' OR links LIKE '%taplink.cc%')
    ORDER BY id DESC LIMIT ?`).bind(POOL_ACCOUNT_ID, max)
    .all<{ id: number; links: string | null; email: string | null; instagram: string | null; tiktok: string | null }>().catch(() => null))?.results || []
  if (!rows.length) return 0
  let enriched = 0
  const stmts: ReturnType<D1Database['prepare']>[] = []
  for (const r of rows) {
    if (budget.left <= 0 || (budget.deadline && Date.now() >= budget.deadline)) break // 예산/시간 소진 — 스탬프 없이 중단(다음 라운드가 이어받음)
    budget.left -= 1
    const link = (r.links || '').split(/\s+/).find(l => /^(?:https?:\/\/)?(?:linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|link\.bio|taplink\.cc)\//i.test(l)) || ''
    const html = link ? await fetchLinkInBioText(link) : ''
    const c = html ? extractContacts(html) : { emails: [], instagram: [], tiktok: [], links: [] }
    let email = r.email
    if (!email && html) {
      const picked = pickBusinessEmail(html)
      email = (picked && !PLATFORM_EMAIL_RE.test(picked) ? picked : null) || c.emails.find(e => !PLATFORM_EMAIL_RE.test(e)) || null
    }
    const insta = r.instagram || c.instagram[0] || null
    const tt = r.tiktok || c.tiktok[0] || null
    if ((email && !r.email) || (insta && !r.instagram) || (tt && !r.tiktok)) enriched++
    stmts.push(DB.prepare("UPDATE ad_influencer_leads SET email = ?, instagram = ?, tiktok = ?, bio_checked_at = datetime('now') WHERE id = ? AND account_id = ?")
      .bind(email, insta, tt, r.id, POOL_ACCOUNT_ID))
  }
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  return enriched
}
