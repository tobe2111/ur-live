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
import { classifyCategory, reconcileCategory, NON_CATEGORIES } from './influencer-classify'
import { runDdlOnce } from './ads-schema-guard'
import { deriveNaverHandle, naverBlogUrl } from './influencer-handle-heal'
import { platformSubreqCap } from './collect-budget'

const _reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/**
 * 🧹 기존 풀 이메일 재정리(백필) — 저장된 소개글(description)에 개선된 추출기를 재적용해 판정.
 *   반환: string=이 값으로 교체 · null=비우기(가짜 제거) · undefined=변경 없음.
 *   ① **가짜 이메일 제거**: 저장 이메일이 소개글에 문자 그대로 없고, "로컬파트 at 도메인라벨"(과거 전치사 'at'
 *      오변환 흔적)이 소개글에 있으면 날조 → 재도출값으로 교체(없으면 비움). ② 빈칸이면 재도출로 채움.
 *      ③ 대행사(비-개인도메인) 저장값 + 소개글에 개인도메인 메일 → 개인메일로 교정.
 */
export function reextractEmail(description: string | null | undefined, stored: string | null): string | null | undefined {
  const desc = stripVideoTitles(description || '') // 🏷️ 영상 제목 세그먼트(분류 전용 신호)의 타인 메일 오추출 방지
  const derived = pickBusinessEmail(desc) || extractContacts(desc).emails[0] || null // 개선된(수정된) 추출기
  if (!stored) return derived || undefined // 빈칸 채움
  // 🛡️ 소급 정리(2026-07-25): 과거 날조 저장분(insta@sunny.day 류 — 로컬파트=플랫폼 라벨)은 진짜 메일로 교체 or 비움.
  //   신규 추출기는 이 클래스를 차단하지만 재추출의 '유지' 판정이 기존 오염을 못 지우던 것 — 발송하면 전량 반송되는 값.
  if (isPlatformLabelEmail(stored)) return derived && derived !== stored ? derived : null
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
/** 개인(창작자 본인) 메일인가 — 위 SSOT 와 동일 판정(스코어링 등 JS 소비자용). */
export const isPersonalEmail = (email?: string | null): boolean => !!email && PERSONAL_EMAIL_RE.test(email)
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

/** ISO-8601 duration(PT#H#M#S) → 초. 파싱 불가/빈값은 0(=길이 미상 → 롱폼 판정에서 제외). */
export function parseIsoDurationSec(iso?: string | null): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(String(iso || '').trim())
  if (!m) return 0
  const [, d, h, mi, s] = m
  const sec = (parseInt(d || '0', 10) * 86400) + (parseInt(h || '0', 10) * 3600) + (parseInt(mi || '0', 10) * 60) + Math.round(parseFloat(s || '0'))
  return Number.isFinite(sec) ? sec : 0
}

/** 쇼츠 판정 임계(초) — 유튜브 쇼츠 최대 길이(3분) 기준. 이보다 길면 롱폼으로 본다. */
export const SHORTS_MAX_SEC = 180

/** 숫자 배열의 중앙값(정수 반올림). 빈 배열은 0. */
export function medianOf(nums: number[]): number {
  if (!nums.length) return 0
  const a = [...nums].sort((x, y) => x - y)
  const mid = a.length >> 1
  return Math.round(a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2)
}

/**
 * 📈 채널 성과 지표(2026-07-27 개선) — 기존 '전체 평균 조회수'는 **쇼츠/롱폼 혼합 + 산술평균**이라
 *   쇼츠 몇 개가 터진 채널이 과대평가됐다(협찬 단가 오판). 롱폼만의 **중앙값**을 별도로 계산해
 *   실제 콘텐츠 도달력을 보수적으로 추정하고, 쇼츠 비중도 함께 노출한다.
 *   ⚠️ avgViews/avgComments 는 기존 표시·정렬 호환을 위해 그대로 유지(제거 아님).
 */
export function videoMetrics(videos: { views: number; comments: number; durationSec?: number }[]): {
  avgViews: number; avgComments: number; medianLongViews: number; shortsRatio: number
} {
  const { avgViews, avgComments } = avgStats(videos)
  const withLen = videos.filter(v => (v.durationSec || 0) > 0)
  const longs = withLen.filter(v => (v.durationSec || 0) > SHORTS_MAX_SEC)
  const shorts = withLen.length - longs.length
  return {
    avgViews, avgComments,
    // 길이를 못 잰 경우(전부 0초)엔 롱폼 중앙값을 0 으로 두고 호출부가 avg 로 폴백하게 한다.
    medianLongViews: medianOf(longs.map(v => v.views || 0)),
    shortsRatio: withLen.length ? Math.round((shorts / withLen.length) * 100) : 0,
  }
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

/** RSS XML 에서 글 제목 추출(채널 자체 title 은 제외 — <item> 안의 것만). CDATA/일반 둘 다.
 *  블로그 카테고리 분류의 핵심 신호 — 검색 스니펫 1건보다 최근 글 제목 묶음이 훨씬 정확. */
export function extractRssTitles(xml: string, max = 6): string[] {
  const out: string[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && out.length < max) {
    const t = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]{1,120}))<\/title>/i.exec(m[1])
    const title = (t?.[1] || t?.[2] || '').trim()
    if (title) out.push(title.slice(0, 80))
  }
  return out
}

/** 네이버 검색 API postdate(YYYYMMDD) → 'YYYY-MM-DD'. 형식 불일치는 null. */
export function naverPostdateToIso(postdate?: string | null): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(postdate || '').trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
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
  apiKey: string | undefined, DB: D1Database, budget: FetchBudget, max: number, mode: 'progress' | 'refresh' = 'progress',
): Promise<number> {
  if (!apiKey || max <= 0 || budget.left <= 3) return 0
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
    { signal: AbortSignal.timeout(10000) }).catch(() => null)
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
    if (budget.left <= 2) { videoIdsByLead.set(r.id, []); budgetSkipped.add(r.id); continue } // 예산 소진 — perf 보류
    budget.left--
    const piRes = await fetch(`${YT_BASE}/playlistItems?part=contentDetails&playlistId=${pl}&maxResults=10&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }).catch(() => null)
    const pi = piRes?.ok ? await piRes.json().catch(() => null) as { items?: { contentDetails?: { videoId?: string } }[] } | null : null
    // 🛡️ 호출 실패("측정 실패")는 빈 목록("진짜 영상 0")과 구분 — 실패면 스탬프 없이 보류(0 각인 방지).
    if (!pi) { videoIdsByLead.set(r.id, []); budgetSkipped.add(r.id); continue }
    videoIdsByLead.set(r.id, (pi.items || []).map(i => i.contentDetails?.videoId).filter((v): v is string => !!v))
  }

  // ③ 영상 통계 — 전 채널 영상을 50개씩 묶어 배치 콜.
  //   📈 part 에 contentDetails 추가(=영상 길이) — 같은 1 unit 이라 쿼터 비용 증가 0. 쇼츠/롱폼 구분에 사용.
  const allIds = Array.from(videoIdsByLead.values()).flat()
  const stats = new Map<string, { views: number; comments: number; durationSec: number }>()
  for (let i = 0; i < allIds.length && budget.left > 0; i += 50) {
    budget.left--
    const vRes = await fetch(`${YT_BASE}/videos?part=statistics,contentDetails&id=${allIds.slice(i, i + 50).join(',')}&maxResults=50&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }).catch(() => null)
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
    if (budgetSkipped.has(r.id) || measureFailed) // perf 미측정 — perf 컬럼/스탬프 무접촉(다음 틱 재선택), About/개설일/카테고리만
      return DB.prepare(`UPDATE ad_influencer_leads SET channel_published_at = COALESCE(channel_published_at, ?), email = COALESCE(?, email), category = ?, category_source = COALESCE(?, category_source) WHERE id = ?`)
        .bind(pub, fixEmail, catToWrite, catSrc, r.id)
    // 📈 롱폼 중앙값 + 쇼츠 비중 동시 기록(쇼츠 착시 배제 — 협찬 단가 판단용). 길이를 못 잰 배치는 중앙값 0 → 표시는 avg 폴백.
    const { avgViews, avgComments, medianLongViews, shortsRatio } = videoMetrics(vids)
    return DB.prepare(`UPDATE ad_influencer_leads SET recent_avg_views = ?, recent_avg_comments = ?, median_long_views = ?, shorts_ratio = ?, channel_published_at = COALESCE(channel_published_at, ?), pub_checked_at = datetime('now'), email = COALESCE(?, email), category = ?, category_source = COALESCE(?, category_source), perf_checked_at = datetime('now') WHERE id = ?`)
      .bind(avgViews, avgComments, medianLongViews, shortsRatio, pub, fixEmail, catToWrite, catSrc, r.id)
  })
  await DB.batch(stmts).catch(() => null)
  return rows.length
}

/** 네이버 블로거 보강 결과 — 어드민 진단용(측정 성공 0 이 반복되면 차단/형식변경 신호).
 *  🩹 2026-07-28 추가된 3필드는 "0 인데 이유를 모르겠다"를 없애기 위한 것이다. 실제로 이 레인은
 *  라운드마다 `tried:0` 만 내보내며 멈춰 있었고(손상 핸들 12,357행을 뽑아서 버리는 중), 원인을 찾는 데
 *  스냅샷이 아니라 라이브 행을 직접 조회해야 했다. `selected/skipped` 만 있었으면 한 번에 보였다. */
export interface NaverEnrichDiag {
  tried: number; measured: number; contacts: number; failed: number
  selected?: number   // 후보 SELECT 가 실제로 돌려준 행 수(0 이면 큐가 빈 것 · >0 인데 tried 0 이면 전량 스킵)
  skipped?: number    // 핸들을 못 살려 스킵한 행(= 복구 불가 — healNaverHandles 의 unfixable 과 같은 집합)
  healed?: number     // 🩹 이번 라운드에 channel_id/url 에서 핸들을 되살려 측정한 행
  /** 후보 조회 자체가 실패한 경우의 사유. 없으면 조회는 성공한 것 — `selected:0` 이 '큐가 빔'을 **확정**한다.
   *  (이게 없으면 조회 실패도 `selected:0` 으로 보여 "큐가 비었다"와 구분되지 않는다.) */
  query_error?: string
}

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
export async function enrichNaverActivity(DB: D1Database, budget: FetchBudget, max: number): Promise<NaverEnrichDiag> {
  const diag: NaverEnrichDiag = { tried: 0, measured: 0, contacts: 0, failed: 0 }
  if (max <= 0 || budget.left <= 1) return diag
  // 🩹 `handle IS NOT NULL` 만으로는 부족하다 — 손상 행은 handle 이 `'blog.naver.com'`(호스트)이라 이 조건을
  //    통과한 뒤 아래에서 전량 스킵됐다. channel_id/url 을 함께 읽어 그 자리에서 진짜 id 를 되살린다.
  type NaverRow = { id: number; handle: string | null; channel_id: string | null; url: string | null; email: string | null; instagram: string | null; links: string | null; description: string | null }
  let rows: NaverRow[] = []
  try {
    const res = await DB.prepare(`SELECT id, handle, channel_id, url, email, instagram, links, description FROM ad_influencer_leads
      WHERE account_id = 0 AND platform = 'naver_blog'
      ORDER BY (perf_checked_at IS NULL) DESC, perf_checked_at ASC LIMIT ?`).bind(Math.min(max, 30)).all<NaverRow>()
    rows = res?.results || []
  } catch (err) {
    // 삼키면 `selected:0` 이 되어 '큐가 빔'과 구분이 사라진다 — 이 레인이 tried:0 으로 멈춰 있던 동안
    // 원인 규명이 막혔던 이유가 정확히 이 종류의 무음이었다.
    diag.query_error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 160)}`
    return diag
  }
  diag.selected = rows.length
  if (!rows.length) return diag
  const HOME_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  const stmts = []
  for (const r of rows) {
    // ⏱️ 예산 또는 **벽시계** 소진 — 블로그 fetch 는 건당 최대 16s(RSS 8 + 홈 8)라 예산이 남아도 시간이 먼저 끝난다.
    //   (2026-07-28 파트너풀 레인의 deadline 가드와 같은 이유 — 죽는 대신 여기까지 쓰고 깨끗이 넘긴다.)
    if (budget.left <= 1 || (budget.deadline && Date.now() >= budget.deadline)) break
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
    const wantHome = budget.left >= 2 // 예산이 1 남으면 RSS(활동성)를 우선 — 연락처보다 측정이 먼저다
    budget.left -= wantHome ? 2 : 1
    const [rssXml, homeText] = await Promise.all([
      (async (): Promise<string | null> => {
        try {
          const res = await fetch(`https://rss.blog.naver.com/${encodeURIComponent(handle)}.xml`, { signal: AbortSignal.timeout(8000) })
          if (res.ok) return (await res.text()).slice(0, 120_000)
          if (res.status === 404 || res.status === 410) return '' // 블로그 삭제/비공개 — "측정 성공·글 0"(터미널)
        } catch { /* null = 측정 실패 */ }
        return null
      })(),
      (async (): Promise<string | null> => {
        if (!wantHome) return null
        try {
          const hr = await fetch(`https://m.blog.naver.com/${handle}`, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': HOME_UA, accept: 'text/html' }, redirect: 'follow' })
          if (hr.ok) return (await hr.text()).slice(0, 80_000)
        } catch { /* fail-soft */ }
        return null
      })(),
    ])
    if (rssXml === null && homeText === null) { // 둘 다 실패 — 아무것도 안 쓰고 스탬프만(다음 순환에 재시도, 0-각인 금지)
      diag.failed++
      stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET perf_checked_at = datetime('now') WHERE id = ?`).bind(r.id))
      continue
    }
    const sets: string[] = [`perf_checked_at = datetime('now')`]
    const binds: (string | number)[] = []
    if (rssXml !== null) {
      diag.measured++
      const pubDates = extractPubDates(rssXml)
      sets.push('recent_posts_30d = ?'); binds.push(countRecentPosts(pubDates, Date.now()))
      const newest = pubDates.map(d => Date.parse(d)).filter(Number.isFinite).sort((a, b) => b - a)[0]
      if (newest) { sets.push(`last_post_at = CASE WHEN last_post_at IS NULL OR last_post_at < ? THEN ? ELSE last_post_at END`); binds.push(...[new Date(newest).toISOString().slice(0, 10), new Date(newest).toISOString().slice(0, 10)]) }
      const titles = extractRssTitles(rssXml)
      if (titles.length) { // 글 제목 꼬리 갱신 — 기존 꼬리 제거 후 최신으로 교체(분류 신호 신선 유지)
        const bare = stripVideoTitles(r.description || '').trim()
        sets.push('description = ?'); binds.push(`${bare.slice(0, 300)} | 글: ${titles.join(' · ')}`.slice(0, 500))
      }
    }
    if (homeText !== null) {
      const neighbors = parseNaverNeighborCount(homeText)
      if (neighbors > 0) { sets.push('subscriber_count = CASE WHEN subscriber_count > 0 THEN subscriber_count ELSE ? END'); binds.push(neighbors) }
      const biz = pickBusinessEmail(homeText) // 프로필/위젯 = 본인 페이지 — 본인 연락처(discovery 홈 보강과 동일 기준)
      const c = extractContacts(homeText)
      if ((biz && !r.email) || (c.instagram[0] && !r.instagram) || (c.links.length && !r.links)) diag.contacts++
      if (biz) { sets.push('email = COALESCE(email, ?)'); binds.push(biz) }
      if (c.instagram[0]) { sets.push('instagram = COALESCE(instagram, ?)'); binds.push(c.instagram[0]) }
      if (c.links.length) { sets.push('links = COALESCE(links, ?)'); binds.push(c.links.slice(0, 8).join(' ')) }
    }
    stmts.push(DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, r.id))
  }
  if (stmts.length) await DB.batch(stmts).catch(() => null)
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
  //   조용히 전멸하고(잡히는 예외 없이) 그 사실이 어디에도 안 남는다. collect-budget.ts 주석 참조.
  const budget: FetchBudget = { left: Math.min(platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP), 250) }
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
export async function runReclassifyPool(DB: D1Database, opts?: { budget?: OpBudget }): Promise<{ scanned: number; changed: number; done: boolean }> {
  // 🧭 2026-07-28: OFFSET 전수스캔 → **id 커서**. 무료 플랜 예산(인보케이션당 ~29 D1 연산)에선 한 번에
  //   3.6만 행을 못 돈다 — 커서가 없으면 매 실행이 늘 같은 앞부분만 훑고 뒤쪽은 영원히 미분류로 남는다
  //   (품질 패스가 이미 쓰는 패턴과 동일: 끝까지 돌면 0 으로 리셋해 순환 재검증).
  const CURSOR_KEY = 'ads_reclassify_cursor'
  const PAGE = 3000
  let cursor = 0
  const raw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  if (raw?.value) cursor = Math.max(0, parseInt(raw.value, 10) || 0)

  let scanned = 0, changed = 0, done = false
  for (;;) {
    const rows = (await DB.prepare(`SELECT id, name, description, category FROM ad_influencer_leads
        WHERE account_id = 0 AND id > ? ORDER BY id ASC LIMIT ?`).bind(cursor, PAGE)
      .all<{ id: number; name: string; description: string | null; category: string | null }>().catch(() => null))?.results || []
    if (!rows.length) { if (!opts?.budget?.exhausted) done = true; break }
    const pageStart = cursor
    scanned += rows.length
    const ups: ReturnType<D1Database['prepare']>[] = []
    for (const r of rows) {
      cursor = Math.max(cursor, r.id)
      const byContent = classifyCategory(r.name, r.description)
      if (byContent && byContent !== r.category) ups.push(DB.prepare("UPDATE ad_influencer_leads SET category = ?, category_source = 'content' WHERE id = ? AND account_id = 0").bind(byContent, r.id))
      else if (!byContent && r.category && NON_CATEGORIES.has(r.category)) ups.push(DB.prepare('UPDATE ad_influencer_leads SET category = NULL WHERE id = ? AND account_id = 0').bind(r.id))
    }
    for (let i = 0; i < ups.length; i += 100) await DB.batch(ups.slice(i, i + 100)).catch(() => null)
    changed += ups.length
    if (opts?.budget?.exhausted) { cursor = pageStart; scanned -= rows.length; break } // 쓰기가 잘림 → 이 페이지 재시도
    if (rows.length < PAGE) { done = true; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, String(done ? 0 : cursor)).run().catch(() => null)
  return { scanned, changed, done }
}
