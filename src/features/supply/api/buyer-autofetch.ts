/**
 * 🌐 유통스타트 — 상세 페이지 서버 자동 수집 (대표 명시 "위험 감수하고 하자 · 모든 서비스", 2026-07-21).
 *   ⚠️ [위험] 로그인 게이트 상세를 대표 세션 쿠키로 서버가 직접 fetch — buyKorea/tradeKorea/EC21/ECPlaza/
 *   GoBizKorea 겸용. 각 사이트 약관상 자동·대량 수집은 금지 → 계정 정지 위험. 대표가 위험을 명시 수용.
 *   방어: ① env 게이트(BUYER_AUTO_FETCH_ENABLED, 기본 OFF) ② 소량 배치 캡(≤30) ③ 요청 간 지연(throttle)
 *   ④ 쿠키 미저장(요청당 1회, 로깅 금지) ⑤ 리스트와 같은 호스트만 순회. 유어딜 무관(features/supply 자립).
 */
import type { Env } from '@/worker/types/env'
import { encryptAtRest, decryptAtRest } from '@/worker/utils/data-crypto'
import { parseBuyKoreaInquiries } from './buyer-parsers'
import { saveBuyerLeads, type BuyerLead } from './buyer-discovery'

/* ── 저장(쿠키·소스) — 매번 F12 안 하도록 한 번 저장 후 재사용 ─────────────────────
 *   쿠키는 호스트별로 AES-GCM 암호화(DATA_ENCRYPTION_KEY) 저장. 소스(리스트 URL)는 목록으로.
 *   platform_settings 재사용(별도 테이블 없이). 클라엔 쿠키 원문 절대 반환 안 함(존재 여부만). */
const CK_KEY = 'buyer_af_cookies', SRC_KEY = 'buyer_af_sources'
export function hostOf(url: string): string { try { return new URL(url).host } catch { return '' } }

// SSRF/사설망 차단 — 쿠키 실린 서버 fetch 는 반드시 공개 http(s) 호스트만.
//   IPv4 사설/루프백/링크로컬/CGNAT + IPv6 루프백/ULA(fc00::/7)/링크로컬(fe80::/10)/매핑(::ffff:)/멀티캐스트 + 내부 호스트명 차단.
//   ⚠️ DNS-rebinding(공개 호스트명이 내부 IP 로 해석)은 이 레이어로 못 막음(호스트명만 검사) — Worker fetch 특성상 잔여 리스크(문서화).
const PRIV4_RE = /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/
export function isPublicHttpUrl(u: string): boolean {
  let x: URL
  try { x = new URL(u) } catch { return false }
  if (x.protocol !== 'https:' && x.protocol !== 'http:') return false
  const host = x.hostname.toLowerCase()
  if (!host) return false
  // 내부 호스트명(localhost/*.localhost/.local/.internal/.lan) + 클라우드 메타데이터
  if (host === 'localhost' || host.endsWith('.localhost') || /\.(?:local|internal|lan)$/.test(host)) return false
  if (host.startsWith('metadata.google')) return false
  // IPv6 (URL.hostname 은 대괄호 포함해서 반환)
  if (host.startsWith('[') || host.includes(':')) {
    const v6 = host.replace(/^\[|\]$/g, '')
    const mapped = v6.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i) // IPv4-mapped ::ffff:a.b.c.d
    if (mapped) return !PRIV4_RE.test(mapped[1])
    if (v6 === '::1' || v6 === '::') return false          // loopback / unspecified
    if (/^f[cd]/i.test(v6)) return false                    // fc00::/7 ULA
    if (/^fe[89ab]/i.test(v6)) return false                 // fe80::/10 link-local
    if (/^ff/i.test(v6)) return false                       // ff00::/8 multicast
    if (/^::ffff:/i.test(v6)) return false                  // hex-form mapped(파싱 못한 것) 보수적 차단
    return true
  }
  // IPv4 (URL 이 10진수/16진수/8진수를 dotted 로 정규화 — 예: http://2130706433/ → 127.0.0.1)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return !PRIV4_RE.test(host)
  return true
}

async function getSetting(env: Env, key: string): Promise<string> {
  const r = await env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key).first<{ value: string }>().catch(() => null)
  return r?.value || ''
}
async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value).run().catch(() => null)
}
async function loadCookieMap(env: Env): Promise<Record<string, string>> {
  const raw = await getSetting(env, CK_KEY); if (!raw) return {}
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {} } catch { return {} }
}
export async function saveCookieForHost(env: Env, host: string, cookie: string): Promise<void> {
  if (!host || !cookie) return
  // 로그인 세션 쿠키는 민감정보 — KEK(DATA_ENCRYPTION_KEY) 없으면 평문 저장 대신 거부(encryptAtRest 는 KEK 없을 때 평문 폴백).
  if (!env.DATA_ENCRYPTION_KEY || env.DATA_ENCRYPTION_KEY.length < 16) {
    throw new Error('NO_ENCRYPTION_KEY — 쿠키 저장에 DATA_ENCRYPTION_KEY(≥16자)가 필요합니다(평문 저장 방지).')
  }
  const map = await loadCookieMap(env)
  map[host] = await encryptAtRest(cookie, env.DATA_ENCRYPTION_KEY)
  await setSetting(env, CK_KEY, JSON.stringify(map))
}
export async function getCookieForHost(env: Env, host: string): Promise<string> {
  const enc = (await loadCookieMap(env))[host]; if (!enc) return ''
  try { return await decryptAtRest(enc, env.DATA_ENCRYPTION_KEY) } catch { return '' }
}
export interface AutofetchSource { host: string; url: string; label: string }
export async function loadSources(env: Env): Promise<AutofetchSource[]> {
  const raw = await getSetting(env, SRC_KEY); if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
}
export async function addSource(env: Env, url: string, label?: string): Promise<void> {
  const host = hostOf(url); if (!host) return
  const list = await loadSources(env)
  if (list.some(s => s.url === url)) return
  list.push({ host, url, label: (label || host).slice(0, 80) })
  await setSetting(env, SRC_KEY, JSON.stringify(list.slice(0, 50)))
}
export async function removeSource(env: Env, url: string): Promise<void> {
  await setSetting(env, SRC_KEY, JSON.stringify((await loadSources(env)).filter(s => s.url !== url)))
}
const CRON_KEY = 'buyer_af_cron'
export async function getCronEnabled(env: Env): Promise<boolean> { return (await getSetting(env, CRON_KEY)) === '1' }
export async function setCronEnabled(env: Env, on: boolean): Promise<void> { await setSetting(env, CRON_KEY, on ? '1' : '0') }

export async function getAutofetchConfig(env: Env): Promise<{ sources: AutofetchSource[]; cookieHosts: string[]; enabled: boolean; cronEnabled: boolean }> {
  const [sources, map, cron] = await Promise.all([loadSources(env), loadCookieMap(env), getCronEnabled(env)])
  return { sources, cookieHosts: Object.keys(map), enabled: env.BUYER_AUTO_FETCH_ENABLED === 'true', cronEnabled: cron }
}

/* ── 북마클릿 인제스트 — F12·쿠키 복사 없이 대표 브라우저에서 원클릭 수집 ────────────────
 *   토큰 인증(관리자 쿠키 대신 — 크로스오리진). 북마클릿이 buyKorea 세션으로 상세 HTML 을 읽어 전송. */
const INGEST_TOKEN_KEY = 'buyer_ingest_token'
function randToken(): string {
  const a = new Uint8Array(24); crypto.getRandomValues(a)
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('')
}
export async function getIngestToken(env: Env): Promise<string> {
  let t = await getSetting(env, INGEST_TOKEN_KEY)
  if (!t) { t = randToken(); await setSetting(env, INGEST_TOKEN_KEY, t) }
  return t
}
export async function resetIngestToken(env: Env): Promise<string> {
  const t = randToken(); await setSetting(env, INGEST_TOKEN_KEY, t); return t
}
export async function verifyIngestToken(env: Env, token: string): Promise<boolean> {
  if (!token || token.length < 20) return false
  const t = await getSetting(env, INGEST_TOKEN_KEY)
  return !!t && t === token
}
/** 북마클릿이 보낸 상세 HTML 배열을 파싱·저장(리스트 행 보강 포함). */
export async function ingestHtmls(env: Env, htmls: string[], refs?: string[]): Promise<{ parsed: number; saved: number }> {
  const leads: BuyerLead[] = []
  const list = htmls.slice(0, 200)
  for (let i = 0; i < list.length; i++) {
    const html = list[i]
    if (typeof html !== 'string' || !html) continue
    const ref = Array.isArray(refs) ? String(refs[i] || '').slice(0, 200) || null : null
    const got = parseBuyKoreaInquiries(htmlToText(html))
    // 재수집 건너뛰기용 소스 참조를 이 상세에서 나온 리드에 태깅(북마클릿 known 조회와 대칭).
    if (ref) for (const g of got) g.source_ref = ref
    leads.push(...got)
  }
  const saved = await saveBuyerLeads(env.DB, leads).catch(() => 0)
  return { parsed: leads.length, saved }
}
const LOGIN_MARKER = /(login|signin|<input[^>]+type=["']?password|로그인이 필요|아이디.{0,6}비밀번호)/i

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
    .replace(/<\/(?:tr|div|p|li|h[1-6]|table|dt|dd|th|td|section|button)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .split('\n').map(l => l.trim()).filter((l, i, a) => l || (a[i - 1] || '').length > 0).join('\n')
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// AbortController 로 행(hang) 방지 — 응답 없는 origin 이 worker 를 무한 점유하는 것 차단(8s).
async function fetchHtml(url: string, init: RequestInit): Promise<string> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 8000)
  try {
    const r = await fetch(url, { ...init, signal: ac.signal })
    return r.ok ? await r.text() : ''
  } catch { return '' } finally { clearTimeout(t) }
}

export interface AutoFetchResult { ran: boolean; reason?: string; urls_found: number; fetched: number; parsed: number; saved: number; errors: number; sample: string[] }

/** 리스트 URL(+쿠키)로 상세 링크를 뽑아 각 상세를 자동 fetch·파싱·저장. urls[] 직접 지정도 가능. */
export async function runBuyerAutoFetch(env: Env, opts: { cookie: string; listUrl?: string; urls?: string[]; max?: number }): Promise<AutoFetchResult> {
  const empty: AutoFetchResult = { ran: false, urls_found: 0, fetched: 0, parsed: 0, saved: 0, errors: 0, sample: [] }
  if (env.BUYER_AUTO_FETCH_ENABLED !== 'true') return { ...empty, reason: 'DISABLED — Cloudflare 환경변수 BUYER_AUTO_FETCH_ENABLED=true 설정이 필요합니다(위험 기능 무장).' }
  const primaryHost = hostOf(opts.listUrl || (opts.urls || [])[0] || '')
  let cookie = (opts.cookie || '').trim()
  // 쿠키 미지정이면 저장된(암호화) 쿠키 재사용 — 매번 F12 안 하도록.
  if (cookie.length < 10 && primaryHost) cookie = (await getCookieForHost(env, primaryHost).catch(() => '')) || ''
  if (cookie.length < 10) return { ...empty, reason: 'NO_COOKIE — 로그인 쿠키가 없습니다(저장된 쿠키 만료 시 다시 붙여넣어 주세요).' }
  const headers: Record<string, string> = {
    cookie,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
  }
  const budget = Math.max(5, parseInt(env.BUYER_SUBREQUEST_BUDGET || '60', 10) || 60)
  const max = Math.min(30, budget - 1, Math.max(1, opts.max || 10))
  let urls = (opts.urls || []).filter(u => /^https?:\/\//.test(u))
  // ⚠️ 쿠키 유출/SSRF 방어: 쿠키는 primaryHost 세션이므로 **primaryHost + 공개호스트** URL 에만 붙인다.
  //   redirect:'manual' — 외부로 302 시 쿠키 따라가는 것 차단(2xx 만 파싱).
  if (opts.listUrl && isPublicHttpUrl(opts.listUrl) && hostOf(opts.listUrl) === primaryHost) {
    const listHtml = await fetchHtml(opts.listUrl, { headers, redirect: 'manual' })
    const found = listHtml ? extractDetailUrls(listHtml, opts.listUrl) : []
    if (!found.length && LOGIN_MARKER.test(listHtml)) return { ...empty, ran: true, reason: 'COOKIE_EXPIRED — 로그인 쿠키가 만료된 것 같습니다. 쿠키를 다시 붙여넣어 주세요.' }
    urls = urls.concat(found)
  }
  urls = Array.from(new Set(urls)).filter(u => isPublicHttpUrl(u) && hostOf(u) === primaryHost).slice(0, max)
  if (!urls.length) return { ...empty, ran: true, reason: '상세 링크를 찾지 못했습니다(같은 사이트 링크만 수집) — 리스트 페이지 URL·로그인 쿠키를 확인하세요.' }
  const leads: BuyerLead[] = []
  let fetched = 0, errors = 0
  const sample: string[] = []
  for (const u of urls) {
    const html = await fetchHtml(u, { headers, redirect: 'manual' })
    if (!html) { errors++; await delay(400); continue }
    fetched++
    const got = parseBuyKoreaInquiries(htmlToText(html))
    if (got.length) { leads.push(...got); if (sample.length < 5 && got[0]?.company) sample.push(got[0].company) }
    await delay(500) // throttle — 봇 탐지·서버 부하 완화(사이트 보호)
  }
  const saved = await saveBuyerLeads(env.DB, leads).catch(() => 0)
  return { ran: true, urls_found: urls.length, fetched, parsed: leads.length, saved, errors, sample }
}

export interface SavedRunResult { ran: boolean; reason?: string; saved: number; sources: Array<{ url: string; label: string; saved: number; parsed: number; reason?: string }> }

/** 저장된 소스(리스트 URL) 전부를 저장된 쿠키로 자동 수집 — 버튼 한 번(또는 크론)으로. */
export async function runSavedSources(env: Env, max?: number, budgetCap?: number): Promise<SavedRunResult> {
  if (env.BUYER_AUTO_FETCH_ENABLED !== 'true') return { ran: false, reason: 'DISABLED', saved: 0, sources: [] }
  // 밴/subrequest 보호: 한 실행 최대 8소스 + 전체 공유 fetch 예산(소스마다 예산 재설정하던 폭발 차단).
  //   budgetCap 지정 시 그 값으로 상한(크론이 collect+enrich 합계를 ~50 아래로 나눠 씀).
  const sources = (await loadSources(env)).slice(0, 8)
  if (!sources.length) return { ran: false, reason: 'NO_SOURCES — 저장된 리스트 URL 이 없습니다(자동 수집 실행 시 "저장" 체크).', saved: 0, sources: [] }
  const cap = budgetCap ?? (parseInt(env.BUYER_SUBREQUEST_BUDGET || '40', 10) || 40)
  let saved = 0, remaining = Math.max(6, Math.min(40, cap))
  const out: SavedRunResult['sources'] = []
  for (const s of sources) {
    if (remaining <= 2) { out.push({ url: s.url, label: s.label, saved: 0, parsed: 0, reason: 'BUDGET_EXHAUSTED' }); continue }
    const perMax = Math.min(max || 15, Math.max(1, remaining - 1))
    const r = await runBuyerAutoFetch(env, { cookie: '', listUrl: s.url, max: perMax }).catch(() => null)
    saved += r?.saved || 0
    // 시도한 subrequest 전부 차감(성공 fetched + 실패 errors + 리스트 1) — 성공만 세면 밴/403 다발 시 예산 초과(1101).
    remaining -= (r?.fetched || 0) + (r?.errors || 0) + 1
    out.push({ url: s.url, label: s.label, saved: r?.saved || 0, parsed: r?.parsed || 0, reason: r?.reason })
  }
  return { ran: true, saved, sources: out }
}
