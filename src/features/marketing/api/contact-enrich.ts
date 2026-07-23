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
const EMAIL_STRICT = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i
const MAILTO_RE = /mailto:([^"'?>\s]+)/gi

/**
 * 📧 HTML 에서 **게시된** 이메일 1개 추출 — 추측·조합 절대 없음.
 *   ① `mailto:` href(업체가 명시적으로 건 연락 링크 = 최고 신뢰) 우선 → ② 본문 pickBusinessEmail(난독복원+문맥점수).
 *   플랫폼 기본값/플레이스홀더(JUNK_EMAIL)는 제외. 못 찾으면 null.
 */
export function extractEmailFromHtml(html: string): string | null {
  const mailtos: string[] = []
  const re = new RegExp(MAILTO_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let e = m[1]
    try { e = decodeURIComponent(e) } catch { /* 원문 유지 */ }
    e = e.trim().toLowerCase()
    if (EMAIL_STRICT.test(e) && !JUNK_EMAIL.test(e)) mailtos.push(e)
  }
  if (mailtos.length) {
    // mailto 다수면 비즈니스 문맥(문의/contact)으로 선별, 아니면 첫 번째.
    const biz = pickBusinessEmail(mailtos.map(e => `문의 ${e}`).join(' '))
    return (biz && !JUNK_EMAIL.test(biz)) ? biz : mailtos[0]
  }
  const body = pickBusinessEmail(html)
  return body && EMAIL_STRICT.test(body) && !JUNK_EMAIL.test(body) ? body : null
}
// 한국 전화번호(지역/휴대/대표번호) 추출 — 형식 검증(자릿수), 팩스/사업자번호 오탐 회피용 최소검증.
const PHONE_RE = /(0\d{1,2})[-.\s]?(\d{3,4})[-.\s]?(\d{4})|(1[5-9]\d{2})[-.\s]?(\d{4})/g
function pickPhone(text: string): string | null {
  const m = String(text || '').match(PHONE_RE)
  if (!m) return null
  const clean = m.map(x => x.replace(/[^\d]/g, '')).filter(d => d.length >= 8 && d.length <= 11)
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

/** ② 홈페이지 크롤 — 게시된 **이메일 + 전화**를 root + /contact,/about 에서 추출(robots.txt 준수). 추측 없음. */
export async function crawlContact(website: string, budget?: FetchBudget): Promise<{ email: string | null; phone: string | null }> {
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`) } catch { return { email: null, phone: null } }
  if (!/^https?:$/.test(url.protocol)) return { email: null, phone: null }
  if (outOfBudget(budget)) return { email: null, phone: null }
  spendBudget(budget)
  const robots = await fetch(`${url.origin}/robots.txt`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => '')
  if (robots) {
    const star = robots.split(/user-agent:/i).find(b => /^\s*\*/.test(b)) || ''
    if (/(^|\n)\s*disallow:\s*\/\s*(#|$|\n)/i.test(star)) return { email: null, phone: null }
  }
  let email: string | null = null, phone: string | null = null
  // 홈 + 국내 소상공인 사이트가 연락처를 두는 고수율 경로(영문/한글 슬러그).
  for (const path of ['', '/contact', '/about', '/company', '/contact-us', '/company/contact']) {
    if ((email && phone) || outOfBudget(budget)) break
    spendBudget(budget)
    const html = await fetch(url.origin + path, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'urdeal-partner-bot (+https://urdeal.kr)' } })
      .then(r => r.ok ? r.text() : '').catch(() => '')
    if (!html) continue
    const slice = html.slice(0, 200000)
    if (!email) email = extractEmailFromHtml(slice)   // mailto: 우선 → 본문 문맥선별
    if (!phone) { const tel = (slice.match(/tel:([+\d\-.\s]{8,})/i)?.[1]) || slice; phone = pickPhone(tel) }
  }
  return { email, phone }
}
