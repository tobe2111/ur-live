/**
 * 🌐 유통스타트 — 상세 페이지 서버 자동 수집 (대표 명시 "위험 감수하고 하자 · 모든 서비스", 2026-07-21).
 *   ⚠️ [위험] 로그인 게이트 상세를 대표 세션 쿠키로 서버가 직접 fetch — buyKorea/tradeKorea/EC21/ECPlaza/
 *   GoBizKorea 겸용. 각 사이트 약관상 자동·대량 수집은 금지 → 계정 정지 위험. 대표가 위험을 명시 수용.
 *   방어: ① env 게이트(BUYER_AUTO_FETCH_ENABLED, 기본 OFF) ② 소량 배치 캡(≤30) ③ 요청 간 지연(throttle)
 *   ④ 쿠키 미저장(요청당 1회, 로깅 금지) ⑤ 리스트와 같은 호스트만 순회. 유어딜 무관(features/supply 자립).
 */
import type { Env } from '@/worker/types/env'
import { parseBuyKoreaInquiries } from './buyer-parsers'
import { saveBuyerLeads, type BuyerLead } from './buyer-discovery'

/** 리스트 HTML 에서 같은 호스트의 상세 링크 추출(사이트 무관 휴리스틱: detail/view/offer/inqry 힌트 + id). */
export function extractDetailUrls(html: string, baseUrl: string): string[] {
  let base: URL
  try { base = new URL(baseUrl) } catch { return [] }
  const DETAIL_HINT = /(detail|view|inqry|inquiry|offer|lead|goods|product|bbs|read)/i
  const out = new Set<string>()
  for (const m of String(html || '').matchAll(/href\s*=\s*["']([^"'#\s]+)["']/gi)) {
    const h = m[1]
    if (/^(javascript:|mailto:|tel:|data:)/i.test(h)) continue
    let abs: URL
    try { abs = new URL(h.replace(/&amp;/g, '&'), baseUrl) } catch { continue }
    if (abs.host !== base.host) continue
    const target = abs.pathname + abs.search
    const hasId = /[?&]\w*(sn|no|id|seq|idx|code|num)=\d+/i.test(abs.search) || /\/\d{3,}(?:\/|$)/.test(abs.pathname)
    if (DETAIL_HINT.test(target) && hasId) out.add(abs.toString())
  }
  return Array.from(out)
}

/** HTML → 텍스트(라벨 파서 입력용). 블록 태그를 줄바꿈으로 보존. */
export function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:tr|div|p|li|h[1-6]|table|dt|dd|th|td|section)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] || '').length > 0).join('\n')
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export interface AutoFetchResult { ran: boolean; reason?: string; urls_found: number; fetched: number; parsed: number; saved: number; errors: number; sample: string[] }

/** 리스트 URL(+쿠키)로 상세 링크를 뽑아 각 상세를 자동 fetch·파싱·저장. urls[] 직접 지정도 가능. */
export async function runBuyerAutoFetch(env: Env, opts: { cookie: string; listUrl?: string; urls?: string[]; max?: number }): Promise<AutoFetchResult> {
  const empty: AutoFetchResult = { ran: false, urls_found: 0, fetched: 0, parsed: 0, saved: 0, errors: 0, sample: [] }
  if (env.BUYER_AUTO_FETCH_ENABLED !== 'true') return { ...empty, reason: 'DISABLED — Cloudflare 환경변수 BUYER_AUTO_FETCH_ENABLED=true 설정이 필요합니다(위험 기능 무장).' }
  const cookie = (opts.cookie || '').trim()
  if (cookie.length < 10) return { ...empty, reason: 'NO_COOKIE — 로그인된 브라우저의 쿠키가 필요합니다.' }
  const headers: Record<string, string> = {
    cookie,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
  }
  const budget = Math.max(5, parseInt(env.BUYER_SUBREQUEST_BUDGET || '60', 10) || 60)
  const max = Math.min(30, budget - 1, Math.max(1, opts.max || 10))
  let urls = (opts.urls || []).filter(u => /^https?:\/\//.test(u))
  if (opts.listUrl && /^https?:\/\//.test(opts.listUrl)) {
    const listHtml = await fetch(opts.listUrl, { headers, redirect: 'follow' }).then(r => (r.ok ? r.text() : '')).catch(() => '')
    if (listHtml) urls = urls.concat(extractDetailUrls(listHtml, opts.listUrl))
  }
  urls = Array.from(new Set(urls)).slice(0, max)
  if (!urls.length) return { ...empty, ran: true, reason: '상세 링크를 찾지 못했습니다 — 리스트 페이지 URL·로그인 쿠키를 확인하거나, 상세 URL 을 직접 넣어 주세요.' }
  const leads: BuyerLead[] = []
  let fetched = 0, errors = 0
  const sample: string[] = []
  for (const u of urls) {
    const html = await fetch(u, { headers, redirect: 'follow' }).then(r => (r.ok ? r.text() : '')).catch(() => '')
    if (!html) { errors++; await delay(400); continue }
    fetched++
    const got = parseBuyKoreaInquiries(htmlToText(html))
    if (got.length) { leads.push(...got); if (sample.length < 5 && got[0]?.company) sample.push(got[0].company) }
    await delay(500) // throttle — 봇 탐지·서버 부하 완화(사이트 보호)
  }
  const saved = await saveBuyerLeads(env.DB, leads).catch(() => 0)
  return { ran: true, urls_found: urls.length, fetched, parsed: leads.length, saved, errors, sample }
}
