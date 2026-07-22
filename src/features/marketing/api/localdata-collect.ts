/**
 * 🏪 매장 후보 수집 — 지방행정 인허가정보 (공공데이터포털, localdata.go.kr 폐쇄 2026-04-16 후 이관) — 2026-07-22.
 *   신청 4업종(일반음식점·휴게음식점·미용업·숙박업)을 **전일 변동분(lastModTsBgn/End)만 일 1회** 수집 →
 *   `store_prospects` 복합키(opnSvcId+opnSfTeamCode+mgtNo) 멱등 upsert. 전국이 한 번에 오므로 지역은 응답
 *   자치단체코드/주소로 우리 쪽에서 필터. pageSize 최대 500 → 페이지네이션. (대표 스펙 2026-07-22)
 *
 *   영업상태구분(trdStateGbn): 01 영업중(active=1) / 02 휴업 / 03 폐업 / 04 취소·말소·만료·정지(active=0).
 *   → ⓐ 매장 발굴 ⓑ 신규 개업 감지(apvPermYmd 최근) ⓒ 폐업 자동 정리(4루프 '정리' 완성).
 *
 *   게이트 `ADS_LOCALDATA_ENABLED`(cron 일1회). 키 `ADS_LOCALDATA_SERVICE_KEY || PUBLIC_DATA_SERVICE_KEY`.
 *   ⚠️ 엔드포인트/파라미터/응답 필드명은 LOCALDATA 표준 기준 — 인허가 활용가이드로 최종 확정(placeholder 가능).
 *      방어적 파싱(봉투 2형태) + stats.diag.sample(원응답 첫 항목)로 라이브 검증.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { ensureProspectSchema, saveProspects, LICENSE_UPJONG, type StoreProspect } from './store-prospects'

// LOCALDATA 표준 오픈API 엔드포인트(이관 후 확정 대상). ⚠️ 활용가이드로 검증.
const LOCALDATA_BASE = 'https://apis.data.go.kr/1741000/StanardPrmsnBySelf'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

function pickRegion(addr: string): string | null {
  const m = addr.match(/([가-힣]+?)(시|군|구)\s/)
  return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null
}
const ymd = (d: Date): string => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`

/** 인허가 원항목(LOCALDATA 표준 필드 — 활용가이드로 확정). */
interface RawLicense {
  opnSvcId?: string; opnSfTeamCode?: string; mgtNo?: string; bplcNm?: string
  siteTel?: string; sitewhladdr?: string; rdnwhladdr?: string; x?: string; y?: string
  trdStateGbn?: string; trdStateNm?: string; apvPermYmd?: string; lastModTs?: string
  uptaeNm?: string; siteCode?: string; localCode?: string; [k: string]: unknown
}

/** 인허가 1페이지(1업종) 조회 → RawLicense[]. 봉투 2형태 방어. */
async function fetchLicensePage(base: string, key: string, opnSvcId: string, dayYmd: string, pageIndex: number): Promise<{ items: RawLicense[]; count: number }> {
  const url = `${base}?serviceKey=${encodeURIComponent(key)}&pageIndex=${pageIndex}&pageSize=500&resultType=json&opnSvcId=${encodeURIComponent(opnSvcId)}&lastModTsBgn=${dayYmd}&lastModTsEnd=${dayYmd}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0 }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!data) return { items: [], count: 0 }
  // 봉투 A: {result:{body:{rows:[{row:[...]}]}}} — LOCALDATA 클래식. 봉투 B: {data:[...], currentCount} — uddi.
  let items: unknown = []
  const result = (data.result ?? data) as Record<string, unknown>
  const body = (result.body ?? result) as Record<string, unknown>
  const rows = body?.rows as unknown
  if (Array.isArray(rows) && rows[0] && typeof rows[0] === 'object') items = (rows[0] as Record<string, unknown>).row ?? []
  else if (Array.isArray(data.data)) items = data.data
  else if (Array.isArray(rows)) items = rows
  const arr = Array.isArray(items) ? items as RawLicense[] : (items && typeof items === 'object' ? [items as RawLicense] : [])
  return { items: arr, count: arr.length }
}

export interface LocalDataStats { last_run: string; day: string; found: number; saved: number; new_open: number; closed: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_localdata_stats'

/** 인허가 변동분 1틱(cron 일1회 또는 수동). 전일 변동분 × 4업종 × 페이지네이션. */
export async function runLocalDataCollect(env: Env): Promise<LocalDataStats> {
  const DB = env.DB
  await ensureProspectSchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const todayYmd = ymd(now)
  const dayYmd = ymd(new Date(now.getTime() - 86400000)) // 전일 변동분
  const key = (env as unknown as { ADS_LOCALDATA_SERVICE_KEY?: string }).ADS_LOCALDATA_SERVICE_KEY || env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_LOCALDATA_ENDPOINT?: string }).ADS_LOCALDATA_ENDPOINT || LOCALDATA_BASE

  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: LocalDataStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as LocalDataStats : null } catch { prev = null }
  const persist = async (s: LocalDataStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const base0 = (err?: string, sample?: unknown): LocalDataStats => ({ last_run: stamp, day: dayYmd, found: 0, saved: 0, new_open: 0, closed: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: !err, error: err, sample } })

  if (!key) { const s = base0('NOT_CONFIGURED: ADS_LOCALDATA_SERVICE_KEY/PUBLIC_DATA_SERVICE_KEY 미설정'); await persist(s); return s }

  const MAX_PAGES = Math.max(1, parseInt((env as unknown as { ADS_LOCALDATA_MAX_PAGES?: string }).ADS_LOCALDATA_MAX_PAGES || '', 10) || 6)
  let found = 0, saved = 0, newOpen = 0, closed = 0
  let sample: unknown
  for (const opnSvcId of Object.keys(LICENSE_UPJONG)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { items, count } = await fetchLicensePage(base, key, opnSvcId, dayYmd, page)
      if (!sample && items[0]) sample = items[0]
      if (!count) break
      const rows: StoreProspect[] = items.map(it => {
        const road = stripTag(it.rdnwhladdr); const lot = stripTag(it.sitewhladdr)
        const trd = stripTag(it.trdStateGbn)
        if (trd === '03' || trd === '04') closed++
        return {
          opn_svc_id: stripTag(it.opnSvcId) || opnSvcId,
          opn_sf_team_code: stripTag(it.opnSfTeamCode),
          mgt_no: stripTag(it.mgtNo),
          biz_name: stripTag(it.bplcNm),
          category: LICENSE_UPJONG[opnSvcId] || null,
          uptae: stripTag(it.uptaeNm) || null,
          addr_road: road || null, addr_lot: lot || null,
          phone: stripTag(it.siteTel) || null,
          local_code: stripTag(it.localCode || it.siteCode) || null,
          region: pickRegion(road || lot) || null,
          trd_state: trd || null, trd_state_nm: stripTag(it.trdStateNm) || null,
          apv_perm_ymd: stripTag(it.apvPermYmd).replace(/\D/g, '').slice(0, 8) || null,
          last_mod_ts: stripTag(it.lastModTs) || null,
          lon: Number(it.x) || null, lat: Number(it.y) || null,
        }
      }).filter(r => r.opn_sf_team_code && r.mgt_no && r.biz_name)
      found += rows.length
      saved += await saveProspects(DB, rows, todayYmd).catch(() => 0)
      if (count < 500) break // 마지막 페이지
    }
  }
  // 신규 개업 집계(이번 수집 반영분).
  const no = await DB.prepare('SELECT COUNT(*) AS n FROM store_prospects WHERE is_new_open = 1').first<{ n: number }>().catch(() => null)
  newOpen = Number(no?.n) || 0

  const s: LocalDataStats = { last_run: stamp, day: dayYmd, found, saved, new_open: newOpen, closed, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, sample } }
  await persist(s)
  return s
}
