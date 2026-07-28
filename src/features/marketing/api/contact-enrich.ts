/**
 * 📇 연락처 확보 폭포수(waterfall) — 여러 공개 경로를 순차 시도, 찾으면 멈춤, 다 실패하면 비워둠(허위 0).
 *   전화: ① 카카오 로컬 API(업체 등록 전화) → ② 홈페이지 tel: 추출 → ③ 네이버 역조회(엄격 매칭)
 *   이메일: ① 홈페이지 게시 이메일 크롤(root + /contact,/about)
 *   각 연락처에 **출처(provenance)** 를 함께 반환 → "어디서 왔는지" 투명. 전부 업체가 공개한 것만.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import { type FetchBudget, pickBusinessEmail } from './influencer-discovery'
import { isSubrequestLimitError } from './collect-budget'

const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }

/**
 * 🛑 외부 fetch 공용 래퍼 — 실패를 **삼키지 않고 원인을 남긴다**(2026-07-28 실측 진단).
 *
 *   배경: 크롤 59건 중 `no_contact`(이메일 미게시) 0건 · fetch 실패 45건 = **HTML 을 한 장도 못 받은**
 *   전역 실패였는데, 모든 fetch 가 `.catch(() => …)` 로 에러를 버려서 "왜"가 영영 안 보였다.
 *   플랫폼 서브리퀘스트 한도("Too many subrequests")에 부딪히면 그 인보케이션의 이후 fetch 가 **전부**
 *   throw 하므로, 한 번 관측되면 남은 작업은 의미가 없다 → 예산 객체에 표식을 남겨 호출부가 즉시 중단한다.
 *   (한도 자체는 코드가 알 수 없어 관측 학습 — collect-budget.ts)
 */
async function safeFetch(url: string, init: RequestInit & { timeoutMs?: number }, budget?: FetchBudget, errSink?: { msg: string }): Promise<Response | null> {
  const { timeoutMs = 8000, ...rest } = init
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    const msg = String(e?.message || '')
    // 예외 이름·메시지를 그대로 남긴다(추측 금지) — AbortError=상대 서버 무응답 · TypeError "Too many
    //   subrequests"=워커 한도 소진 · 그 외=DNS/TLS/연결거부. 상태줄 실패 샘플에서 이 문자열로 판정한다.
    if (errSink) errSink.msg = `${e?.name || 'Error'}: ${msg.slice(0, 70)}`
    if (isSubrequestLimitError(msg) && budget) budget.limitHit = true
    return null
  }
}
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const norm = (s: string) => s.replace(/\s+/g, '')

// 템플릿/플랫폼 기본값·플레이스홀더 — 업체 실이메일이 아님(게시돼 있어도 스킵, 허위 방지).
const JUNK_EMAIL = /@(?:sentry\.|wixpress\.com|example\.|your-?domain|yourdomain|domain\.com|email\.com|test\.com|sample\.|godaddy|cloudflare|w3\.org|schema\.org|sentry\.io|abc\.com|company\.com)|^(?:example|test|sample|your-?email|yourname|user|name|id)@/i
/** 📰 뉴스룸 계정 로컬파트(press11@·jebo@·desk@…) — 언론사/보도자료 페이지에서 긁힌 이메일은 B2B 영업에
 *  무의미한 오염(2026-07-27 대표 스크린샷: press11@daum.net·pcoop@pressian.com). 크롤 채택 거부 + 소급 스윕 공용. */
export const NEWSROOM_EMAIL_LOCAL = /^(?:press|news|newsroom|newsdesk|desk|reporter|editor|jebo|bodo)[\d._-]*@/i
/** 📰 언론사성 호스트(수집 제외 + 크롤 거부 공용) — 뉴스 포털 루트에서 webmaster@ 류가 긁히는 것 차단. */
export const NEWS_MEDIA_HOST = /(^|\.)((?:[a-z0-9-]*)(?:news|ilbo|daily|press|journal|times)[a-z0-9-]*)\.(?:co\.kr|com|kr|net)$/i
/** 🔢 크롤/추출 규칙 버전 (2026-07-28 실측 — 개선한 크롤러가 7일 쿨다운에 막혀 기존 백로그를 못 만나던 문제).
 *  보강 대상 쿼리가 `COALESCE(enrich_v,0) < CRAWL_RULES_VERSION` 인 행도 포함하므로, **크롤 경로·추출기를
 *  개선하면 이 값을 +1** → 이전 크롤러로 실패한 전량이 즉시 재시도 대상이 된다(분류 규칙 버전과 동일 철학).
 *  v2 = 엔티티/태그분할 복원 · JSON-LD · 사이트맵 발견 · 호스트 변형 폴백.
 *  v3 (2026-07-28) = 사이트당 fetch 캡(5경로 + MAX_PAGES) — v2 의 12경로가 예산을 2배 먹어 크롤 사이트 수가
 *  반토막나던 회귀 수리. 이전 v2 시도분(적중 0%)을 전량 재시도해야 하므로 버전 bump.
 *  v4 (2026-07-28) = fetch 실패 상태코드 분류(403/404/5xx/network) + 실패 URL 샘플 — 원인 특정용 재시도.
 *  v5 (2026-07-28) = 서브리퀘스트 한도 관측·중단(safeFetch). v4 까지의 '실패' 대다수는 사이트 문제가 아니라
 *    **한도 초과 뒤 무의미하게 시도된 것**이고, 그 행들이 실패 도장(7일 쿨다운)까지 받아 재시도 풀에서
 *    이탈해 있었다 → 버전 bump 로 그 오염분을 전량 즉시 재시도 대상으로 되돌린다. */
export const CRAWL_RULES_VERSION = 5
const EMAIL_STRICT = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i
const MAILTO_RE = /mailto:([^"'?>\s]+)/gi
/** 게시 가능 이메일 판정 공용(형식+정크+뉴스룸) — 추출기·JSON-LD 스캔이 같은 기준. */
const publishableEmail = (e: string, allowNewsroom = false): boolean =>
  EMAIL_STRICT.test(e) && !JUNK_EMAIL.test(e) && (allowNewsroom || !NEWSROOM_EMAIL_LOCAL.test(e))
/** HTML 엔티티형 이메일 난독 복원(&#64;→@ 등) — 국내 CMS 안티봇 출력에 흔함(2026-07-27 크롤 고도화). */
const decodeEmailEntities = (s: string): string =>
  s.replace(/&#0*64;|&commat;/gi, '@').replace(/&#0*46;|&period;/gi, '.').replace(/&#0*45;/g, '-')

/**
 * 📧 HTML 에서 **게시된** 이메일 1개 추출 — 추측·조합 절대 없음.
 *   ① `mailto:` href(업체가 명시적으로 건 연락 링크 = 최고 신뢰) 우선 → ② 본문 pickBusinessEmail(난독복원+문맥점수).
 *   플랫폼 기본값/플레이스홀더(JUNK_EMAIL)는 제외. 못 찾으면 null.
 */
export function extractEmailFromHtml(html: string, allowNewsroom = false): string | null {
  const src = decodeEmailEntities(String(html || '')) // &#64; 류 엔티티 난독 복원 후 스캔
  const mailtos: string[] = []
  const re = new RegExp(MAILTO_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let e = m[1]
    try { e = decodeURIComponent(e) } catch { /* 원문 유지 */ }
    e = e.trim().toLowerCase()
    if (publishableEmail(e, allowNewsroom)) mailtos.push(e)
  }
  if (mailtos.length) {
    // mailto 다수면 비즈니스 문맥(문의/contact)으로 선별, 아니면 첫 번째.
    const biz = pickBusinessEmail(mailtos.map(e => `문의 ${e}`).join(' '))
    return (biz && publishableEmail(biz, allowNewsroom)) ? biz : mailtos[0]
  }
  const body = pickBusinessEmail(src)
  if (body && publishableEmail(body, allowNewsroom)) return body
  // 태그로 쪼갠 이메일("info<span>@</span>domain.com") — 태그 제거본 재스캔(2026-07-27 크롤 고도화).
  const stripped = pickBusinessEmail(src.replace(/<[^>]+>/g, ' '))
  return stripped && publishableEmail(stripped, allowNewsroom) ? stripped : null
}
/** ☎️ 실존 국번 검증 — 2026-07-27 대표 신고 "0405-120-0000 같은 번호" (페이지의 날짜/ID 숫자열 오인).
 *   한국에 존재하는 국번만 통과: 02 / 지역(031~033·041~044·051~055·061~064) / 휴대(01X) / 070 / 050X / 15·16·18XX. */
export function isValidKrPhone(phone: string | null | undefined): boolean {
  const d = String(phone || '').replace(/\D/g, '')
  if (/^(15|16|18)\d{2}\d{4}$/.test(d)) return true            // 대표번호 8자리
  if (/^02\d{7,8}$/.test(d)) return true                        // 서울 9~10자리
  if (/^0(3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/.test(d)) return true // 지역 10~11자리
  if (/^01[016789]\d{7,8}$/.test(d)) return true                // 휴대 10~11자리
  if (/^070\d{7,8}$/.test(d)) return true                       // 인터넷전화
  if (/^050\d{8,9}$/.test(d)) return true                       // 안심번호
  return false
}

// 한국 전화번호 추출 — 국번 화이트리스트(isValidKrPhone) + 숫자 경계((?<!\d)/(?!\d)) 로 긴 숫자열 조각 오탐 차단.
const PHONE_RE = /(?<!\d)(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})(?!\d)|(?<!\d)(1[568]\d{2})[-.\s]?(\d{4})(?!\d)/g
function pickPhone(text: string): string | null {
  const m = String(text || '').match(PHONE_RE)
  if (!m) return null
  const clean = m.map(x => x.replace(/[^\d]/g, '')).filter(d => isValidKrPhone(d))
  return clean[0] ? clean[0].replace(/(\d{2,4})(\d{3,4})(\d{4})$/, '$1-$2-$3') : null
}

/** 주소 지문 토큰(번지/동/로) — 두 주소가 같은 실매장인지 판정. */
const addrTokens = (s: string) => new Set((s || '').replace(/\s+/g, ' ').match(/[가-힣]+[동로길]|\d+(-\d+)?/g) || [])
function sameAddr(a: string, b: string): boolean {
  const ta = addrTokens(a), tb = addrTokens(b)
  if (!ta.size || !tb.size) return false
  let shared = 0; for (const t of ta) if (tb.has(t)) shared++
  return shared >= 2
}

/** ① 카카오 로컬 API — 네이버와 달리 **전화번호를 준다**. 상호 완전일치 + 주소 동일매장일 때만 채택(허위 방지). */
export async function kakaoLocalLookup(key: string, name: string, region: string | null, storeAddr: string, budget?: FetchBudget): Promise<{ phone: string | null; website: string | null }> {
  if (!key || outOfBudget(budget)) return { phone: null, website: null }
  spendBudget(budget)
  const q = `${name} ${region || ''}`.trim()
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=5`
  const res = await safeFetch(url, { headers: { Authorization: `KakaoAK ${key}` }, timeoutMs: 10000 }, budget)
  if (!res || !res.ok) return { phone: null, website: null }
  const data = await res.json().catch(() => null) as { documents?: Array<{ place_name?: string; phone?: string; road_address_name?: string; address_name?: string; place_url?: string }> } | null
  const want = norm(name)
  for (const d of (data?.documents || [])) {
    const hit = norm(stripTag(d.place_name))
    if (!hit) continue
    const nameOk = hit === want || (want.length >= 2 && (hit.includes(want) || want.includes(hit)))
    if (!nameOk) continue
    const kakaoAddr = stripTag(d.road_address_name || d.address_name)
    if (storeAddr && !sameAddr(storeAddr, kakaoAddr)) continue // 주소 불일치 → 다른 매장 → 스킵
    const phone = (d.phone || '').trim()
    if (phone) return { phone, website: (d.place_url || '').trim() || null }
  }
  return { phone: null, website: null }
}

/** ①-b 네이버 지역검색 — 매장 **홈페이지 링크(`link`)** 를 준다(카카오 place_url 은 지도페이지라 이메일 크롤 불가).
 *   상호 완전일치 + 주소 동일매장일 때만 채택(허위 방지). 이메일 발견의 관문(link → 크롤). */
export async function naverLocalLookup(clientId: string, clientSecret: string, name: string, region: string | null, storeAddr: string, budget?: FetchBudget): Promise<{ phone: string | null; website: string | null }> {
  if (!clientId || !clientSecret || outOfBudget(budget)) return { phone: null, website: null }
  spendBudget(budget)
  const q = `${name} ${region || ''}`.trim()
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&sort=random`
  const res = await safeFetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, timeoutMs: 10000 }, budget)
  if (!res || !res.ok) return { phone: null, website: null }
  const data = await res.json().catch(() => null) as { items?: Array<{ title?: string; telephone?: string; link?: string; address?: string; roadAddress?: string }> } | null
  const want = norm(name)
  for (const it of (data?.items || [])) {
    const hit = norm(stripTag(it.title))
    if (!hit) continue
    const nameOk = hit === want || (want.length >= 2 && (hit.includes(want) || want.includes(hit)))
    if (!nameOk) continue
    const nvAddr = stripTag(it.roadAddress || it.address)
    if (storeAddr && !sameAddr(storeAddr, nvAddr)) continue // 다른 매장 → 스킵
    const website = (it.link || '').trim() || null
    const phone = (it.telephone || '').trim() || null
    if (website || phone) return { phone, website }
  }
  return { phone: null, website: null }
}

// ⚠️ 제3자/UGC 플랫폼 — 리뷰 블로그·카페 글이 상호를 제목에 달고 있어도 **그 페이지의 이메일은 글쓴이(제3자) 것**
//   → 크롤 대상에서 제외(오귀속=허위 방지). 업체 *자체* 홈페이지만 발견 대상. (웹 발굴 레인도 재사용 — export)
export const THIRD_PARTY_HOST = /(?:^|\.)(?:blog\.naver\.com|m\.blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com|naver\.me|tistory\.com|brunch\.co\.kr|instagram\.com|facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|band\.us|daum\.net|kakao\.com|kmong\.com|saramin\.co\.kr|jobkorea\.co\.kr|wanted\.co\.kr|albamon\.com|incruit\.com|namu\.wiki|wikipedia\.org)$/i

/** ①-c 네이버 웹문서 검색으로 **자체 홈페이지 발견** — 지역검색에 홈페이지가 없는 업체(세무사·소상공인 등)도
 *   웹엔 자기 사이트를 노출. 상호가 결과 제목/설명에 포함 + 제3자/UGC 도메인 제외. 발견 사이트의 이메일 채택은
 *   crawlContact 의 requireName 가드(페이지에 상호 존재)로 2중 검증 — 오귀속(허위) 구조적 차단. */
export async function naverHomepageSearch(clientId: string, clientSecret: string, name: string, region: string | null, budget?: FetchBudget): Promise<string | null> {
  if (!clientId || !clientSecret || !name || name.length < 2) return null
  const want = norm(name)
  const q = `${name} ${region || ''}`.trim()
  if (outOfBudget(budget)) return null
  spendBudget(budget)
  const url = `https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(q)}&display=8`
  const res = await safeFetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, timeoutMs: 10000 }, budget)
  if (!res || !res.ok) return null
  const data = await res.json().catch(() => null) as { items?: Array<{ title?: string; link?: string; description?: string }> } | null
  for (const it of (data?.items || [])) {
    const hay = norm(stripTag(it.title) + ' ' + stripTag(it.description))
    if (!hay.includes(want)) continue // 상호가 제목/설명에 없으면 다른 사이트 → 스킵
    const link = (it.link || '').trim()
    if (!link || !/^https?:\/\//i.test(link)) continue
    try { if (THIRD_PARTY_HOST.test(new URL(link).hostname)) continue } catch { continue } // 리뷰블로그/SNS 제외
    return link
  }
  return null
}

// 잘 알려진 메일 도메인(MX 확실) — DoH 조회 생략(예산 절약).
const KNOWN_MAIL_DOMAIN = /(?:^|\.)(naver\.com|gmail\.com|daum\.net|hanmail\.net|kakao\.com|nate\.com|hotmail\.com|outlook\.com|icloud\.com|yahoo\.com)$/i
/** 유명 메일 도메인 여부(DoH 생략 가능) — 재검증 스윕이 예산 계산에 사용. */
export const isKnownMailDomain = (email: string): boolean => KNOWN_MAIL_DOMAIN.test(String(email || '').split('@')[1] || '')

/** 📮 이메일 도메인 실존 검증(무료 Cloudflare DoH) — **죽은 도메인 이메일(반송 확정)** 저장 방지.
 *   NXDOMAIN(도메인 자체 없음)만 false — MX 부재는 A 레코드 수신 가능(RFC 5321)이라 과차단 안 함.
 *   DoH 장애/예산 소진 시 true(fail-open — 수집 우선, 검증은 보수적으로). */
export async function domainAcceptsMail(email: string, budget?: FetchBudget): Promise<boolean> {
  const domain = String(email || '').split('@')[1]?.toLowerCase() || ''
  if (!domain) return false
  if (KNOWN_MAIL_DOMAIN.test(domain)) return true
  if (outOfBudget(budget)) return true
  spendBudget(budget)
  const res = await safeFetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { Accept: 'application/dns-json' }, timeoutMs: 6000 }, budget)
  if (!res || !res.ok) return true
  const j = await res.json().catch(() => null) as { Status?: number } | null
  return !(j && j.Status === 3) // 3 = NXDOMAIN — 도메인 소멸 → 반송 확정이라 버림
}

/** ② 홈페이지 크롤 — 게시된 **이메일 + 전화**를 root + /contact,/about 에서 추출(robots.txt 준수). 추측 없음.
 *   requireName: **검색으로 발견한(등록 링크 아닌) 사이트**용 오귀속 가드 — 페이지 어디에도 상호가 없으면
 *   그 사이트의 연락처를 채택하지 않음(엉뚱한 회사 이메일 부착 = 허위 방지). */
/** 크롤 결과 사유(적중률 계측용) — email/phone 못 찾은 이유를 집계해 다음 개선을 데이터로 고른다. */
// ⚠️ 'network'(예외 발생)는 원인이 갈린다 — 표본 4건이 아니라 **분포 자체가 답하도록** 쪼갠다:
//   subreq_limit(워커 한도 소진) / timeout(상대 서버 무응답 8s) / network(DNS·TLS·연결거부).
//   셋은 처방이 전혀 다르다: 한도=예산 축소, 타임아웃=대기시간·동시성 조정, DNS=대상 URL 품질.
export type CrawlReason = 'ok' | 'bad_url' | 'blocked_host' | 'budget' | 'robots' | 'no_name' | 'dead_domain' | 'no_contact' | 'fetch_fail' | 'http_403' | 'http_404' | 'http_5xx' | 'network' | 'subreq_limit' | 'timeout'
export interface CrawlResult { email: string | null; phone: string | null; siteName: string | null; reason: CrawlReason; failUrl?: string; failErr?: string }
export async function crawlContact(website: string, budget?: FetchBudget, requireName?: string, allowNewsHost = false): Promise<CrawlResult> {
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`) } catch { return { email: null, phone: null, siteName: null, reason: 'bad_url' } }
  if (!/^https?:$/.test(url.protocol)) return { email: null, phone: null, siteName: null, reason: 'bad_url' }
  // 📰 언론사성 호스트는 크롤 자체 거부(심층방어) — 단, '미디어' 카테고리 리드(별도 수집 레인)는 예외로 허용.
  if ((!allowNewsHost && NEWS_MEDIA_HOST.test(url.hostname)) || THIRD_PARTY_HOST.test(url.hostname)) return { email: null, phone: null, siteName: null, reason: 'blocked_host' }
  if (outOfBudget(budget)) return { email: null, phone: null, siteName: null, reason: 'budget' }
  spendBudget(budget)
  // ⚠️ 예산 회계는 **fetch 1회 = spend 1회**를 지킨다(과소평가하면 한도를 예산보다 먼저 치고, 과대평가하면
  //   학습 상한이 실제보다 낮게 굳는다). 이 robots 요청은 바로 위 spendBudget 이 이미 계상한 몫이다 —
  //   실사용과 회계가 어긋나는지는 company-collect 의 독립 카운터(fetches)와 대조해 화면에서 확인한다.
  const robotsRes = await safeFetch(`${url.origin}/robots.txt`, { timeoutMs: 6000 }, budget)
  // 한도에 부딪혔으면 이 사이트는 시도조차 못 한 것 — 실패로 기록해 도장 찍으면 7일간 재시도 못 한다.
  if (budget?.limitHit) return { email: null, phone: null, siteName: null, reason: 'subreq_limit' }
  const robots = robotsRes && robotsRes.ok ? await robotsRes.text().catch(() => '') : ''
  if (robots) {
    const star = robots.split(/user-agent:/i).find(b => /^\s*\*/.test(b)) || ''
    if (/(^|\n)\s*disallow:\s*\/\s*(#|$|\n)/i.test(star)) return { email: null, phone: null, siteName: null, reason: 'robots' }
  }
  let email: string | null = null, phone: string | null = null, nameSeen = !requireName, anyPage = false
  let siteName: string | null = null // 🏷️ 사이트 자기 이름(og:site_name→title 첫 구획) — webkr 헤드라인 상호 치유용
  const wantName = requireName ? norm(requireName) : ''
  // 홈 + 국내 소상공인 사이트가 연락처를 두는 고수율 경로(영문/한글 슬러그).
  //   + 🧭 **홈에서 발견한 '문의/Contact' 링크 추적(≤3)** + 사이트맵 기반 연락처 페이지 발견(2026-07-27 고도화).
  //   국내 대행사/SME 는 그누보드·cafe24·아임웹 자체 경로가 흔해 고정 경로만으론 놓침. same-origin 만 + 파일 제외.
  //   ⚠️ 2026-07-28 실측 회귀 수리: 경로를 12개로 늘렸더니 **사이트당 서브요청이 2배**가 되어 같은 예산으로
  //   크롤 가능한 사이트 수가 반토막(처리 344 중 크롤 54회). 고수율 5경로로 축소 + 사이트당 fetch 캡(MAX_PAGES).
  //   커스텀 경로는 홈에서 발견한 문의링크·사이트맵이 커버(그쪽이 정확도도 높음).
  const queue = ['', '/contact', '/about', '/company', '/sub/contact.html']
  const MAX_PAGES = 5
  const visited = new Set<string>()
  let discoveredLinks = 0
  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko,ko-KR;q=0.9,en;q=0.5',
  }
  // 실패를 상태코드로 구분(403 봇차단 / 404 경로없음 / 5xx / network) — '왜 못 가져왔나'를 데이터로 판정.
  let lastStatus = 0
  //   network 는 원인이 갈린다: AbortError=상대 서버 느림/무응답 · TypeError "Too many subrequests"=워커 한도 소진
  //   · 그 외=DNS/TLS/연결거부. safeFetch 가 예외 이름·메시지를 errSink 에 그대로 남겨 상태줄에서 판정한다.
  const errSink = { msg: '' }
  const fetchHtml = async (u: string): Promise<string> => {
    const r = await safeFetch(u, { headers: BROWSER_HEADERS, timeoutMs: 8000 }, budget, errSink)
    if (!r) { lastStatus = -1; return '' }
    lastStatus = r.status
    return r.ok ? await r.text().catch(() => '') : ''
  }
  // 🔀 호스트 변형 폴백(2026-07-27 고도화) — 국내 사이트가 www↔non-www / https↔http 한쪽만 응답해 크롤
  //   전체가 날아가던 fetch_fail 버킷 축소. 홈 fetch 가 비면 대체 오리진을 1회만 시도해 살아있는 쪽으로 고정.
  let originResolved = false
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i]
    if (visited.has(path)) continue
    visited.add(path)
    if (email || outOfBudget(budget) || visited.size > MAX_PAGES) break // 이메일 확보 시 즉시 종료(전화는 부가 — 카카오 레인이 전담)
    spendBudget(budget)
    // UA: 브라우저형(아임웹/카페24류가 낯선 봇 UA 에 403 → 푸터 이메일 수집 0 이던 갭). robots 존중은 위에서 그대로.
    let html = await fetchHtml(url.origin + path)
    if (!html && path === '' && !originResolved && budget && budget.left > 3) {
      originResolved = true
      const altHost = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`
      for (const alt of [`https://${altHost}`, `http://${url.hostname}`]) {
        if (outOfBudget(budget)) break
        spendBudget(budget)
        const h = await fetchHtml(alt + path)
        if (h) { html = h; try { url = new URL(alt) } catch { /* keep */ } break } // 살아있는 오리진으로 전환
      }
    }
    if (budget?.limitHit) break // 한도 도달 — 이후 fetch 는 전부 throw 라 더 볼 것이 없다
    if (!html) continue
    anyPage = true
    const slice = html.slice(0, 200000)
    if (!nameSeen && wantName && norm(slice).includes(wantName)) nameSeen = true
    if (path === '' && !siteName) {
      const og = slice.match(/property=["']og:site_name["'][^>]*content=["']([^"'<>]{2,40})["']/i)?.[1]
        || slice.match(/content=["']([^"'<>]{2,40})["'][^>]*property=["']og:site_name["']/i)?.[1]
      const cand = stripTag(og || (slice.match(/<title[^>]*>([^<]{2,80})</i)?.[1] || '').split(/[|\-–—:·]/)[0]).trim()
      if (cand.length >= 2 && cand.length <= 30 && !/["“”‘’',?？]|공지|로그인|메인|홈페이지$/.test(cand)) siteName = cand
    }
    if (!email) email = extractEmailFromHtml(slice, allowNewsHost)   // mailto: 우선 → 본문 문맥선별
    if (!phone) { const tel = (slice.match(/tel:([+\d\-.\s]{8,})/i)?.[1]) || slice; phone = pickPhone(tel) }
    // 🧾 JSON-LD(구조화 데이터) email/telephone — 사이트가 스스로 선언한 값이라 정밀도 최상(2026-07-27 고도화).
    if (!email || !phone) {
      for (const ld of slice.matchAll(/"email"\s*:\s*"([^"<>{}]{5,120})"/gi)) {
        const e = decodeEmailEntities(ld[1]).replace(/^mailto:/i, '').trim().toLowerCase()
        if (publishableEmail(e, allowNewsHost)) { email = email || e; break }
      }
      if (!phone) { const tm = slice.match(/"telephone"\s*:\s*"([^"<>{}]{8,25})"/i); if (tm) phone = pickPhone(tm[1]) }
    }
    // 홈(root) HTML 에서 연락처성 링크 추출 — 커스텀 경로 커버(최대 3개 추가, 어휘 확장 2026-07-27).
    if (path === '' && !email) {
      for (const m of slice.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
        if (discoveredLinks >= 3) break
        const href = m[1].replace(/&amp;/g, '&').trim()
        if (!/(contact|inquiry|contactus|문의|오시는|co_id=|about|company|intro|(?:회사|기업)\s*소개|고객\s*센터|customer|support)/i.test(href)) continue
        if (/\.(?:jpe?g|png|gif|webp|svg|pdf|zip|hwp|docx?|xlsx?)(?:$|\?)/i.test(href)) continue
        let u2: URL
        try { u2 = new URL(href, url.origin + '/') } catch { continue }
        if (u2.hostname !== url.hostname) continue // 남의 사이트로 안 나감(오귀속 방지)
        const p2 = u2.pathname + u2.search
        if (!visited.has(p2) && !queue.includes(p2)) { queue.push(p2); discoveredLinks++ }
      }
      // 🗺️ 사이트맵 기반 연락처 페이지 발견 — 네비에 링크가 없어도 sitemap.xml 에 등재된 contact/about URL 을
      //   찾아 큐에 추가(그누보드/워드프레스 등 자동 사이트맵 흔함). 홈에서 이메일 못 찾았을 때만(예산 절약).
      if (!email && discoveredLinks < 3 && budget && budget.left > 3) {
        spendBudget(budget)
        const smRes = await safeFetch(`${url.origin}/sitemap.xml`, { timeoutMs: 6000 }, budget)
        const sm = smRes && smRes.ok ? await smRes.text().catch(() => '') : ''
        for (const loc of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
          if (discoveredLinks >= 3) break
          if (!/(contact|inquiry|about|company|intro|문의|소개)/i.test(loc[1])) continue
          try { const su = new URL(loc[1]); if (su.hostname !== url.hostname) continue
            const sp = su.pathname + su.search
            if (!visited.has(sp) && !queue.includes(sp)) { queue.push(sp); discoveredLinks++ }
          } catch { /* skip */ }
        }
      }
    }
  }
  if (!nameSeen) return { email: null, phone: null, siteName, reason: 'no_name' } // 발견 사이트에 상호 부재 → 남의 사이트일 수 있음 → 채택 안 함
  if (email && !(await domainAcceptsMail(email, budget))) { email = null; return { email: null, phone, siteName, reason: 'dead_domain' } } // 죽은 도메인(반송 확정) 배제
  // 한도 도달은 **사이트의 문제가 아니다** — 별도 사유로 분리해야 호출부가 '실패 도장' 대신 '중단'을 고른다.
  //   타임아웃(AbortError)도 분리 — 우리 인프라(한도) vs 상대 서버(무응답) vs 주소 품질(DNS)을 분포로 판별.
  const httpReason = (): CrawlReason => budget?.limitHit ? 'subreq_limit'
    : lastStatus === -1 && /^AbortError|TimeoutError/.test(errSink.msg) ? 'timeout'
    : lastStatus === 403 || lastStatus === 401 ? 'http_403'
    : lastStatus === 404 ? 'http_404' : lastStatus >= 500 ? 'http_5xx' : lastStatus === -1 ? 'network' : 'fetch_fail'
  const reason: CrawlReason = email ? 'ok' : (!anyPage ? httpReason() : 'no_contact')
  return { email, phone, siteName, reason, failUrl: email ? undefined : url.origin, failErr: email || !errSink.msg ? undefined : errSink.msg }
}
