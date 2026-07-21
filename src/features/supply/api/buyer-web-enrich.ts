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
// 홈 → 자주 쓰는 연락 경로 순회(이메일 찾으면 중단). 과도한 요청 방지 위해 소수만.
const CONTACT_PATHS = ['', '/contact', '/contact-us', '/en/contact', '/about', '/company']
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

function normUrl(website: string): string | null {
  let w = String(website || '').trim()
  if (!w) return null
  if (!/^https?:\/\//i.test(w)) w = 'https://' + w
  if (!isPublicHttpUrl(w)) return null // SSRF: 내부/사설 호스트 차단
  try { return new URL(w).origin } catch { return null }
}

// AbortController 로 8s 에 실제 fetch 도 중단(dangling subrequest 방지).
async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 8000)
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: ac.signal })
    return res.ok ? await res.text() : ''
  } catch { return '' } finally { clearTimeout(t) }
}

export interface WebEnrichResult { ran: boolean; reason?: string; scanned: number; enriched: number; fetches: number; sample: string[] }

/** 웹사이트 있고 이메일 없는 리드를 방문해 이메일/전화 백필. 스코어 높은 순. */
export async function enrichLeadsFromWebsites(env: Env, opts: { max?: number } = {}): Promise<WebEnrichResult> {
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
  const budget = Math.min(25, Math.max(8, parseInt(env.BUYER_SUBREQUEST_BUDGET || '25', 10) || 25)) // Cloudflare subrequest 한도 보호
  let fetches = 0, enriched = 0
  const sample: string[] = []
  for (const row of rows) {
    const origin = normUrl(row.website)
    if (!origin) continue
    let email: string | null = null, phone: string | null = null
    for (const path of CONTACT_PATHS) {
      if (fetches >= budget) break
      fetches++
      const html = await fetchText(origin + path, headers)
      if (!html) { await delay(300); continue }
      if (!email) {
        const es = emailsFromHtml(html) // 이미 정크/이미지 필터됨
        // mailto: 최우선 → 전체 HTML 문맥 스코어(pickBusinessEmail) → 첫 후보.
        const mail = es.find(e => new RegExp('mailto:' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(html))
        const ctx = pickBusinessEmail(html)
        const ctxOk = ctx && !IMG_EMAIL.test(ctx) && !JUNK_EMAIL.test(ctx) ? ctx : null
        email = mail || ctxOk || es[0] || null
      }
      if (!phone) { const p = pickPhone(html); if (p && /^\s*\+/.test(p)) phone = p }
      await delay(400) // throttle
      if (email) break
    }
    if (email || phone) {
      const r = await DB.prepare(
        `UPDATE overseas_buyer_leads SET email = COALESCE(email, ?), phone = COALESCE(phone, ?),
           source_keyword = COALESCE(source_keyword, 'web-enrich')
         WHERE id = ? AND (email IS NULL OR email = '')`).bind(email, phone, row.id).run().catch(() => null)
      if (r && (r.meta?.changes ?? 0) > 0) { enriched++; if (email && sample.length < 5) sample.push(email) }
    }
    if (fetches >= budget) break
  }
  return { ran: true, scanned: rows.length, enriched, fetches, sample }
}
