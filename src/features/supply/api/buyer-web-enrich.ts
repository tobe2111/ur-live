/**
 * 🌐 유통스타트 — 바이어 웹사이트에서 이메일/전화 추출 (2026-07-21).
 *   buyKorea 등은 바이어 이메일을 마스킹(ke****@****)하지만 **웹사이트는 공개**한다. 그 공개 웹사이트
 *   (바이어 자사 사이트 — 로그인 게이트 아님)를 방문해 연락처(mailto/이메일/전화)를 채운다.
 *   ⚠️ 공개 비즈니스 사이트만 · 소량 배치 + 지연(서버 부하 완화) · 이메일 없는 행만(멱등). 유어딜 무관.
 */
import type { Env } from '@/worker/types/env'
import { ensureBuyerSchema, pickBusinessEmail, pickPhone } from './buyer-discovery'
import { isPublicHttpUrl } from './buyer-autofetch'

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
// 홈 → 자주 쓰는 연락 경로 순회(이메일 찾으면 중단). 다국어(영/스페인/포르투갈/독/불) 변형 포함.
const CONTACT_PATHS = ['', '/contact', '/contact-us', '/contact-us.html', '/contactus', '/en/contact',
  '/about', '/about-us', '/company', '/company/contact', '/en', '/en/about',
  '/contacto', '/contato', '/kontakt', '/nous-contacter', '/contact.html', '/pages/contact']
// 홈 HTML 에서 "연락/회사소개" 링크를 직접 발견(추측 경로보다 적중률↑). 다국어 텍스트/경로.
const CONTACT_LINK_RE = /<a\b[^>]*href\s*=\s*["']([^"'#\s]+)["'][^>]*>([\s\S]{0,40}?)<\/a>/gi
const CONTACT_HINT = /contact|about|company|연락|회사|소개|kontakt|contacto|contato|nous-contacter|impressum|imprint|reach\s*us|get\s*in\s*touch/i
const IMG_EMAIL = /\.(png|jpe?g|gif|webp|svg|ico)$/i
// 3rd-party/플랫폼/개발툴 이메일 제외(바이어 실컨택만).
const JUNK_EMAIL = /(example\.|sentry|wixpress|\.wix|godaddy|@sentry|no-?reply@|noreply@|test@|email@|your@|user@|name@|info@example|domain\.com|@sentry\.|intercom|zendesk|hubspot|mailchimp|cloudflare|squarespace|shopify|@wordpress|@2x|privacy@|dpo@|abuse@|postmaster@|@w3\.org|@schema\.org|@googlegroups)/i

/** HTML 에서 이메일 후보 추출 — mailto: 우선(가장 확실). */
function emailsFromHtml(html: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/mailto:([^"'?>\s]+@[^"'?>\s]+)/gi)) out.add(m[1].trim().toLowerCase())
  for (const m of html.matchAll(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)) out.add(m[0].trim().toLowerCase())
  return Array.from(out).filter(e => !IMG_EMAIL.test(e) && !JUNK_EMAIL.test(e) && e.length < 80)
}

/** 홈 HTML 에서 같은 origin 의 연락/소개 페이지 링크를 발견(href 또는 링크 텍스트에 힌트). 최대 5개. */
export function discoverContactPaths(html: string, origin: string): string[] {
  const out = new Set<string>()
  for (const m of String(html || '').matchAll(CONTACT_LINK_RE)) {
    const href = m[1].replace(/&amp;/g, '&'), text = m[2].replace(/<[^>]+>/g, ' ')
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue
    if (!CONTACT_HINT.test(href) && !CONTACT_HINT.test(text)) continue
    try {
      const u = new URL(href, origin + '/')
      if (u.origin !== origin) continue // 같은 사이트만(외부 SNS/파트너 제외)
      out.add(u.pathname + u.search)
    } catch { /* skip */ }
    if (out.size >= 5) break
  }
  return Array.from(out)
}

/** 웹사이트 HTML 에서 회사 주소 추출 — <address> 태그 / schema.org streetAddress / "Address:" 라벨 순. */
export function addressFromHtml(html: string): string | null {
  const h = String(html || '')
  const tag = h.match(/<address[^>]*>([\s\S]{5,240}?)<\/address>/i)
  if (tag) { const t = tag[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim(); if (t.length > 8) return t.slice(0, 300) }
  const sa = h.match(/streetAddress"?\s*[:=]\s*"?([^"<\n]{8,180})/i)
  if (sa) { const t = sa[1].replace(/\s+/g, ' ').trim(); if (t.length > 8) return t.slice(0, 300) }
  const text = h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  // "office:" 는 "Box office:" 등 오탐 → 제외. 주소 라벨만.
  const m = text.match(/(?:company\s+address|business\s+address|address|주소|소재지|본사\s*주소)\s*[:：]\s*([^\n]{10,140})/i)
  if (m) { const t = m[1].replace(/\s+/g, ' ').trim(); if (t.length > 8) return t.slice(0, 300) }
  return null
}

function normUrl(website: string): string | null {
  let w = String(website || '').trim()
  if (!w) return null
  if (!/^https?:\/\//i.test(w)) w = 'https://' + w
  if (!isPublicHttpUrl(w)) return null // SSRF: 내부/사설 호스트 차단
  try { return new URL(w).origin } catch { return null }
}

// AbortController 로 8s 중단 + redirect:'manual' 로 SSRF 방어.
//   redirect:'follow' 는 공개 사이트가 내부 IP(169.254.169.254 등)로 302 하면 그대로 따라감(내부 응답 유출).
//   → manual 로 받아 Location 을 isPublicHttpUrl 로 재검증한 뒤 최대 2회만 수동 추종.
async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  let cur = url
  for (let hop = 0; hop < 3; hop++) {
    if (!isPublicHttpUrl(cur)) return '' // 매 홉 공개 호스트 재검증(SSRF)
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 8000)
    let res: Response
    try { res = await fetch(cur, { headers, redirect: 'manual', signal: ac.signal }) }
    catch { return '' } finally { clearTimeout(t) }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location'); if (!loc) return ''
      try { cur = new URL(loc, cur).toString() } catch { return '' }
      continue // 다음 홉에서 재검증
    }
    return res.ok ? await res.text() : ''
  }
  return ''
}

export interface WebEnrichResult { ran: boolean; reason?: string; scanned: number; enriched: number; resolvedSites?: number; fetches: number; sample: string[] }

// ── 회사명 → 공식 웹사이트 추정(무료, best-effort) ─────────────────────────────
//   tradeKorea 등은 회사명+국가만 주고 웹사이트가 없다 → 웹사이트를 우리가 찾아 이메일 보강의 출발점 확보.
//   ① 도메인 추정(slug.com — 회사명 토큰이 페이지에 있어야 채택) ② DuckDuckGo HTML 검색 폴백.
//   ⚠️ 구글 자동검색은 차단/약관 위반이라 미사용. DDG 도 CF 워커 IP 를 막을 수 있음(수율 변동, 실측 필요).
const LEGAL_SFX = /\b(inc|llc|ltd|limited|corp|co|company|gmbh|srl|sa|plc|pvt|group|holdings?|services?|trading|import|export|international|intl)\b/gi
function companySlug(company: string): string {
  // ⚠️ 악센트는 *제거*가 아니라 *폴딩* — "Estée Lauder"→"estee..."(제거 시 "este"라 estelauder.com 오추정).
  return String(company || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' ').replace(/[.,'’]/g, ' ')
    .replace(LEGAL_SFX, ' ').replace(/[^a-z0-9]/g, '').slice(0, 40)
}
const BAD_HOST = /(facebook|linkedin|instagram|twitter|x\.com|youtube|youtu\.be|pinterest|tiktok|wikipedia|tradekorea|kompass|bloomberg|crunchbase|zoominfo|dnb\.com|opencorporates|amazon\.|alibaba|made-in-china|indeed|glassdoor|yelp|yellowpages|google\.|bing\.|duckduckgo|reddit|prnewswire|businesswire|globenewswire|ebay|etsy|shopify|blogspot|wordpress|medium\.com|quora|slideshare)/i
// 국가 → ccTLD (비미국 바이어는 .com 이 아니라 ccTLD 인 경우多 — 1개 country-TLD 추정 추가로 수율↑).
const COUNTRY_TLD: Record<string, string> = {
  india: 'in', brazil: 'com.br', germany: 'de', 'united kingdom': 'co.uk', uk: 'co.uk', england: 'co.uk',
  turkey: 'com.tr', 'united arab emirates': 'ae', uae: 'ae', japan: 'co.jp', china: 'com.cn',
  france: 'fr', italy: 'it', spain: 'es', mexico: 'com.mx', vietnam: 'com.vn', indonesia: 'co.id',
  thailand: 'co.th', australia: 'com.au', canada: 'ca', russia: 'ru', netherlands: 'nl', poland: 'pl',
  'saudi arabia': 'com.sa', malaysia: 'com.my', philippines: 'com.ph', 'south africa': 'co.za',
}

/** 도메인이 회사 slug 를 포함하는지(오추정 방지 핵심 게이트). host 의 영숫자화 후 slug 포함 검사. */
function hostMatchesSlug(host: string, slug: string): boolean {
  if (!slug || slug.length < 4) return false
  return host.replace(/^www\./, '').replace(/[^a-z0-9]/g, '').includes(slug)
}

/** DuckDuckGo HTML 결과에서 회사 slug 와 도메인이 일치하는 첫 결과만 반환(엉뚱한 뉴스/유통사 도메인 채택 방지). */
async function ddgFirstDomain(query: string, headers: Record<string, string>, slug = ''): Promise<string> {
  const html = await fetchText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), headers)
  if (!html) return ''
  for (const m of html.matchAll(/uddg=([^"&]+)/g)) {
    try {
      const u = new URL(decodeURIComponent(m[1]))
      if (!/^https?:$/.test(u.protocol) || BAD_HOST.test(u.host) || !isPublicHttpUrl(u.origin)) continue
      // ⚠️ 첫 결과 무조건 채택 금지 — 도메인이 회사명(slug)을 포함할 때만(오회사 이메일 저장 방지).
      if (hostMatchesSlug(u.host, slug)) return u.origin
    } catch { /* skip */ }
  }
  return ''
}

/** 회사명(+국가) → 웹사이트 origin. spend() 는 예산 소모(true=진행 가능). 못 찾으면 ''. */
async function resolveWebsiteForCompany(company: string, country: string, headers: Record<string, string>, spend: () => boolean): Promise<string> {
  const slug = companySlug(company)
  // ① 도메인 추정 — slug 가 충분히 특정적일 때만(짧은/제네릭 단어는 오추정 위험 → DDG 로). .com + 국가 ccTLD.
  if (slug.length >= 6) {
    const tld = COUNTRY_TLD[String(country || '').trim().toLowerCase()]
    const guesses = [`https://www.${slug}.com`, `https://${slug}.com`]
    if (tld) guesses.push(`https://www.${slug}.${tld}`)
    for (const guess of guesses) {
      if (!spend()) return ''
      const html = await fetchText(guess, headers)
      // 회사 slug 전체가 실제 그 페이지에 있어야 채택(부분매칭 제거 — 우연 도메인 배제).
      if (html && html.toLowerCase().includes(slug)) { try { return new URL(guess).origin } catch { /* skip */ } }
      await delay(200)
    }
  }
  // ② DDG 폴백 — 도메인이 회사 slug 를 포함하는 결과만 채택(못 찾으면 '' — 오회사보다 미발견이 안전).
  if (!spend()) return ''
  const dom = await ddgFirstDomain(`${company} ${country || ''} official website`.trim(), headers, slug)
  await delay(300)
  return dom
}


/** 이메일 없는 리드를 방문해 이메일/전화 백필. 웹사이트 없으면 회사명→웹사이트 추정 후 진행. 스코어 높은 순. */
export async function enrichLeadsFromWebsites(env: Env, opts: { max?: number; budget?: number } = {}): Promise<WebEnrichResult> {
  const DB = env.DB
  await ensureBuyerSchema(DB)
  const max = Math.min(40, Math.max(1, opts.max || 15))
  // 웹사이트 보유 리드 우선(즉시 방문) → 웹사이트 없지만 회사명 있는 리드(웹사이트 먼저 추정) 후순위.
  const rows = (await DB.prepare(
    `SELECT id, website, company, country FROM overseas_buyer_leads
     WHERE (email IS NULL OR email = '') AND (decision_maker_email IS NULL OR decision_maker_email = '')
       AND ( (website IS NOT NULL AND website != '') OR (company IS NOT NULL AND company != '') )
     ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),
              COALESCE(match_score,0) DESC, id DESC LIMIT ?`).bind(max)
    .all<{ id: number; website: string | null; company: string | null; country: string | null }>().catch(() => null))?.results || []
  if (!rows.length) return { ran: true, reason: '이메일 없는 (웹사이트/회사명) 리드가 없습니다.', scanned: 0, enriched: 0, resolvedSites: 0, fetches: 0, sample: [] }
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en;q=0.9,ko;q=0.8',
  }
  // ⚠️ fetchText 는 리다이렉트로 호출당 최대 3 subrequest → 예산 1단위 = 실제 최대 3회. CF 무료 한도(~50) 보호를
  //   위해 상한 16(×3=48<50). (기존 25/30 은 리다이렉트 다발 시 한도 초과 → 이후 리드 전부 무수익 위험.)
  const budget = opts.budget != null ? Math.max(4, Math.min(16, opts.budget)) : Math.min(16, Math.max(8, parseInt(env.BUYER_SUBREQUEST_BUDGET || '16', 10) || 16)) // Cloudflare subrequest 한도 보호(크론은 명시 budget 로 합산 상한)
  let fetches = 0, enriched = 0, resolvedSites = 0
  const sample: string[] = []
  const SITE_CAP = 5 // 사이트당 최대 방문(홈 + 연락 페이지 몇 개) — 예산을 여러 리드에 분산.
  const spend = () => { if (fetches >= budget) return false; fetches++; return true } // 예산 소모(true=진행 가능)
  const originCache = new Map<string, { email: string | null; phone: string | null; address: string | null }>() // 같은 도메인 재방문 방지.
  for (const row of rows) {
    if (fetches >= budget) break
    let origin = normUrl(row.website || '')
    // 웹사이트가 없으면 회사명(+국가)으로 추정 → 찾으면 저장하고 이어서 이메일 보강.
    if (!origin && row.company && row.company.trim() && fetches < budget) {
      const found = await resolveWebsiteForCompany(row.company, row.country || '', headers, spend)
      if (found) {
        origin = found
        resolvedSites++
        await DB.prepare(`UPDATE overseas_buyer_leads SET website = COALESCE(website, ?),
             source_keyword = COALESCE(source_keyword, 'web-enrich') WHERE id = ?`).bind(found, row.id).run().catch(() => null)
      }
    }
    if (!origin) continue
    let res = originCache.get(origin)
    if (!res) {
      res = { email: null, phone: null, address: null }
      const visited = new Set<string>()
      const queue: string[] = [''] // 홈부터
      let siteFetches = 0
      while (queue.length && fetches < budget && siteFetches < SITE_CAP) {
        const path = queue.shift() as string
        if (visited.has(path)) continue
        visited.add(path)
        fetches++; siteFetches++
        const html = await fetchText(origin + path, headers)
        if (html) {
          if (!res.email) {
            const es = emailsFromHtml(html) // 이미 정크/이미지 필터됨
            // 사이트 도메인과 같은 도메인의 이메일 최우선 — 푸터의 개발사/파트너/@gmail 을 바이어로 오채택 방지.
            const originHost = origin.replace(/^https?:\/\//, '').replace(/^www\./, '')
            const sameDomain = es.find(e => { const d = (e.split('@')[1] || '').replace(/^www\./, ''); return d && originHost.includes(d) })
            // 그다음 mailto: → 문맥 스코어(pickBusinessEmail, 구매담당 local-part 우선) → 첫 후보.
            const mail = es.find(e => new RegExp('mailto:' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html))
            const ctx = pickBusinessEmail(html)
            const ctxOk = ctx && !IMG_EMAIL.test(ctx) && !JUNK_EMAIL.test(ctx) ? ctx : null
            res.email = sameDomain || mail || ctxOk || es[0] || null
          }
          if (!res.phone) { const p = pickPhone(html); if (p && /^\s*\+/.test(p)) res.phone = p }
          if (!res.address) { const a = addressFromHtml(html); if (a) res.address = a }
          // 홈에서 실제 연락/소개 링크 발견(추측보다 적중률↑) → 앞에, 추측 경로 → 뒤에.
          if (path === '') {
            for (const d of discoverContactPaths(html, origin)) if (!visited.has(d)) queue.push(d)
            for (const g of CONTACT_PATHS.slice(1)) if (!visited.has(g)) queue.push(g)
          }
        }
        await delay(html ? 400 : 250) // throttle
        if (res.email) break
      }
      originCache.set(origin, res)
    }
    const { email, phone, address } = res
    if (email || phone || address) {
      const r = await DB.prepare(
        `UPDATE overseas_buyer_leads SET email = COALESCE(email, ?), phone = COALESCE(phone, ?),
           address = COALESCE(address, ?), source_keyword = COALESCE(source_keyword, 'web-enrich')
         WHERE id = ? AND (email IS NULL OR email = '')`).bind(email, phone, address, row.id).run().catch(() => null)
      if (r && (r.meta?.changes ?? 0) > 0) { enriched++; if (email && sample.length < 5) sample.push(email) }
    }
    if (fetches >= budget) break
  }
  return { ran: true, scanned: rows.length, enriched, resolvedSites, fetches, sample }
}

// ── 진단(왜 이메일이 안 나오나) — 실제 코드경로를 워커에서 그대로 찔러 ground truth 수집 ──────
//   추측 금지: DDG 가 CF 워커에서 응답하는지 / 대상 리드가 있는지 / 회사명이 도메인으로 풀리는지를 실측.
export async function diagnoseWebEnrich(env: Env): Promise<Record<string, unknown>> {
  const DB = env.DB
  await ensureBuyerSchema(DB)
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en;q=0.9,ko;q=0.8',
  }
  // ① 리드 자격 집계 — 대상이 아예 없으면(모두 이메일 보유/회사명 없음) '실패'가 아니라 '대상 0'.
  const counts = await DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN (email IS NULL OR email='') AND (decision_maker_email IS NULL OR decision_maker_email='') THEN 1 ELSE 0 END) AS no_email,
      SUM(CASE WHEN company IS NOT NULL AND company!='' THEN 1 ELSE 0 END) AS has_company,
      SUM(CASE WHEN website IS NOT NULL AND website!='' THEN 1 ELSE 0 END) AS has_website,
      SUM(CASE WHEN (email IS NULL OR email='') AND (decision_maker_email IS NULL OR decision_maker_email='')
           AND ((website IS NOT NULL AND website!='') OR (company IS NOT NULL AND company!='')) THEN 1 ELSE 0 END) AS eligible
    FROM overseas_buyer_leads`).first<Record<string, number>>().catch((e) => ({ error: String(e) } as unknown as Record<string, number>))
  const sample = (await DB.prepare(
    `SELECT id, company, country, website FROM overseas_buyer_leads
     WHERE (email IS NULL OR email='') AND (decision_maker_email IS NULL OR decision_maker_email='')
       AND ((website IS NOT NULL AND website!='') OR (company IS NOT NULL AND company!=''))
     ORDER BY id DESC LIMIT 3`).all<{ id: number; company: string | null; country: string | null; website: string | null }>().catch(() => null))?.results || []
  // ② DDG 프로브 — 워커에서 DuckDuckGo 가 실제로 HTML 을 주는지(=차단 여부의 결정적 신호). responded=html 유무.
  const sampleSlug = sample[0]?.company ? companySlug(sample[0].company) : ''
  const ddgQuery = (sample[0]?.company ? `${sample[0].company} ${sample[0].country || ''}` : 'Estée Lauder USA') + ' official website'
  const ddgHtml = await fetchText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(ddgQuery.trim()), headers)
  const ddgFirst = ddgHtml ? await ddgFirstDomain(ddgQuery.trim(), headers, sampleSlug) : ''
  // HTML 자체가 없으면 차단, 있는데 결과 0/캡차어면 soft-blocked(응답은 하나 쓸모없음).
  const ddgHardBlocked = !ddgHtml
  const ddgSoftBlocked = !!ddgHtml && (/anomaly|blocked|captcha|unusual traffic|rate limit/i.test(ddgHtml.slice(0, 4000)) || !/uddg=/.test(ddgHtml))
  const ddgBlocked = ddgHardBlocked || ddgSoftBlocked
  // ③ 도메인 추정 프로브 — 실제 resolver 와 동일 규칙(slug≥6, 전체 slug 페이지 포함)으로 실측.
  let guess: Record<string, unknown> = { tried: false }
  if (sample[0]?.company) {
    if (sampleSlug.length >= 6) {
      const url = `https://www.${sampleSlug}.com`
      const html = await fetchText(url, headers)
      const matched = !!html && html.toLowerCase().includes(sampleSlug)
      guess = { tried: true, company: sample[0].company, slug: sampleSlug, guessedUrl: url, htmlLen: html.length, matched }
    } else guess = { tried: false, company: sample[0].company, slug: sampleSlug, reason: 'slug<6(제네릭/짧음 — 추정 생략, DDG 의존)' }
  }
  const eligible = counts && !(counts as Record<string, unknown>).error ? (counts as Record<string, number>).eligible : undefined
  const guessTried = guess.tried === true, guessMatched = guess.matched === true
  return {
    counts, sampleEligible: sample,
    ddg: { query: ddgQuery.trim(), responded: !!ddgHtml, htmlLen: ddgHtml.length, firstDomain: ddgFirst, likelyBlocked: ddgBlocked, hardBlocked: ddgHardBlocked },
    domainGuess: guess,
    verdict: (eligible === 0)
      ? '대상 리드 0 — 회사명/웹사이트 없는 리드뿐이거나 이미 이메일 보유(수집을 더 하세요)'
      : (ddgFirst || guessMatched)
        ? 'DDG 또는 도메인추정 작동 — 웹사이트는 찾힘. 이메일 미확보는 사이트가 이메일을 안 올린 것(대기업일수록 흔함)'
        : ddgBlocked && (!guessTried || !guessMatched)
          ? 'DDG 차단' + (guessTried ? ' + 도메인추정 실패' : '(도메인추정은 샘플 slug 짧아 미시도)') + ' — 무료 웹검색 경로가 CF 워커에서 막힘'
          : '판정 보류 — DDG 응답은 하나 회사도메인 미일치, 도메인추정도 미일치(대상 회사명이 도메인과 다를 수 있음)',
  }
}
