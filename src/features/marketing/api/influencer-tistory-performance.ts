/**
 * 📗 **티스토리 블로거 측정** (2026-08-03 — 대표 *"다 해줘"*).
 *
 * ## 왜 만들었나 — 재는 사람이 아무도 없었다
 * ```
 *   platform   총     미측정   이메일
 *   tistory    495    495      0        ← 측정 경로가 **아예 없다**. 그런데 유입은 ~216/일
 * ```
 * 수집(`discoverTistoryBloggers`)은 카카오 Daum 블로그 검색 **스니펫**에서만 컨택을 뽑는데,
 * 스니펫은 남의 글 본문이라 `requireContext: true` 게이트를 거의 못 넘는다 — 그래서 **0/495**다.
 * 네이버 블로거는 같은 문제를 `enrichNaverActivity`(RSS + 홈)로 풀었고, 티스토리만 그 짝이 없었다.
 * 방치하면 8/19(블로그 백로그 소진 예정일)엔 ~3,900행이 **영영 못 쓰는 채로** 쌓인다.
 *
 * ## 왜 별 파일인가 — 네이버 경로를 안 건드리기 위해서다
 * `enrichNaverActivity` 는 지금 백로그 20,264행을 시간당 ~190행씩 갈아내는 **가장 값진 레인**이고,
 * 핸들 자가복구·이웃수 파싱·마감 바닥값 등 실측으로 조율된 로직이 얽혀 있다. 공용 엔진으로 뽑는
 * 리팩토링은 그 레인에 회귀 위험을 지운다. ⇒ **판정 로직(추출·분류·채점·스탬프 규칙)은 공용 헬퍼로
 * 진짜 공유**하고, 루프 골격만 여기서 따로 갖는다. 티스토리 쪽이 더 단순해서 가능하다:
 *   · 핸들 자가복구 불필요 — 티스토리 핸들은 서브도메인이라 손상될 여지가 없다
 *   · 이웃수 없음 — 티스토리엔 공개 구독자 지표가 없다(`subscriber_count` 는 손대지 않는다)
 *
 * ## 스탬프 규칙 — 네이버와 **같다**(다르면 두 레인이 조용히 갈라진다)
 *   · 둘 다 실패 → 데이터 없이 `perf_checked_at` 만(0 각인 금지, 다음 순환 재시도)
 *   · RSS 404/410 → 삭제·비공개 = "측정 성공·글 0"(터미널)
 *   · 홈은 채울 게 있을 때만 fetch(순수 낭비 제거)
 *
 * ⚠️ **이 환경에서 실물 응답을 못 봤다** — 프록시가 `tistory.com` 을 CONNECT 403 으로 막는다
 * (`rss.blog.naver.com` 과 같은 사정. `NaverEnrichDiag` 주석이 같은 한계를 적어 뒀다).
 * ⇒ **판정 근거는 라이브 diag 다**: `measured` 가 계속 0이면 RSS 경로가 틀린 것이고,
 * `contacts`/`emails` 가 계속 0이면 티스토리 홈에서 연락처가 안 나오는 것이니 **추측으로 파서를
 * 더 손대지 말고 이 경로를 접을 것.** 배포 후 5분이면 답이 나온다.
 */
import { canStartBudgetedItem, budgetedTimeoutMs } from './collect-budget'
import { sliceClause, type EnrichSlice } from './enrich-slice'
import { dueForRemeasure } from './influencer-remeasure-window'
import { extractPubDates, countRecentPosts, deriveNaverRssSignals } from './influencer-parse'
import { extractContacts, pickBusinessEmail, type FetchBudget } from './influencer-discovery'
import { classifyCategory, classifyCategoryByHits, reconcileCategory, NON_CATEGORIES } from './influencer-classify'
import { isSelfBlogLink } from './influencer-self-link'

/** 티스토리 보강 결과 — 필드 의미는 `NaverEnrichDiag` 와 동일(두 레인을 같은 눈으로 읽기 위해). */
export interface TistoryEnrichDiag {
  tried: number; measured: number; contacts: number; failed: number
  emails?: number
  selected?: number
  skipped?: number
  rss_intro?: number
  rss_emails?: number
  cat_body?: number
  home_skipped?: number
  window_skipped?: number
  query_error?: string
}

type TistoryRow = {
  id: number; handle: string | null; url: string | null; name: string | null
  email: string | null; instagram: string | null; links: string | null; description: string | null
  category: string | null; subscriber_count: number | null; is_brand: number | null
  consented_at: string | null; source: string | null; perf_checked_at: string | null
}

/**
 * 🔤 핸들 도출 — `handle` 이 정상이면 그대로, 아니면 `url` 의 서브도메인에서 되살린다.
 *   ⚠️ 되살려도 **DB 를 고치지 않는다**(네이버의 healing 과 다른 점). 티스토리 핸들 손상은 관측된 적이
 *   없어서, 없는 문제에 쓰기 경로를 만드는 대신 읽는 자리에서만 관대하게 처리한다.
 */
export function deriveTistoryHandle(row: { handle?: string | null; url?: string | null }): string | null {
  const h = String(row.handle || '').trim().toLowerCase()
  if (/^[a-z0-9][a-z0-9-]{1,39}$/.test(h) && h !== 'tistory') return h
  const m = /^https?:\/\/([a-z0-9][a-z0-9-]{1,39})\.tistory\.com/i.exec(String(row.url || ''))
  return m ? m[1].toLowerCase() : null
}

/** 🏠 홈을 받을 가치가 있나 — 연락처 3종이 이미 다 차 있으면 응답이 버려진다(네이버 `naverHomeUseful` 과 같은 취지). */
export function tistoryHomeUseful(row: { email?: string | null; instagram?: string | null; links?: string | null }): boolean {
  return !row.email || !row.instagram || !row.links
}

const HOME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
/** 🏃 동시성 — 호스트가 블로거마다 달라(`{handle}.tistory.com`) 네이버(호스트 2개 고정)보다 여유가 있지만,
 *  같은 CDN 뒤라 보수적으로 네이버와 같은 값에서 시작한다. 올리기 전에 `failed` 가 안 오르는지부터 볼 것. */
const TISTORY_CONCURRENCY = 3

export async function enrichTistoryActivity(
  DB: D1Database, budget: FetchBudget, max: number, slice?: EnrichSlice | null, env?: unknown,
): Promise<TistoryEnrichDiag> {
  const diag: TistoryEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0 }
  if (max <= 0 || budget.left <= 1) return diag
  let rows: TistoryRow[] = []
  try {
    const sl = sliceClause(slice)
    const res = await DB.prepare(
      `SELECT id, handle, url, name, email, instagram, links, description, category, subscriber_count, is_brand, consented_at, source, perf_checked_at
       FROM ad_influencer_leads WHERE account_id = 0 AND platform = 'tistory'${sl.sql}
       ORDER BY perf_checked_at ASC LIMIT ?`,
    ).bind(...sl.binds, Math.min(max, 30)).all<TistoryRow>()
    rows = dueForRemeasure(res?.results || [], env)   // 🔁 최근에 잰 것은 건너뛴다(근거: `influencer-remeasure-window.ts`)
  } catch (err) {
    // 삼키면 `selected:0` 이 '큐가 빔'과 구분되지 않는다 — 네이버 레인이 그 무음으로 원인 규명을 막았던 그 자리.
    diag.query_error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}`
    return diag
  }
  diag.selected = rows.length
  if (!rows.length) return diag

  const { scoreLead } = await import('./influencer-quality') // 순환 회피 — 네이버 경로와 같은 이유·같은 형태
  const stmts: ReturnType<D1Database['prepare']>[] = []
  let cursor = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      if (budget.left <= 1) return
      // 🔴 바닥값을 줄 수 없으면 아예 안 집는다 — 집고 실패하면 데이터 없이 스탬프가 찍혀 큐 뒤로 밀린다.
      if (!canStartBudgetedItem(budget.deadline)) { diag.window_skipped = (diag.window_skipped || 0) + 1; return }
      const r = rows[cursor++]
      if (!r) return
      const handle = deriveTistoryHandle(r)
      if (!handle) { // url/handle 어디에도 서브도메인이 없다 — 측정 불가 확정, 스탬프만(재선택 뒤로)
        diag.skipped = (diag.skipped || 0) + 1
        stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET perf_checked_at = datetime('now') WHERE id = ?`).bind(r.id))
        continue
      }
      diag.tried++
      const wantHome = budget.left >= 2 && tistoryHomeUseful(r)
      if (!wantHome && budget.left >= 2) diag.home_skipped = (diag.home_skipped || 0) + 1
      budget.left -= wantHome ? 2 : 1
      const itemTimeout = budgetedTimeoutMs(budget.deadline, 8000)
      const base = `https://${handle}.tistory.com`
      const [rssXml, homeText] = await Promise.all([
        (async (): Promise<string | null> => {
          try {
            const res = await fetch(`${base}/rss`, { signal: AbortSignal.timeout(itemTimeout) })
            if (res.ok) return (await res.text()).slice(0, 120_000)
            if (res.status === 404 || res.status === 410) return '' // 폐쇄/비공개 — "측정 성공·글 0"(터미널)
          } catch { /* null = 측정 실패 */ }
          return null
        })(),
        (async (): Promise<string | null> => {
          if (!wantHome) return null
          try {
            const hr = await fetch(base, { signal: AbortSignal.timeout(itemTimeout), headers: { 'user-agent': HOME_UA, accept: 'text/html' }, redirect: 'follow' })
            if (hr.ok) return (await hr.text()).slice(0, 80_000)
          } catch { /* fail-soft */ }
          return null
        })(),
      ])
      if (rssXml === null && homeText === null) { // 둘 다 실패 — 0 각인 금지, 스탬프만
        diag.failed++
        stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET perf_checked_at = datetime('now') WHERE id = ?`).bind(r.id))
        continue
      }

      const sets: string[] = [`perf_checked_at = datetime('now')`]
      const binds: (string | number)[] = []
      let descForClass = r.description || ''
      let rssIntro = ''
      let rssBody = ''
      if (rssXml !== null) {
        diag.measured++
        const pubDates = extractPubDates(rssXml)
        sets.push('recent_posts_30d = ?'); binds.push(countRecentPosts(pubDates, Date.now()))
        const newest = pubDates.map(d => Date.parse(d)).filter(Number.isFinite).sort((a, b) => b - a)[0]
        if (newest) {
          const iso = new Date(newest).toISOString().slice(0, 10)
          sets.push(`last_post_at = CASE WHEN last_post_at IS NULL OR last_post_at < ? THEN ? ELSE last_post_at END`); binds.push(iso, iso)
        }
        // 🎁 이름은 Naver 지만 내용은 **표준 RSS 2.0 추출**이다(채널 description·item title/본문) —
        //   티스토리도 RSS 2.0 이라 그대로 쓴다. 두 벌로 복사하면 파서가 조용히 갈라진다.
        const sig = deriveNaverRssSignals(rssXml, r.description || '')
        if (sig.intro) diag.rss_intro = (diag.rss_intro || 0) + 1
        if (sig.description) { descForClass = sig.description; sets.push('description = ?'); binds.push(sig.description) }
        rssIntro = sig.intro; rssBody = sig.body
      }

      let emailAfter = r.email
      let instaAfter = r.instagram
      if (homeText !== null) {
        const biz = pickBusinessEmail(homeText) // 본인 페이지 = 본인 연락처(네이버 홈 보강과 같은 기준)
        const c = extractContacts(homeText)
        const extLinks = c.links.filter(u => !isSelfBlogLink(u)) // 자기 글 링크는 연락처가 아니다
        if ((biz && !r.email) || (c.instagram[0] && !r.instagram) || (extLinks.length && !r.links)) diag.contacts++
        if (biz && !r.email) diag.emails = (diag.emails || 0) + 1
        if (biz) { sets.push('email = COALESCE(email, ?)'); binds.push(biz); emailAfter = emailAfter || biz }
        if (c.instagram[0]) { sets.push('instagram = COALESCE(instagram, ?)'); binds.push(c.instagram[0]); instaAfter = instaAfter || c.instagram[0] }
        if (extLinks.length) { sets.push('links = COALESCE(links, ?)'); binds.push(extLinks.slice(0, 8).join(' ')) }
      }
      // 📇 홈에서 못 얻은 것만 **소개글**로 보강(추가 fetch 0). 글 본문(rssBody)은 **쓰지 않는다** —
      //   남의 연락처(협찬 문의처 등)가 섞여 발송 대상이 오염된다. 네이버 경로와 같은 규칙이다.
      if (rssIntro && (!emailAfter || !instaAfter)) {
        const biz = !emailAfter ? pickBusinessEmail(rssIntro) : null
        const ig = !instaAfter ? extractContacts(rssIntro).instagram[0] : null
        if (biz) { sets.push('email = COALESCE(email, ?)'); binds.push(biz); emailAfter = biz; diag.emails = (diag.emails || 0) + 1; diag.rss_emails = (diag.rss_emails || 0) + 1 }
        if (ig) { sets.push('instagram = COALESCE(instagram, ?)'); binds.push(ig); instaAfter = ig }
        if (biz || ig) diag.contacts++
      }

      let liveCat = classifyCategory(r.name || '', descForClass)
      if (!liveCat && rssBody) { liveCat = classifyCategoryByHits(rssBody); if (liveCat) diag.cat_body = (diag.cat_body || 0) + 1 }
      if (liveCat && !NON_CATEGORIES.has(liveCat)) {
        const finalCat = reconcileCategory(r.category, liveCat, null)
        if (finalCat) { sets.push('category = ?', `category_source = 'content'`); binds.push(finalCat) }
      }
      const posts30 = rssXml !== null ? countRecentPosts(extractPubDates(rssXml), Date.now()) : undefined
      if (posts30 !== undefined) {
        const { score } = scoreLead({
          platform: 'tistory', email: emailAfter, instagram: instaAfter, links: r.links,
          subscriber_count: r.subscriber_count, recent_posts_30d: posts30,
          recent_avg_views: null, median_long_views: null,
          category: r.category, is_brand: r.is_brand, consented_at: r.consented_at, source: r.source,
        })
        sets.push('lead_score = ?'); binds.push(score)
      }
      stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, r.id))
    }
  }
  await Promise.all(Array.from({ length: Math.min(TISTORY_CONCURRENCY, rows.length) }, () => worker()))
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  return diag
}

/**
 * 📗 **티스토리 회차 몫 — 0 으로 접었다** (2026-08-04, 대표 *"티스토리 접고"*).
 *
 * ## 하루 만에 뒤집힌 판단이라 근거를 남긴다
 * 이 경로는 **2026-08-03 에 이 세션이 만들었다**. 그때 근거는 *"495행이 미측정인데 측정 경로가
 * 아예 없다"* 였고, 초기 소표본에서 이메일 수율을 11.5% 로 봤다. **표본이 397건으로 커지자 3.0% 였다.**
 * ```
 *   측정완료 기준 이메일 수율     티스토리  3.0% (397 → 12)
 *                                네이버   26.7% (17,643 → 4,705)
 *                                유튜브   40.6% (4,858 → 1,974)
 *   최근 3일 유입 325행 → 이메일 0
 * ```
 * ⚠️ **경로가 고장난 게 아니다** — 측정은 정상 동작한다(397건 중 393건이 글 수, 392건이 링크 획득).
 *   티스토리 블로거가 **연락처를 안 거는 것**이고, 그건 코드로 못 고친다.
 *   ⇒ 회차당 4~6 서브리퀘스트를 1/9 수율에 쓰는 대신 네이버(26.7%)로 보낸다.
 *
 * ## 왜 코드를 지우지 않는가
 * `enrichTistoryActivity` 와 diag 는 그대로 둔다. 0 이면 **한 건도 안 돌지만**, 나중에
 * 추출기를 고치거나 티스토리 쪽이 바뀌면 이 상수 하나(또는 `ADS_TISTORY_ROOM`)로 즉시 되살아난다.
 * 삭제하면 되살리는 데 다시 하루가 든다 — 이 레포가 반복해 쓰는 가역성 원칙.
 *
 * 🔓 되살리는 법: env `ADS_TISTORY_ROOM=2`. 되살리기 전에 **왜 수율이 올랐는지 근거를 먼저** 볼 것.
 */
export const TISTORY_ROOM = 0

/** env 로 재배포 없이 되살릴 수 있게(0~5). 기본은 위 상수(=접힘). */
export function tistoryRoom(env: unknown): number {
  const raw = parseInt(String((env as { ADS_TISTORY_ROOM?: string } | undefined)?.ADS_TISTORY_ROOM ?? ''), 10)
  return Number.isFinite(raw) && raw >= 0 ? Math.min(5, raw) : TISTORY_ROOM
}
