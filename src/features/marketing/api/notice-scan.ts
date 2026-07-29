/**
 * 📢 공고 스캐너 엔진 — 나라장터 입찰공고 + 기업마당 지원사업 (2026-07-22).
 *   "상권활성화·소상공인·마케팅·창업" 키워드로 전일~당일 공고를 스캔 → gov_notices.
 *   게이트 `ADS_NOTICE_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`.
 *   ⚠️ 엔드포인트/필드/오퍼레이션(업무구분)은 표준 기준(placeholder) — 활용가이드로 확정. 방어적 파싱 + diag.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { ensureNoticeSchema, saveNotices, type GovNotice } from './gov-notices'

// ✅ 실 엔드포인트(대표 활용신청 승인 화면 확인 2026-07-27): 조달청_나라장터 **공공데이터개방표준서비스**
//   /1230000/ao/PubDataOpnStdService — 입찰공고는 날짜구간 조회(getDataSetOpnStdBidPblancInfo) 후 키워드를
//   우리 쪽에서 필터(개방표준은 구간 조회가 표준 — 검색 파라미터 미보장). 이전 BidPublicInfoService 는 placeholder.
//   (같이 승인된 사용자정보서비스 UsrInfoService02 는 조달업체 명부 — 공고 스캔과 무관, 미배선.)
const NARA_BASE = 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService'
const BIZINFO_BASE = 'https://apis.data.go.kr/1421000/hpsBnaSituService'   // 기업마당(중기부) — 확정 대상
const KEYWORDS = ['상권활성화', '소상공인', '마케팅', '창업', '상권']
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
const g = (it: Record<string, unknown>, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (v != null && String(v).trim()) return stripTag(v) } return '' }

function pickArray(data: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!data) return []
  const body = ((data.response as Record<string, unknown>)?.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? data.data ?? (data as Record<string, unknown>).jsonArray ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  return Array.isArray(items) ? items as Record<string, unknown>[] : []
}

async function fetchJson(url: string, budget: { left: number }): Promise<Record<string, unknown> | null> {
  if (budget.left <= 0) return null
  budget.left -= 1
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return null
  return await res.json().catch(() => null) as Record<string, unknown> | null
}

export interface NoticeStats { last_run: string; found: number; saved: number; bid: number; grant: number; total_runs: number; diag: { configured: boolean; error?: string; sampleBid?: unknown; sampleGrant?: unknown } }
const STATS_KEY = 'ads_notice_stats'

export async function runNoticeScan(env: Env): Promise<NoticeStats> {
  const DB = env.DB
  await ensureNoticeSchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const naraBase = (env as unknown as { ADS_NARA_ENDPOINT?: string }).ADS_NARA_ENDPOINT || NARA_BASE
  const bizBase = (env as unknown as { ADS_BIZINFO_ENDPOINT?: string }).ADS_BIZINFO_ENDPOINT || BIZINFO_BASE
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NoticeStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NoticeStats : null } catch { prev = null }
  const persist = async (s: NoticeStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: NoticeStats = { last_run: stamp, found: 0, saved: 0, bid: 0, grant: 0, total_runs: (prev?.total_runs || 0) + 1, diag: { configured: false, error: 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정' } }; await persist(s); return s }

  const budget = { left: Math.max(6, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 20) }
  let bid = 0, grant = 0, sampleBid: unknown, sampleGrant: unknown
  const all: GovNotice[] = []

  // ── 나라장터 입찰(개방표준) — 최근 3일 구간 일괄 조회 후 키워드는 우리 쪽 필터(호출 1회로 전 키워드 커버) ──
  {
    const p2 = (n: number) => String(n).padStart(2, '0')
    const ymdhm = (d: Date, hm: string) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${hm}`
    const now = new Date()
    const bgn = ymdhm(new Date(now.getTime() - 3 * 86400000), '0000')
    const end = ymdhm(now, '2359')
    const url = `${naraBase}/getDataSetOpnStdBidPblancInfo?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=300&type=json&bidNtceBgnDt=${bgn}&bidNtceEndDt=${end}`
    const items = pickArray(await fetchJson(url, budget))
    if (!sampleBid && items[0]) sampleBid = items[0]
    for (const it of items) {
      const title = g(it, 'bidNtceNm', 'ntceNm')
      const kw = KEYWORDS.find(k => title.includes(k))
      if (!kw) continue // 상권/소상공인/마케팅 관련 공고만
      const no = g(it, 'bidNtceNo', 'ntceNo')
      if (!no) continue
      all.push({
        source: 'bid', notice_no: no, title, org: g(it, 'ntceInsttNm', 'dminsttNm') || null,
        biz_field: g(it, 'bsnsDivNm') || '입찰', url: g(it, 'bidNtceUrl', 'bidNtceDtlUrl') || null, amount: g(it, 'presmptPrce', 'asignBdgtAmt') || null,
        posted_date: g(it, 'bidNtceDt', 'bidNtceDate').slice(0, 10) || null, end_date: g(it, 'bidClseDt', 'bidClseDate', 'opengDt').slice(0, 10) || null, keyword: kw,
      })
      bid++
    }
  }
  // ── 기업마당 지원사업 — 키워드 검색 ──
  for (const kw of KEYWORDS) {
    if (budget.left <= 0) break
    const url = `${bizBase}/getSupportBusinessList?serviceKey=${encodeURIComponent(key)}&numOfRows=30&pageNo=1&resultType=json&searchCnst=${encodeURIComponent(kw)}`
    const items = pickArray(await fetchJson(url, budget))
    if (!sampleGrant && items[0]) sampleGrant = items[0]
    for (const it of items) {
      const no = stripTag(it.pblancId || it.pblancSn)
      if (!no) continue
      all.push({
        source: 'grant', notice_no: no, title: stripTag(it.pblancNm), org: stripTag(it.jrsdInsttNm || it.excInsttNm) || null,
        biz_field: stripTag(it.pldirSportRealmLclasCodeNm) || '지원사업', url: stripTag(it.pblancUrl || it.rceptEngnHmpgUrl) || null,
        posted_date: stripTag(it.creatPnttm).slice(0, 10) || null, end_date: stripTag(it.reqstEndDe).slice(0, 10) || null, keyword: kw,
      })
      grant++
    }
  }

  const saved = await saveNotices(DB, all).catch(() => 0)
  const s: NoticeStats = { last_run: stamp, found: all.length, saved, bid, grant, total_runs: (prev?.total_runs || 0) + 1, diag: { configured: true, sampleBid, sampleGrant } }
  await persist(s)
  return s
}
