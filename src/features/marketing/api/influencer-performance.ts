/**
 * 📈 2026-07-21 인플루언서 성과 지표 수집 (매시간 cron 잔여 예산으로 점진 보강).
 *   - 유튜브: **최근 영상 ≤10개의 평균 조회수·댓글수** (구독자수보다 정직한 협업 지표).
 *     비용: 채널당 playlistItems 1점 + videos.list 공유 1점 — units 예산(10k)의 유휴분 사용(검색 병목과 무관).
 *   - 네이버 블로그: 공식 조회수/댓글 API 없음(비공개) → **RSS 로 최근 30일 포스팅 수**(활동성)가 합법 최선.
 *   perf_checked_at 스탬프로 재시도 폭주 방지(실패도 스탬프 — 다음 대상으로 진행).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { OpBudget } from './maintenance-budget'
import type { Env } from '@/worker/types/env'
import { pickBusinessEmail, extractContacts, stripVideoTitles, isPlatformLabelEmail, type FetchBudget } from './influencer-discovery'
import { classifyCategory, classifyCategoryByHits, reconcileCategory, NON_CATEGORIES, shouldClearCategory } from './influencer-classify'
// 🧩 순수 파서는 `influencer-parse.ts` — 기존 import 경로 호환을 위해 재수출.
/** 🎯 키워드 연락처 성과 재계산 — 본체는 `influencer-keyword-yield.ts`(목적함수 근거가 거기 있다).
 *  여기서 재수출하는 이유: 이것도 *성과 재계산*이고, 호출부(`influencer-maintenance.ts`)가 600줄 캡에
 *  정확히 닿아 있어 import 한 줄을 더 넣을 수 없다. 기존 import 에 이름만 얹는다(동작 무관).
 */
export { recomputeKeywordContactYield } from './influencer-keyword-yield'

export { countRecentPosts, extractPubDates, extractRssTitles, parseNaverNeighborCount, naverPostdateToIso,
  avgStats, parseIsoDurationSec, SHORTS_MAX_SEC, medianOf, videoMetrics } from './influencer-parse'
import { countRecentPosts, extractPubDates, extractRssTitles, parseNaverNeighborCount, deriveNaverRssSignals, videoMetrics, parseIsoDurationSec } from './influencer-parse'
import { isSelfBlogLink } from './influencer-self-link'
import { runDdlOnce } from './ads-schema-guard'
import { deriveNaverHandle, naverBlogUrl } from './influencer-handle-heal'
import { noteCrawlStatus, naverCrawlBlocked, crawlBlockSnapshot, flushCrawlBlock } from './naver-crawl-block'
import { envSubreqCap, budgetedTimeoutMs, canStartBudgetedItem } from './collect-budget'

// 📧 이메일 판정 규칙(순수)은 `influencer-email-rules.ts` — 기존 import 경로 호환을 위해 재수출.
export { reextractEmail, correctedAboutEmail, PERSONAL_EMAIL_DOMAINS, personalEmailSqlClause, isPersonalEmail } from './influencer-email-rules'
import { correctedAboutEmail, reextractEmail } from './influencer-email-rules'

// ── 순수 계산(비디오 지표)은 `influencer-parse.ts` 로 이사(2026-07-29 — 이 파일 600줄 캡) · 아래에서 재수출.


// 성과 보강 전용 추가 컬럼(동결 ensureInfluencerSchema 무접촉 — 여기서 소유). 멱등·동시성 안전.
//   channel_published_at(개설일) + pub_checked_at(개설일 조회 시도 스탬프 — 응답없는 좀비채널 무한 재선택 방지)
//   + 📈 롱폼 중앙값(쇼츠 착시 배제)·쇼츠 비중 + 📝 블로거 마지막 글 날짜(검색 API postdate — RSS 차단 무관).
export const AD_PERF_DDL: string[] = [
  'ALTER TABLE ad_influencer_leads ADD COLUMN channel_published_at DATETIME',
  'ALTER TABLE ad_influencer_leads ADD COLUMN pub_checked_at DATETIME',
  'ALTER TABLE ad_influencer_leads ADD COLUMN median_long_views INTEGER',
  'ALTER TABLE ad_influencer_leads ADD COLUMN shorts_ratio INTEGER',
  'ALTER TABLE ad_influencer_leads ADD COLUMN last_post_at TEXT',
]
const _perfColPromise = new WeakMap<object, Promise<void>>()
/** 🧱 2026-07-28: 매 인보케이션 5 ALTER → 체크섬 1회 조회(무료 플랜 예산 회수 — D1 도 서브리퀘스트다).
 *  목록이 바뀌면 체크섬이 달라져 자동 재적용되므로 "버전 올리는 걸 잊어 컬럼이 안 생기는" footgun 이 없다. */
export function ensurePerfExtraColumns(DB: D1Database): Promise<void> {
  const c = _perfColPromise.get(DB); if (c) return c
  const p = runDdlOnce(DB, 'ads_ddl_influencer_perf', AD_PERF_DDL).then(() => undefined)
  _perfColPromise.set(DB, p); return p
}

export const YT_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * ⏱️ **이 단계가 쓸 시간이 끝났는가** — 예산(`budget.left`)과 **독립**인 두 번째 정지 조건.
 *
 * ## 왜 이게 따로 필요한가 (2026-07-29, 배포와 안 겹친 첫 클린 틱)
 * 보강 레인은 앞 단계(유튜브)에 **사전 마감**을 씌워 뒤에 선 블로거 레인의 시간 바닥을 보장한다
 * (`frontStageDeadline`, 기본 40%). 그런데 그 바닥이 실측에서 전혀 듣지 않았다:
 * ```
 *   14:00 틱 — 창 20,000ms · 앞 단계 사전 마감 12,000ms
 *   결과: elapsed 28,095ms · naver { selected: 12, tried: 0 } · spent 19/45
 * ```
 * 원인은 단순하다 — **바닥은 '마감'인데, 그 마감을 앞 단계가 한 번도 읽지 않았다.** 이 함수의 세 루프는
 * `budget.left` 만 보고 `budget.deadline` 은 안 봤다. 그래서 fetch 타임아웃 10s × 채널 수가 그대로
 * 창을 넘겼고, 블로거는 매 회차 **선택만 하고 한 명도 못 재고** 반환했다(예산은 26 이나 남긴 채).
 *
 * ⚠️ 시간으로 멈춘 건은 **예산으로 멈춘 건과 같은 취급**(`budgetSkipped`)이다 — 스탬프를 찍으면
 *    "측정했더니 0" 으로 각인돼 다음 순환에서 재선택 대상에서 빠진다(이 파일이 반복해 지켜온 불변식).
 */
export const outOfTime = (b: FetchBudget): boolean => !!b.deadline && Date.now() >= b.deadline

/** 🎯 YouTube topicDetails(구글 자체 주제분류, Wikipedia URL)를 우리 카테고리로 매핑 — 텍스트 파싱보다 신뢰도↑.
 *  구체적 주제 먼저. 없거나 매핑 불가면 null(호출부가 기존 category 유지). part=topicDetails 는 추가 쿼터 0. */
export function topicToCategory(topicUrls: string[] | undefined): string | null {
  const t = (topicUrls || []).join(' ')
  if (!t) return null
  if (/\/(Cosmetics|Beauty)\b/i.test(t)) return '뷰티'
  if (/\/Fashion\b/i.test(t)) return '패션'
  if (/\/(Food|Cooking)\b/i.test(t)) return '맛집'
  if (/\/Tourism\b/i.test(t)) return '여행'
  if (/\/Physical_fitness\b/i.test(t)) return '운동'
  if (/\/(Pet|Pets)\b/i.test(t)) return '반려동물'
  if (/\/Hobby\b/i.test(t)) return '취미'
  return null
}

// 📊 진단 타입은 `influencer-perf-types.ts` 로 분리(600줄 캡) — 호출부 무수정 위해 재수출.
//   ⚠️ 재수출(`export type ... from`)은 **로컬 스코프에 안 들어온다** — 아래에서 쓰므로 import 도 따로 한다.
// 📈 YT 성과는 `influencer-yt-performance.ts` 로 분리(600줄 래칫) — 호출부 무수정 위해 재수출.
//   ⚠️ 재수출은 **로컬 스코프에 안 들어온다** — 아래 runYtLiveRefetch 가 쓰므로 import 도 따로 한다
//     (바로 아래 NaverEnrichDiag 재수출이 같은 이유로 같은 짝을 두고 있다).
export { enrichYouTubePerformance } from './influencer-yt-performance'
import { enrichYouTubePerformance } from './influencer-yt-performance'
export type { NaverEnrichDiag } from './influencer-perf-types'
import type { NaverEnrichDiag } from './influencer-perf-types'

/**
 * 네이버 블로거 활동성+정보 보강 — RSS(30일 포스팅 수·최근 글 제목) + 홈 HTML(이웃수·프로필 연락처).
 *   🛡️ 2026-07-27 재작성(대표 "블로그 부정확 — 정보 더 수집"):
 *   ① **실패≠0글**: 기존엔 fetch 실패도 `recent_posts_30d=0`+스탬프 → 활발한 블로거가 "月0글"로 영구 각인
 *      (스크린샷 실사고 — 검색에 방금 글이 잡힌 블로거들이 전부 0글). 이제 RSS 성공 시에만 포스팅 수 기록.
 *   ② **순환 재측정**: 선택을 '미측정만'→'가장 오래전에 시도한 순'(라운드로빈)으로 — 과거 0-각인 행이
 *      가장 오래된 스탬프라 자동으로 맨 앞에서 재측정(별도 힐 불필요) + 활동성이 주기적으로 신선해짐.
 *   ③ **프로필 연락처**: 이미 받는 홈 HTML 에서 이웃수뿐 아니라 이메일/인스타/링크도 추출(추가 fetch 0,
 *      빈칸만 COALESCE — 프로필은 블로거 본인 페이지라 본인 연락처).
 *   ④ **글 제목 → 카테고리 신호**: RSS 최근 글 제목을 description 꼬리(` | 글: …`)에 갱신 —
 *      야간 재분류가 실제 콘텐츠로 판정(검색 스니펫 1건 상속보다 정확).
 */
/**
 * 🏠 블로그 **홈 HTML 을 받을 가치가 있는가** — 순수 판정(테스트 가능).
 *
 * ## 왜
 * 홈에서 얻는 건 넷뿐이고(이웃수·이메일·인스타·링크) **저장은 전부 빈칸 채움**이다
 * (`COALESCE(email, ?)` · `CASE WHEN subscriber_count > 0 THEN subscriber_count ELSE ?`).
 * 즉 넷이 이미 다 차 있으면 홈 응답은 **통째로 버려진다** — 그런데 서브리퀘스트는 소비된다.
 *
 * 서브리퀘스트가 이 파이프라인의 천장이다(라운드 실측 `spent 44/45` = 예산 소진으로 끝남).
 * 버려질 fetch 하나를 안 쓰면 그 예산이 **아직 아무것도 없는 리드**에게 간다.
 * 이건 추정이 아니라 저장 규칙에서 바로 따라 나오는 사실이라, 라운드 병목의 원인과 무관하게 맞다.
 *
 * ⚠️ 하나라도 비어 있으면 받는다 — 보수적으로. "이미 충분해 보인다"로 정보 수집을 줄이지 않는다.
 */
export function naverHomeUseful(r: {
  email?: string | null; instagram?: string | null; links?: string | null; subscriber_count?: number | null
}): boolean {
  return !r.email || !r.instagram || !r.links || !((r.subscriber_count || 0) > 0)
}

import { sliceClause, type EnrichSlice } from './enrich-slice'
export { sliceClause, type EnrichSlice } from './enrich-slice' // 기존 import 경로 유지

export async function enrichNaverActivity(DB: D1Database, budget: FetchBudget, max: number, slice?: EnrichSlice | null): Promise<NaverEnrichDiag> {
  const diag: NaverEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0, emails: 0 }
  if (max <= 0 || budget.left <= 1) return diag
  // 🩹 `handle IS NOT NULL` 만으로는 부족하다 — 손상 행은 handle 이 `'blog.naver.com'`(호스트)이라 이 조건을
  //    통과한 뒤 아래에서 전량 스킵됐다. channel_id/url 을 함께 읽어 그 자리에서 진짜 id 를 되살린다.
  type NaverRow = { id: number; handle: string | null; channel_id: string | null; url: string | null; email: string | null; instagram: string | null; links: string | null; description: string | null
    name: string | null; category: string | null; category_source: string | null; subscriber_count: number | null; is_brand: number | null; consented_at: string | null; source: string | null; recent_avg_views: number | null; median_long_views: number | null }
  let rows: NaverRow[] = []
  try {
    const sl = sliceClause(slice)
    const res = await DB.prepare(`SELECT id, handle, channel_id, url, name, email, instagram, links, description, category, category_source, subscriber_count, is_brand, consented_at, source, recent_avg_views, median_long_views FROM ad_influencer_leads      WHERE account_id = 0 AND platform = 'naver_blog'${sl.sql}
      ORDER BY perf_checked_at ASC LIMIT ?`).bind(...sl.binds, Math.min(max, 30)).all<NaverRow>()
    // ⬆️ 2026-07-29: `(perf_checked_at IS NULL) DESC, perf_checked_at ASC` 를 `perf_checked_at ASC` 로 —
    //   SQLite 는 NULL 을 가장 작은 값으로 보므로 ASC 가 이미 **미측정 우선**이다(정렬 결과 동일).
    //   식(expression)이 앞에 있으면 인덱스로 정렬을 만족시키지 못해 매 라운드 계정 전체(38k행)를 스캔·정렬했다.
    //   `idx_ad_inf_leads_perf(account_id, platform, perf_checked_at)` 와 형태를 맞춰 읽기를 LIMIT 만큼으로 떨어뜨린다.
    rows = res?.results || []
  } catch (err) {
    // 삼키면 `selected:0` 이 되어 '큐가 빔'과 구분이 사라진다 — 이 레인이 tried:0 으로 멈춰 있던 동안
    // 원인 규명이 막혔던 이유가 정확히 이 종류의 무음이었다.
    diag.query_error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}`
    return diag
  }
  diag.selected = rows.length
  if (!rows.length) return diag
  // 🏅 재채점 함수는 **동적 import**(루프 밖 1회) — `influencer-quality` 가 이 파일의 isPersonalEmail 을
  //   import 하므로 정적 import 는 순환이 된다. 상대경로 동적 import 는 레포 규칙상 허용되는 형태.
  const { scoreLead } = await import('./influencer-quality')
  const HOME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  // 타입 명시 필수 — 아래 push 가 워커 클로저 안에서 일어나 추론이 안 된다(동시화 이전엔 같은 스코프라 추론됐다).
  const stmts: ReturnType<D1Database['prepare']>[] = []
  /**
   * 🏃 **블로거 단위 동시 처리**(2026-07-29) — 라운드가 예산을 남긴 채 시간에 끊기던 것.
   *
   *   실측(08:00 라운드): `selected 12 · tried 3 · spent 25/45 · deadline_hit true · elapsed 20.3s`.
   *   즉 **예산의 44%를 못 쓰고** 벽시계로 끝났다. 건당 두 fetch 는 이미 병렬인데(아래) 블로거는
   *   한 명씩 순차라, 네이버 응답이 건당 ~6.8s 면 20s 안에 3명이 천장이다. 예산이 아니라 **직렬화**가
   *   병목이었다 — 같은 서브리퀘스트로 처리량만 버리고 있었다.
   *
   *   ⚠️ 동시성 3 으로 **보수적**으로 잡는다: 우리가 때리는 호스트는 둘(rss./m.blog.naver.com)이고
   *   호스트당 동시 연결을 과하게 올리면 차단·지연으로 되돌아온다 — 그건 처리량을 늘리는 게 아니라
   *   레인을 통째로 죽이는 방향이다. 3 이면 호스트당 3 으로, 흔한 6-per-host 한도 아래에 머문다.
   *   (더 올리기 전에 `failed` 카운터가 안 오르는지부터 확인할 것 — 추측으로 올리면 조용히 악화된다.)
   *
   *   ✅ 예산 정합: 아래 [잔량 검사 → 차감] 사이에 `await` 가 없다(전부 동기 구문). JS 는 단일 스레드라
   *   그 구간이 원자적으로 실행되므로 동시 워커가 같은 잔량을 두 번 쓰는 초과 지출이 생기지 않는다.
   */
  const NAVER_CONCURRENCY = 3
  let cursor = 0
  const worker = async (): Promise<void> => {
   for (;;) {
    // ⏱️ 예산 또는 **벽시계** 소진 — 블로그 fetch 는 건당 최대 8s(RSS·홈 병렬)라 예산이 남아도 시간이 먼저 끝난다.
    //   (2026-07-28 파트너풀 레인의 deadline 가드와 같은 이유 — 죽는 대신 여기까지 쓰고 깨끗이 넘긴다.)
    // 🔴 **바닥값을 줄 수 없으면 아예 안 집는다** (2026-08-02). 근거·실측은 `canStartBudgetedItem` 정의부.
    //   요약: 마감을 *지났을 때만* 멈추던 옛 판은 잔여 1~1,499ms 에 집은 항목에 바닥값 1.5s 를 줘서
    //   **확정 초과 → 실패 → 데이터 없이 `perf_checked_at` 도장**(22,000 깊이 큐 뒤로 밀림)을 만들었다.
    //   실측 03:00 회차 `tried 9 / failed 3` = 동시성 3(워커마다 마지막 1건). 안 집으면 NULL 로 남아
    //   다음 라운드가 온전한 창으로 다시 집는다(라운드마다 새 인보케이션 = 새 마감).
    //   ⚠️ 처리량 증가가 아니라 **`failed` 를 진짜 신호로 되돌리는** 변경이다 — 위 NAVER_CONCURRENCY
    //   주석의 "올리기 전에 failed 부터 확인하라"가 그동안 마감 아티팩트에 오염돼 쓸 수 없었다.
    if (budget.left <= 1) return
    if (!canStartBudgetedItem(budget.deadline)) { diag.window_skipped = (diag.window_skipped || 0) + 1; return }
    const r = rows[cursor++]
    if (!r) return
    // 🩹 손상 핸들 자가복구 — 일괄 힐(healNaverHandles)이 전수를 도는 데 몇 시간 걸리므로, 레인이 만나는
    //    행은 그 자리에서 살린다. 되살리면 handle/url 을 함께 고쳐 다음부터는 손상 상태로 안 돌아온다.
    const handle = deriveNaverHandle(r)
    if (!handle) { // channel_id/url 어디에도 id 가 없다 — 측정 불가 확정, 스탬프만(재선택 뒤로)
      diag.skipped = (diag.skipped || 0) + 1
      stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET perf_checked_at = datetime('now') WHERE id = ?`).bind(r.id))
      continue
    }
    if (handle !== r.handle) {
      diag.healed = (diag.healed || 0) + 1
      stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET handle = ?, url = ? WHERE id = ?`).bind(handle, naverBlogUrl(handle), r.id))
    }
    diag.tried++
    // ①② RSS(포스팅 수·글 제목·마지막 글) + 홈 HTML(이웃수·프로필 연락처) — **병렬**.
    //   ⏱️ 2026-07-28: 두 요청은 서로의 결과를 안 쓰는데 직렬로 기다리고 있었다(건당 최대 8+8=16s).
    //   라운드는 벽시계 20s 가 상한이라 직렬이면 **한 라운드에 1~2명**밖에 못 재고, cron 도 라운드를
    //   6회 예약해 놓고 2회에서 시간이 끝난다(라이브 실측: 라운드 13.8s / 9.1s 후 정지).
    //   병렬로 바꾸면 건당 상한이 8s — 같은 서브리퀘스트 수로 처리량이 배가 된다.
    // 예산이 1 남으면 RSS(활동성)를 우선 — 연락처보다 측정이 먼저다.
    // + 홈이 **아무것도 못 채우는** 리드면 아예 안 받는다(아래 naverHomeUseful — 순수 낭비 제거).
    const wantHome = budget.left >= 2 && naverHomeUseful(r)
    if (!wantHome && budget.left >= 2) diag.home_skipped = (diag.home_skipped || 0) + 1
    budget.left -= wantHome ? 2 : 1
    // ⏱️ 타임아웃은 **남은 창에서 유도**한다(상수 8s 금지 — 6.9초에 집은 항목이 14.9초에 끝나면
    //   부모(≈10.5s)가 이미 없어 이 라운드가 통째로 기록조차 안 남는다). 근거: collect-budget.ts.
    const itemTimeout = budgetedTimeoutMs(budget.deadline, 8000)
    const [rssXml, homeText] = await Promise.all([
      (async (): Promise<string | null> => {
        try {
          const res = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(handle)}.xml`, { signal: AbortSignal.timeout(itemTimeout) })
          noteCrawlStatus(res.status) // 🚧 429/403 만 차단으로 샌다 — 근거·한계는 naver-crawl-block.ts
          if (res.ok) return (await res.text()).slice(0, 120_000)
          if (res.status === 404 || res.status === 410) return '' // 블로그 삭제/비공개 — "측정 성공·글 0"(터미널)
        } catch { noteCrawlStatus(null) /* 예외=상대 무응답. 차단의 증거도 회복의 증거도 아니다 */ }
        return null
      })(),
      (async (): Promise<string | null> => {
        if (!wantHome) return null
        try {
          const hr = await fetch(`https://m.blog.naver.com/${handle}`, { signal: AbortSignal.timeout(itemTimeout), headers: { 'user-agent': HOME_UA, accept: 'text/html' }, redirect: 'follow' })
          noteCrawlStatus(hr.status)
          if (hr.ok) return (await hr.text()).slice(0, 80_000)
        } catch { noteCrawlStatus(null) /* fail-soft */ }
        return null
      })(),
    ])
    if (rssXml === null && homeText === null) {
      diag.failed++
      // 🚧 **차단이면 스탬프를 찍지 않는다** (2026-08-04). 실패에 스탬프를 찍는 건 "이 블로그가 문제"일 때
      //   큐를 전진시키려는 것인데, 막힌 건 우리다 — 그대로 찍으면 ① 백로그가 한 바퀴 통째로 소모되고
      //   ② `perf_checked_at` 이 `nb_measured`(연락처 수율의 **분모**)를 부풀려 `suppressLowRotationYield`
      //   가 멀쩡한 키워드를 "나쁘다"고 학습한다. 그 학습은 차단이 풀려도 안 돌아온다(억제되면 증거가
      //   갱신되지 않으므로). NULL 로 남기면 다음 회차가 온전한 창으로 다시 집는다.
      if (naverCrawlBlocked()) { diag.blocked = (diag.blocked || 0) + 1; return }
      stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET perf_checked_at = datetime('now') WHERE id = ?`).bind(r.id))
      continue
    }
    const sets: string[] = [`perf_checked_at = datetime('now')`]
    const binds: (string | number)[] = []
    let descForClass = r.description || '' // 🏷️ 재분류용 본문 — 아래에서 최신 글 제목으로 갱신되면 그 값을 쓴다
    let rssIntro = ''   // 채널 소개글(본인 작성) — 연락처 보강에 **안전한** 유일한 RSS 출처
    let rssBody = ''    // 글 본문 묶음 — **분류 전용**(남의 연락처가 섞임)
    if (rssXml !== null) {
      diag.measured++
      const pubDates = extractPubDates(rssXml)
      sets.push('recent_posts_30d = ?'); binds.push(countRecentPosts(pubDates, Date.now()))
      const newest = pubDates.map(d => Date.parse(d)).filter(Number.isFinite).sort((a, b) => b - a)[0]
      if (newest) { sets.push(`last_post_at = CASE WHEN last_post_at IS NULL OR last_post_at < ? THEN ? ELSE last_post_at END`); binds.push(...[new Date(newest).toISOString().slice(0, 10), new Date(newest).toISOString().slice(0, 10)]) }
      // 🎁 같은 응답에서 뽑을 수 있는 걸 전부 뽑는다(추가 fetch 0) — 제목 + 블로거 자기분류 + 블로그 소개글 + 본문.
      const sig = deriveNaverRssSignals(rssXml, r.description || '')
      if (sig.cats.length) diag.rss_cat = (diag.rss_cat || 0) + 1
      if (sig.intro) diag.rss_intro = (diag.rss_intro || 0) + 1
      if (sig.description) { descForClass = sig.description; sets.push('description = ?'); binds.push(sig.description) }
      rssIntro = sig.intro; rssBody = sig.body
    }
    let emailAfter = r.email
    let instaAfter = r.instagram
    // 🐛 2026-07-29: 아래 재채점이 email/instagram 은 **갱신 후** 값을 쓰면서 이웃수만 갱신 *전* 값을 썼다.
    //   방금 측정한 이웃수를 자기 점수에 반영하지 못해, 이웃 3,000+ 블로거가 규모 22 대신 13(미측정 기본)으로
    //   채점된다 — 9점 손해가 야간 정비(커서 4,500/일 → 최대 8일)까지 그대로 남는다. 대표가 점수순으로
    //   연락 대상을 고르므로, 하필 **방금 측정된 신선한 리드**가 뒤로 밀리는 방향의 오차다.
    let subsAfter = r.subscriber_count
    if (homeText !== null) {
      const neighbors = parseNaverNeighborCount(homeText)
      if (neighbors > 0) { sets.push('subscriber_count = CASE WHEN subscriber_count > 0 THEN subscriber_count ELSE ? END'); binds.push(neighbors); if (!subsAfter || subsAfter <= 0) subsAfter = neighbors }
      const biz = pickBusinessEmail(homeText) // 프로필/위젯 = 본인 페이지 — 본인 연락처(discovery 홈 보강과 동일 기준)
      const c = extractContacts(homeText)
      /**
       * 🔗 **자기 블로그 URL 은 연락처가 아니다**(2026-07-29 실측).
       *   `extractContacts` 의 blog-URL 수집은 *유튜버*에겐 크로스플랫폼 발자국이라 값지지만,
       *   네이버 블로거에겐 자기 글 링크일 뿐이다. 실측: 이메일 없는 블로거 303명 중 **295명이 links 보유**
       *   인데 내용은 m.blog.naver.com(1,997)·blog.naver.com(292) — 외부 링크는 **3개**뿐이었다.
       *   ⚠️ 두 가지가 망가진다: ① '연락처 보유'와 '새 연락처 획득률'이 부푼다(판단 근거로 쓰던 수치다)
       *   ② 저장이 `COALESCE(links, ?)` 라 **한번 자기링크로 채워지면 나중에 찾은 진짜 외부 링크가 영영
       *   안 들어간다** — 노이즈가 실제 연락처를 막는다.
       */
      const extLinks = c.links.filter(u => !isSelfBlogLink(u)) // 판정 SSOT: influencer-self-link
      if ((biz && !r.email) || (c.instagram[0] && !r.instagram) || (extLinks.length && !r.links)) diag.contacts++
      if (biz && !r.email) diag.emails = (diag.emails || 0) + 1
      if (biz) { sets.push('email = COALESCE(email, ?)'); binds.push(biz); emailAfter = emailAfter || biz }
      if (c.instagram[0]) { sets.push('instagram = COALESCE(instagram, ?)'); binds.push(c.instagram[0]); instaAfter = instaAfter || c.instagram[0] }
      if (extLinks.length) { sets.push('links = COALESCE(links, ?)'); binds.push(extLinks.slice(0, 8).join(' ')) }
    }
    // 🏷️ **측정한 그 자리에서 재분류**(2026-07-29) — 추가 fetch 0.
    //   배경: 풀의 74%(28,673명)가 네이버 블로거인데 이들의 업종은 거의 전부 **수집 키워드 상속**이다
    //   (실측 `cat_keyword 30,747` vs `cat_content 5,251`). "강남 맛집"으로 발굴됐다고 맛집 블로거인 건
    //   아니다 — 서비스몰이 파는 것이 **지역×업종 맞춤 매칭**이라 이 축이 틀리면 이행 품질이 무너진다.
    //   유튜브 경로는 이미 About 으로 재분류하는데(reconcileCategory) 네이버만 빠져 있었다.
    //   방금 받은 최신 글 제목이 블로거가 실제로 쓰는 주제라 키워드 상속보다 훨씬 정직한 신호다.
    //   ⚠️ live 가 null 이면 기존 값을 유지한다(reconcile 규칙 동일) — 못 알아본 것을 '없음'으로 덮지 않는다.
    // 📇 홈에서 못 얻은 것만 **블로그 소개글**로 보강 — 추가 fetch 0(이미 받은 RSS).
    //   ⚠️ 소개글은 본인이 쓴 프로필이라 홈 프로필과 신뢰도가 같다. 글 본문(rssBody)은 **쓰지 않는다** —
    //      협찬 문의처·업체 정보 등 남의 연락처가 섞여 발송 대상이 오염된다.
    if (rssIntro && (!emailAfter || !instaAfter)) {
      const biz = !emailAfter ? pickBusinessEmail(rssIntro) : null
      const ig = !instaAfter ? extractContacts(rssIntro).instagram[0] : null
      if (biz) { sets.push('email = COALESCE(email, ?)'); binds.push(biz); emailAfter = biz; diag.emails = (diag.emails || 0) + 1; diag.rss_emails = (diag.rss_emails || 0) + 1 }
      if (ig) { sets.push('instagram = COALESCE(instagram, ?)'); binds.push(ig); instaAfter = ig }
      if (biz || ig) diag.contacts++
    }
    let liveCat = classifyCategory(r.name || '', descForClass)
    // 🔢 이름·소개글·제목 어디에도 신호가 없을 때만 **글 본문 빈도**로 폴백(덮어쓰기 아님 — 빈칸 채움).
    if (!liveCat && rssBody) { liveCat = classifyCategoryByHits(rssBody); if (liveCat) diag.cat_body = (diag.cat_body || 0) + 1 }
    if (liveCat && !NON_CATEGORIES.has(liveCat)) {
      const finalCat = reconcileCategory(r.category, liveCat, null)
      if (finalCat) { sets.push('category = ?', `category_source = 'content'`); binds.push(finalCat) }
    }
    // 🏅 측정한 그 자리에서 재채점(2026-07-29) — 활동성(최대 25점)은 `recent_posts_30d` 에서 오는데,
    //   블로거는 핸들 손상으로 그동안 **전원 미측정 = activity 0점**이었다(실측: 블로거 최고 33점,
    //   전체 70+ 는 사실상 유튜브뿐). 그래서 점수순 목록에서 블로거가 구조적으로 뒤로 밀렸다.
    //   측정이 시작돼도 재채점이 야간 정비(커서 4,500/일)뿐이면 반영까지 최대 8일 — 그 사이 대표가
    //   뽑는 "연락 대상" 정렬이 계속 틀린다. 방금 얻은 값으로 여기서 갱신한다(추가 조회 0).
    const posts30 = rssXml !== null ? countRecentPosts(extractPubDates(rssXml), Date.now()) : (undefined as number | undefined)
    if (posts30 !== undefined) {
      const { score } = scoreLead({
        platform: 'naver_blog', email: emailAfter, instagram: instaAfter, links: r.links,
        subscriber_count: subsAfter, recent_posts_30d: posts30,
        recent_avg_views: r.recent_avg_views, median_long_views: r.median_long_views,
        category: r.category, is_brand: r.is_brand, consented_at: r.consented_at, source: r.source,
      })
      sets.push('lead_score = ?'); binds.push(score)
    }
    stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, r.id))
   }
  }
  await Promise.all(Array.from({ length: Math.min(NAVER_CONCURRENCY, rows.length) }, () => worker()))
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  // 🚧 차단 관측을 일별로 남긴다(관측 0이면 왕복 0). `crawl_block.tripped` 가 참인 회차는 **측정치가 아니라
  //   사고 기록**이다 — 수율이 떨어졌다고 키워드를 탓하기 전에 이 값을 먼저 볼 것.
  Object.assign(diag, { crawl_block: crawlBlockSnapshot() })
  await flushCrawlBlock(DB, Date.now())
  return diag
}

/**
 * 🔄 유튜브 라이브 재조회(수동) — 저장된 소개글이 아니라 **현재 라이브 About 을 다시 불러** 이메일/카테고리/성과를 갱신.
 *   대표 신고(티벳동생): 저장값은 수집 당시 영상설명의 대행사 메일인데 현재 About 엔 개인메일 — 재추출(저장데이터)로는
 *   못 고치고, 라이브 About 재조회가 필요. enrichYouTubePerformance 를 refresh 모드로 여러 패스 —
 *   **이미 수집됐어도 개인메일이 아직 없는 채널**(NULL·대행사)을 오래된 조회순으로 재선택해(진행 모드는 미수집만 보므로
 *   티벳동생처럼 이미 처리된 채널엔 안 닿던 게 근본 원인) correctedAboutEmail 이 라이브 About 개인메일로 교정 + topicDetails 카테고리 채움.
 *   YouTube units 사용(검색 쿼터와 무관 — channels/videos.list). passes×20 채널.
 */
export async function runYtLiveRefetch(env: Env, passes = 3): Promise<{ processed: number }> {
  // 🧱 플랫폼 천장(2026-07-29) — env 값이 얼마든 인보케이션 한도를 넘을 수 없다. 넘으면 후반 fetch 가
  //   조용히 전멸하고(잡히는 예외 없이) 그 사실이 어디에도 안 남는다. collect-budget.ts 주석(기본 60·근거) 참조.
  const budget: FetchBudget = { left: Math.min(envSubreqCap(env), 250) }
  let processed = 0
  for (let i = 0; i < Math.max(1, Math.min(10, passes)) && budget.left > 5; i++) {
    const n = await enrichYouTubePerformance(env.YOUTUBE_API_KEY, env.DB, budget, 20, 'refresh').catch(() => 0)
    processed += n
    if (n === 0) break // 더 처리할 대상 없음
  }
  return { processed }
}

/**
 * 🧭 카테고리 전체 재보정(라이브·초경량) — 유튜브 카테고리는 채널당 무거운 호출 없이 **channels.list 50개 배치**
 *   (part=snippet,topicDetails)만으로 라이브 About + YouTube 자체분류를 받아 reconcileCategory 로 교정.
 *   전 YT 풀(수천)도 ≈ N/50 호출(4,200개 ≈ 85콜, 하루 쿼터 10k 의 <1%) → **버튼 한 번에 전 풀 재보정**(waitUntil 백그라운드).
 *   반복 클릭·수백 클릭 불필요. 멱등(같은 결과 재적용 무해). 0-views/perf 힐과 무관(그건 채널당 호출이라 별도).
 */
export async function runCategoryRescan(env: Env, opts?: { maxChannels?: number }): Promise<{ scanned: number; changed: number; confirmed: number }> {
  const apiKey = env.YOUTUBE_API_KEY
  if (!apiKey) return { scanned: 0, changed: 0, confirmed: 0 }
  const DB = env.DB
  await ensurePerfExtraColumns(DB)
  // 🛡️ 2026-07-23 전수조사: 이 함수만 fetch 예산·진행 커서가 없어 20k 풀에서 무제한 fetch → 인보케이션 중도 사망 시
  //   조용히 앞부분만 처리되고, OFFSET 재시작이라 **재클릭해도 항상 같은 앞부분만** 도달하던 결함 수리:
  //   ① 호출 상한(MAX_CALLS — 서브리퀘스트 한도 내 안전) ② platform_settings 영속 id-커서(중단 지점 이어받기, 끝 도달 시 0 리셋).
  const CAP = Math.max(1, Math.min(opts?.maxChannels ?? 12000, 20000))
  const MAX_CALLS = 220 // channels.list 호출 상한/실행 — 50개 배치라 실행당 최대 1.1만 채널(부족분은 커서가 이어받음)
  const CURSOR_KEY = 'ads_catrescan_cursor'
  const { readSetting, writeSetting } = await import('./influencer-auto-collect')
  let afterId = Math.max(0, parseInt((await readSetting(DB, CURSOR_KEY)) || '0', 10) || 0)
  let scanned = 0, changed = 0, confirmed = 0, calls = 0, reachedEnd = false
  while (scanned < CAP && calls < MAX_CALLS) {
    const rows = (await DB.prepare(`SELECT id, channel_id, name, category, category_source FROM ad_influencer_leads
        WHERE account_id = 0 AND platform = 'youtube' AND channel_id IS NOT NULL AND id > ?
        ORDER BY id ASC LIMIT 1000`).bind(afterId)
      .all<{ id: number; channel_id: string; name: string | null; category: string | null; category_source: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { reachedEnd = true; break }
    for (let i = 0; i < rows.length && scanned < CAP && calls < MAX_CALLS; i += 50) {
      const batch = rows.slice(i, i + 50)
      calls++
      const res = await fetch(`${YT_BASE}/channels?part=snippet,topicDetails&id=${batch.map(r => r.channel_id).join(',')}&maxResults=50&key=${apiKey}`,
        { signal: AbortSignal.timeout(10000) }).catch(() => null)
      const json = res?.ok ? await res.json().catch(() => null) as { items?: { id?: string; snippet?: { description?: string }; topicDetails?: { topicCategories?: string[] } }[] } | null : null
      // 호출 실패 배치는 About/topic 맵이 비어 reconcile 이 저장값 그대로 반환 → write 0 (자연 no-op, 다음 순회 때 재시도).
      const aboutById = new Map<string, string>(), topicById = new Map<string, string>()
      for (const it of json?.items || []) {
        if (it.id && it.snippet?.description) aboutById.set(it.id, it.snippet.description)
        if (it.id) { const tc = topicToCategory(it.topicDetails?.topicCategories); if (tc) topicById.set(it.id, tc) }
      }
      const ups = batch
        .map(r => {
          const live = classifyCategory(r.name || '', aboutById.get(r.channel_id) || '')
          const topic = topicById.get(r.channel_id) || null
          const finalCat = reconcileCategory(r.category, live, topic)
          // 🏷️ 채택 근거 — 라이브 About 규칙이면 content, 유튜브 자체분류면 topic, 유지/기타는 기존 근거 보존(null=미기록).
          const src = finalCat == null ? null : finalCat === live ? 'content' : finalCat === topic ? 'topic' : undefined
          // ✅ 2026-07-28 확인분 — 카테고리는 그대로인데 **라이브 신호가 그 값을 확증**한 경우.
          //   이전엔 변경분만 write 해서, 키워드 상속 카테고리가 *맞다고 확인돼도* category_source 가 'keyword' 로
          //   남았다 → 어드민 "근거 검증됨 7%"가 재보정을 아무리 돌려도 안 움직임(재검증은 실제로 되는데 계측만 거짓).
          //   이미 content/topic 으로 검증된 행은 제외 — 매 순회 같은 값 재기록 방지.
          const alreadyVerified = r.category_source === 'content' || r.category_source === 'topic'
          const confirmOnly = finalCat === r.category && !!src && !alreadyVerified
          return { id: r.id, finalCat, prev: r.category, src, confirmOnly }
        })
        .filter(x => x.finalCat !== x.prev || x.confirmOnly)
      if (ups.length) {
        await DB.batch(ups.map(x => x.src === undefined
          ? DB.prepare('UPDATE ad_influencer_leads SET category = ? WHERE id = ? AND account_id = 0').bind(x.finalCat, x.id)
          : DB.prepare('UPDATE ad_influencer_leads SET category = ?, category_source = ? WHERE id = ? AND account_id = 0').bind(x.finalCat, x.src, x.id))).catch(() => null)
        // 교정(changed)과 확증(confirmed)은 의미가 달라 따로 센다 — 리포트가 "몇 개 고쳤나"를 부풀리지 않게.
        for (const x of ups) { if (x.confirmOnly) confirmed++; else changed++ }
      }
      scanned += batch.length
      afterId = batch[batch.length - 1].id
      await writeSetting(DB, CURSOR_KEY, String(afterId)) // 배치마다 전진 — 중도 사망해도 다음 실행이 정확히 이어받음
    }
    if (rows.length < 1000 && scanned >= 0 && calls < MAX_CALLS) { reachedEnd = true; break }
  }
  if (reachedEnd) await writeSetting(DB, CURSOR_KEY, '0') // 한 바퀴 완료 — 다음 클릭은 처음부터(멱등 재보정)
  return { scanned, changed, confirmed }
}

/** 🏷️ 풀 카테고리 재분류(백필, 멱등) — 콘텐츠 신호로 교정 + 레거시 '자동'/'일반' → NULL 정리. */
// ⏱️ 풀 전수 스캔 작업 상한(순수)은 `pool-scan-budget.ts` — 기존 import 경로 호환을 위해 재수출.
export { poolScanShouldStop, POOL_SCAN_MAX_ROWS, POOL_SCAN_MAX_MS } from './pool-scan-budget'
import { poolScanShouldStop } from './pool-scan-budget'

export async function runReclassifyPool(DB: D1Database, opts?: { budget?: OpBudget }): Promise<{ scanned: number; changed: number; stamped: number; done: boolean }> {
  // 🧭 2026-07-28: OFFSET 전수스캔 → **id 커서**. 무료 플랜 예산(인보케이션당 ~29 D1 연산)에선 한 번에
  //   3.6만 행을 못 돈다 — 커서가 없으면 매 실행이 늘 같은 앞부분만 훑고 뒤쪽은 영원히 미분류로 남는다
  //   (품질 패스가 이미 쓰는 패턴과 동일: 끝까지 돌면 0 으로 리셋해 순환 재검증).
  const CURSOR_KEY = 'ads_reclassify_cursor'
  const PAGE = 3000
  let cursor = 0
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (raw?.value) cursor = Math.max(0, parseInt(raw.value, 10) || 0)

  let scanned = 0, changed = 0, stamped = 0, done = false
  const startedMs = Date.now()   // ⏱️ 인보케이션당 작업 상한(위 poolScanShouldStop) — CPU 한도 초과 방지
  for (;;) {
    const rows = (await DB.prepare(`SELECT id, name, description, category, category_source FROM ad_influencer_leads
        WHERE account_id = 0 AND id > ? ORDER BY id ASC LIMIT ?`).bind(cursor, PAGE)
      .all<{ id: number; name: string; description: string | null; category: string | null; category_source: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    const pageStart = cursor
    scanned += rows.length
    const ups: ReturnType<D1Database['prepare']>[] = []
    let pageStamped = 0   // 이 페이지에서 '근거만' 찍은 수 — changed 와 섞지 않기 위해 따로 센다
    for (const r of rows) {
      cursor = Math.max(cursor, r.id)
      const byContent = classifyCategory(r.name, r.description)
      if (byContent && byContent !== r.category) ups.push(DB.prepare("UPDATE ad_influencer_leads SET category = ?, category_source = 'content' WHERE id = ? AND account_id = 0").bind(byContent, r.id))
      /**
       * 🔖 **값이 같아도 근거는 찍는다** (2026-08-03 라이브 실측).
       *
       *   본문 분류가 기존 값과 **일치**하면 이전 판은 아무것도 안 썼다. 그래서 "본문으로 확인됐다"는
       *   사실이 기록되지 않고 `category_source` 가 NULL 로 남았고, 어드민 통계는 그걸 **키워드 폴백으로**
       *   센다. 실측: 근거 NULL 19,595행(그중 19,297행이 소개글 보유) — 분류 품질이 실제보다 나빠 보였다.
       *   ⇒ 확인 사실을 남긴다. 값은 안 바꾸므로 **분류 결과에 영향 0**, 통계만 진실에 가까워진다.
       *   ⚠️ `changed`(값이 바뀐 수)와 **따로 센다** — 섞으면 "규칙이 얼마나 고치고 있나"를 못 본다.
       */
      else if (byContent && r.category_source !== 'content') { ups.push(DB.prepare("UPDATE ad_influencer_leads SET category_source = 'content' WHERE id = ? AND account_id = 0").bind(r.id)); pageStamped++ }
      // 🧹 값이 안 나와도 **현재 규칙이 그 값을 거부한다는 걸 아는 경우**엔 지운다(shouldClearCategory 참조).
      //   안 지우면 옛 규칙으로 붙은 값이 영구히 굳는다 — 실측: 입주업체 27명 중 21명이 그 상태였다.
      else if (!byContent && shouldClearCategory(r.category, r.name, r.description)) ups.push(DB.prepare('UPDATE ad_influencer_leads SET category = NULL WHERE id = ? AND account_id = 0').bind(r.id))
    }
    for (let i = 0; i < ups.length; i += 100) await DB.batch(ups.slice(i, i + 100)).catch(() => null)
    changed += ups.length - pageStamped
    stamped += pageStamped
    if (opts?.budget?.exhausted) { cursor = pageStart; scanned -= rows.length; break } // 쓰기가 잘림 → 이 페이지 재시도
    if (rows.length < PAGE) { done = true; break }
    // ⏱️ 여기까지가 이 인보케이션의 몫 — `done` 을 false 로 남겨 커서가 다음 회차로 이어진다(커버리지 손실 0).
    if (poolScanShouldStop(scanned, startedMs, Date.now())) break
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, changed, stamped, done }
}
