/**
 * 💼 파트너 발굴 — 고용24(워크넷) 채용정보 (2026-07-27 대표 인증키 승인 — 채용정보 API).
 *   "채용 중인 회사 = 활동·성장 중" 신호로 광고·마케팅·판촉·인쇄 계열 기업을 발굴해 파트너 풀에 적재.
 *   목록 응답엔 연락처가 없어 requireContact:true(보류 저장) → 기존 보강 폭포수(네이버 발견→크롤)가
 *   홈페이지·이메일을 채움. 채용공고 URL 은 description 에 기록(영업 멘트 소재 — "지금 채용 중이시더라").
 *
 *   ⚠️ 고용24 통합(2024) 후 엔드포인트 표기가 문서마다 흔들려 **방어 설계**: URL env 오버라이드
 *   (ADS_WORK24_LIST_URL) + XML/JSON 양대응 파서 + 첫 응답 샘플 diag 노출(추측 대신 실확인 — NPS/HIRA 패턴).
 *   키 WORK24_API_KEY(코드/커밋 금지 — Cloudflare env 전용). 게이트 ADS_WORK24_ENABLED(기본 OFF), 수동 무관.
 *   ⚠️ 수집 ≠ 발송 — 공개 채용공고의 회사 정보만.
 */
import type { Env } from '@/worker/types/env'
import { isNoValue } from './public-data-diag'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

const DEFAULT_LIST_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do'
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
// 파트너 적합 업종 신호 — 회사명/모집직종/공고제목에서(아인종합기획형 포함).
const PARTNER_RE = /광고|마케팅|홍보|기획|판촉|인쇄|디자인|이벤트|프로모션|간판|옥외|미디어|브랜딩/
const KEYWORDS = ['광고기획', '마케팅', '광고대행', '판촉', '인쇄', '이벤트']

type Raw = Record<string, string>
/** 고용24 채용목록 경량 파서 — XML `<wanted>` 블록(워크넷 계열 표준) + `<item>` + JSON 양대응. */
function parseJobs(text: string): { items: Raw[]; msg?: string } {
  const t = text.trim()
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>
      const arrRaw = (j.wanted ?? (j.wantedRoot as Record<string, unknown> | undefined)?.wanted ?? (j.body as Record<string, unknown> | undefined)?.items ?? []) as unknown
      const arr = (Array.isArray(arrRaw) ? arrRaw : arrRaw ? [arrRaw] : []) as Record<string, unknown>[]
      return { items: arr.map(o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, stripTag(v)]))) }
    } catch { return { items: [], msg: 'JSON 파싱 실패' } }
  }
  const items: Raw[] = []
  for (const open of ['wanted', 'item'] as const) {
    for (const b of t.split(new RegExp(`<${open}>`)).slice(1)) {
      const chunk = b.split(`</${open}>`)[0]
      const o: Raw = {}
      for (const m of chunk.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[m[1]] = stripTag(m[2])
      if (Object.keys(o).length) items.push(o)
    }
    if (items.length) break
  }
  // <GO24><error>…</error> 형식도 회수(실측 2026-07-27 — "개인회원은 사용할 수 없는 OPEN-API입니다").
  const msg = !items.length ? (t.match(/<message>([^<]*)<\/message>/)?.[1] || t.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/)?.[1] || t.match(/<error>([^<]*)<\/error>/)?.[1] || undefined) : undefined
  return { items, msg }
}

const g = (o: Raw, ...keys: string[]): string => {
  for (const k of keys) { if (o[k] != null && String(o[k]).trim() !== '') return String(o[k]).trim() }
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))
// ⚠️ 별칭 폴백은 `isNoValue` 를 통과해야 한다 — 포털이 '값 없음'을 `"N/A"` 문자열로 주는데 truthy 라
//   앞 별칭에서 걸리면 **뒤 별칭의 진짜 값을 건너뛴다**(통신판매에서 주소 31.7% 를 그렇게 잃었다).
  for (const k of keys) { const v = lower[k.toLowerCase()]; if (!isNoValue(v)) return String(v).trim() }
  return ''
}

export interface Work24Stats {
  last_run: string; keyword: string; page: number; found: number; matched: number; saved: number
  total_runs: number; total_saved: number
  diag: { configured: boolean; error?: string; sample?: unknown }
}
const STATS_KEY = 'ads_work24_stats'
const CURSOR_KEY = 'ads_work24_cursor'

/** 채용기업 1틱 — 키워드×페이지 커서 순환(회당 2요청). 파트너 업종 신호만 저장. */
export async function runWork24JobsCollect(env: Env): Promise<Work24Stats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = (env as unknown as { WORK24_API_KEY?: string }).WORK24_API_KEY || ''
  const listUrl = (env as unknown as { ADS_WORK24_LIST_URL?: string }).ADS_WORK24_LIST_URL || DEFAULT_LIST_URL
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: Work24Stats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as Work24Stats : null } catch { prev = null }
  const persist = async (s: Work24Stats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) {
    const s: Work24Stats = { last_run: stamp, keyword: '', page: 0, found: 0, matched: 0, saved: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: WORK24_API_KEY 미설정(Cloudflare env)' } }
    await persist(s); return s
  }

  // 커서: 키워드 idx × 페이지(키워드당 3페이지 순회 후 다음 키워드).
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let ki = 0, page = 1
  try { const c = curRaw?.value ? JSON.parse(curRaw.value) as { ki?: number; page?: number } : null; ki = c?.ki || 0; page = c?.page || 1 } catch { /* 초기 */ }
  if (!Number.isFinite(ki) || ki < 0 || ki >= KEYWORDS.length) ki = 0
  if (!Number.isFinite(page) || page < 1) page = 1
  const kw = KEYWORDS[ki]

  let found = 0, matched = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  for (let hop = 0; hop < 2; hop++) {
    const params = new URLSearchParams({ authKey: key, callTp: 'L', returnType: 'XML', startPage: String(page), display: '100', keyword: kw })
    const res = await fetch(`${listUrl}?${params.toString()}`, { signal: AbortSignal.timeout(20000) }).catch(() => null)
    if (!res || !res.ok) { lastMsg = res ? `HTTP ${res.status}` : '네트워크 오류'; break }
    const rawText = await res.text().catch(() => '')
    const { items, msg } = parseJobs(rawText)
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    // 🔎 발굴 0 이면 응답 **원문 앞부분**을 diag 로 — "왜 0인지"를 어드민 상태줄에서 바로 봄
    //   (엔드포인트 slug/파라미터명 오류·인증 거부·HTML 에러페이지가 전부 여기 드러남 → 추측 대신 실확인).
    if (!sample && !items.length) sample = rawText.slice(0, 400) || '(빈 응답)'
    if (!items.length) { ki = (ki + 1) % KEYWORDS.length; page = 1; break } // 키워드 소진 → 다음 키워드
    found += items.length
    const leads: CompanyLead[] = []
    for (const it of items) {
      const company = g(it, 'company', 'corpNm', 'coNm', 'entrprsNm')
      const title = g(it, 'title', 'wantedTitle', 'recrtTitle')
      const occupation = g(it, 'occupation', 'jobsNm', 'sptCertOccpNm')
      if (company.length < 2) continue
      if (!PARTNER_RE.test(`${company} ${occupation} ${title}`)) continue // 파트너 업종 신호만
      matched++
      const region = g(it, 'region', 'basicAddr', 'workRegion').split(/\s+/).slice(0, 2).join(' ')
      const infoUrl = g(it, 'wantedInfoUrl', 'infoUrl')
      leads.push({
        company_name: company, region: region || null,
        description: [`채용중: ${title}`.slice(0, 120), occupation, infoUrl].filter(Boolean).join(' · ').slice(0, 300),
        source: 'work24', source_keyword: kw, tier: 2,
      })
    }
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0) // 연락처는 보강 폭포수가
    page++
    if (page > 3) { ki = (ki + 1) % KEYWORDS.length; page = 1; break }
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, JSON.stringify({ ki, page })).run().catch(() => null)
  // 실측 확인된 차단 사유는 **다음 행동까지** 붙여 준다 — 어드민이 메시지만 보고 바로 처리하게(2026-07-27 진단).
  const hint = lastMsg && /개인회원|사용할 수 없는/.test(lastMsg)
    ? ' → 고용24에서 **기업회원으로 전환** 후 오픈API 키를 재발급받아 `WORK24_API_KEY` 를 교체하면 즉시 동작합니다(코드 변경 불필요).'
    : ''
  const error = found === 0 && lastMsg ? `API: ${lastMsg}${hint}` : undefined
  const s: Work24Stats = {
    last_run: stamp, keyword: kw, page, found, matched, saved,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    diag: { configured: true, error, sample },
  }
  await persist(s)
  return s
}
