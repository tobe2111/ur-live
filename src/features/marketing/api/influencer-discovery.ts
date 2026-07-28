/**
 * 🆕 2026-07-13 유어애즈 — 인플루언서 발굴/연락처 수집 (대표 "지금 무조건 수집").
 *
 *   ⚖️ 합법·즉시 동작 경로: **YouTube Data API v3**(공식, `YOUTUBE_API_KEY` 보유, OAuth·승인 불필요).
 *   키워드로 채널을 검색해 공개 지표(구독자/조회수)를 얻고, **API가 공식 반환하는 채널 설명(description)
 *   텍스트에서** 크리에이터가 스스로 공개한 비즈니스 이메일 + 인스타/틱톡 링크를 추출한다
 *   (숨겨진 필드 스크래핑이 아니라 공개 텍스트 파싱 — 유튜버는 설명란에 타 SNS·문의처를 교차게시하므로
 *   유튜브 1개 API 로 3플랫폼 핸들+연락처를 동시에 수집 가능).
 *
 *   ⚠️ 수집은 합법이나 **활용은 별개**: 수집한 이메일/연락처로 광고성 정보를 보내려면 정보통신망법상
 *   사전 수신동의가 필요(콜드 발송 위법). 이 모듈은 수집·정리까지만 담당 — 발송 자동화는 하지 않는다.
 *   개인정보 최소화: 원시 IP/UA 등은 저장 안 하고, 크리에이터가 공개한 비즈니스 컨택만 기록.
 */

import { resolveCategory, classifyCategory } from './influencer-classify'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

export interface ExtractedContacts { emails: string[]; instagram: string[]; tiktok: string[]; links: string[] }

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
const IG_RE = /(?:instagram\.com|instagr\.am)\/([A-Za-z0-9_.]{2,40})/gi
// 🆕 키워드+@ 근접형 — URL 없이 "인스타 @foodie", "IG: @foodie_kim", "insta @x" 처럼 쓴 핸들 포착.
//   @ 를 필수로 둬 "instagram is great" 같은 일반 문장 오탐을 원천 차단(@뒤 토큰만 핸들로 인정).
//   (?<![A-Za-z]) = 앞이 영문자면 매칭 안 함 → "big @brand" 의 "ig" 오탐 차단(짧은 키워드 ig/insta 보호).
const IG_AT_RE = /(?<![A-Za-z])(?:인스타(?:그램)?|instagram|insta|ig)\s*[:：]?\s*@([A-Za-z0-9_.]{2,30})/gi
const TT_RE = /tiktok\.com\/@?([A-Za-z0-9_.]{2,40})/gi
const TT_AT_RE = /(?<![A-Za-z])(?:틱톡|tiktok)\s*[:：]?\s*@([A-Za-z0-9_.]{2,30})/gi
const LINKINBIO_RE = /(?:linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|link\.bio|taplink\.cc)\/[A-Za-z0-9_.\-/]{1,60}/gi
// 🔗 유튜브·블로그 교차링크(다른 SNS 를 프로필에 교차게시) — 완전 URL 형만(오탐 최소). links 로 함께 수집.
const YT_URL_RE = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:@[A-Za-z0-9_.\-]{2,40}|channel\/[A-Za-z0-9_-]{4,40}|c\/[A-Za-z0-9_.\-]{2,40}|user\/[A-Za-z0-9_.\-]{2,40})|youtu\.be\/[A-Za-z0-9_-]{4,20})/gi
const BLOG_URL_RE = /https?:\/\/(?:[A-Za-z0-9_-]{2,40}\.tistory\.com|(?:m\.)?blog\.naver\.com\/[A-Za-z0-9_-]{2,40}|brunch\.co\.kr\/@[A-Za-z0-9_.\-]{2,40})/gi
// 핸들 정규화 — @ 제거·소문자·후행 구두점(.,) 제거(uniqLower 전 적용). "@Foodie_Kim." → "foodie_kim".
const normHandle = (h: string): string => h.trim().replace(/^@+/, '').replace(/[.,]+$/, '').toLowerCase()
// URL 스킴 보장 — Naver 검색 API 의 bloggerlink/cafeurl 은 스킴 없이 오기도 함("blog.naver.com/id").
//   스킴 없이 저장하면 <a href> 가 상대경로로 해석돼 404 → 항상 https:// 부여.
const ensureScheme = (u: string): string => (u && !/^https?:\/\//i.test(u) ? 'https://' + u.replace(/^\/+/, '') : u)
// 이메일 오탐 필터 — 이미지/파일 확장자로 끝나는 건 컨택 아님.
const NOT_EMAIL_SUFFIX = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)$/i

/**
 * 🕵️ 이메일 난독화 복원 — 크리에이터가 봇 회피용으로 흩어 쓴 이메일을 표준형으로 되살린다(EMAIL_RE 매칭 전 적용).
 *   "abc [at] gmail [dot] com" · "abc(엣)naver.com" · "abc 골뱅이 gmail.com" · "abc@gmail．com" · "abc @ gmail . com".
 *   순수함수(단위테스트) — @ 뒤 도메인 맥락에서만 공백·점을 정리해 일반 문장 오염을 피한다.
 */
export function deobfuscateEmail(text: string): string {
  let t = String(text || '')
  // ① 괄호/대괄호 마커: [at] (at) {at} → @ · [dot] (dot) {dot} → .  (영문 at/dot + 한글 골뱅이/앳/엣/점)
  t = t.replace(/\s*[[({]\s*(?:at|@|골뱅이|앳|엣)\s*[\])}]\s*/gi, '@')
  t = t.replace(/\s*[[({]\s*(?:dot|점)\s*[\])}]\s*/gi, '.')
  // ② 한글 골뱅이/전각 @ → @ · 전각 점(．·)·가운뎃점 → .
  t = t.replace(/골뱅이|앳|＠/g, '@').replace(/[．]/g, '.')
  // ③ 단어형 " at " — **뒤에 " dot " 난독화가 이어질 때만** @로(영어 전치사 "at" 오탐 방지: "products at home.com"→가짜 이메일 금지). 공백 낀 리터럴 @ 는 ④가 처리.
  t = t.replace(/([A-Za-z0-9._%+-])\s+at\s+(?=[A-Za-z0-9][A-Za-z0-9\-]*\s+dot\s+)/gi, '$1@')
  t = t.replace(/([A-Za-z0-9])\s+dot\s+([A-Za-z]{2,})/gi, '$1.$2')
  // ④ @ 주변 공백 제거 + @ 뒤 도메인의 점 주변 공백 제거(@ 있는 토큰 한정 — 일반 마침표 미접촉).
  //   "biz @ daum . net" 처럼 점 양옆 공백도 흡수(도메인 마지막 라벨 앞 `\s*\.\s*`).
  t = t.replace(/([A-Za-z0-9._%+-]+)\s*@\s*([A-Za-z0-9][A-Za-z0-9\-]*?(?:\s*\.\s*[A-Za-z]{2,})+)/g, (_m, a, b) => `${a}@${String(b).replace(/\s+/g, '')}`) // 도메인 라벨에 공백 불허(과거 "DM @ourteam for rates . more"→가짜메일 방지). 점 양옆 공백만 \s*\.\s* 로 흡수.
  return t
}

const uniqLower = (arr: string[]): string[] => Array.from(new Set(arr.map(s => s.trim().toLowerCase()))).filter(Boolean)

const PLATFORM_LABEL_LOCAL_RE = /^(insta|instagram|ig|tiktok|틱톡|인스타|인스타그램|youtube|yt|facebook|fb|twitter|threads|telegram|텔레그램|kakao|kakaotalk|카톡|x)$/i // 🛡️ F-01: "insta @sunny.day"→insta@sunny.day 가짜 이메일 날조 차단(로컬파트=플랫폼 라벨이면 "라벨+@핸들" 표기)
export const isPlatformLabelEmail = (e: string): boolean => PLATFORM_LABEL_LOCAL_RE.test(e.split('@')[0] || '')

/** 🏷️ 영상 제목 세그먼트(" | 영상: …") 제거 — 컨택 재추출/해시태그 마이닝의 타인 핸들·캠페인 태그 오수집 방지(제목=분류 전용). */
export const stripVideoTitles = (s: string): string => String(s || '').replace(/\s\|\s(?:영상|글):[\s\S]*$/, '')

// 🧹 노이즈 판별 — 개인 인플루언서가 아닌 게 거의 확실한 계정(뉴스·방송·기관·체험단모집·마케팅대행).
//   보수적(오탐 최소) — bare 체험단/서포터즈/대행사 는 정상 창작자(협찬 환영·"대행사 아님") 오제외라 '…모집'·부정문만 노이즈.
const NOISE_RE =/(뉴스|신문사|방송국|아나운서|연합뉴스|\b(?:ytn|jtbc|kbs|mbc|sbs)\b|체험단\s*모집|서포터즈\s*모집|기자단\s*모집|리뷰어\s*모집|블로그\s*마케팅|바이럴\s*마케팅|마케팅\s*대행|광고\s*대행|대행사(?!\s*(?:아님|아니))|주민센터|재단법인|사단법인)/i
export function isLikelyNoise(name?: string | null, description?: string | null): boolean {
  return NOISE_RE.test(`${name || ''} ${description || ''}`)
}

/** 공개 텍스트(채널/영상 설명)에서 컨택 추출 — 순수함수(단위테스트 잠금). */
export function extractContacts(text: string): ExtractedContacts {
  const t = String(text || '')
  // 이메일은 난독화 복원본에서 추출(핸들/링크는 원문 — URL 훼손 방지).
  const emails = uniqLower((deobfuscateEmail(t).match(EMAIL_RE) || []).filter(e => !NOT_EMAIL_SUFFIX.test(e) && !isPlatformLabelEmail(e))).sort((a, b) => (/@(gmail|naver|daum|kakao|hanmail|nate|hotmail|outlook|icloud)\./i.test(b) ? 1 : 0) - (/@(gmail|naver|daum|kakao|hanmail|nate|hotmail|outlook|icloud)\./i.test(a) ? 1 : 0)).slice(0, 5) // 개인도메인 우선 정렬 + 플랫폼라벨 날조(insta@x.day) 제외
  // URL 형 + 키워드+@ 형을 합쳐 정규화(다양한 표기 흡수) — 예약어(p/reel/instagram…) 제외.
  const IG_BAD = ['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'instagram', 'insta', 'about', 'accounts']
  // 라벨형("인스타:@x"=본인선언) 우선, URL형 후순위. 🛡️ 'official' 핸들은 라벨형 제외(협업 브랜드 계정 오수집 방지).
  const atHandles = Array.from(t.matchAll(IG_AT_RE), m => m[1]).filter(h => !/official/i.test(h))
  const instagram = uniqLower([
    ...atHandles,
    ...Array.from(t.matchAll(IG_RE), m => m[1]),
  ].map(normHandle).filter(h => h.length >= 2 && !IG_BAD.includes(h))).slice(0, 5)
  const TT_BAD = ['video', 'tag', 'discover', 'tiktok', 'music', 'foryou']
  const tiktok = uniqLower([
    ...Array.from(t.matchAll(TT_AT_RE), m => m[1]),
    ...Array.from(t.matchAll(TT_RE), m => m[1]),
  ].map(normHandle).filter(h => h.length >= 2 && !TT_BAD.includes(h))).slice(0, 5)
  // 🔗 링크인바이오 + 유튜브/블로그 교차링크(완전 URL) 통합 — 크로스플랫폼 발자국 보존.
  const links = uniqLower([
    ...(t.match(LINKINBIO_RE) || []),
    ...(t.match(YT_URL_RE) || []),
    ...(t.match(BLOG_URL_RE) || []),
  ]).slice(0, 8)
  return { emails, instagram, tiktok, links }
}

// 비즈니스 문의 맥락 키워드 — 이 근처의 이메일이 채널 주인의 컨택일 확률이 높다.
// ⚠️ bare "mail" 은 gmail 등 주소 자체에 오매칭되므로 제외 — 한국어 "메일"/"이메일" 과 명시 문맥어만.
const BIZ_CONTEXT_RE = /(비즈니스|문의|제휴|협찬|광고|연락|섭외|business|inquir|contact|sponsor|collab|partnership|advert|이메일|메일)/i
// 협찬사/서비스/자동응답 등 채널 주인이 아닐 확률이 높은 이메일(감점).
const NON_OWNER_EMAIL_RE = /^(no-?reply|noreply|support|help|admin|contact|info|cs|care|hello|team)@/i

/**
 * 여러 후보 이메일 중 **채널 주인의 비즈니스 이메일**을 고른다(영상 설명은 협찬사 메일 등 노이즈가 많음).
 *   점수: 비즈니스 문맥어(문의/business…) 근처(±40자) +3 · 개인메일 도메인(gmail/naver/daum/kakao/hanmail) +1
 *        · 서비스/자동응답 계정(support@ 등) −2. 동점이면 먼저 등장한 것. 후보 0개면 null.
 */
// 🛡️ F-04: 당첨자 발표 근처 이메일=시청자 메일. 강신호만(당첨/추첨/사연/퀴즈 — '이벤트 참여'는 정상 문맥에도 흔해 제외).
const WINNER_CONTEXT_RE = /(당첨|추첨|응모\s*하|사연\s*(보내|접수)|퀴즈\s*정답)/gi

export function pickBusinessEmail(text: string, opts?: { requireContext?: boolean }): string | null {
  const t = deobfuscateEmail(String(text || '')) // 난독화 복원 후 문맥 점수 계산(around 컨텍스트도 복원본 기준).
  const raw = uniqLower((t.match(EMAIL_RE) || []).filter(e => !NOT_EMAIL_SUFFIX.test(e) && !isPlatformLabelEmail(e))).slice(0, 12)
  if (!raw.length) return null
  const lower = t.toLowerCase()
  // 당첨 문맥은 **가장 가까운 이메일 1개에만** 귀속(±40) — 창 방식은 앞 이메일의 뒤창이 다음 문장까지 물어 오귀속.
  const emailPos = raw.map(e => ({ e, idx: lower.indexOf(e) })).filter(p => p.idx >= 0)
  const winnerPenalized = new Set<string>()
  WINNER_CONTEXT_RE.lastIndex = 0
  for (let wm = WINNER_CONTEXT_RE.exec(t); wm !== null; wm = WINNER_CONTEXT_RE.exec(t)) {
    let bestE: string | null = null; let bestD = Infinity
    for (const { e, idx } of emailPos) {
      const d = wm.index < idx ? Math.max(0, idx - (wm.index + wm[0].length)) : Math.max(0, wm.index - (idx + e.length))
      if (d < bestD) { bestD = d; bestE = e }
    }
    if (bestE && bestD <= 40) winnerPenalized.add(bestE)
  }
  let best: string | null = null; let bestScore = -Infinity; let bestIdx = Infinity; let bestHasCtx = false
  for (const { e: email, idx } of emailPos) {
    const around = t.slice(Math.max(0, idx - 40), idx + email.length + 10)
    const hasCtx = BIZ_CONTEXT_RE.test(around)
    let score = 0
    if (/@(gmail|naver|daum|kakao|hanmail|nate|hotmail|outlook|icloud)\./i.test(email)) score += 5 // 개인도메인=창작자 본인(대행사/MCN 코퍼레이트 메일보다 지배적 — 협찬사 오수집 방지)
    if (hasCtx) score += 2
    if (winnerPenalized.has(email)) score -= 6 // 당첨자 발표 메일 — 개인도메인 가점(+5)을 상쇄하고도 남게
    if (NON_OWNER_EMAIL_RE.test(email)) score -= 3
    if (score > bestScore || (score === bestScore && idx < bestIdx)) { best = email; bestScore = score; bestIdx = idx; bestHasCtx = hasCtx }
  }
  // requireContext: 비즈니스 문맥어 근처의 이메일만 인정(블로그/카페 검색 스니펫 = 글 본문이라 제3자 메일 위험 — 문맥 없으면 버림).
  if (opts?.requireContext && !bestHasCtx) return null
  return best
}

export interface InfluencerLead {
  platform: string; channel_id: string; handle: string | null; name: string; url: string
  subscriber_count: number; view_count: number; video_count: number
  country: string | null; thumbnail: string | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  description: string
  last_post_at?: string | null // 📝 블로거 마지막 글 날짜(YYYY-MM-DD, 검색 API postdate) — RSS 차단 무관 활동 신호
}

interface YTSearchResp { items?: Array<{ id?: { channelId?: string }; snippet?: { channelId?: string } }>; nextPageToken?: string; error?: { message?: string; errors?: Array<{ reason?: string }> } }
interface YTChannelsResp {
  items?: Array<{
    id: string
    snippet?: { title?: string; description?: string; customUrl?: string; country?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } }
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean }
    brandingSettings?: { channel?: { description?: string; keywords?: string } }
    contentDetails?: { relatedPlaylists?: { uploads?: string } }
  }>
  error?: { message?: string; errors?: Array<{ reason?: string }> }
}
interface YTPlaylistItemsResp { items?: Array<{ snippet?: { title?: string; description?: string } }>; error?: { errors?: Array<{ reason?: string }> } }

/** 🔗 링크인바이오(linktr.ee/litt.ly/인포크 등) 공개 페이지 텍스트 취득 — 소개글엔 없고 링크트리에만
 *  이메일·인스타를 적어둔 인플루언서 커버(공개 웹페이지 = 합법·무료·쿼터 무관). 실패 시 빈 문자열(fail-soft).
 *  링크는 extractContacts 의 LINKINBIO_RE 매칭 결과만 받는다(허용 호스트 외 fetch 없음 — SSRF 방지). */
export async function fetchLinkInBioText(link: string): Promise<string> {
  const m = String(link || '').match(/^(?:https?:\/\/)?((?:linktr\.ee|litt\.ly|inpock\.co\.kr|litelink\.at|link\.bio|taplink\.cc)\/[A-Za-z0-9_.\-/]{1,60})$/i)
  if (!m) return ''
  try {
    const res = await fetch(`https://${m[1]}`, { signal: AbortSignal.timeout(8000), headers: { accept: 'text/html' }, redirect: 'follow' })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 80000) // SSR HTML 에 mailto:/instagram.com 링크가 포함됨 — 상한 컷
  } catch { return '' }
}

/** 채널 최근 영상 스니펫 — descText(설명=이메일/링크 추출용) + titleText(제목=카테고리 신호). playlistItems 1 unit. */
async function fetchRecentVideoSnippets(key: string, uploadsPlaylistId: string): Promise<{ descText: string; titleText: string }> {
  try {
    const url = `${YT_BASE}/playlistItems?part=snippet&maxResults=8&playlistId=${uploadsPlaylistId}&key=${key}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    const data = await res.json() as YTPlaylistItemsResp
    if (!res.ok) return { descText: '', titleText: '' }
    const items = data.items || []
    return { descText: items.map(it => it.snippet?.description || '').join('\n'), titleText: items.map(it => it.snippet?.title || '').filter(Boolean).join(' · ') }
  } catch { return { descText: '', titleText: '' } }
}

export type DiscoverResult =
  | { ok: true; leads: InfluencerLead[] }
  | { ok: false; error: 'NOT_CONFIGURED' | 'QUOTA' | 'FAILED'; message?: string }

/** 🔒 서브리퀘스트 예산(2026-07-20) — Cloudflare Worker 1회 실행의 subrequest 한도 방어.
 *   여러 키워드 발굴이 한 cron 실행에 누적돼 "Too many subrequests" 로 중도 실패하던 사고 방지.
 *   호출자가 공유 객체를 넘기면 각 외부 fetch 전에 소진 → 0 이 되면 발굴을 우아하게 조기 종료(에러 아님).
 *   미전달이면 무제한(단건 수동 발굴 등 기존 동작 불변). `limitHit`(2026-07-28) = 이번 실행에서 **플랫폼 한도 오류를 실제로 관측**했나 — 예산(left)은 우리가 세는 숫자일 뿐 실제 한도가 아니라, 한도에 부딪힌 사실은 fetch 실패 메시지로만 알 수 있다. 각 레인이 이 플래그를 세우고 호출부가 즉시 중단 + 학습 상한 하향(collect-budget.ts)에 쓴다. */
export type FetchBudget = { left: number; limitHit?: boolean }
const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }

/** YouTube Data API 로 키워드 채널 발굴 + 컨택 추출.
 *  quota: search=100 units/page · channels.list=1/50ch · playlistItems(enrich)=1/ch.
 *  opts.pages: 검색 페이지 수(1~5, 기본 1) — 키워드당 깊이 확장(page 2=51~100위…).
 *  opts.searchType: 'channel'(기본, 채널명·소개에 키워드) | 'video'(그 주제 영상을 올린 채널 — 채널명엔
 *    키워드 없는 소형·신생 크리에이터까지 커버. 같은 쿼터, 다른 그물). video 는 snippet.channelId 로 채널 수집.
 *  opts.order: 검색 정렬 — 'relevance'(관련도) | 'date'(최신, 신생·소형) | 'viewCount'(인기) | 'rating'.
 *    같은 키워드도 정렬을 바꾸면 다른 채널이 나옴 → 매 실행 교대 시 top-N 재탕이 아니라 커버리지가 계속 확장(수렴). */
export async function discoverYouTubeInfluencers(
  env: { YOUTUBE_API_KEY?: string }, keyword: string, opts: { maxResults?: number; enrichMax?: number; pages?: number; budget?: FetchBudget; searchType?: 'channel' | 'video'; order?: 'relevance' | 'date' | 'viewCount' | 'rating' } = {},
): Promise<DiscoverResult> {
  const key = env.YOUTUBE_API_KEY
  if (!key) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  const n = Math.min(50, Math.max(1, Math.round(opts.maxResults || 15)))
  const pages = Math.max(1, Math.min(5, Math.round(opts.pages || 1)))
  const searchType = opts.searchType === 'video' ? 'video' : 'channel'
  // date 정렬은 video 에만 의미(채널 정렬 date 는 지원 약함) → channel 검색이면 relevance/viewCount 만 허용.
  const order = ['relevance', 'date', 'viewCount', 'rating'].includes(opts.order || '')
    ? (searchType === 'channel' && opts.order === 'date' ? 'relevance' : opts.order!) : 'relevance'

  // 1) 검색 — pageToken 으로 pages 만큼 깊이 순회(각 page=100 units). 첫 page 실패는 에러, 이후는 있는 만큼 진행.
  //    channel=채널 결과(id.channelId) / video=영상 결과(snippet.channelId → 그 영상 주인 채널).
  const channelIds: string[] = []
  let pageToken = ''
  for (let p = 0; p < pages; p++) {
    if (outOfBudget(opts.budget)) break // 예산 소진 — 모은 만큼만 처리
    spendBudget(opts.budget)
    const searchUrl = `${YT_BASE}/search?part=snippet&type=${searchType}&maxResults=${n}&order=${order}&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(q)}${pageToken ? `&pageToken=${pageToken}` : ''}&key=${key}`
    let searchData: YTSearchResp
    try {
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(15000) })
      searchData = await res.json() as YTSearchResp
      if (!res.ok) {
        const reason = searchData.error?.errors?.[0]?.reason || ''
        // 일일 쿼터 + **단기 요청 한도(rateLimit)** 둘 다 QUOTA 로 취급 → 호출자가 quotaHit 로 이번 틱 YT 중단
        //   (rateLimit 은 계속 재시도하면 예산만 태우고 전부 실패 — 멈추면 다음 정시에 자동 재개).
        if (['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)) {
          if (p === 0) return { ok: false, error: 'QUOTA', message: reason.startsWith('rate') || reason.startsWith('user') ? 'YouTube 단기 요청 한도 — 다음 시간에 자동 재개됩니다.' : '오늘 YouTube 조회 한도에 도달했습니다. 내일 다시 시도해주세요.' }
          break // 이후 page 만 실패 — 지금까지 모은 것 계속 처리
        }
        if (p === 0) { const detail = reason || searchData.error?.message || `HTTP ${res.status}`; return { ok: false, error: 'FAILED', message: `YouTube 검색 실패: ${detail}` } }
        break
      }
    } catch (e) { if (p === 0) return { ok: false, error: 'FAILED', message: `검색 요청 오류: ${(e as Error)?.message || 'network'}` }; break }
    for (const it of searchData.items || []) { const id = it.id?.channelId || it.snippet?.channelId; if (id) channelIds.push(id) }
    pageToken = searchData.nextPageToken || ''
    if (!pageToken) break // 더 깊은 페이지 없음
  }
  const uniqIds = Array.from(new Set(channelIds))
  if (!uniqIds.length) return { ok: true, leads: [] }

  // 2) 채널 상세 — id 50개씩 배치(channels.list 는 1콜당 최대 50 id/1 unit). contentDetails 로 업로드 재생목록.
  const chItems: NonNullable<YTChannelsResp['items']> = []
  for (let i = 0; i < uniqIds.length; i += 50) {
    if (outOfBudget(opts.budget)) break
    spendBudget(opts.budget)
    const batch = uniqIds.slice(i, i + 50)
    const chUrl = `${YT_BASE}/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${batch.join(',')}&maxResults=50&key=${key}`
    try {
      const res = await fetch(chUrl, { signal: AbortSignal.timeout(15000) })
      const chData = await res.json() as YTChannelsResp
      if (!res.ok) {
        const reason = chData.error?.errors?.[0]?.reason || ''
        if (['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'].includes(reason)) { if (i === 0) return { ok: false, error: 'QUOTA', message: 'YouTube 조회 한도 — 다음 시간에 자동 재개됩니다.' }; break }
        if (i === 0) return { ok: false, error: 'FAILED', message: '채널 정보를 불러오지 못했습니다' }; break
      }
      for (const it of chData.items || []) chItems.push(it)
    } catch { if (i === 0) return { ok: false, error: 'FAILED', message: '채널 요청 중 오류가 발생했습니다' }; break }
  }

  const leads: InfluencerLead[] = chItems.map(ch => {
    const desc = `${ch.snippet?.description || ''}\n${ch.brandingSettings?.channel?.description || ''}\n${(ch.brandingSettings?.channel?.keywords || '').replace(/"/g, ' ')}`.trim() // 🏷️ 채널 등록 키워드(이미 받는 응답)도 분류 신호로 — 정확도↑, 쿼터 0
    const c = extractContacts(desc)
    const custom = ch.snippet?.customUrl || null
    return {
      platform: 'youtube',
      channel_id: ch.id,
      handle: custom,
      name: ch.snippet?.title || '(이름 없음)',
      url: custom ? `https://www.youtube.com/${custom.startsWith('@') ? custom : '@' + custom}` : `https://www.youtube.com/channel/${ch.id}`,
      subscriber_count: ch.statistics?.hiddenSubscriberCount ? 0 : parseInt(ch.statistics?.subscriberCount || '0', 10) || 0,
      view_count: parseInt(ch.statistics?.viewCount || '0', 10) || 0,
      video_count: parseInt(ch.statistics?.videoCount || '0', 10) || 0,
      country: ch.snippet?.country || null,
      thumbnail: ch.snippet?.thumbnails?.medium?.url || ch.snippet?.thumbnails?.default?.url || null,
      email: pickBusinessEmail(desc), // About 이메일도 비즈니스 문맥 우선 선별
      instagram: c.instagram[0] || null,
      tiktok: c.tiktok[0] || null,
      links: c.links.length ? c.links.join(' ') : null,
      description: desc.slice(0, 500),
      // 업로드 재생목록(영상 설명 보충용 — lead 엔 저장 안 함, 아래 enrich 후 제거).
      _uploads: ch.contentDetails?.relatedPlaylists?.uploads,
    } as InfluencerLead & { _uploads?: string }
  })

  // 3) 📧🏷️ 영상 스니펫 보충(playlistItems 1unit/채널, 상한 enrichMax) — 이메일 없거나(영상 더보기 비즈니스메일 커버,
  //    pickBusinessEmail 노이즈 방지) 소개글로 카테고리 분류가 안 되는(영상 제목으로 교정) 채널. 같은 1콜로 둘 다 보강(쿼터 0).
  const enrichMax = Math.max(0, Math.min(30, opts.enrichMax ?? 15))
  const targets = (leads as Array<InfluencerLead & { _uploads?: string }>)
    .filter(l => l._uploads && (!l.email || !classifyCategory(l.name, l.description)))
    .sort((a, b) => b.subscriber_count - a.subscriber_count)
    .slice(0, enrichMax)
  for (const l of targets) {
    if (outOfBudget(opts.budget)) break // 예산 소진 — 컨택 보충 조기 종료(핵심 메타는 이미 수집됨)
    spendBudget(opts.budget)
    const { descText, titleText } = await fetchRecentVideoSnippets(key, l._uploads!)
    if (descText) {
      const c = extractContacts(descText); const bizEmail = pickBusinessEmail(descText)
      if (bizEmail && !l.email) l.email = bizEmail
      if (!l.instagram && c.instagram[0]) l.instagram = c.instagram[0]
      if (!l.tiktok && c.tiktok[0]) l.tiktok = c.tiktok[0]
      if (!l.links && c.links.length) l.links = c.links.join(' ')
    }
    // 🏷️ 영상 제목=카테고리 신호. F-09: 500자 소개글 뒤에 붙이고 재-500 자르면 무효이던 버그 — 소개글 360자로 양보.
    if (titleText) l.description = `${l.description.slice(0, 360)} | 영상: ${titleText}`.slice(0, 500)
  }
  // 내부 필드 제거(저장 스키마엔 없음).
  for (const l of leads as Array<InfluencerLead & { _uploads?: string }>) delete l._uploads

  // 구독자 많은 순.
  leads.sort((a, b) => b.subscriber_count - a.subscriber_count)
  return { ok: true, leads }
}

// ── 네이버 블로거 발굴 (네이버 검색 오픈API — 무료, 보유 키) ────────────────────
//   블로그 검색으로 키워드 상위 노출 블로거를 수집(고유 블로거로 집계). 지표는 없고
//   블로그 링크 + 이름 + 매칭 글 수(활동/관련도 프록시) 제공. 연락처는 글 설명에서 best-effort.
const NAVER_OPENAPI = 'https://openapi.naver.com'
const stripTag = (s: string | undefined) => String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()

/** 네이버 블로그 RSS(공개 피드)로 최근 글 본문 텍스트 취득 — 검색 스니펫보다 풍부해 컨택(이메일/카톡/인스타) 커버.
 *  네이버 오픈API 쿼터와 무관(단순 HTTP GET). 실패/차단 시 빈 문자열(fail-soft). */
async function fetchNaverBlogRss(handle: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(handle)) return ''
  try {
    const res = await fetch(`https://rss.blog.naver.com/${handle}.xml`, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 20000) // 최근 글 몇 개면 충분
  } catch { return '' }
}

/** 🏠 네이버 블로그 **홈(모바일)** 공개 HTML — 프로필 소개글 + 위젯(인스타/링크트리/오픈카톡/이메일)이 여기 있음.
 *  RSS(글 본문)보다 컨택 적중률 높음(블로거는 이메일을 글이 아니라 프로필/위젯에 둠). 공개 페이지 · 쿼터 무관 · fail-soft.
 *  모바일 SSR(m.blog.naver.com)이 데스크톱 iframe 보다 정적 텍스트가 풍부 → 브라우저 UA 로 요청. */
async function fetchNaverBlogHome(handle: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(handle)) return ''
  try {
    const res = await fetch(`https://m.blog.naver.com/${handle}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1', accept: 'text/html' },
      redirect: 'follow',
    })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 80000) // 프로필/위젯 영역에 mailto:·instagram.com·linktr.ee 링크
  } catch { return '' }
}

export async function discoverNaverBloggers(
  clientId: string | undefined, clientSecret: string | undefined, keyword: string, opts: { display?: number; enrichMax?: number; budget?: FetchBudget; sort?: 'sim' | 'date' } = {},
): Promise<DiscoverResult> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  if (outOfBudget(opts.budget)) return { ok: true, leads: [] } // 예산 소진 — 조기 종료(에러 아님)
  spendBudget(opts.budget)
  const display = Math.min(100, Math.max(10, Math.round(opts.display || 50)))
  const sort = opts.sort === 'date' ? 'date' : 'sim' // sim=정확도(관련) / date=최신(신규 블로거 유입)
  const url = `${NAVER_OPENAPI}/v1/search/blog.json?query=${encodeURIComponent(q)}&display=${display}&sort=${sort}`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res) return { ok: false, error: 'FAILED', message: '블로그 검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string; bloggername?: string; bloggerlink?: string; postdate?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: 'FAILED', message: data?.errorMessage || `블로그 검색 오류 (HTTP ${res.status})` }
  // 고유 블로거로 집계(블로그홈 링크 기준).
  const byBlog = new Map<string, InfluencerLead & { _matches: number; _titles: string[] }>()
  for (const it of (data?.items || [])) {
    const home = ensureScheme(String(it.bloggerlink || '').trim()) // 🐛 Naver API 는 스킴 없이 반환 → 상대경로 404 방지
    if (!home) continue
    // 🛡️ F-22: channel_id 정규화(http→https·m. 제거) — 표기 변형이 UNIQUE 를 뚫어 영구 중복되던 것 차단.
    const key = home.replace(/\/$/, '').replace(/^http:\/\//i, 'https://').replace(/^https:\/\/m\./i, 'https://')
    const handle = key.replace(/^https?:\/\/(?:m\.)?blog\.naver\.com\//i, '').replace(/[/?#].*$/, '') || null
    const text = `${stripTag(it.title)} ${stripTag(it.description)}`
    const ex = existingOrNew(byBlog, key, String(it.bloggername || handle || '블로거'), key, handle)
    ex._matches += 1
    // 📝 마지막 글 날짜(postdate YYYYMMDD → YYYY-MM-DD, 매칭 글 중 최신) — RSS 차단과 무관한 활동 신호.
    const pd = /^(\d{4})(\d{2})(\d{2})$/.exec(String(it.postdate || '').trim())
    if (pd) { const iso = `${pd[1]}-${pd[2]}-${pd[3]}`; if (!ex.last_post_at || ex.last_post_at < iso) ex.last_post_at = iso }
    const title = stripTag(it.title).slice(0, 80)
    if (title && ex._titles.length < 4 && !ex._titles.includes(title)) ex._titles.push(title) // 🏷️ 글 제목 = 분류 신호
    const c = extractContacts(text)
    if (!ex.email) { const be = pickBusinessEmail(text, { requireContext: true }); if (be) ex.email = be } // ⚖️ F-03: 스니펫=글 본문 — 문맥 있는 메일만
    if (!ex.instagram && c.instagram[0]) ex.instagram = c.instagram[0]
    if (!ex.tiktok && c.tiktok[0]) ex.tiktok = c.tiktok[0]
    if (!ex.links && c.links.length) ex.links = c.links.join(' ')
    if (!ex.description) ex.description = text.slice(0, 300)
  }
  // 글 제목 묶음을 description 꼬리에 부착(` | 글: ` — stripVideoTitles 가 인지하는 마커) → 카테고리 분류 정확도 ↑.
  for (const ex of byBlog.values()) if (ex._titles.length) ex.description = `${stripVideoTitles(ex.description).slice(0, 300)} | 글: ${ex._titles.join(' · ')}`.slice(0, 500)
  const leads = Array.from(byBlog.values())
    .map(({ _matches, _titles, ...l }) => ({ ...l, video_count: _matches })) // video_count = 매칭 글 수(활동 프록시)
    .sort((a, b) => b.video_count - a.video_count)

  // 📧 컨택 보충 — 이메일 **또는 인스타/링크** 아무 컨택도 없는 블로거를 보강(활동 많은 순 상한 enrichMax).
  //   1차 블로그 홈(프로필·위젯 — 적중률 높음), 홈에서 못 찾고 예산 남으면 2차 RSS(글 본문). 링크트리는
  //   여기서 links 로 잡히고 이후 enrichPoolFromLinkInBio 가 다시 따라가 이메일까지 체인 추출.
  const enrichMax = Math.max(0, Math.min(20, opts.enrichMax ?? 8))
  const targets = leads.filter(l => (!l.email && !l.instagram && !l.links) && l.handle).slice(0, enrichMax)
  for (const l of targets) {
    if (outOfBudget(opts.budget)) break // 예산 소진 — 컨택 보충 조기 종료
    spendBudget(opts.budget)
    let text = await fetchNaverBlogHome(l.handle!)
    let c = text ? extractContacts(text) : { emails: [], instagram: [], tiktok: [], links: [] }
    let biz = text ? pickBusinessEmail(text) : null
    // 홈에서 아무 컨택도 못 찾고 예산 남으면 RSS(글 본문)도 시도.
    if (!biz && !c.instagram[0] && !c.links.length && !outOfBudget(opts.budget)) {
      spendBudget(opts.budget)
      const rss = await fetchNaverBlogRss(l.handle!)
      if (rss) { text = rss; c = extractContacts(rss); biz = pickBusinessEmail(rss) }
    }
    if (!text) continue
    if (biz) l.email = biz
    if (!l.instagram && c.instagram[0]) l.instagram = c.instagram[0]
    if (!l.tiktok && c.tiktok[0]) l.tiktok = c.tiktok[0]
    if (!l.links && c.links.length) l.links = c.links.join(' ')
  }
  return { ok: true, leads }
}

function existingOrNew(m: Map<string, InfluencerLead & { _matches: number; _titles: string[] }>, key: string, name: string, url: string, handle: string | null): InfluencerLead & { _matches: number; _titles: string[] } {
  let ex = m.get(key)
  if (!ex) {
    ex = { platform: 'naver_blog', channel_id: key, handle, name, url, subscriber_count: 0, view_count: 0, video_count: 0, country: 'KR', thumbnail: null, email: null, instagram: null, tiktok: null, links: null, description: '', _matches: 0, _titles: [] }
    m.set(key, ex)
  }
  return ex
}

// ── 네이버 카페 발굴 (네이버 검색 오픈API cafearticle — 무료, 동일 키) ──────────
//   카페는 개인이 아니라 커뮤니티 단위 → 게시글 상위 노출 카페를 집계(카페홈 링크 기준).
//   지표 없음, 매칭 글 수(활동 프록시) + best-effort 컨택. platform='naver_cafe'.
export async function discoverNaverCafes(
  clientId: string | undefined, clientSecret: string | undefined, keyword: string, opts: { display?: number; budget?: FetchBudget; sort?: 'sim' | 'date' } = {},
): Promise<DiscoverResult> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  if (outOfBudget(opts.budget)) return { ok: true, leads: [] } // 예산 소진 — 조기 종료(에러 아님)
  spendBudget(opts.budget)
  const display = Math.min(100, Math.max(10, Math.round(opts.display || 50)))
  const sort = opts.sort === 'date' ? 'date' : 'sim'
  const url = `${NAVER_OPENAPI}/v1/search/cafearticle.json?query=${encodeURIComponent(q)}&display=${display}&sort=${sort}`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res) return { ok: false, error: 'FAILED', message: '카페 검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string; cafename?: string; cafeurl?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: 'FAILED', message: data?.errorMessage || `카페 검색 오류 (HTTP ${res.status})` }
  const byCafe = new Map<string, InfluencerLead & { _matches: number }>()
  for (const it of (data?.items || [])) {
    const home = ensureScheme(String(it.cafeurl || '').trim()) // 🐛 스킴 보장(상대경로 404 방지)
    if (!home) continue
    const key = home.replace(/\/$/, '').replace(/^http:\/\//i, 'https://').replace(/^https:\/\/m\./i, 'https://') // F-22/23 정규화(m.cafe 핸들 오추출·중복 차단)
    const handle = key.replace(/^https?:\/\/(?:m\.)?cafe\.naver\.com\//i, '').replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '') || null
    const text = `${stripTag(it.title)} ${stripTag(it.description)}`
    let ex = byCafe.get(key)
    if (!ex) { ex = { platform: 'naver_cafe', channel_id: key, handle, name: String(it.cafename || handle || '카페'), url: key, subscriber_count: 0, view_count: 0, video_count: 0, country: 'KR', thumbnail: null, email: null, instagram: null, tiktok: null, links: null, description: '', _matches: 0 }; byCafe.set(key, ex) }
    ex._matches += 1
    // ⚖️ F-03: 카페 스니펫 이메일 저장 안 함 — 게시글 제3자 개인 메일 PIPA 위험 최고 표면. 인스타/링크만.
    const c = extractContacts(text)
    if (!ex.instagram && c.instagram[0]) ex.instagram = c.instagram[0]
    if (!ex.links && c.links.length) ex.links = c.links.join(' ')
    if (!ex.description) ex.description = text.slice(0, 300)
  }
  const leads = Array.from(byCafe.values())
    .map(({ _matches, ...l }) => ({ ...l, video_count: _matches }))
    .sort((a, b) => b.video_count - a.video_count)
  return { ok: true, leads }
}

// ── 티스토리 블로거 발굴 (카카오 Daum 블로그 검색 API — 무료 일 3만, 새 소스) ──────────
//   네이버 블로그 엔진과 동형이나 **티스토리 도메인만** 수집(네이버는 기존 엔진이 커버 — 중복 방지).
//   지표 없음, 매칭 글 수(활동 프록시) + 스니펫 컨택. platform='tistory'. 키: KAKAO_REST_API_KEY(KakaoAK).
const KAKAO_DAPI = 'https://dapi.kakao.com'
export async function discoverTistoryBloggers(
  restKey: string | undefined, keyword: string, opts: { size?: number; budget?: FetchBudget; sort?: 'accuracy' | 'recency' } = {},
): Promise<DiscoverResult> {
  if (!restKey) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = (keyword || '').trim()
  if (q.length < 2) return { ok: false, error: 'FAILED', message: '키워드를 2자 이상 입력해주세요' }
  if (outOfBudget(opts.budget)) return { ok: true, leads: [] }
  spendBudget(opts.budget)
  const size = Math.min(50, Math.max(10, Math.round(opts.size || 50)))
  const sort = opts.sort === 'recency' ? 'recency' : 'accuracy'
  const url = `${KAKAO_DAPI}/v2/search/blog?query=${encodeURIComponent(q)}&size=${size}&sort=${sort}`
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${restKey}` }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res) return { ok: false, error: 'FAILED', message: '티스토리 검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { documents?: Array<{ title?: string; contents?: string; url?: string; blogname?: string; thumbnail?: string }>; message?: string } | null
  if (!res.ok) return { ok: false, error: 'FAILED', message: data?.message || `티스토리 검색 오류 (HTTP ${res.status})` }
  const byBlog = new Map<string, InfluencerLead & { _matches: number }>()
  for (const it of (data?.documents || [])) {
    const u = String(it.url || '').trim()
    const m = u.match(/^https?:\/\/([a-z0-9-]{2,40}\.tistory\.com)/i) // 티스토리만(네이버 등 타 플랫폼 skip)
    if (!m) continue
    const host = m[1].toLowerCase()
    const handle = host.replace(/\.tistory\.com$/i, '')
    const home = `https://${host}`
    const text = `${stripTag(it.title)} ${stripTag(it.contents)}`
    let ex = byBlog.get(host)
    if (!ex) { ex = { platform: 'tistory', channel_id: home, handle, name: String(it.blogname || handle || '티스토리'), url: home, subscriber_count: 0, view_count: 0, video_count: 0, country: 'KR', thumbnail: it.thumbnail || null, email: null, instagram: null, tiktok: null, links: null, description: '', _matches: 0 }; byBlog.set(host, ex) }
    ex._matches += 1
    const c = extractContacts(text)
    if (!ex.email) { const be = pickBusinessEmail(text, { requireContext: true }); if (be) ex.email = be } // ⚖️ F-03: 스니펫=글 본문 — 문맥 있는 메일만
    if (!ex.instagram && c.instagram[0]) ex.instagram = c.instagram[0]
    if (!ex.tiktok && c.tiktok[0]) ex.tiktok = c.tiktok[0]
    if (!ex.links && c.links.length) ex.links = c.links.join(' ')
    if (!ex.description) ex.description = text.slice(0, 300)
  }
  const leads = Array.from(byBlog.values())
    .map(({ _matches, ...l }) => ({ ...l, video_count: _matches }))
    .sort((a, b) => b.video_count - a.video_count)
  return { ok: true, leads }
}

// ── 저장/관리 (계정별 리드 DB) ────────────────────────────────────────────────
export interface LeadRow extends InfluencerLead { id: number; status: string; memo: string | null; collected_at: string; category: string | null; source_keyword: string | null }

// ⚠️ 2026-07-21: 동시성 안전 — 인-플라이트 Promise 캐시(완료 후 재사용). 이전 WeakSet 방식은 ALTER
//   *완료 전에* 플래그를 세워, 병렬 요청(어드민 목록+통계 동시 로드)에서 한쪽이 컬럼 추가 중일 때
//   다른 쪽이 '이미 완료'로 착각하고 신규 컬럼 SELECT → 'no such column' → 빈 목록(배포마다 재발).
//   이제 두 요청이 *같은 Promise* 를 await → 컬럼 존재 보장 후에만 조회 진행.
const _schemaPromise = new WeakMap<object, Promise<void>>()
export function ensureInfluencerSchema(DB: D1Database): Promise<void> {
  const cached = _schemaPromise.get(DB)
  if (cached) return cached
  const p = _ensureInfluencerSchema(DB)
  _schemaPromise.set(DB, p)
  return p
}
async function _ensureInfluencerSchema(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_influencer_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    platform TEXT NOT NULL DEFAULT 'youtube',
    channel_id TEXT NOT NULL,
    handle TEXT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    subscriber_count INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    video_count INTEGER NOT NULL DEFAULT 0,
    country TEXT,
    thumbnail TEXT,
    email TEXT,
    instagram TEXT,
    tiktok TEXT,
    links TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    category TEXT,
    source_keyword TEXT,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, platform, channel_id)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_acct ON ad_influencer_leads(account_id, id)').run().catch(() => null)
  // 기존 테이블(구버전) 대비 컬럼 보강 — 이미 있으면 catch 로 무시(자동 수집 출처 분류용).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN category TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN source_keyword TEXT').run().catch(() => null)
  // 아웃리치 후속 관리 — 컨택 시점 + 다음 팔로업 예정일(무응답 리드 추적용).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN contacted_at DATETIME').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN follow_up_at DATETIME').run().catch(() => null)
  // 컨택 채널(이메일/인스타DM/네이버쪽지/카톡/전화/기타) — memo 규칙 대신 구조화 필드.
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN contact_channel TEXT').run().catch(() => null)
  // ✍ 개인화 제안 초안(JSON {subject,body,dm,generated_at}) — 생성만, 발송 없음(정보통신망법).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN outreach_draft TEXT').run().catch(() => null)
  // 🔗 링크인바이오 보강 시도 시각 — NULL 이면 미시도(cron 이 잔여 예산으로 순차 소진, 재시도 폭주 방지).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN bio_checked_at DATETIME').run().catch(() => null)
  // 📥 유입 출처(자동수집=NULL/'auto', 인바운드 신청='inbound') + 사전동의 시각(인바운드=신청 시 기록 → 자유 연락 가능).
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN source TEXT').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN consented_at DATETIME').run().catch(() => null)
  // 📈 성과 지표(2026-07-21) — YT 최근 영상 ≤10 평균 조회/댓글, 네이버 RSS 30일 포스팅 수, 수집 스탬프.
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN recent_avg_views INTEGER').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN recent_avg_comments INTEGER').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN recent_posts_30d INTEGER').run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_influencer_leads ADD COLUMN perf_checked_at DATETIME').run().catch(() => null)
}

/** 발굴 결과를 계정 DB 에 저장(멱등 — 이미 있는 채널은 skip, 수동편집 보존). 반환: 신규 저장 수. */
export async function saveInfluencerLeads(
  DB: D1Database, accountId: number, leads: InfluencerLead[],
  meta?: { category?: string | null; sourceKeyword?: string | null },
): Promise<number> {
  await ensureInfluencerSchema(DB)
  const sourceKeyword = meta?.sourceKeyword ?? null
  let saved = 0
  for (const l of leads) {
    // 🧹 노이즈 + YT 구독자 1000 미만 제외. 예외(F-25): 구독자 비공개(API 0)는 총조회 200만+ 면 대형으로 통과.
    const ytTooSmall = l.platform === 'youtube' && (l.subscriber_count || 0) < 1000 && !((l.subscriber_count || 0) === 0 && (l.view_count || 0) >= 2_000_000)
    if (isLikelyNoise(l.name, l.description) || ytTooSmall) continue
    // 🏷️ 콘텐츠(이름+소개글) 신호 우선 분류 — 키워드 상속의 오분류('자동'/교차 카테고리) 방지.
    const category = resolveCategory(l.name, l.description, meta?.category)
    const r = await DB.prepare(`INSERT OR IGNORE INTO ad_influencer_leads
      (account_id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, category, source_keyword)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(accountId, l.platform, l.channel_id, l.handle, l.name.slice(0, 120), l.url, l.subscriber_count, l.view_count, l.video_count,
        l.country, l.thumbnail, l.email, l.instagram, l.tiktok, l.links, l.description.slice(0, 500), category, sourceKeyword)
      .run().catch(() => null)
    if (r?.meta?.changes === 1) saved++
  }
  return saved
}

export async function listInfluencerLeads(DB: D1Database, accountId: number, filter: { status?: string; hasContact?: boolean } = {}): Promise<LeadRow[]> {
  await ensureInfluencerSchema(DB)
  const where = ['account_id = ?']
  const binds: (string | number)[] = [accountId]
  if (filter.status && ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasContact) where.push('(email IS NOT NULL OR instagram IS NOT NULL OR tiktok IS NOT NULL OR links IS NOT NULL)')
  const r = await DB.prepare(`SELECT id, platform, channel_id, handle, name, url, subscriber_count, view_count, video_count, country, thumbnail, email, instagram, tiktok, links, description, status, memo, category, source_keyword, collected_at
    FROM ad_influencer_leads WHERE ${where.join(' AND ')} ORDER BY subscriber_count DESC, id DESC LIMIT 500`)
    .bind(...binds).all<LeadRow>().catch(() => null)
  return r?.results || []
}

export async function updateInfluencerLead(DB: D1Database, accountId: number, id: number, patch: { status?: string; memo?: string; follow_up_at?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureInfluencerSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    // 아웃리치 파이프라인: 신규→컨택함→관심→계약 / 거절·보류.
    if (!['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold'].includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
    // 컨택 이후 단계로 넘어가면 최초 컨택 시점 기록(이미 있으면 유지).
    if (['contacted', 'interested', 'contracted'].includes(patch.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push(patch.memo.slice(0, 500) || null) }
  if (patch.follow_up_at !== undefined) {
    const f = patch.follow_up_at
    if (f === null || f === '') { sets.push('follow_up_at = NULL') }
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return { ok: false, error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다' }
  }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE ad_influencer_leads SET ${sets.join(', ')} WHERE id = ? AND account_id = ?`).bind(...binds, id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteInfluencerLead(DB: D1Database, accountId: number, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureInfluencerSchema(DB)
  const r = await DB.prepare('DELETE FROM ad_influencer_leads WHERE id = ? AND account_id = ?').bind(id, accountId).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}
