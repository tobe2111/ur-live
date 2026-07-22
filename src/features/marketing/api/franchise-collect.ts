/**
 * 🏢 파트너 수집 — 공정위 가맹사업 정보공개서 (공정거래위원회, data.go.kr) — 2026-07-22.
 *   프랜차이즈 **본사** 정보(브랜드·법인·대표·전화·주소·가맹점수)를 발굴 → `ad_company_leads` source='franchise'.
 *   가맹점 확장 중인 본사 = 유어딜에 매장을 다수 데려올 수 있는 파트너. 연락처(대표전화) attached.
 *
 *   게이트 `ADS_FRANCHISE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`.
 *   ⚠️ 엔드포인트/필드는 표준 기준(placeholder) — 활용가이드로 확정. 방어적 파싱 + diag.sample.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

const FRANCHISE_BASE = 'https://apis.data.go.kr/1130000/FftcIffInfoService'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

interface RawFranchise {
  brandNm?: string; corpNm?: string; rprsntvNm?: string; telNo?: string; hpUrl?: string
  addr?: string; indutyNm?: string; frcsCnt?: string; [k: string]: unknown
}

async function fetchFranchisePage(base: string, key: string, page: number, budget: { left: number }): Promise<{ items: RawFranchise[]; count: number }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/getIffInfo?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=100&resultType=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0 }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!data) return { items: [], count: 0 }
  const body = ((data.response as Record<string, unknown>)?.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawFranchise[] : []
  return { items: arr, count: arr.length }
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
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: FranchiseStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as FranchiseStats : null } catch { prev = null }
  const persist = async (s: FranchiseStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: FranchiseStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  const budget = { left: Math.max(3, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 8) }
  let found = 0, saved = 0, sample: unknown
  for (let i = 0; i < budget.left + 3 && budget.left > 0; i++) {
    const { items, count } = await fetchFranchisePage(base, key, page, budget)
    if (!sample && items[0]) sample = items[0]
    if (!count) break
    const leads: CompanyLead[] = items.map(it => {
      const addr = stripTag(it.addr)
      const cnt = stripTag(it.frcsCnt)
      return {
        company_name: stripTag(it.brandNm || it.corpNm), category: '창업생태계', subcategory: '프랜차이즈본사', tier: 5,
        region: pickRegion(addr), address: addr || null, website: stripTag(it.hpUrl) || null,
        phone: stripTag(it.telNo) || null,
        description: [stripTag(it.indutyNm), cnt ? `가맹점 ${cnt}` : '', stripTag(it.rprsntvNm) ? `대표 ${stripTag(it.rprsntvNm)}` : ''].filter(Boolean).join(' · ') || null,
        source: 'franchise', source_keyword: stripTag(it.corpNm) || 'franchise',
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  const s: FranchiseStats = { last_run: stamp, found, saved, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, sample } }
  await persist(s)
  return s
}
