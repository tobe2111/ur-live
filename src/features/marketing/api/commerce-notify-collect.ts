/**
 * 🛒 파트너 수집 — 통신판매사업자 (공정거래위원회, data.go.kr 1130000) — 2026-07-22.
 *   사업자가 통신판매업 신고 시 제출한 **상호·대표자·전화·전자우편(이메일)·주소**가 데이터에 직접 붙어 옴
 *   → 매칭 없이(오매칭·허위 위험 0) 연락처 확보. 온라인 겸업 업체(마케팅·쇼핑 관련) 발굴 + 이메일 소스.
 *   `ad_company_leads` 에 source='commerce' 로 저장(연락처 attached → active=1 직행).
 *
 *   게이트 `ADS_COMMERCE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`(동일 data.go.kr 계정).
 *   ⚠️ 엔드포인트/필드는 표준 기준(placeholder) — 활용가이드로 확정. 방어적 파싱 + diag.sample.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

const COMMERCE_BASE = 'https://apis.data.go.kr/1130000/MllBsInfoService02'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

interface RawCommerce {
  bzmnNm?: string; prmmiMnno?: string; rprsvNm?: string; telno?: string; email?: string; coEml?: string
  addr?: string; lctnAddr?: string; upteNm?: string; bizrno?: string; [k: string]: unknown
}

async function fetchCommercePage(base: string, key: string, page: number, budget: { left: number }): Promise<{ items: RawCommerce[]; count: number }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/getMllBsInfoDetail?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=100&resultType=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0 }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!data) return { items: [], count: 0 }
  const body = ((data.response as Record<string, unknown>)?.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawCommerce[] : []
  return { items: arr, count: arr.length }
}

export interface CommerceStats { last_run: string; found: number; saved: number; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_commerce_stats'
const CURSOR_KEY = 'ads_commerce_cursor'

export async function runCommerceCollect(env: Env): Promise<CommerceStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_COMMERCE_ENDPOINT?: string }).ADS_COMMERCE_ENDPOINT || COMMERCE_BASE
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: CommerceStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as CommerceStats : null } catch { prev = null }
  const persist = async (s: CommerceStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: CommerceStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  const budget = { left: Math.max(3, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 8) }
  let found = 0, saved = 0, sample: unknown
  for (let i = 0; i < budget.left + 3 && budget.left > 0; i++) {
    const { items, count } = await fetchCommercePage(base, key, page, budget)
    if (!sample && items[0]) sample = items[0]
    if (!count) break
    const leads: CompanyLead[] = items.map(it => {
      const addr = stripTag(it.addr || it.lctnAddr)
      return {
        company_name: stripTag(it.bzmnNm), category: '대행사', subcategory: stripTag(it.upteNm) || '통신판매', tier: 1,
        region: pickRegion(addr), address: addr || null,
        phone: stripTag(it.telno) || null, email: stripTag(it.email || it.coEml) || null,
        business_no: stripTag(it.bizrno) || null, description: stripTag(it.rprsvNm) ? `대표 ${stripTag(it.rprsvNm)}` : null,
        contact_source: 'commerce', // 통신판매 신고 등록본(전화·이메일이 데이터에 직접 붙어옴)
        source: 'commerce', source_keyword: stripTag(it.prmmiMnno) || 'commerce',
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  const s: CommerceStats = { last_run: stamp, found, saved, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, sample } }
  await persist(s)
  return s
}
