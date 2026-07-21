/**
 * 📈 2026-07-21 인플루언서 성과 지표 수집 (매시간 cron 잔여 예산으로 점진 보강).
 *   - 유튜브: **최근 영상 ≤10개의 평균 조회수·댓글수** (구독자수보다 정직한 협업 지표).
 *     비용: 채널당 playlistItems 1점 + videos.list 공유 1점 — units 예산(10k)의 유휴분 사용(검색 병목과 무관).
 *   - 네이버 블로그: 공식 조회수/댓글 API 없음(비공개) → **RSS 로 최근 30일 포스팅 수**(활동성)가 합법 최선.
 *   perf_checked_at 스탬프로 재시도 폭주 방지(실패도 스탬프 — 다음 대상으로 진행).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { FetchBudget } from './influencer-discovery'

// ── 순수 계산(테스트 가능) ──────────────────────────────────────────────────
export function avgStats(videos: { views: number; comments: number }[]): { avgViews: number; avgComments: number } {
  if (!videos.length) return { avgViews: 0, avgComments: 0 }
  const s = videos.reduce((a, v) => ({ v: a.v + (v.views || 0), c: a.c + (v.comments || 0) }), { v: 0, c: 0 })
  return { avgViews: Math.round(s.v / videos.length), avgComments: Math.round(s.c / videos.length) }
}

/** RSS pubDate 목록 → 최근 N일 내 포스팅 수. 파싱 불가 날짜는 무시. */
export function countRecentPosts(pubDates: string[], nowMs: number, days = 30): number {
  const cutoff = nowMs - days * 86400_000
  let n = 0
  for (const d of pubDates) { const t = Date.parse(d); if (Number.isFinite(t) && t >= cutoff && t <= nowMs + 86400_000) n++ }
  return n
}

/** RSS XML 에서 pubDate 텍스트 추출(정규식 — 외부 파서 없음). */
export function extractPubDates(xml: string): string[] {
  const out: string[] = []
  const re = /<pubDate>([^<]{5,60})<\/pubDate>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim())
  return out
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * 유튜브 최근성과 보강 — perf 미수집 채널을 구독자 많은 순으로 max 개.
 *   채널당: channels.list(uploads 재생목록, 50개 배치 1점) → playlistItems(1점) → videos.list(50 id 배치 1점 공유).
 */
export async function enrichYouTubePerformance(
  apiKey: string | undefined, DB: D1Database, budget: FetchBudget, max: number,
): Promise<number> {
  if (!apiKey || max <= 0 || budget.left <= 3) return 0
  const rows = (await DB.prepare(`SELECT id, channel_id FROM ad_influencer_leads
      WHERE account_id = 0 AND platform = 'youtube' AND perf_checked_at IS NULL
      ORDER BY subscriber_count DESC LIMIT ?`).bind(Math.min(max, 20))
    .all<{ id: number; channel_id: string }>().catch(() => null))?.results || []
  if (!rows.length) return 0

  // ① uploads 재생목록 id — 50개 배치 1콜.
  budget.left--
  const chRes = await fetch(`${YT_BASE}/channels?part=contentDetails&id=${rows.map(r => r.channel_id).join(',')}&maxResults=50&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }).catch(() => null)
  const chJson = chRes?.ok ? await chRes.json().catch(() => null) as { items?: { id?: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] } | null : null
  const uploads = new Map<string, string>() // channel_id → uploads playlist
  for (const it of chJson?.items || []) if (it.id && it.contentDetails?.relatedPlaylists?.uploads) uploads.set(it.id, it.contentDetails.relatedPlaylists.uploads)

  // ② 채널별 최근 영상 id ≤10 — 채널당 1콜.
  const videoIdsByLead = new Map<number, string[]>()
  for (const r of rows) {
    const pl = uploads.get(r.channel_id)
    if (!pl || budget.left <= 2) { videoIdsByLead.set(r.id, []); continue }
    budget.left--
    const piRes = await fetch(`${YT_BASE}/playlistItems?part=contentDetails&playlistId=${pl}&maxResults=10&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }).catch(() => null)
    const pi = piRes?.ok ? await piRes.json().catch(() => null) as { items?: { contentDetails?: { videoId?: string } }[] } | null : null
    videoIdsByLead.set(r.id, (pi?.items || []).map(i => i.contentDetails?.videoId).filter((v): v is string => !!v))
  }

  // ③ 영상 통계 — 전 채널 영상을 50개씩 묶어 배치 콜.
  const allIds = Array.from(videoIdsByLead.values()).flat()
  const stats = new Map<string, { views: number; comments: number }>()
  for (let i = 0; i < allIds.length && budget.left > 0; i += 50) {
    budget.left--
    const vRes = await fetch(`${YT_BASE}/videos?part=statistics&id=${allIds.slice(i, i + 50).join(',')}&maxResults=50&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }).catch(() => null)
    const vj = vRes?.ok ? await vRes.json().catch(() => null) as { items?: { id?: string; statistics?: { viewCount?: string; commentCount?: string } }[] } | null : null
    for (const it of vj?.items || []) if (it.id) stats.set(it.id, { views: parseInt(it.statistics?.viewCount || '0', 10) || 0, comments: parseInt(it.statistics?.commentCount || '0', 10) || 0 })
  }

  // ④ 평균 계산 + 저장(1 batch). 실패/영상없음도 스탬프(재시도 폭주 방지).
  const stmts = rows.map(r => {
    const vids = (videoIdsByLead.get(r.id) || []).map(id => stats.get(id)).filter((v): v is { views: number; comments: number } => !!v)
    const { avgViews, avgComments } = avgStats(vids)
    return DB.prepare(`UPDATE ad_influencer_leads SET recent_avg_views = ?, recent_avg_comments = ?, perf_checked_at = datetime('now') WHERE id = ?`)
      .bind(avgViews, avgComments, r.id)
  })
  await DB.batch(stmts).catch(() => null)
  return rows.length
}

/**
 * 네이버 블로거 활동성 보강 — RSS 최근 30일 포스팅 수(조회수/댓글은 공식 API 부재 — 비공개 지표).
 */
export async function enrichNaverActivity(DB: D1Database, budget: FetchBudget, max: number): Promise<number> {
  if (max <= 0 || budget.left <= 1) return 0
  const rows = (await DB.prepare(`SELECT id, handle FROM ad_influencer_leads
      WHERE account_id = 0 AND platform = 'naver_blog' AND perf_checked_at IS NULL AND handle IS NOT NULL
      ORDER BY id DESC LIMIT ?`).bind(Math.min(max, 15))
    .all<{ id: number; handle: string }>().catch(() => null))?.results || []
  if (!rows.length) return 0
  const stmts = []
  for (const r of rows) {
    if (budget.left <= 0) break
    budget.left--
    let posts30 = 0
    try {
      const res = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(r.handle)}.xml`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) posts30 = countRecentPosts(extractPubDates((await res.text()).slice(0, 120_000)), Date.now())
    } catch { /* fail-soft — 스탬프만 */ }
    stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET recent_posts_30d = ?, perf_checked_at = datetime('now') WHERE id = ?`).bind(posts30, r.id))
  }
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  return stmts.length
}
