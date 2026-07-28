/**
 * 📧 유통스타트(도매몰) — 제조사·판매사 후보 **이메일 보강 레인** (2026-07-28).
 *
 *   maker-collect 의 카카오 레인은 전화·주소를 직접 주지만 **홈페이지를 안 준다** → 이메일이 안 쌓인다.
 *   이 모듈이 [홈페이지 발견 → 게시 이메일 크롤] 을 담당한다. **이메일 전용** — 전화는 카카오 레인이 이미
 *   확보하므로 여기서 다시 긁지 않는다(소비자 트랙에서 페이지의 날짜/ID 숫자열을 전화로 오인하던 버그 클래스를
 *   구조적으로 회피).
 *
 *   ⚠️ **서비스 분리(CLAUDE.md)**: features/supply 자립 — 유어애즈(features/marketing) 코드 의존 0.
 *   `buyer-discovery`(해외 바이어)의 선별기도 쓰지 않는다 — 그쪽은 수입/수출 어휘에 가점을 줘 국내 제조사
 *   대표메일에는 틀린 신호. 이 모듈은 국내 B2B 문맥으로 따로 튜닝한다.
 *
 *   ⚠️ **소비자 트랙 실사고 반영(2026-07-28)**: 같은 결함을 복제하지 않으려고 이 레인을 일부러 미뤘었다.
 *   원인은 **Cloudflare 서브리퀘스트 한도** — env 예산은 우리가 세는 숫자일 뿐 실제 한도가 아니어서, 초과 후
 *   모든 fetch 가 throw 하는데 `.catch()` 들이 전부 삼켜 "사이트가 이상하다"로 오진되고, 게다가 그 실패 행들이
 *   재시도 쿨다운 도장까지 받아 백로그가 영영 안 흘렀다. → 이 레인은 **처음부터** ① 에러를 삼키지 않고
 *   ② 한도를 관측하면 즉시 중단하며 ③ 그 라운드는 도장을 찍지 않고 ④ 실효 상한을 학습한다.
 *
 *   ⚠️ 수집 ≠ 발송. 업체가 **공개 게시한** 비즈니스 이메일만. 추측·조합 생성 절대 없음(허위 0).
 */
import type { Env } from '@/worker/types/env'
import { ensureMakerSchema } from './maker-leads'

/** 🔢 크롤 규칙 버전 — 크롤 경로/추출기를 개선하면 +1 하면 이전 시도분 전량이 즉시 재시도 대상이 된다
 *   (`COALESCE(enrich_v,0) < MAKER_CRAWL_VERSION`). 소비자 트랙의 CRAWL_RULES_VERSION 과 동일 철학. */
export const MAKER_CRAWL_VERSION = 1

/** 학습된 서브리퀘스트 상한(도매 전용 키) — 유어애즈와 **다른 워커**라 한도도 따로 학습해야 정확하다. */
const SUBREQ_CAP_KEY = 'supply_subreq_cap'
const SUBREQ_CAP_MIN = 25
const BACKOFF_RATIO = 0.8
const RECOVER_RATIO = 1.25

/** 플랫폼 서브리퀘스트 한도 신호(실측 문구: "Too many subrequests by single Worker invocation"). */
const isSubrequestLimitError = (msg?: string | null): boolean => /too many subrequests/i.test(String(msg || ''))

type Budget = { left: number; limitHit?: boolean }
const spend = (b: Budget) => { b.left -= 1 }

/**
 * 외부 fetch 공용 래퍼 — 실패를 삼키지 않고 **한도 신호를 예산 객체에 남긴다**.
 * 한 번 한도에 부딪히면 그 인보케이션의 이후 fetch 는 전부 throw 하므로 남은 작업은 의미가 없다.
 */
async function safeFetch(url: string, init: RequestInit & { timeoutMs?: number }, budget: Budget): Promise<Response | null> {
  const { timeoutMs = 8000, ...rest } = init
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '')
    if (isSubrequestLimitError(msg)) budget.limitHit = true
    return null
  }
}

const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const norm = (s: string) => s.replace(/\s+/g, '')

/** 템플릿/플랫폼 기본값 — 업체 실이메일이 아님(게시돼 있어도 스킵). */
const JUNK_EMAIL = /@(?:sentry\.|wixpress\.com|example\.|your-?domain|yourdomain|domain\.com|email\.com|test\.com|sample\.|godaddy|cloudflare|w3\.org|schema\.org|abc\.com|company\.com)|^(?:example|test|sample|your-?email|yourname|user|name|id)@/i
const EMAIL_STRICT = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i
const publishableEmail = (e: string): boolean => EMAIL_STRICT.test(e) && !JUNK_EMAIL.test(e)
/** HTML 엔티티형 난독 복원(&#64;→@) — 국내 CMS 안티봇 출력에 흔함. */
const decodeEmailEntities = (s: string): string =>
  s.replace(/&#0*64;|&commat;/gi, '@').replace(/&#0*46;|&period;/gi, '.').replace(/&#0*45;/g, '-')

/* ── 이메일 선별(자립·국내 B2B 튜닝) ─────────────────────────────────────────
   ⚠️ buyer-discovery 의 선별기를 재사용하지 않는다 — 그쪽은 **해외 바이어**용이라 import/export/buy 계열
   local-part 에 가점을 준다(국내 제조사 대표메일에는 틀린 신호). 여기선 국내 B2B 문맥(문의/영업/담당)에 맞춘다. */
const EMAIL_ANY = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
const NOT_EMAIL_SUFFIX = /\.(png|jpe?g|gif|webp|svg|mp4|webm|css|js)$/i
const KR_BIZ_CONTEXT = /(문의|담당|영업|구매|이메일|메일|연락|대표|contact|inquir|sales|business)/i
/** 대표 연락 창구로 쓰이는 local-part(강) — 국내 회사 사이트의 사실상 표준. */
const STRONG_LOCAL = /^(info|contact|sales|master|admin|help|office|biz|business|mail|ceo|jhs|shop|order)/i
/** 사람이 안 읽거나 회신이 막힌 주소(감점). */
const NON_OWNER_LOCAL = /^(no-?reply|noreply|donotreply|webmaster|postmaster|abuse|hostmaster)/i

/** 공개 텍스트에서 회사 컨택 이메일 1개 선택(문맥 가점) — 순수함수, 생성·조합 없음. */
function pickKrBusinessEmail(text: string): string | null {
  const t = String(text || '')
  const raw = Array.from(new Set((t.match(EMAIL_ANY) || []).map(e => e.trim().toLowerCase())))
    .filter(e => e && !NOT_EMAIL_SUFFIX.test(e) && publishableEmail(e)).slice(0, 12)
  if (!raw.length) return null
  const lower = t.toLowerCase()
  let best: string | null = null, bestScore = -Infinity, bestIdx = Infinity
  for (const email of raw) {
    const idx = lower.indexOf(email)
    const around = idx >= 0 ? t.slice(Math.max(0, idx - 40), idx + email.length + 10) : ''
    const local = email.split('@')[0]
    let score = 0
    if (KR_BIZ_CONTEXT.test(around)) score += 3
    if (STRONG_LOCAL.test(local)) score += 2
    if (NON_OWNER_LOCAL.test(email)) score -= 3
    if (score > bestScore || (score === bestScore && idx < bestIdx)) { best = email; bestScore = score; bestIdx = idx }
  }
  return best
}

/** 제3자/UGC 도메인 — 리뷰 블로그·SNS 의 이메일은 **글쓴이(제3자) 것**이라 오귀속(허위)이 된다. */
const THIRD_PARTY_HOST = /(?:^|\.)(?:blog\.naver\.com|m\.blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com|naver\.me|tistory\.com|brunch\.co\.kr|instagram\.com|facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|band\.us|daum\.net|kakao\.com|namu\.wiki|wikipedia\.org|saramin\.co\.kr|jobkorea\.co\.kr|wanted\.co\.kr|albamon\.com|incruit\.com)$/i

/** HTML 에서 **게시된** 이메일 1개 — mailto: 우선(업체가 명시적으로 건 링크 = 최고 신뢰) → 본문 문맥선별. */
export function extractEmail(html: string): string | null {
  const src = decodeEmailEntities(String(html || ''))
  const mailtos: string[] = []
  for (const m of src.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    let e = m[1]
    try { e = decodeURIComponent(e) } catch { /* 원문 유지 */ }
    e = e.trim().toLowerCase()
    if (publishableEmail(e)) mailtos.push(e)
  }
  if (mailtos.length) return mailtos[0]
  const body = pickKrBusinessEmail(src)
  if (body && publishableEmail(body)) return body
  // 태그로 쪼갠 이메일("info<span>@</span>domain.com") — 태그 제거본 재스캔.
  const stripped = pickKrBusinessEmail(src.replace(/<[^>]+>/g, ' '))
  return stripped && publishableEmail(stripped) ? stripped : null
}

export type MakerCrawlReason = 'ok' | 'bad_url' | 'blocked_host' | 'robots' | 'no_name' | 'no_contact'
  | 'http_403' | 'http_404' | 'http_5xx' | 'network' | 'subreq_limit'

/**
 * 홈페이지에서 게시 이메일 크롤(robots.txt 준수) — 홈 + 고수율 연락처 경로.
 * @param requireName 검색으로 *발견한* 사이트면 상호 존재를 요구(오귀속 방지). 등록 링크면 생략.
 */
async function crawlEmail(website: string, budget: Budget, requireName?: string): Promise<{ email: string | null; reason: MakerCrawlReason; failUrl?: string }> {
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`) } catch { return { email: null, reason: 'bad_url' } }
  if (!/^https?:$/.test(url.protocol)) return { email: null, reason: 'bad_url' }
  if (THIRD_PARTY_HOST.test(url.hostname)) return { email: null, reason: 'blocked_host' }

  spend(budget)
  const robotsRes = await safeFetch(`${url.origin}/robots.txt`, { timeoutMs: 6000 }, budget)
  if (budget.limitHit) return { email: null, reason: 'subreq_limit' } // 시도조차 못 한 것 — 실패로 기록하면 안 됨
  const robots = robotsRes && robotsRes.ok ? await robotsRes.text().catch(() => '') : ''
  if (robots) {
    const star = robots.split(/user-agent:/i).find(b => /^\s*\*/.test(b)) || ''
    if (/(^|\n)\s*disallow:\s*\/\s*(#|$|\n)/i.test(star)) return { email: null, reason: 'robots' }
  }

  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko,ko-KR;q=0.9,en;q=0.5',
  }
  let lastStatus = 0
  const fetchHtml = async (u: string): Promise<string> => {
    const r = await safeFetch(u, { headers: BROWSER_HEADERS, timeoutMs: 8000 }, budget)
    if (!r) { lastStatus = -1; return '' }
    lastStatus = r.status
    return r.ok ? await r.text().catch(() => '') : ''
  }

  const queue = ['', '/contact', '/about', '/company']
  const MAX_PAGES = 4
  const visited = new Set<string>()
  const wantName = requireName ? norm(requireName) : ''
  let nameSeen = !requireName, anyPage = false, email: string | null = null

  for (let i = 0; i < queue.length && visited.size < MAX_PAGES; i++) {
    const path = queue[i]
    if (visited.has(path)) continue
    visited.add(path)
    if (email || budget.left <= 0) break
    spend(budget)
    let html = await fetchHtml(url.origin + path)
    // 호스트 변형 폴백 — 국내 사이트가 www↔non-www 한쪽만 응답하는 경우가 흔하다(홈 1회만).
    if (!html && path === '' && !budget.limitHit && budget.left > 2) {
      const altHost = url.hostname.startsWith('www.') ? url.hostname.slice(4) : `www.${url.hostname}`
      spend(budget)
      const h = await fetchHtml(`https://${altHost}`)
      if (h) { html = h; try { url = new URL(`https://${altHost}`) } catch { /* keep */ } }
    }
    if (budget.limitHit) break
    if (!html) continue
    anyPage = true
    const slice = html.slice(0, 200000)
    if (!nameSeen && wantName && norm(slice).includes(wantName)) nameSeen = true
    email = extractEmail(slice)
    // JSON-LD 는 사이트가 스스로 선언한 값이라 정밀도 최상.
    if (!email) {
      for (const ld of slice.matchAll(/"email"\s*:\s*"([^"<>{}]{5,120})"/gi)) {
        const e = decodeEmailEntities(ld[1]).replace(/^mailto:/i, '').trim().toLowerCase()
        if (publishableEmail(e)) { email = e; break }
      }
    }
    // 홈에서 '문의/Contact' 링크 추적(≤2) — 국내 그누보드/카페24 커스텀 경로 커버. same-origin 만.
    if (path === '' && !email) {
      let added = 0
      for (const m of slice.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
        if (added >= 2) break
        const href = m[1].replace(/&amp;/g, '&').trim()
        if (!/(contact|inquiry|문의|about|company|intro|회사소개|고객센터)/i.test(href)) continue
        if (/\.(?:jpe?g|png|gif|webp|svg|pdf|zip|hwp|docx?|xlsx?)(?:$|\?)/i.test(href)) continue
        let u2: URL
        try { u2 = new URL(href, url.origin + '/') } catch { continue }
        if (u2.hostname !== url.hostname) continue // 남의 사이트로 안 나감(오귀속 방지)
        const p2 = u2.pathname + u2.search
        if (!visited.has(p2) && !queue.includes(p2)) { queue.push(p2); added++ }
      }
    }
  }

  if (budget.limitHit) return { email: null, reason: 'subreq_limit' }
  if (email && !nameSeen) return { email: null, reason: 'no_name' } // 발견 사이트에 상호 부재 → 남의 회사일 수 있음
  if (email) return { email, reason: 'ok' }
  const httpReason = (): MakerCrawlReason => lastStatus === 403 || lastStatus === 401 ? 'http_403'
    : lastStatus === 404 ? 'http_404' : lastStatus >= 500 ? 'http_5xx' : 'network'
  return { email: null, reason: anyPage ? 'no_contact' : httpReason(), failUrl: url.origin }
}

/** 🔎 네이버 지역검색 — 업체가 **등록한** 홈페이지 링크(신뢰). 상호 일치할 때만 채택. */
async function findSiteByLocal(id: string, secret: string, name: string, region: string | null, budget: Budget): Promise<string | null> {
  spend(budget)
  const q = `${name} ${region || ''}`.trim()
  const res = await safeFetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5`,
    { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }, timeoutMs: 10000 }, budget)
  if (!res || !res.ok) return null
  const data = await res.json().catch(() => null) as { items?: Array<{ title?: string; link?: string }> } | null
  const want = norm(name)
  for (const it of (data?.items || [])) {
    const hit = norm(stripTag(it.title))
    if (!hit || !(hit === want || hit.includes(want) || want.includes(hit))) continue
    const link = (it.link || '').trim()
    if (link && /^https?:\/\//i.test(link)) return link
  }
  return null
}

/** 🔎 네이버 웹문서 — 지역검색에 홈페이지가 없는 업체의 자체 사이트 발견. 제3자 도메인 제외 + 상호 가드. */
async function findSiteByWeb(id: string, secret: string, name: string, region: string | null, budget: Budget): Promise<string | null> {
  spend(budget)
  const q = `${name} ${region || ''}`.trim()
  const res = await safeFetch(`https://openapi.naver.com/v1/search/webkr.json?query=${encodeURIComponent(q)}&display=8`,
    { headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret }, timeoutMs: 10000 }, budget)
  if (!res || !res.ok) return null
  const data = await res.json().catch(() => null) as { items?: Array<{ title?: string; link?: string; description?: string }> } | null
  const want = norm(name)
  for (const it of (data?.items || [])) {
    if (!norm(stripTag(it.title) + ' ' + stripTag(it.description)).includes(want)) continue
    const link = (it.link || '').trim()
    if (!link || !/^https?:\/\//i.test(link)) continue
    try { if (THIRD_PARTY_HOST.test(new URL(link).hostname)) continue } catch { continue }
    return link
  }
  return null
}

export interface MakerEnrichStats {
  last_run: string; processed: number; enriched: number; crawls: number; hit_rate: number
  remaining: number; crawl_reason: Record<string, number>; fail_samples: string[]
  budget_total: number; spent: number; limit_hit: boolean; learned_cap: number
}
const STATS_KEY = 'supply_maker_enrich_last'

/**
 * 📧 이메일 보강 1틱 — [홈페이지 발견 → 크롤] 폭포수. 이메일 없는 리드만, 홈페이지 보유분 우선.
 *   못 찾으면 비워둔다(허위 0). 한도에 부딪히면 **도장 없이** 중단해 다음 실행이 같은 행을 다시 집는다.
 */
export async function enrichMakerLeads(env: Env): Promise<MakerEnrichStats> {
  const DB = env.DB
  await ensureMakerSchema(DB)
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''

  const envBudget = Math.min(400, Math.max(20, parseInt((env as { SUPPLY_ENRICH_BUDGET?: string }).SUPPLY_ENRICH_BUDGET || '', 10) || 120))
  const learnedCap = Math.max(0, parseInt((await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SUBREQ_CAP_KEY)
    .first<{ value: string }>().catch(() => null))?.value || '', 10) || 0)
  const budgetTotal = learnedCap > 0 ? Math.min(envBudget, learnedCap) : envBudget
  const budget: Budget = { left: budgetTotal }

  // 대상 = 이메일 없는 리드. 홈페이지 보유분 우선(크롤 즉시 가능 = 수율 최고) → 제조사 우선(도매 공급 주체).
  const targetCap = Math.min(200, Math.max(40, budgetTotal))
  const targets = (await DB.prepare(`SELECT id, company_name, region, website FROM supply_maker_leads
      WHERE (email IS NULL OR email = '')
        AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < ${MAKER_CRAWL_VERSION})
      ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END),
               (CASE WHEN kind = 'maker' THEN 0 ELSE 1 END), id DESC LIMIT ${targetCap}`)
    .all<{ id: number; company_name: string; region: string | null; website: string | null }>().catch(() => null))?.results || []

  const stamp = async (id: number) => {
    await DB.prepare(`UPDATE supply_maker_leads SET enrich_checked_at = datetime('now'), enrich_v = ${MAKER_CRAWL_VERSION} WHERE id = ?`)
      .bind(id).run().catch(() => null)
  }
  const crawlReason: Record<string, number> = {}
  const failSamples: string[] = []
  let processed = 0, enriched = 0

  for (const t of targets) {
    if (budget.left <= 2 || budget.limitHit) break
    processed++
    let site = (t.website || '').trim() || null
    let discovered = false
    if (!site && nvId && nvSecret && budget.left > 3) {
      site = await findSiteByLocal(nvId, nvSecret, t.company_name, t.region, budget)
      if (!site && !budget.limitHit && budget.left > 3) { site = await findSiteByWeb(nvId, nvSecret, t.company_name, t.region, budget); discovered = !!site }
    }
    if (site && !budget.limitHit && budget.left > 2) {
      const c = await crawlEmail(site, budget, discovered ? t.company_name : undefined)
      crawlReason[c.reason] = (crawlReason[c.reason] || 0) + 1
      if (c.reason !== 'ok' && c.failUrl && failSamples.length < 4) failSamples.push(`${c.failUrl} (${c.reason})`)
      if (c.email) {
        const r = await DB.prepare(`UPDATE supply_maker_leads SET email = COALESCE(email, ?), website = COALESCE(website, ?),
            contact_source = COALESCE(contact_source, 'homepage') WHERE id = ?`).bind(c.email, site, t.id).run().catch(() => null)
        if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) enriched++
      } else if (site && !t.website) {
        // 이메일은 못 얻어도 **발견한 홈페이지는 남긴다** — 다음 라운드/수동 접촉의 자산.
        await DB.prepare('UPDATE supply_maker_leads SET website = COALESCE(website, ?) WHERE id = ?').bind(site, t.id).run().catch(() => null)
      }
    }
    // ⛔ 한도 도달이면 도장 없이 중단 — 인프라 실패가 이 행을 7일간 재시도 불가로 만들면 안 된다.
    if (budget.limitHit) break
    await stamp(t.id)
  }

  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM supply_maker_leads WHERE email IS NULL OR email = ''").first<{ n: number }>().catch(() => null)
  const crawls = Object.values(crawlReason).reduce((s, n) => s + n, 0)
  const spent = budgetTotal - budget.left
  // 🩹 실효 상한 학습 — 부딪혔으면 쓴 양보다 낮게, 다 쓰고도 무사하면 조금 올린다.
  let nextCap: number | null = null
  if (budget.limitHit) nextCap = Math.max(SUBREQ_CAP_MIN, Math.floor(spent * BACKOFF_RATIO))
  else if (learnedCap > 0 && budget.left <= 0 && learnedCap < envBudget) nextCap = Math.min(envBudget, Math.ceil(learnedCap * RECOVER_RATIO))
  if (nextCap != null) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(SUBREQ_CAP_KEY, String(nextCap)).run().catch(() => null)

  const stats: MakerEnrichStats = {
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '),
    processed, enriched, crawls, hit_rate: crawls ? Math.round(((crawlReason.ok || 0) / crawls) * 100) : 0,
    remaining: Number(rem?.n) || 0, crawl_reason: crawlReason, fail_samples: failSamples,
    budget_total: budgetTotal, spent, limit_hit: !!budget.limitHit, learned_cap: nextCap ?? learnedCap,
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(STATS_KEY, JSON.stringify(stats)).run().catch(() => null)
  return stats
}
