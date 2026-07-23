/**
 * 🏪 매장 후보 수집 — 지방행정 인허가정보 (공공데이터포털, localdata.go.kr 폐쇄 2026-04-16 후 이관) — 2026-07-22.
 *   신청 4업종(일반음식점·휴게음식점·미용업·숙박업)을 **전일 변동분(lastModTsBgn/End)만 일 1회** 수집 →
 *   `store_prospects` 복합키(opnSvcId+opnSfTeamCode+mgtNo) 멱등 upsert. 전국이 한 번에 오므로 지역은 응답
 *   자치단체코드/주소로 우리 쪽에서 필터. pageSize 최대 500 → 페이지네이션. (대표 스펙 2026-07-22)
 *
 *   ⚠️ 실구조(대표 활성화 화면 확인 2026-07-23): 인허가는 **단일 API 아님 — 업종별 REST 엔드포인트가 따로**다.
 *     일반음식점 → https://apis.data.go.kr/1741000/general_restaurants
 *     휴게음식점 → https://apis.data.go.kr/1741000/rest_cafes
 *     (미용업·숙박업은 활성화 후 슬러그 확정 시 LICENSE_UPJONG 또는 ADS_LOCALDATA_ENDPOINTS env 로 추가)
 *   응답 필드는 **localdata 표준 소문자**(bplcnm/sitetel/sitewhladdr/rdnwhladdr/trdstategbn/apvpermymd/lastmodts/
 *   opnsvcid/mgtno/opnsfteamcode/uptaenm/x/y). opnSvcId 는 쿼리 파라미터가 아니라 **응답 필드**에서 온다.
 *
 *   영업상태구분(trdstategbn): 01 영업/정상(active=1) 외 전부 보류(active=0) — 폐업·휴업·말소 자동 정리.
 *   → ⓐ 매장 발굴 ⓑ 신규 개업 감지(apvpermymd 최근) ⓒ 폐업 자동 정리.
 *
 *   게이트 `ADS_LOCALDATA_ENABLED`(cron 일1회). 키 `ADS_LOCALDATA_SERVICE_KEY || PUBLIC_DATA_SERVICE_KEY`.
 *   방어적 파싱(봉투 다형태 + 소문자/카멜 양대응) + stats.diag.sample(원응답 첫 항목)로 라이브 검증.
 *   설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { ensureProspectSchema, saveProspects, LICENSE_UPJONG, type StoreProspect } from './store-prospects'

// 지방행정 인허가 공통 베이스(업종별 슬러그를 append). ⚠️ 슬러그 맵은 LICENSE_UPJONG(store-prospects.ts) SSOT.
const LOCALDATA_BASE = 'https://apis.data.go.kr/1741000'
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()

function pickRegion(addr: string): string | null {
  const m = addr.match(/([가-힣]+?)(시|군|구)\s/)
  return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null
}
const ymd = (d: Date): string => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`

/** 인허가 원항목 — localdata 표준(소문자). 카멜/대문자 변종도 g() 폴백으로 흡수. */
type RawLicense = Record<string, unknown>

/** 첫 매칭 키의 값(태그 제거). 소문자 우선 + 카멜/구필드 폴백. */
function g(it: RawLicense, ...keys: string[]): string {
  for (const k of keys) { const v = it[k]; if (v != null && String(v).trim()) return stripTag(v) }
  return ''
}

/** 봉투 다형태 방어: localdata `{<svc>:{row:[…]}}` · data.go.kr `response.body.items.item` · `result.body.rows[0].row` · `data:[…]`. */
function extractRows(data: Record<string, unknown> | null): { rows: RawLicense[]; msg?: string } {
  if (!data || typeof data !== 'object') return { rows: [] }
  const asArr = (v: unknown): RawLicense[] => Array.isArray(v) ? v as RawLicense[] : (v && typeof v === 'object' ? [v as RawLicense] : [])
  // A) 최상위 row
  if (Array.isArray(data.row)) return { rows: data.row as RawLicense[] }
  // B) response.body.items.item (data.go.kr 표준 봉투)
  const resp = (data.response ?? data) as Record<string, unknown>
  const body = (resp.body ?? resp) as Record<string, unknown>
  const items = body?.items as Record<string, unknown> | unknown[] | undefined
  if (items) {
    const it = Array.isArray(items) ? items : (items as Record<string, unknown>).item ?? items
    const arr = asArr(it); if (arr.length) return { rows: arr }
  }
  if (body?.item) { const arr = asArr(body.item); if (arr.length) return { rows: arr } }
  // C) result.body.rows[0].row (localdata 클래식) — result.body.rows 또는 response.body.rows
  const classicRows = ((data.result as Record<string, unknown>)?.body as Record<string, unknown>)?.rows ?? (body as Record<string, unknown>)?.rows
  if (Array.isArray(classicRows) && classicRows[0] && typeof classicRows[0] === 'object' && Array.isArray((classicRows[0] as Record<string, unknown>).row)) {
    return { rows: (classicRows[0] as Record<string, unknown>).row as RawLicense[] }
  }
  // D) localdata REST: {<serviceName>:{head:[…],row:[…]}} — 최상위 아무 객체값의 row 배열
  let msg: string | undefined
  for (const v of Object.values(data)) {
    if (v && typeof v === 'object') {
      const rec = v as Record<string, unknown>
      if (Array.isArray(rec.row)) return { rows: rec.row as RawLicense[], msg }
      // head[].RESULT.MESSAGE 에러 메시지 회수(진단용)
      const head = rec.head
      if (Array.isArray(head)) for (const h of head) { const r = (h as Record<string, unknown>)?.RESULT as Record<string, unknown> | undefined; if (r?.MESSAGE) msg = String(r.MESSAGE) }
    }
  }
  // E) 평면 data 배열
  if (Array.isArray(data.data)) return { rows: data.data as RawLicense[], msg }
  return { rows: [], msg }
}

/** 인허가 1페이지(1업종 엔드포인트) 조회 → RawLicense[]. */
async function fetchLicensePage(base: string, endpoint: string, key: string, dayYmd: string, pageIndex: number): Promise<{ items: RawLicense[]; count: number; msg?: string }> {
  const url = `${base}/${endpoint}?serviceKey=${encodeURIComponent(key)}&pageIndex=${pageIndex}&pageSize=500&type=json&resultType=json&lastModTsBgn=${dayYmd}&lastModTsEnd=${dayYmd}`
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], count: 0 }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  const { rows, msg } = extractRows(data)
  return { items: rows, count: rows.length, msg }
}

export interface LocalDataStats { last_run: string; day: string; found: number; saved: number; new_open: number; closed: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown; endpoints?: string[] } }
const STATS_KEY = 'ads_localdata_stats'

/** env 병합 엔드포인트 맵: 코드 SSOT(LICENSE_UPJONG) + ADS_LOCALDATA_ENDPOINTS(JSON) — 무배포로 미용업·숙박업 추가. */
function resolveEndpoints(env: Env): Record<string, string> {
  const map: Record<string, string> = { ...LICENSE_UPJONG }
  const raw = (env as unknown as { ADS_LOCALDATA_ENDPOINTS?: string }).ADS_LOCALDATA_ENDPOINTS
  if (raw) { try { const extra = JSON.parse(raw) as Record<string, string>; if (extra && typeof extra === 'object') for (const [k, v] of Object.entries(extra)) if (k && v) map[k] = String(v) } catch { /* 무시 */ } }
  return map
}

/** 인허가 변동분 1틱(cron 일1회 또는 수동). 전일 변동분 × 업종별 엔드포인트 × 페이지네이션. */
export async function runLocalDataCollect(env: Env): Promise<LocalDataStats> {
  const DB = env.DB
  await ensureProspectSchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const todayYmd = ymd(now)
  const dayYmd = ymd(new Date(now.getTime() - 86400000)) // 전일 변동분
  const key = (env as unknown as { ADS_LOCALDATA_SERVICE_KEY?: string }).ADS_LOCALDATA_SERVICE_KEY || env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_LOCALDATA_ENDPOINT?: string }).ADS_LOCALDATA_ENDPOINT || LOCALDATA_BASE
  const endpoints = resolveEndpoints(env)

  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: LocalDataStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as LocalDataStats : null } catch { prev = null }
  const persist = async (s: LocalDataStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const base0 = (err?: string, sample?: unknown): LocalDataStats => ({ last_run: stamp, day: dayYmd, found: 0, saved: 0, new_open: 0, closed: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: !err, error: err, sample, endpoints: Object.keys(endpoints) } })

  if (!key) { const s = base0('NOT_CONFIGURED: ADS_LOCALDATA_SERVICE_KEY/PUBLIC_DATA_SERVICE_KEY 미설정'); await persist(s); return s }
  if (!Object.keys(endpoints).length) { const s = base0('NO_ENDPOINTS: 업종 엔드포인트 미설정'); await persist(s); return s }

  const MAX_PAGES = Math.max(1, parseInt((env as unknown as { ADS_LOCALDATA_MAX_PAGES?: string }).ADS_LOCALDATA_MAX_PAGES || '', 10) || 6)
  let found = 0, saved = 0, closed = 0
  let sample: unknown; let lastMsg: string | undefined
  for (const [endpoint, category] of Object.entries(endpoints)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { items, count, msg } = await fetchLicensePage(base, endpoint, key, dayYmd, page)
      if (msg) lastMsg = msg
      if (!sample && items[0]) sample = items[0]
      if (!count) break
      const rows: StoreProspect[] = items.map(it => {
        const road = g(it, 'rdnwhladdr', 'rdnWhlAddr', 'rdnWhladdr')
        const lot = g(it, 'sitewhladdr', 'siteWhlAddr', 'siteWhladdr')
        const trd = g(it, 'trdstategbn', 'trdStateGbn')
        if (trd && trd !== '01') closed++
        return {
          opn_svc_id: g(it, 'opnsvcid', 'opnSvcId') || endpoint,
          opn_sf_team_code: g(it, 'opnsfteamcode', 'opnSfTeamCode'),
          mgt_no: g(it, 'mgtno', 'mgtNo'),
          biz_name: g(it, 'bplcnm', 'bplcNm'),
          category,
          uptae: g(it, 'uptaenm', 'uptaeNm') || null,
          addr_road: road || null, addr_lot: lot || null,
          phone: g(it, 'sitetel', 'siteTel') || null,
          local_code: g(it, 'opnsfteamcode', 'opnSfTeamCode', 'localcode', 'localCode') || null,
          region: pickRegion(road || lot) || null,
          trd_state: trd || null, trd_state_nm: g(it, 'trdstatenm', 'trdStateNm') || null,
          apv_perm_ymd: g(it, 'apvpermymd', 'apvPermYmd').replace(/\D/g, '').slice(0, 8) || null,
          last_mod_ts: g(it, 'lastmodts', 'lastModTs') || null,
          lon: Number(g(it, 'x')) || null, lat: Number(g(it, 'y')) || null,
        }
      }).filter(r => r.opn_sf_team_code && r.mgt_no && r.biz_name)
      found += rows.length
      saved += await saveProspects(DB, rows, todayYmd).catch(() => 0)
      if (count < 500) break // 마지막 페이지
    }
  }
  // 신규 개업 집계(현재 DB 반영 상태).
  const no = await DB.prepare('SELECT COUNT(*) AS n FROM store_prospects WHERE is_new_open = 1').first<{ n: number }>().catch(() => null)
  const newOpen = Number(no?.n) || 0

  // 데이터 0건인데 API 메시지가 있으면 진단에 노출(키 오류/등록 대기 등).
  const err = found === 0 && lastMsg && !/정상|INFO-000/.test(lastMsg) ? `API: ${lastMsg}` : undefined
  const s: LocalDataStats = { last_run: stamp, day: dayYmd, found, saved, new_open: newOpen, closed, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error: err, sample, endpoints: Object.keys(endpoints) } }
  await persist(s)
  return s
}
