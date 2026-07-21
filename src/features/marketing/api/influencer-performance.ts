/**
 * 📈 2026-07-21 인플루언서 성과 지표 수집 (매시간 cron 잔여 예산으로 점진 보강).
 *   - 유튜브: **최근 영상 ≤10개의 평균 조회수·댓글수** (구독자수보다 정직한 협업 지표).
 *     비용: 채널당 playlistItems 1점 + videos.list 공유 1점 — units 예산(10k)의 유휴분 사용(검색 병목과 무관).
 *   - 네이버 블로그: 공식 조회수/댓글 API 없음(비공개) → **RSS 로 최근 30일 포스팅 수**(활동성)가 합법 최선.
 *   perf_checked_at 스탬프로 재시도 폭주 방지(실패도 스탬프 — 다음 대상으로 진행).
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '@/worker/types/env'
import { pickBusinessEmail, extractContacts, type FetchBudget } from './influencer-discovery'
import { classifyCategory, NON_CATEGORIES } from './influencer-classify'

const _reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/**
 * 🧹 기존 풀 이메일 재정리(백필) — 저장된 소개글(description)에 개선된 추출기를 재적용해 판정.
 *   반환: string=이 값으로 교체 · null=비우기(가짜 제거) · undefined=변경 없음.
 *   ① **가짜 이메일 제거**: 저장 이메일이 소개글에 문자 그대로 없고, "로컬파트 at 도메인라벨"(과거 전치사 'at'
 *      오변환 흔적)이 소개글에 있으면 날조 → 재도출값으로 교체(없으면 비움). ② 빈칸이면 재도출로 채움.
 *      ③ 대행사(비-개인도메인) 저장값 + 소개글에 개인도메인 메일 → 개인메일로 교정.
 */
export function reextractEmail(description: string | null | undefined, stored: string | null): string | null | undefined {
  const desc = description || ''
  const derived = pickBusinessEmail(desc) || extractContacts(desc).emails[0] || null // 개선된(수정된) 추출기
  if (!stored) return derived || undefined // 빈칸 채움
  const s = stored.toLowerCase(); const [local, domain] = s.split('@'); const label = (domain || '').split('.')[0]
  const fabricated = !desc.toLowerCase().includes(s) && !!local && !!label
    && new RegExp(`${_reEsc(local)}\\s+at\\s+${_reEsc(label)}`, 'i').test(desc) // "out at naver" 류 날조 흔적
  if (fabricated) return derived && derived !== stored ? derived : null // 진짜 메일로 교체 or 비움
  if (!PERSONAL_EMAIL_RE.test(stored) && derived && PERSONAL_EMAIL_RE.test(derived)) return derived // 대행사→개인
  return undefined // 유지
}

// 개인(창작자 본인) 메일 도메인 SSOT — 대행사/MCN 코퍼레이트 메일과 구분. About 에 이 도메인 메일이 있으면 우선.
//   통계(admin-ads `yt_email_personal`)·교정(correctedAboutEmail) 둘 다 이 집합에서 파생 → 정의 드리프트 방지.
export const PERSONAL_EMAIL_DOMAINS = ['gmail', 'naver', 'daum', 'kakao', 'hanmail', 'nate', 'hotmail', 'outlook', 'icloud'] as const
const PERSONAL_EMAIL_RE = new RegExp(`@(${PERSONAL_EMAIL_DOMAINS.join('|')})\\.`, 'i')
/** 통계용 SQL 조건 — 주어진 컬럼이 개인도메인 메일인지(위 SSOT 와 동일 집합). 도메인 리터럴만이라 인젝션 무관. */
export const personalEmailSqlClause = (col = 'email'): string => PERSONAL_EMAIL_DOMAINS.map(d => `${col} LIKE '%@${d}.%'`).join(' OR ')
/** 저장된 이메일을 최신 About 이메일로 교정할지 판단(보수적 — 값을 나쁘게 만들지 않음).
 *  대상: 저장값이 없거나(NULL) 개인도메인이 아닌 경우(대행사 co.kr 등) + About 에 개인도메인 비즈니스 메일이 있을 때만.
 *  → 채널 주인이 나중에 About 에 본인 메일을 추가한 케이스(수집 당시엔 영상설명의 대행사 메일만 잡힘)를 자동 정정. */
export function correctedAboutEmail(aboutDesc: string | undefined, stored: string | null): string | null {
  if (!aboutDesc) return null
  const fresh = pickBusinessEmail(aboutDesc)
  if (!fresh || !PERSONAL_EMAIL_RE.test(fresh) || fresh === (stored || '')) return null
  const storedIsPersonal = !!stored && PERSONAL_EMAIL_RE.test(stored)
  return storedIsPersonal ? null : fresh // 이미 개인메일이면 안 건드림(처닝 방지), 아니면(대행사/NULL) 교정
}

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

/** 네이버 블로그 홈 HTML 에서 이웃수(규모 프록시) 파싱 — best-effort. 네이버 오픈API 는 구독/이웃수를
 *  안 줘서(비공개) 이미 받는 홈 HTML 에서 긁는 게 무료 최선. 여러 레이아웃 대비 다중 패턴, 못 찾으면 0. */
export function parseNaverNeighborCount(html: string): number {
  if (!html) return 0
  const pats: RegExp[] = [
    /"buddyCount"\s*:\s*"?(\d{1,9})"?/i,         // 상태 JSON blob
    /buddyCount['"]?\s*[:=]\s*['"]?(\d{1,9})/i,
    /이웃\s*<[^>]*>\s*([\d,]{1,12})/,            // "이웃 <em>1,234</em>"
    /이웃[^0-9]{0,6}([\d,]{2,12})\s*명/,         // "이웃 1,234명"
    /([\d,]{2,12})\s*명의?\s*이웃/,              // "1,234명의 이웃"
  ]
  for (const re of pats) {
    const m = html.match(re)
    if (m) { const n = parseInt(m[1].replace(/,/g, ''), 10); if (Number.isFinite(n) && n > 0 && n < 100_000_000) return n }
  }
  return 0
}

// 성과 보강 전용 추가 컬럼(동결 ensureInfluencerSchema 무접촉 — 여기서 소유). 멱등·동시성 안전.
const _perfColPromise = new WeakMap<object, Promise<void>>()
export function ensurePerfExtraColumns(DB: D1Database): Promise<void> {
  const c = _perfColPromise.get(DB); if (c) return c
  // channel_published_at(개설일) + pub_checked_at(개설일 조회 시도 스탬프 — 응답없는 좀비채널 무한 재선택 방지).
  const p = (async () => {
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN channel_published_at DATETIME').run().catch(() => null)
    await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN pub_checked_at DATETIME').run().catch(() => null)
  })()
  _perfColPromise.set(DB, p); return p
}

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

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

/**
 * 유튜브 최근성과 보강 — perf 미수집 채널을 구독자 많은 순으로 max 개.
 *   채널당: channels.list(uploads 재생목록, 50개 배치 1점) → playlistItems(1점) → videos.list(50 id 배치 1점 공유).
 */
export async function enrichYouTubePerformance(
  apiKey: string | undefined, DB: D1Database, budget: FetchBudget, max: number,
): Promise<number> {
  if (!apiKey || max <= 0 || budget.left <= 3) return 0
  await ensurePerfExtraColumns(DB) // channel_published_at 참조(백필 조건) 전 보강
  // perf 미수집 + 개설일 조회 미시도(기존 풀 백필 — pub_checked_at 로 자기종료: 좀비채널도 1회 시도 후 재선택 안 함).
  const rows = (await DB.prepare(`SELECT id, channel_id, email, category FROM ad_influencer_leads
      WHERE account_id = 0 AND platform = 'youtube' AND (perf_checked_at IS NULL OR pub_checked_at IS NULL)
      ORDER BY (pub_checked_at IS NULL) DESC, subscriber_count DESC LIMIT ?`).bind(Math.min(max, 20))
    .all<{ id: number; channel_id: string; email: string | null; category: string | null }>().catch(() => null))?.results || []
  if (!rows.length) return 0

  // ① uploads 재생목록 id — 50개 배치 1콜. snippet(개설일·소개글)+topicDetails(주제분류) 추가 — parts 는 비용 안 늘림(같은 1점).
  budget.left--
  await ensurePerfExtraColumns(DB)
  const chRes = await fetch(`${YT_BASE}/channels?part=contentDetails,snippet,topicDetails&id=${rows.map(r => r.channel_id).join(',')}&maxResults=50&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }).catch(() => null)
  const chJson = chRes?.ok ? await chRes.json().catch(() => null) as { items?: { id?: string; snippet?: { publishedAt?: string; description?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } }; topicDetails?: { topicCategories?: string[] } }[] } | null : null
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
    const pub = publishedAt.get(r.channel_id) || null // 개설일(계정 나이) — 있으면 채움, 기존값 보존
    const fixEmail = correctedAboutEmail(aboutDesc.get(r.channel_id), r.email) // 최신 About 개인메일로 대행사/스테일 메일 정정(NULL=유지)
    const catFill = !r.category ? (topicCat.get(r.channel_id) || null) : null // 미분류만 topicDetails 로 채움(기존 분류 보존)
    return DB.prepare(`UPDATE ad_influencer_leads SET recent_avg_views = ?, recent_avg_comments = ?, channel_published_at = COALESCE(channel_published_at, ?), pub_checked_at = datetime('now'), email = COALESCE(?, email), category = COALESCE(category, ?), perf_checked_at = datetime('now') WHERE id = ?`)
      .bind(avgViews, avgComments, pub, fixEmail, catFill, r.id)
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
  const HOME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  const stmts = []
  for (const r of rows) {
    if (budget.left <= 0) break
    budget.left--
    let posts30 = 0
    try {
      const res = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(r.handle)}.xml`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) posts30 = countRecentPosts(extractPubDates((await res.text()).slice(0, 120_000)), Date.now())
    } catch { /* fail-soft — 스탬프만 */ }
    // 🏠 이웃수(규모 프록시) — 홈 HTML 파싱(best-effort). 네이버 오픈API 미제공이라 blog 리드는 지금 전부 0.
    //   예산 남을 때만 홈 1콜 추가 시도(fail-soft). 찾으면 subscriber_count 채움(0>0 일 때만 — 수동값 보존).
    let neighbors = 0
    if (budget.left > 0 && /^[A-Za-z0-9_-]{2,40}$/.test(r.handle)) {
      budget.left--
      try {
        const hr = await fetch(`https://m.blog.naver.com/${r.handle}`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': HOME_UA, accept: 'text/html' }, redirect: 'follow' })
        if (hr.ok) neighbors = parseNaverNeighborCount((await hr.text()).slice(0, 80_000))
      } catch { /* fail-soft */ }
    }
    stmts.push(neighbors > 0
      ? DB.prepare(`UPDATE ad_influencer_leads SET recent_posts_30d = ?, subscriber_count = CASE WHEN subscriber_count > 0 THEN subscriber_count ELSE ? END, perf_checked_at = datetime('now') WHERE id = ?`).bind(posts30, neighbors, r.id)
      : DB.prepare(`UPDATE ad_influencer_leads SET recent_posts_30d = ?, perf_checked_at = datetime('now') WHERE id = ?`).bind(posts30, r.id))
  }
  if (stmts.length) await DB.batch(stmts).catch(() => null)
  return stmts.length
}

/**
 * 🔄 유튜브 라이브 재조회(수동) — 저장된 소개글이 아니라 **현재 라이브 About 을 다시 불러** 이메일/카테고리/성과를 갱신.
 *   대표 신고(티벳동생): 저장값은 수집 당시 영상설명의 대행사 메일인데 현재 About 엔 개인메일 — 재추출(저장데이터)로는
 *   못 고치고, 라이브 About 재조회가 필요. enrichYouTubePerformance 를 여러 패스 돌려 구독자 많은 순으로 처리
 *   (correctedAboutEmail 이 라이브 About 개인메일로 대행사/스테일 메일 교정 + topicDetails 카테고리 채움).
 *   YouTube units 사용(검색 쿼터와 무관 — channels/videos.list). passes×20 채널.
 */
export async function runYtLiveRefetch(env: Env, passes = 3): Promise<{ processed: number }> {
  const budget: FetchBudget = { left: 250 }
  let processed = 0
  for (let i = 0; i < Math.max(1, Math.min(10, passes)) && budget.left > 5; i++) {
    const n = await enrichYouTubePerformance(env.YOUTUBE_API_KEY, env.DB, budget, 20).catch(() => 0)
    processed += n
    if (n === 0) break // 더 처리할 대상 없음
  }
  return { processed }
}

/** 🏷️ 풀 카테고리 재분류(백필, 멱등) — 콘텐츠 신호로 교정 + 레거시 '자동'/'일반' → NULL 정리. */
export async function runReclassifyPool(DB: D1Database): Promise<{ scanned: number; changed: number }> {
  let scanned = 0, changed = 0
  for (let off = 0; ; off += 3000) {
    const rows = (await DB.prepare(`SELECT id, name, description, category FROM ad_influencer_leads
        WHERE account_id = 0 ORDER BY id ASC LIMIT 3000 OFFSET ?`).bind(off)
      .all<{ id: number; name: string; description: string | null; category: string | null }>().catch(() => null))?.results || []
    if (!rows.length) break
    scanned += rows.length
    const ups: ReturnType<D1Database['prepare']>[] = []
    for (const r of rows) {
      const byContent = classifyCategory(r.name, r.description)
      if (byContent && byContent !== r.category) ups.push(DB.prepare('UPDATE ad_influencer_leads SET category = ? WHERE id = ? AND account_id = 0').bind(byContent, r.id))
      else if (!byContent && r.category && NON_CATEGORIES.has(r.category)) ups.push(DB.prepare('UPDATE ad_influencer_leads SET category = NULL WHERE id = ? AND account_id = 0').bind(r.id))
    }
    for (let i = 0; i < ups.length; i += 100) await DB.batch(ups.slice(i, i + 100)).catch(() => null)
    changed += ups.length
    if (rows.length < 3000) break
  }
  return { scanned, changed }
}
