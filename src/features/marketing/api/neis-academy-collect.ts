/**
 * 🎓 매장 후보 수집 — 나이스(NEIS) 학원·교습소 (open.neis.go.kr) — 2026-07-27.
 *   학원은 교육청 소관이라 지방행정 인허가(1741000)에 **없음** — 나이스 교육정보 개방포털이 유일한 전국 소스.
 *   17개 시도교육청 코드를 커서 순환하며 `acaInsttSc`(학원교습소정보)를 페이지 수집 → `store_prospects`
 *   (opn_svc_id='neis_academy', 복합키 = 교육청코드 + 학원지정번호) 멱등 upsert. 등록상태(개원/휴원/폐원) → active.
 *
 *   키: `NEIS_API_KEY`(나이스 개방포털 발급 — Cloudflare env 전용, 코드 노출 금지). 게이트 `ADS_NEIS_ENABLED`
 *   (매시간 소량 청크 — 전국 ~수십만 건을 며칠에 걸쳐 순회, 이후엔 갱신 순환). 수동 트리거는 게이트 무관.
 *   응답 필드는 NEIS 표준(ACA_NM/FA_RDNMA/REG_STTUS_NM…) — 방어적 별칭 + diag.sample 로 검증.
 *   ⚠️ 수집 ≠ 발송 — 공개 등록 정보만. 설계 SSOT: docs/design/partner-company-collection.md §12.
 */
import type { Env } from '@/worker/types/env'
import { envLaneBudget , envPlanValue} from './collect-budget'
import { ensureProspectSchema, saveProspects, type StoreProspect } from './store-prospects'
import { serviceKeyParam, isNoValue } from './public-data-diag'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

// 17개 시도교육청 코드(나이스 표준) — 커서가 이 순서로 순환.
const NEIS_OFFICES: Array<[string, string]> = [
  ['B10', '서울'], ['J10', '경기'], ['E10', '인천'], ['C10', '부산'], ['D10', '대구'], ['F10', '광주'],
  ['G10', '대전'], ['H10', '울산'], ['I10', '세종'], ['K10', '강원'], ['M10', '충북'], ['N10', '충남'],
  ['P10', '전북'], ['Q10', '전남'], ['R10', '경북'], ['S10', '경남'], ['T10', '제주'],
]
// ⚠️ 2026-07-28 수리: 서비스명이 `acaInsttSc` 였는데 NEIS 가 34회 연속 `ERROR-310 해당하는 서비스를
//   찾을 수 없습니다. 요청인자 중 SERVICE를 확인하십시오.` 로 거절 → 누적 저장 0. 학원교습소정보의 실제
//   서비스 식별자는 `acaInsTiInfo`(NEIS 개방포털 데이터셋 + 공개 래퍼 라이브러리 교차확인).
//   대소문자/표기가 또 흔들릴 경우를 대비해 `ADS_NEIS_SERVICE` 로 무배포 교정(franchise/nara 와 동일 패턴).
const NEIS_HUB = 'https://open.neis.go.kr/hub'
const NEIS_SERVICE_DEFAULT = 'acaInsTiInfo'
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
type RawAca = Record<string, unknown>
// ⚠️ 별칭 폴백은 `isNoValue` 를 통과해야 한다 — 포털이 '값 없음'을 `"N/A"` 문자열로 주는데 truthy 라
//   앞 별칭에서 걸리면 **뒤 별칭의 진짜 값을 건너뛴다**(통신판매에서 주소 31.7% 를 그렇게 잃었다).
const g = (it: RawAca, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }

/** NEIS 봉투: {<서비스명>:[{head:[…,{RESULT}]},{row:[…]}]} / 오류: {RESULT:{CODE,MESSAGE}}.
 *  ⚠️ 봉투 최상위 키 = **서비스명**이라 서비스명을 바꾸면 키도 같이 바뀐다. 예전엔 `acaInsttSc` 를
 *  하드코딩해서, 서비스명만 고치면 파서가 조용히 0행을 반환하는(오류도 없는) 함정이 있었다 →
 *  지정 서비스명 우선 + 없으면 `row` 배열을 품은 아무 최상위 값으로 폴백(서비스명 비의존). */
function parseNeis(data: Record<string, unknown> | null, service: string): { rows: RawAca[]; msg?: string } {
  if (!data) return { rows: [], msg: '비JSON 응답' }
  const top = (data.RESULT ?? null) as Record<string, unknown> | null
  if (top?.CODE && String(top.CODE) !== 'INFO-000') return { rows: [], msg: `${top.CODE} ${top.MESSAGE || ''}`.trim() }
  let svc = data[service] as unknown
  if (!Array.isArray(svc)) {
    svc = Object.values(data).find(v => Array.isArray(v) && v.some(p => p && typeof p === 'object' && Array.isArray((p as Record<string, unknown>).row))) ?? null
  }
  if (!Array.isArray(svc)) return { rows: [] }
  let rows: RawAca[] = []; let msg: string | undefined
  for (const part of svc) {
    const rec = part as Record<string, unknown>
    if (Array.isArray(rec?.row)) rows = rec.row as RawAca[]
    if (Array.isArray(rec?.head)) for (const h of rec.head) { const r = (h as Record<string, unknown>)?.RESULT as Record<string, unknown> | undefined; if (r?.CODE && String(r.CODE) !== 'INFO-000') msg = `${r.CODE} ${r.MESSAGE || ''}`.trim() }
  }
  return { rows, msg }
}

/** 등록상태명(개원/휴원/폐원…) → 인허가 trd_state 코드(01 영업 / 02 휴업 / 03 폐업)로 정규화. */
function regToTrd(nm: string): string {
  if (!nm || nm.includes('개원') || nm.includes('등록') || nm.includes('운영')) return '01'
  if (nm.includes('휴원') || nm.includes('휴업')) return '02'
  return '03' // 폐원/말소/취소
}

function toProspect(it: RawAca, officeName: string): StoreProspect {
  const road = [g(it, 'FA_RDNMA'), g(it, 'FA_RDNDA')].filter(Boolean).join(' ')
  const regNm = g(it, 'REG_STTUS_NM')
  const zone = g(it, 'ADMST_ZONE_NM') // 행정구역명(예: 강남구)
  return {
    opn_svc_id: 'neis_academy',
    opn_sf_team_code: g(it, 'ATPT_OFCDC_SC_CODE') || officeName,
    mgt_no: g(it, 'ACA_ASNUM', 'CAA_ASNUM'), // 학원지정번호(교육청 내 고유)
    biz_name: g(it, 'ACA_NM'),
    category: '학원',
    uptae: g(it, 'REALM_SC_NM', 'LE_CRSE_NM', 'ACA_INSTI_SC_NM') || null, // 분야(입시·외국어·예능…)
    addr_road: road || null, addr_lot: null,
    phone: g(it, 'FA_TELNO', 'TELNO', 'ACA_TELNO') || null, // ⚠️ 데이터셋에 전화 없으면 빈값 → 보강(카카오)이 담당
    local_code: g(it, 'ATPT_OFCDC_SC_CODE') || null,
    region: (zone.match(/([가-힣]+?)(시|군|구)$/)?.[1] || zone || officeName).slice(0, 20) || null,
    trd_state: regToTrd(regNm), trd_state_nm: regNm || null,
    apv_perm_ymd: g(it, 'REG_YMD', 'ESTBL_YMD').replace(/\D/g, '').slice(0, 8) || null,
    last_mod_ts: g(it, 'LOAD_DTM') || null,
    lon: null, lat: null,
  }
}

export interface NeisStats { last_run: string; office: string; page: number; found: number; saved: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_neis_stats'
const CURSOR_KEY = 'ads_neis_cursor' // 'officeIdx:page'

/** 학원·교습소 1틱(매시간 크론 소량 또는 수동). 교육청×페이지 커서 순환 — 소진 시 처음부터 재순환(갱신). */
export async function runNeisAcademyCollect(env: Env, maxPagesArg?: number): Promise<NeisStats> {
  // 🎚️ 회차당 일감도 **요금제를 따른다** — 예산만 커지고 이 숫자가 고정이면 늘어난 예산이 남는다.
  //   호출부가 명시로 넘기면 그 값이 이긴다(수동 트리거·테스트가 그렇게 쓴다).
  // 🩹 **6 → 3 되돌림**(2026-08-02 01:00 KST 실측) — 이 레인은 `Worker exceeded CPU time limit` 으로
  //   26.0초에 죽고 있었다. 6페이지로 올린 것이 07-29 인데 **그 뒤로 성공 기록이 없다**(올린 날 죽었고
  //   회복이 없었다). 무료에서 다시 올리려면 하트비트의 `ms` 를 먼저 볼 것 — 26,000 근처면 그게 천장이다.
  //   ⚠️ 유료(8)는 CPU 한도가 다른 세계라 별개 값이다. **무료 3 을 올리는 것과 혼동하지 말 것.**
  const maxPages = maxPagesArg ?? envPlanValue(undefined, 3, 8, env)
  const DB = adsLeadsDb(env)
  await ensureProspectSchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const todayYmd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  const key = (env as unknown as { NEIS_API_KEY?: string }).NEIS_API_KEY || ''
  const service = (env as unknown as { ADS_NEIS_SERVICE?: string }).ADS_NEIS_SERVICE || NEIS_SERVICE_DEFAULT
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NeisStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NeisStats : null } catch { prev = null }
  const persist = async (s: NeisStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  if (!key) { const s: NeisStats = { last_run: stamp, office: '', page: 0, found: 0, saved: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: NEIS_API_KEY 미설정(ur-ads env)' } }; await persist(s); return s }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let [oi, page] = (curRaw?.value || '0:1').split(':').map(n => parseInt(n, 10))
  if (!Number.isFinite(oi) || oi < 0) oi = 0
  if (!Number.isFinite(page) || page < 1) page = 1
  oi = oi % NEIS_OFFICES.length
  const [officeCode, officeName] = NEIS_OFFICES[oi]

  let found = 0, saved = 0, sample: unknown, lastMsg: string | undefined
  for (let i = 0; i < Math.max(1, maxPages); i++) {
    const url = `${NEIS_HUB}/${service}?KEY=${serviceKeyParam(key)}&Type=json&pIndex=${page}&pSize=1000&ATPT_OFCDC_SC_CODE=${officeCode}`
    // 실패 원인을 삼키지 않는다 — 원인 불명의 0건이 몇 주씩 방치되는 클래스(2026-07-28 전수점검).
    let res: Response | null = null
    let netMsg = '네트워크 오류'
    try { res = await fetch(url, { signal: AbortSignal.timeout(20000) }) } catch (err) {
      const m = err instanceof Error ? err.message : String(err || '')
      if (/too many subrequests/i.test(m)) netMsg = '⛔ 플랫폼 요청한도 도달 — 한 번에 조회할 페이지 수를 줄일 것'
      else if (m) netMsg = `네트워크 오류: ${m.slice(0, 80)}`
    }
    if (res && !res.ok) netMsg = `HTTP ${res.status}`
    const data = res && res.ok ? await res.json().catch(() => null) as Record<string, unknown> | null : null
    const { rows, msg } = parseNeis(data, service)
    if (msg) lastMsg = msg
    else if (!res || !res.ok) lastMsg = netMsg
    if (!sample && rows[0]) sample = rows[0]
    if (!rows.length) { oi = (oi + 1) % NEIS_OFFICES.length; page = 1; break } // 이 교육청 소진 → 다음 교육청
    const prospects = rows.map(it => toProspect(it, officeName)).filter(r => r.opn_sf_team_code && r.mgt_no && r.biz_name)
    found += prospects.length
    saved += await saveProspects(DB, prospects, todayYmd).catch(() => 0)
    page++
    if (rows.length < 1000) { oi = (oi + 1) % NEIS_OFFICES.length; page = 1; break } // 마지막 페이지
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, `${oi}:${page}`).run().catch(() => null)
  // INFO-200(데이터 없음)은 정상 소진 신호 — 오류 아님.
  const error = found === 0 && lastMsg && !/INFO-200/.test(lastMsg) ? `API: ${lastMsg}` : undefined
  const s: NeisStats = { last_run: stamp, office: `${officeName}(${officeCode})`, page, found, saved, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, error, sample } }
  await persist(s)
  return s
}
