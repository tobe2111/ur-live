/**
 * 📑 파트너 수집 — 나라장터 조달업체(사용자정보 서비스) (data.go.kr 1230000/ao/UsrInfoService02) — 2026-07-27.
 *   나라장터에 입찰참가자격을 등록한 업체 = **검증된 사업자**(사업자번호·대표·주소·전화 등록). 그중
 *   광고·마케팅·홍보·디자인 계열만 키워드 필터해 `ad_company_leads` source='nara' 로 저장 —
 *   정부 용역을 수주하는 대행사 리드(tier 2). 이메일은 보강(웹 발견→크롤)이 담당.
 *
 *   ⚠️ 오퍼레이션명은 참고문서(docx) 기반 최적 추정 `getPrcrmntCorpBasicInfo` — 오류 시 화면에 API 메시지가
 *   그대로 떠서(진단) `ADS_NARA_VENDOR_OP` env 로 무배포 교정 가능(통신판매 때 검증된 패턴).
 *   게이트 `ADS_NARA_VENDOR_ENABLED`(일 1회 크론). 키 `PUBLIC_DATA_SERVICE_KEY`(승인 완료).
 *   ⚠️ 수집 ≠ 발송 — 공개 등록 정보만. SSOT: partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam } from './public-data-diag'

const NARA_VENDOR_BASE = 'https://apis.data.go.kr/1230000/ao/UsrInfoService02'
const NARA_VENDOR_OP = 'getPrcrmntCorpBasicInfo'
// 대행사/마케팅 계열 판별 — 업종명·업체명 어느 필드든 매칭(필드명 불확실 대비 전 값 스캔).
const AGENCY_RE = /광고|마케팅|홍보|커뮤니케이션|미디어|디자인|이벤트|프로모션|콘텐츠|브랜딩|퍼포먼스|기획|판촉|인쇄/ // 2026-07-27 종합기획사 포집(아인종합기획형)
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawV = Record<string, unknown>
const g = (it: RawV, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (v != null && String(v).trim()) return stripTag(v) } return '' }
const pickRegion = (addr: string): string | null => { const m = addr.match(/([가-힣]+?)(시|군|구)\s/); return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null }

async function fetchVendorPage(base: string, op: string, key: string, page: number, bgnDt: string, endDt: string): Promise<{ items: RawV[]; msg?: string }> {
  const url = `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=200&type=json&inqryDiv=1&inqryBgnDt=${bgnDt}&inqryEndDt=${endDt}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  // 🩺 실패 본문을 버리지 않는다 — data.go.kr 은 원인 코드를 본문에 담아 준다(public-data-diag SSOT).
  if (!res || !res.ok) return { items: [], msg: await describePublicDataFailure(res) }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawV[] : (items && typeof items === 'object' ? [items as RawV] : [])
  const msg = rc && rc !== '00' && rc !== '0' ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, msg }
}

export interface NaraVendorStats { last_run: string; page: number; scanned: number; matched: number; saved: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_naravendor_stats'
const CURSOR_KEY = 'ads_naravendor_cursor'

/** 조달업체 1틱(일 1회 크론 또는 수동). 최근 N일 등록/변경 구간을 페이지 커서 순환, 대행사 계열만 저장. */
export async function runNaraVendorCollect(env: Env, maxPages = 5): Promise<NaraVendorStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_NARA_VENDOR_ENDPOINT?: string }).ADS_NARA_VENDOR_ENDPOINT || NARA_VENDOR_BASE
  const op = (env as unknown as { ADS_NARA_VENDOR_OP?: string }).ADS_NARA_VENDOR_OP || NARA_VENDOR_OP
  const days = Math.max(7, parseInt((env as unknown as { ADS_NARA_VENDOR_DAYS?: string }).ADS_NARA_VENDOR_DAYS || '', 10) || 90)
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NaraVendorStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NaraVendorStats : null } catch { prev = null }
  const persist = async (s: NaraVendorStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: NaraVendorStats = { last_run: stamp, page: 0, scanned: 0, matched: 0, saved: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const p2 = (n: number) => String(n).padStart(2, '0')
  const ymdhm = (d: Date, hm: string) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${hm}`
  const bgnDt = ymdhm(new Date(now.getTime() - days * 86400000), '0000')
  const endDt = ymdhm(now, '2359')
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1

  let scanned = 0, matched = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  for (let i = 0; i < Math.max(1, maxPages); i++) {
    const { items, msg } = await fetchVendorPage(base, op, key, page, bgnDt, endDt)
    if (msg) lastMsg = msg
    if (!sample && items[0]) sample = items[0]
    if (!items.length) { page = 1; break } // 구간 소진 → 다음 실행에 처음부터(구간이 매일 굴러감)
    scanned += items.length
    const leads: CompanyLead[] = []
    for (const it of items) {
      // 대행사 계열 판별 — 전 필드 값 스캔(업종 필드명 불확실 대비). 미매칭은 저장 안 함(잡업종 유입 차단).
      const hay = Object.values(it).map(v => String(v ?? '')).join(' ')
      if (!AGENCY_RE.test(hay)) continue
      const name = g(it, 'corpNm', 'prcrmntCorpNm', 'bidprcCorpNm', 'entrpsNm', 'cmpnyNm', 'bzmnNm')
      if (name.length < 2) continue
      const addr = g(it, 'adrs', 'addr', 'corpAdrs', 'lctnAddr')
      matched++
      leads.push({
        company_name: name, category: '대행사', subcategory: '조달등록', tier: 2,
        region: pickRegion(addr), address: addr || null,
        phone: g(it, 'telNo', 'telno', 'cttpcNo', 'ofclTelno') || null, email: null, website: null,
        business_no: g(it, 'bizno', 'brno', 'bizRegNo', 'bzmnRegNo') || null,
        description: [g(it, 'ceoNm', 'rprsntvNm') && `대표 ${g(it, 'ceoNm', 'rprsntvNm')}`, '나라장터 등록업체'].filter(Boolean).join(' · ') || null,
        contact_source: g(it, 'telNo', 'telno', 'cttpcNo', 'ofclTelno') ? 'govreg' : null,
        source: 'nara', source_keyword: g(it, 'rgstDt', 'inqryDiv') || 'nara',
      })
    }
    saved += await saveCompanyLeads(DB, leads, { requireContact: true }).catch(() => 0)
    page++
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  // 404 = 경로/오퍼레이션명 문제(키 문제 아님). 오퍼레이션명은 애초에 문서 추정값이라 특히 의심 대상 —
  //   무엇을 고쳐야 하는지 화면에 박아둔다(2026-07-28: 8회 연속 `API: HTTP 404` 만 뜨고 방치됨).
  const hint = lastMsg === 'HTTP 404' ? ` — 경로/오퍼레이션명 불일치(현재 op 는 문서 추정값). 나라장터 사용자정보 서비스 스펙 확인 후 ADS_NARA_VENDOR_ENDPOINT/ADS_NARA_VENDOR_OP env 로 무배포 교정(현재: ${base}/${op})` : ''
  const error = saved === 0 && lastMsg ? `API: ${lastMsg}${hint}` : undefined
  const s: NaraVendorStats = { last_run: stamp, page, scanned, matched, saved, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample } }
  await persist(s)
  return s
}
