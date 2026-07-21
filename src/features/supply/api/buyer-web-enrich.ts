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

export interface WebEnrichResult { ran: boolean; reason?: string; scanned: number; enriched: number; fetches: number; sample: string[] }

/** 웹사이트 있고 이메일 없는 리드를 방문해 이메일/전화 백필. 스코어 높은 순. */
export async function enrichLeadsFromWebsites(env: Env, opts: { max?: number; budget?: number } = {}): Promise<WebEnrichResult> {
  const DB = env.DB
  await ensureBuyerSchema(DB)
  const max = Math.min(40, Math.max(1, opts.max || 15))
  const rows = (await DB.prepare(
    `SELECT id, website FROM overseas_buyer_leads
     WHERE website IS NOT NULL AND website != ''
       AND (email IS NULL OR email = '') AND (decision_maker_email IS NULL OR decision_maker_email = '')
     ORDER BY COALESCE(match_score,0) DESC, id DESC LIMIT ?`).bind(max)
    .all<{ id: number; website: string }>().catch(() => null))?.results || []
  if (!rows.length) return { ran: true, reason: '이메일 없는 웹사이트 리드가 없습니다.', scanned: 0, enriched: 0, fetches: 0, sample: [] }
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml', 'accept-language': 'en;q=0.9,ko;q=0.8',
  }
  const budget = opts.budget != null ? Math.max(4, Math.min(30, opts.budget)) : Math.min(25, Math.max(8, parseInt(env.BUYER_SUBREQUEST_BUDGET || '25', 10) || 25)) // Cloudflare subrequest 한도 보호(크론은 명시 budget 로 합산 상한)
  let fetches = 0, enriched = 0
  const sample: string[] = []
  const SITE_CAP = 5 // 사이트당 최대 방문(홈 + 연락 페이지 몇 개) — 예산을 여러 리드에 분산.
  const originCache = new Map<string, { email: string | null; phone: string | null; address: string | null }>() // 같은 도메인 재방문 방지.
  for (const row of rows) {
    if (fetches >= budget) break
    const origin = normUrl(row.website)
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
            // mailto: 최우선 → 전체 HTML 문맥 스코어(pickBusinessEmail, 구매담당 local-part 우선) → 첫 후보.
            const mail = es.find(e => new RegExp('mailto:' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html))
            const ctx = pickBusinessEmail(html)
            const ctxOk = ctx && !IMG_EMAIL.test(ctx) && !JUNK_EMAIL.test(ctx) ? ctx : null
            res.email = mail || ctxOk || es[0] || null
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
  return { ran: true, scanned: rows.length, enriched, fetches, sample }
}
