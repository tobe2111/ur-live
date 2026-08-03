/**
 * 📈 **유튜브 성과 보강** — `influencer-performance.ts` 에서 분리(2026-08-03, 600줄 래칫).
 *
 *   순수 이동이다. 로직 한 줄도 안 바꿨다 — 분리 사유는 파일 크기뿐이고, 호출부는
 *   원본이 재수출하므로 **무수정**이다(`influencer-keyword-store` 분리와 같은 방식).
 *
 *   ⚠️ 이 함수의 스탬프 규칙은 조용한 함정이 있다(2026-08-03 실측):
 *     · 예산으로 건너뛴 행에도 **`pub_checked_at` 은 찍는다** — 선택 순서가
 *       `(pub_checked_at IS NULL) DESC` 라, 안 찍으면 그 행이 영원히 맨 앞이라 채널콜을 반복한다.
 *     · 그래도 **`perf_checked_at` 은 안 찍는다** — 0 을 각인하면 "측정했는데 0회"와 구분이 안 된다.
 *   두 규칙은 반대 방향이고 **둘 다 필요하다**. 유닛(`ads-enrich-throughput`)이 양쪽을 고정한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { type FetchBudget } from './influencer-discovery'
import { reconcileCategory, classifyCategory } from './influencer-classify'
import { videoMetrics, parseIsoDurationSec } from './influencer-parse'
import { budgetedTimeoutMs } from './collect-budget'
import { correctedAboutEmail } from './influencer-email-rules'
import { topicToCategory, ensurePerfExtraColumns, YT_BASE, outOfTime } from './influencer-performance'


/**
 * 유튜브 최근성과 보강 — perf 미수집 채널을 구독자 많은 순으로 max 개.
 *   채널당: channels.list(uploads 재생목록, 50개 배치 1점) → playlistItems(1점) → videos.list(50 id 배치 1점 공유).
 */
export async function enrichYouTubePerformance(
  apiKey: string | undefined, DB: D1Database, budget: FetchBudget, max: number, mode: 'progress' | 'refresh' = 'progress',
): Promise<number> {
  // ⏱️ 시간이 이미 지났으면 **아무것도 하지 않는다** — D1/DDL 도 서브리퀘스트다(레인 예산과 같은 지갑).
  if (!apiKey || max <= 0 || budget.left <= 3 || outOfTime(budget)) return 0
  await ensurePerfExtraColumns(DB) // channel_published_at 참조(백필 조건) 전 보강
  // 선택 대상 — progress(cron): perf 미수집 채널을 구독자 많은 순(pub_checked_at 로 자기종료: 좀비채널도 1회 후 재선택 X).
  //   refresh(수동 라이브 재조회): 이미 수집됐어도 **개인메일이 아직 없는 채널**(NULL·대행사)을 오래된 조회순으로 재선택
  //   → 저장값이 대행사 메일이지만 현재 About 엔 개인메일인 케이스(티벳동생)를 correctedAboutEmail 이 실제로 교정.
  //   반복 클릭 시 pub_checked_at 이 now 로 갱신돼 큐 뒤로 밀리므로 전 풀을 순회(무한 재조회 없음, 개인메일 확보되면 대상서 제외).
  //   + **recent_avg_views = 0 힐**: 과거 예산소진 버그로 avg 0 으로 굳은 채널(개설일 스탬프됨 → 진행모드 재선택 안 됨)도
  //   재조회 대상에 포함해 실제 조회수로 교정(예산소진 스킵은 이제 0 을 안 찍으므로 재감염 없음, 진짜 0 이면 실측 후 유지).
  //   + **전체 재스캔**(2026-07-22): 키워드 상속으로 잘못 분류된 채널은 저장 소개글에 신호가 없어 reclassify(저장 기반)로
  //   못 고침 → refresh 는 **전 YT 채널**을 오래된 조회순으로 순회하며 라이브 About(우리 15종) + YouTube topicDetails 로
  //   카테고리/이메일/조회수를 실제 재검증(reconcileCategory). 명백히 깨진 것(미분류·0회·무메일) 먼저, 처리분은 pub_checked_at=now
  //   로 뒤로 밀려 반복 클릭이 전 풀을 한 바퀴 순회(idempotent — 재클릭은 같은 결과라 무해).
  const refresh = mode === 'refresh'
  const whereMode = refresh ? `channel_id IS NOT NULL` : `(perf_checked_at IS NULL OR pub_checked_at IS NULL)`
  const orderMode = refresh
    ? `(category IS NULL OR recent_avg_views = 0 OR email IS NULL) DESC, pub_checked_at ASC`
    : `(pub_checked_at IS NULL) DESC, subscriber_count DESC`
  const rows = (await DB.prepare(`SELECT id, channel_id, name, email, category FROM ad_influencer_leads
      WHERE account_id = 0 AND platform = 'youtube' AND ${whereMode}
      ORDER BY ${orderMode} LIMIT ?`).bind(Math.min(max, 20))
    .all<{ id: number; channel_id: string; name: string | null; email: string | null; category: string | null }>().catch(() => null))?.results || []
  if (!rows.length) return 0

  // ① uploads 재생목록 id — 50개 배치 1콜. snippet(개설일·소개글)+topicDetails(주제분류) 추가 — parts 는 비용 안 늘림(같은 1점).
  budget.left--
  await ensurePerfExtraColumns(DB)
  const chRes = await fetch(`${YT_BASE}/channels?part=contentDetails,snippet,topicDetails&id=${rows.map(r => r.channel_id).join(',')}&maxResults=50&key=${apiKey}`,
    { signal: AbortSignal.timeout(budgetedTimeoutMs(budget.deadline, 10000)) }).catch(() => null)
  const chJson = chRes?.ok ? await chRes.json().catch(() => null) as { items?: { id?: string; snippet?: { publishedAt?: string; description?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } }; topicDetails?: { topicCategories?: string[] } }[] } | null : null
  // 🛡️ 2026-07-23 전수조사: channels.list 자체가 실패(네트워크/403/쿼터)하면 uploads 맵이 비어 이 배치 전원이
  //   "영상 0개가 정답" 분기로 avg 0 + 스탬프 → **영구 0 각인**(재선택 제외). 실패 시 아무것도 쓰지 않고 보류(다음 틱 재시도).
  if (!chJson) return 0
  const uploads = new Map<string, string>() // channel_id → uploads playlist
  const publishedAt = new Map<string, string>() // channel_id → 개설일(계정 나이 신호)
  const aboutDesc = new Map<string, string>() // channel_id → 최신 About 소개글(이메일 재교정용 — 이미 받는 snippet)
  const topicCat = new Map<string, string>() // channel_id → topicDetails 매핑 카테고리(빈 category 채움용)
  for (const it of chJson?.items || []) {
    if (it.id && it.contentDetails?.relatedPlaylists?.uploads) uploads.set(it.id, it.contentDetails.relatedPlaylists.uploads)
    if (it.id && it.snippet?.publishedAt) publishedAt.set(it.id, it.snippet.publishedAt)
    if (it.id && it.snippet?.description) aboutDesc.set(it.id, it.snippet.description)
    if (it.id) { const tc = topicToCategory(it.topicDetails?.topicCategories); if (tc) topicCat.set(it.id, tc) }
  }

  // ② 채널별 최근 영상 id ≤10 — 채널당 1콜.
  const videoIdsByLead = new Map<number, string[]>()
  const budgetSkipped = new Set<number>() // 예산 소진으로 영상통계를 못 잰 채널 — perf 를 0 으로 찍지 않고 보류(다음 틱 재선택)
  for (const r of rows) {
    const pl = uploads.get(r.channel_id)
    if (!pl) { videoIdsByLead.set(r.id, []); continue }                 // 업로드 재생목록 없음 = 실제로 영상 0 → avg 0 이 정답
    // ⏱️ 예산 **또는 시간** 소진 — perf 보류(0 각인 금지). 시간을 안 보면 아래 10s 타임아웃 × 채널 수가
    //   그대로 창을 넘겨, 뒤에 선 블로거 레인이 통째로 굶는다(2026-07-29 14:00 클린 틱 실측).
    if (budget.left <= 2 || outOfTime(budget)) { videoIdsByLead.set(r.id, []); budgetSkipped.add(r.id); continue }
    budget.left--
    const piRes = await fetch(`${YT_BASE}/playlistItems?part=contentDetails&playlistId=${pl}&maxResults=10&key=${apiKey}`,
      { signal: AbortSignal.timeout(budgetedTimeoutMs(budget.deadline, 10000)) }).catch(() => null)
    const pi = piRes?.ok ? await piRes.json().catch(() => null) as { items?: { contentDetails?: { videoId?: string } }[] } | null : null
    // 🛡️ 호출 실패("측정 실패")는 빈 목록("진짜 영상 0")과 구분 — 실패면 스탬프 없이 보류(0 각인 방지).
    if (!pi) { videoIdsByLead.set(r.id, []); budgetSkipped.add(r.id); continue }
    videoIdsByLead.set(r.id, (pi.items || []).map(i => i.contentDetails?.videoId).filter((v): v is string => !!v))
  }

  // ③ 영상 통계 — 전 채널 영상을 50개씩 묶어 배치 콜.
  //   📈 part 에 contentDetails 추가(=영상 길이) — 같은 1 unit 이라 쿼터 비용 증가 0. 쇼츠/롱폼 구분에 사용.
  const allIds = Array.from(videoIdsByLead.values()).flat()
  const stats = new Map<string, { views: number; comments: number; durationSec: number }>()
  for (let i = 0; i < allIds.length && budget.left > 0 && !outOfTime(budget); i += 50) {
    budget.left--
    const vRes = await fetch(`${YT_BASE}/videos?part=statistics,contentDetails&id=${allIds.slice(i, i + 50).join(',')}&maxResults=50&key=${apiKey}`,
      { signal: AbortSignal.timeout(budgetedTimeoutMs(budget.deadline, 10000)) }).catch(() => null)
    const vj = vRes?.ok ? await vRes.json().catch(() => null) as { items?: { id?: string; statistics?: { viewCount?: string; commentCount?: string }; contentDetails?: { duration?: string } }[] } | null : null
    for (const it of vj?.items || []) if (it.id) stats.set(it.id, {
      views: parseInt(it.statistics?.viewCount || '0', 10) || 0,
      comments: parseInt(it.statistics?.commentCount || '0', 10) || 0,
      durationSec: parseIsoDurationSec(it.contentDetails?.duration),
    })
  }

  // ④ 평균 계산 + 저장(1 batch). 영상없음(!pl)/실패는 스탬프(재시도 폭주 방지)하되, **예산 소진으로 못 잰 채널**은
  //   avg=0/perf_checked_at 을 찍지 않는다 — 찍으면 progress 재선택(perf_checked_at IS NULL)에서 영구 제외돼
  //   라이브 채널이 avg 0 으로 묻힘(enrichNaverActivity 는 budget break 로 이미 안전). 이미 받은 About/개설일/카테고리 교정만 반영.
  const stmts = rows.map(r => {
    const pub = publishedAt.get(r.channel_id) || null // 개설일(계정 나이) — 있으면 채움, 기존값 보존
    const fixEmail = correctedAboutEmail(aboutDesc.get(r.channel_id), r.email) // 최신 About 개인메일로 대행사/스테일 메일 정정(NULL=유지)
    // 카테고리: 우리 라이브 규칙(15종, 현재 About) + YouTube topicDetails 종합. **refresh(수동 재조회)=적극 교정**
    //   (reconcileCategory — 저장값 있으면 null 안 됨), **progress(cron)=미분류만 채움**(기존/수동 분류 보존).
    const liveCat = classifyCategory(r.name || '', aboutDesc.get(r.channel_id) || '')
    const catToWrite = refresh
      ? reconcileCategory(r.category, liveCat, topicCat.get(r.channel_id) || null)
      : (r.category || liveCat || topicCat.get(r.channel_id) || null)
    const leadVideoIds = videoIdsByLead.get(r.id) || []
    const vids = leadVideoIds.map(id => stats.get(id)).filter((v): v is { views: number; comments: number; durationSec: number } => !!v)
    // 🛡️ videos.list 실패(영상 id 는 있는데 통계 0건 매칭 = 측정 실패)도 0 각인 대신 보류 — 진짜 영상 0(id 없음)과 구분.
    const measureFailed = leadVideoIds.length > 0 && vids.length === 0
    // 🏷️ 분류 근거 — 라이브 About 규칙=content / 유튜브 자체분류=topic / 그 외(유지)=기존 근거 보존(COALESCE).
    const catSrc = catToWrite == null ? null : catToWrite === liveCat ? 'content' : catToWrite === topicCat.get(r.channel_id) ? 'topic' : null
    /**
     * perf 미측정 — perf 컬럼/스탬프 무접촉(다음 틱 재선택), About/개설일/카테고리만.
     *
     * 🩸 **그런데 `pub_checked_at` 은 찍어야 한다** (2026-08-03 라이브 실측으로 발견).
     *   선택 순서가 `(pub_checked_at IS NULL) DESC, subscriber_count DESC` 다. 여기까지 왔다는 건
     *   `if (!chJson) return 0` 을 통과했다는 뜻 = **channels.list 는 성공**했고 About/개설일/카테고리를
     *   지금 쓰고 있다. 즉 "pub 은 확인됨"이 사실인데 스탬프를 안 찍으니 이 행이 **다음 회차에도 맨 앞**이다.
     *   ⇒ 예산 14 로는 20행 중 앞 ~11행만 완주하고 나머지는 매번 같은 자리에서 다시 채널콜을 태운다.
     *   실측: **PT 하루 2,003 units 를 쓰고 106행만 측정** = 19콜/행(코드상 건당 2~3콜인데도).
     *   ⇒ 스탬프를 찍으면 그 행은 뒤로 물러나고 다음 회차가 **새 행**으로 전진한다.
     *
     * ⚠️ `perf_checked_at` 은 **여전히 안 찍는다** — 영상 통계를 못 잰 건 사실이고, 0 을 각인하면
     *   "측정했는데 0회"와 구분이 안 된다(위 measureFailed 주석의 그 사고). 재선택 자격은 유지된다.
     */
    if (budgetSkipped.has(r.id) || measureFailed)
      return DB.prepare(`UPDATE ad_influencer_leads SET channel_published_at = COALESCE(channel_published_at, ?), email = COALESCE(?, email), category = ?, category_source = COALESCE(?, category_source), pub_checked_at = datetime('now') WHERE id = ?`)
        .bind(pub, fixEmail, catToWrite, catSrc, r.id)
    // 📈 롱폼 중앙값 + 쇼츠 비중 동시 기록(쇼츠 착시 배제 — 협찬 단가 판단용). 길이를 못 잰 배치는 중앙값 0 → 표시는 avg 폴백.
    const { avgViews, avgComments, medianLongViews, shortsRatio } = videoMetrics(vids)
    return DB.prepare(`UPDATE ad_influencer_leads SET recent_avg_views = ?, recent_avg_comments = ?, median_long_views = ?, shorts_ratio = ?, channel_published_at = COALESCE(channel_published_at, ?), pub_checked_at = datetime('now'), email = COALESCE(?, email), category = ?, category_source = COALESCE(?, category_source), perf_checked_at = datetime('now') WHERE id = ?`)
      .bind(avgViews, avgComments, medianLongViews, shortsRatio, pub, fixEmail, catToWrite, catSrc, r.id)
  })
  await DB.batch(stmts).catch(() => null)
  return rows.length
}