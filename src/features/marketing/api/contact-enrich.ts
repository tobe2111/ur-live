/**
 * 📇 연락처 확보 폭포수(waterfall) — 여러 공개 경로를 순차 시도, 찾으면 멈춤, 다 실패하면 비워둠(허위 0).
 *   전화: ① 카카오 로컬 API(업체 등록 전화) → ② 홈페이지 tel: 추출 → ③ 네이버 역조회(엄격 매칭)
 *   이메일: ① 홈페이지 게시 이메일 크롤(root + /contact,/about)
 *   각 연락처에 **출처(provenance)** 를 함께 반환 → "어디서 왔는지" 투명. 전부 업체가 공개한 것만.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import { type FetchBudget, pickBusinessEmail } from './influencer-discovery'

const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const norm = (s: string) => s.replace(/\s+/g, '')

// 템플릿/플랫폼 기본값·플레이스홀더 — 업체 실이메일이 아님(게시돼 있어도 스킵, 허위 방지).
const JUNK_EMAIL = /@(?:sentry\.|wixpress\.com|example\.|your-?domain|yourdomain|domain\.com|email\.com|test\.com|sample\.|godaddy|cloudflare|w3\.org|schema\.org|sentry\.io|abc\.com|company\.com)|^(?:example|test|sample|your-?email|yourname|user|name|id)@/i
/** 📰 뉴스룸 계정 로컬파트(press11@·jebo@·desk@…) — 언론사/보도자료 페이지에서 긁힌 이메일은 B2B 영업에
 *  무의미한 오염(2026-07-27 대표 스크린샷: press11@daum.net·pcoop@pressian.com). 크롤 채택 거부 + 소급 스윕 공용. */
export const NEWSROOM_EMAIL_LOCAL = /^(?:press|news|newsroom|newsdesk|desk|reporter|editor|jebo|bodo)[\d._-]*@/i
/** 📰 언론사성 호스트(수집 제외 + 크롤 거부 공용) — 뉴스 포털 루트에서 webmaster@ 류가 긁히는 것 차단. */
export const NEWS_MEDIA_HOST = /(^|\.)((?:[a-z0-9-]*)(?:news|ilbo|daily|press|journal|times)[a-z0-9-]*)\.(?:co\.kr|com|kr|net)$/i
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
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) }).catch(() => null)
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
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(10000) }).catch(() => null)
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
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(10000) }).catch(() => null)
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
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
  if (!res || !res.ok) return true
  const j = await res.json().catch(() => null) as { Status?: number } | null
  return !(j && j.Status === 3) // 3 = NXDOMAIN — 도메인 소멸 → 반송 확정이라 버림
}

/** ② 홈페이지 크롤 — 게시된 **이메일 + 전화**를 root + /contact,/about 에서 추출(robots.txt 준수). 추측 없음.
 *   requireName: **검색으로 발견한(등록 링크 아닌) 사이트**용 오귀속 가드 — 페이지 어디에도 상호가 없으면
 *   그 사이트의 연락처를 채택하지 않음(엉뚱한 회사 이메일 부착 = 허위 방지). */
/** 크롤 결과 사유(적중률 계측용) — email/phone 못 찾은 이유를 집계해 다음 개선을 데이터로 고른다. */
export type CrawlReason = 'ok' | 'bad_url' | 'blocked_host' | 'budget' | 'robots' | 'no_name' | 'dead_domain' | 'no_contact' | 'fetch_fail'
export interface CrawlResult { email: string | null; phone: string | null; siteName: string | null; reason: CrawlReason }
export async function crawlContact(website: string, budget?: FetchBudget, requireName?: string, allowNewsHost = false): Promise<CrawlResult> {
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`) } catch { return { email: null, phone: null, siteName: null, reason: 'bad_url' } }
  if (!/^https?:$/.test(url.protocol)) return { email: null, phone: null, siteName: null, reason: 'bad_url' }
  // 📰 언론사성 호스트는 크롤 자체 거부(심층방어) — 단, '미디어' 카테고리 리드(별도 수집 레인)는 예외로 허용.
  if ((!allowNewsHost && NEWS_MEDIA_HOST.test(url.hostname)) || THIRD_PARTY_HOST.test(url.hostname)) return { email: null, phone: null, siteName: null, reason: 'blocked_host' }
  if (outOfBudget(budget)) return { email: null, phone: null, siteName: null, reason: 'budget' }
  spendBudget(budget)
  const robots = await fetch(`${url.origin}/robots.txt`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => '')
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
  const queue = ['', '/contact', '/about', '/company', '/contact-us', '/company/contact',
    '/sub/contact.html', '/bbs/content.php?co_id=contact', '/html/contact.html', '/kor/contact', '/introduce', '/company/info']
  const visited = new Set<string>()
  let discoveredLinks = 0
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i]
    if (visited.has(path)) continue
    visited.add(path)
    if ((email && phone) || outOfBudget(budget)) break
    spendBudget(budget)
    // UA: 브라우저형(2026-07-27 — 아임웹/카페24류가 낯선 봇 UA 에 403 → 푸터에 이메일이 있어도 수집 0 이던 갭).
    //   robots.txt 존중은 위에서 그대로(공개 페이지만 읽음) — 식별 문자열만 표준 브라우저 형태로.
    const html = await fetch(url.origin + path, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko,ko-KR;q=0.9,en;q=0.5',
      },
    }).then(r => r.ok ? r.text() : '').catch(() => '')
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
        const sm = await fetch(`${url.origin}/sitemap.xml`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => '')
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
  const reason: CrawlReason = email ? 'ok' : (!anyPage ? 'fetch_fail' : 'no_contact')
  return { email, phone, siteName, reason }
}
