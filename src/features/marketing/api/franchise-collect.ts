/**
 * 🏢 파트너 수집 — 공정위 가맹사업 브랜드 목록 (공정거래위원회, data.go.kr 1130000) — 2026-07-23.
 *   프랜차이즈 **본사/브랜드**(브랜드명·법인명·대표·사업자번호·업종·주요상품)를 발굴 → `ad_company_leads` source='franchise'.
 *   가맹점 확장 중인 본사 = 유어딜에 매장을 다수 데려올 수 있는 파트너.
 *
 *   ✅ 실 엔드포인트(웹 확인 2026-07-23): FftcBrandRlsInfo2_Service / getBrandList.
 *   ⚠️ 이 API 는 **연락처(전화/이메일)를 직접 주지 않음**(브랜드·법인·사업자번호까지). 연락처는 **보강 단계**에서
 *      네이버 홈페이지 검색(브랜드명)→크롤로 확보(프랜차이즈 본사는 홈페이지 보유율 높아 이메일 수율 우수).
 *      → requireContact:true 로 저장(보류) → enrichHeldLeads 가 브랜드명으로 홈페이지 찾아 이메일/전화 채움.
 *
 *   게이트 `ADS_FRANCHISE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`. ADS_FRANCHISE_ENDPOINT/OP 로 override.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

const FRANCHISE_BASE = 'https://apis.data.go.kr/1130000/FftcBrandRlsInfo2_Service'
const FRANCHISE_OP = 'getBrandList'
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawFranchise = Record<string, unknown>
const g = (it: RawFranchise, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (v != null && String(v).trim()) return stripTag(v) } return '' }

/** 브랜드 1페이지 조회 → RawFranchise[]. 봉투 다형태 방어 + header resultMsg 회수. */
async function fetchBrandPage(base: string, op: string, key: string, page: number, yr: string, budget: { left: number }): Promise<{ items: RawFranchise[]; count: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/${op}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=100&type=json&_type=json&resultType=json${yr ? `&yr=${encodeURIComponent(yr)}` : ''}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0, msg: res ? `HTTP ${res.status}` : '네트워크 오류' }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawFranchise[] : (items && typeof items === 'object' ? [items as RawFranchise] : [])
  const msg = (rc && rc !== '00' && rc !== '0') || (rm && !/normal|정상|success/i.test(rm)) ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, count: arr.length, msg }
}

export interface FranchiseStats { last_run: string; found: number; saved: number; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_franchise_stats'
const CURSOR_KEY = 'ads_franchise_cursor'

export async function runFranchiseCollect(env: Env): Promise<FranchiseStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_FRANCHISE_ENDPOINT?: string }).ADS_FRANCHISE_ENDPOINT || FRANCHISE_BASE
  const op = (env as unknown as { ADS_FRANCHISE_OP?: string }).ADS_FRANCHISE_OP || FRANCHISE_OP
  const yr = (env as unknown as { ADS_FRANCHISE_YEAR?: string }).ADS_FRANCHISE_YEAR || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: FranchiseStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as FranchiseStats : null } catch { prev = null }
  const persist = async (s: FranchiseStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: FranchiseStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  const budget = { left: Math.max(3, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 10) }
  let found = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  for (let i = 0; i < budget.left + 3 && budget.left > 0; i++) {
    const { items, count, msg } = await fetchBrandPage(base, op, key, page, yr, budget)
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    if (!count) break
    const leads: CompanyLead[] = items.map(it => {
      const brand = g(it, 'brandNm', 'brand', 'brandName')
      const corp = g(it, 'corpNm', 'jnghdCorpNm', 'coNm')
      const induty = [g(it, 'indutyLclasNm', 'induty', 'idustyLclasNm'), g(it, 'indutyMlsfcNm', 'idustyMlsfcNm')].filter(Boolean).join('>')
      const rep = g(it, 'jnghdRprsntvNm', 'rprsntvNm', 'prsdntNm', 'rprsvNm', 'ceoNm')
      const prod = g(it, 'mnProductNm', 'prductNm', 'mnProduct')
      return {
        company_name: brand || corp, category: '창업생태계', subcategory: '프랜차이즈본사', tier: 5,
        region: null, address: null, phone: null, email: null, website: null,
        business_no: g(it, 'brno', 'bizrno', 'bzmnRegNo') || null,
        description: [corp && brand && corp !== brand ? `법인 ${corp}` : '', rep ? `대표 ${rep}` : '', induty, prod ? `상품 ${prod}` : ''].filter(Boolean).join(' · ') || null,
        contact_source: null, // 직접 연락처 없음 → 보강(네이버 홈페이지 검색→크롤)이 채움
        source: 'franchise', source_keyword: g(it, 'brandMngtNo', 'jnghdMngtNo', 'brandNm') || 'franchise',
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0) // 보류 → enrichHeldLeads 가 홈페이지 검색으로 연락처 채움
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  const error = found === 0 && lastMsg ? `API: ${lastMsg}` : undefined
  const s: FranchiseStats = { last_run: stamp, found, saved, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample } }
  await persist(s)
  return s
}
