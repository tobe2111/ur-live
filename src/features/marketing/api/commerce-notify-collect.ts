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

// ✅ 두 서비스 모두 수집(사업자번호로 자동 병합, 대표 확인 2026-07-23):
//   ① 등록현황 MllBs_2Service/getMllBsInfo_2 = **전자우편(이메일) 포함** (이메일 핵심)
//   ② 등록상세 MllBsDtl_3Service/getMllBsInfoDetail_3 = 부가필드(운영상태/법인명 등)
//   각각 data.go.kr 활용신청 필요 — 미신청 서비스는 diag.error 로 표시되고 스킵(다른 서비스는 정상 수집).
//   ADS_COMMERCE_ENDPOINT/OP 는 ①(현황)을 override. pageNo/numOfRows(최대 10000) 페이지네이션.
const COMMERCE_SERVICES = [
  { name: 'status', label: '등록현황', base: 'https://apis.data.go.kr/1130000/MllBs_2Service', op: 'getMllBsInfo_2' },
  { name: 'detail', label: '등록상세', base: 'https://apis.data.go.kr/1130000/MllBsDtl_3Service', op: 'getMllBsInfoDetail_3' },
]

/** 통신판매 원항목 → CompanyLead. 필드명이 서비스/버전마다 달라 g() 다중별칭 + anyEmail/anyDomain 폴백. */
function mapCommerceLead(it: RawCommerce): CompanyLead {
  const addr = g(it, 'addr', 'lctnAddr', 'dtlLctnAddr', 'bizAddr', 'lctnRoadNmAddr', 'lctnRnAddr')
  const email = g(it, 'email', 'coEml', 'eml', 'emlAddr', 'coEmlAddr', 'rprsvEml', 'elctrnMailAdres') || anyEmail(it)
  const domain = anyDomain(it)
  return {
    company_name: g(it, 'bzmnNm', 'bsshNm', 'coNm', 'brmNm', 'entrNm', 'cmpnyNm'), category: '대행사', subcategory: g(it, 'upteNm', 'dclsfNm', 'idustyNm', 'taskNm') || '통신판매', tier: 1,
    region: pickRegion(addr), address: addr || null,
    phone: g(it, 'telno', 'telNo', 'cttpcNo', 'phone', 'telnoCn') || null,
    email: email || null,
    website: (email ? null : domain) ? (/^https?:\/\//i.test(domain) ? domain : `http://${domain}`) : null,
    business_no: g(it, 'bizrno', 'brno', 'bzmnRegNo') || null,
    description: g(it, 'rprsvNm', 'rprsntvNm', 'ceoNm') ? `대표 ${g(it, 'rprsvNm', 'rprsntvNm', 'ceoNm')}` : null,
    contact_source: 'commerce',
    source: 'commerce', source_keyword: g(it, 'prmmiMnno', 'mnno', 'dclrNo') || 'commerce',
  }
}
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

type RawCommerce = Record<string, unknown>
const EMAIL_RE = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i
const DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9.\-]+\.[a-z]{2,}(?:\/\S*)?$/i

/** 첫 매칭 키의 값(태그 제거). 표준 필드명이 API 버전마다 달라 다중 별칭. */
function g(it: RawCommerce, ...keys: string[]): string { for (const k of keys) { const v = it[k]; if (v != null && String(v).trim()) return stripTag(v) } return '' }
/** ⚠️ 필드명 불확실 대비 — **어떤 필드든 이메일 형태면** 회수(통신판매 신고본은 전자우편이 있음, 키 이름만 버전차). */
function anyEmail(it: RawCommerce): string { for (const v of Object.values(it)) { const s = stripTag(v); const m = s.match(EMAIL_RE); if (m && !/@(?:example|test|sample)\./i.test(m[0])) return m[0].toLowerCase() } return '' }
/** 인터넷도메인 필드(있으면 이메일 없을 때 크롤 관문). 이메일 형태는 제외. */
function anyDomain(it: RawCommerce): string { for (const [k, v] of Object.entries(it)) { if (!/dmn|domain|url|site|hmpg|hompage|homepage/i.test(k)) continue; const s = stripTag(v); if (s && !s.includes('@') && DOMAIN_RE.test(s)) return s } return '' }

async function fetchCommercePage(base: string, op: string, key: string, page: number, budget: { left: number }): Promise<{ items: RawCommerce[]; count: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0 }
  budget.left -= 1
  const url = `${base}/${op}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=500&type=json&_type=json&resultType=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0, msg: res ? `HTTP ${res.status}` : '네트워크 오류' }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' } // XML 오류(등록안됨 등) 그대로 노출
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawCommerce[] : (items && typeof items === 'object' ? [items as RawCommerce] : [])
  const msg = (rc && rc !== '00' && rc !== '0') || (rm && !/normal|정상|success/i.test(rm)) ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, count: arr.length, msg }
}

export interface CommerceStats { last_run: string; found: number; saved: number; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_commerce_stats'
const CURSOR_KEY = 'ads_commerce_cursor'

export async function runCommerceCollect(env: Env): Promise<CommerceStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: CommerceStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as CommerceStats : null } catch { prev = null }
  const persist = async (s: CommerceStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: CommerceStats = { last_run: stamp, found: 0, saved: 0, page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  // ①(현황)에 env override 적용. 두 서비스 각각 별도 커서 + 공유 예산.
  const services = COMMERCE_SERVICES.map((svc, idx) => idx === 0 ? {
    ...svc,
    base: (env as unknown as { ADS_COMMERCE_ENDPOINT?: string }).ADS_COMMERCE_ENDPOINT || svc.base,
    op: (env as unknown as { ADS_COMMERCE_OP?: string }).ADS_COMMERCE_OP || svc.op,
  } : svc)
  const totalBudget = Math.max(4, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 12)
  const budget = { left: totalBudget }
  const perService = Math.max(2, Math.floor(totalBudget / services.length))

  let found = 0, saved = 0, sample: unknown, sampleHasEmail = false, lastPage = 0
  const msgs: string[] = []
  for (const svc of services) {
    const ck = `${CURSOR_KEY}_${svc.name}`
    const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(ck).first<{ value: string }>().catch(() => null)
    let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
    for (let p = 0; p < perService && budget.left > 0; p++) {
      const { items, count, msg } = await fetchCommercePage(svc.base, svc.op, key, page, budget)
      if (msg) msgs.push(`${svc.label}: ${msg}`)
      if (items[0]) { const hasE = anyEmail(items[0]) !== ''; if (!sample || (hasE && !sampleHasEmail)) { sample = items[0]; sampleHasEmail = hasE } } // 이메일 든 샘플 우선(probe 정확도)
      if (!count) break
      const leads = items.map(mapCommerceLead).filter(l => l.company_name.length >= 2)
      found += leads.length
      saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
      page++
    }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(ck, String(page)).run().catch(() => null)
    lastPage = page
  }
  // 저장 0인데 API 메시지가 있으면 진단에 노출(활용신청 미승인/키오류/파라미터 등 원인 표시).
  const error = saved === 0 && msgs.length ? `API: ${msgs.join(' | ')}` : undefined
  const s: CommerceStats = { last_run: stamp, found, saved, page: lastPage, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample } }
  await persist(s)
  return s
}
