/**
 * 🏪 매장 후보 수집 — 지방행정 인허가정보 (공공데이터포털, localdata.go.kr 폐쇄 2026-04-16 후 이관) — 2026-07-22.
 *   신청 4업종(일반음식점·휴게음식점·미용업·숙박업)을 **전일 변동분(lastModTsBgn/End)만 일 1회** 수집 →
 *   `store_prospects` 복합키(opnSvcId+opnSfTeamCode+mgtNo) 멱등 upsert. 전국이 한 번에 오므로 지역은 응답
 *   자치단체코드/주소로 우리 쪽에서 필터. pageSize 최대 500 → 페이지네이션. (대표 스펙 2026-07-22)
 *
 *   ⚠️ 실구조(대표 활성화 화면 확인 2026-07-23): 인허가는 **단일 API 아님 — 업종별 REST 엔드포인트가 따로**다.
 *     일반음식점 → /1741000/general_restaurants · 휴게음식점 → /1741000/rest_cafes
 *     미용업 → /1741000/beauty_salons · 숙박업 → /1741000/tourist_accommodations · 동물미용업 → /1741000/pet_grooming
 *     (전 업종 승인 완료 — LICENSE_UPJONG SSOT 고정. 추가 업종은 ADS_LOCALDATA_ENDPOINTS env 로 무배포 병합)
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
import { ensureProspectSchema, saveProspects, LICENSE_UPJONG, PRIORITY_UPJONG, type StoreProspect } from './store-prospects'
import { describePublicDataFailure, serviceKeyParam, isNoValue } from './public-data-diag'
import { type FetchBudget } from './influencer-discovery'
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, isSubrequestLimitError, platformSubreqCap } from './collect-budget'
import {
  buildLicenseUrl, findVariant, probeLicenseVariants, redactServiceKey, resolveLicensePageSize,
  shouldProbe, type ProbeAttempt, type VariantState,
} from './license-url'

/**
 * 🧮 서브리퀘스트 예산 (2026-07-29 근본수리 — 이 레인이 `total_saved: 0` 이던 진짜 이유).
 *
 *   증상: 6회 실행 동안 **단 한 건도 저장하지 못했다**(라이브 실측). 진단에 남은 원인은
 *   `⛔ 플랫폼 요청한도 도달` — data.go.kr 한도가 아니라 **Cloudflare 인보케이션 서브리퀘스트 한도**다.
 *
 *   구조적 원인 둘:
 *   ① 이 레인이 cron 에서 `kick()`(SELF = 독립 인보케이션) 이 아니라 **인라인 `ctx.waitUntil`** 로 돌아
 *      같은 인보케이션의 다른 레인들과 예산을 다퉜다 — 정상 작동하는 레인(storeinfo·commerce·company)은
 *      전부 kick 경유였고, `total_saved: 0` 인 레인(localdata·nara)은 전부 인라인이었다.
 *   ② 예산 개념 자체가 없어 **16업종 × 최대 6페이지를 맹목 순회**했다(백필은 2일치라 최대 192 fetch).
 *      한도에 부딪히면 그 회차 수확이 통째로 버려지고, 다음 회차도 같은 지점에서 죽는다.
 *
 *   ⇒ ①은 worker-ads cron 에서 kick 전환, ②는 여기 — 다른 레인들이 이미 쓰는 관측 학습 상한
 *   (`collect-budget` SSOT)을 적용하고, **중단 지점을 커서로 남겨 다음 틱이 이어받는다**.
 *   ⚠️ D1 도 서브리퀘스트다(enrich-lane 이 같은 이유로 놓쳤던 것) — 같은 지갑에서 지불한다.
 */
const outOfBudget = (b: FetchBudget): boolean => b.left <= 0 || !!b.limitHit || (!!b.deadline && Date.now() >= b.deadline)
/** 미완 업종 이어받기 커서 — 예산이 끊긴 지점(day + 업종 인덱스)을 남겨 다음 틱이 그날을 마저 훑는다. */
const PENDING_KEY = 'ads_localdata_pending'
/** 백필의 업종 인덱스(현재 커서 날짜 내부) — 날짜가 넘어가면 0 으로 리셋. */
const BF_IDX_KEY = 'ads_localdata_backfill_idx'
const MAX_PENDING_DAYS = 14 // 미완 일자 적체 상한(그 이상은 백필 레인이 담당)
/** 프로브가 쓸 수 있는 최대 요청 수 — 이만큼 여유가 없으면 아예 시작하지 않는다(반쯤 하다 끊기면 판정 불가). */
const LICENSE_VARIANT_PROBE_COST = 6

interface PendingDay { day: string; idx: number }

/** 이 레인의 예산 산출(env × 관측 학습 상한) — 다른 레인 키와 절대 공유하지 않는다(collect-budget 주석 참조). */
async function resolveLocalDataBudget(env: Env): Promise<{ budget: FetchBudget; envBudget: number; learnedCap: number; total: number }> {
  const envBudget = Math.min(300, Math.max(20, parseInt((env as unknown as { ADS_LOCALDATA_BUDGET?: string }).ADS_LOCALDATA_BUDGET || '', 10) || 40))
  const learnedCap = Math.max(0, parseInt((await env.DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('localdata'))
    .first<{ value: string }>().catch(() => null))?.value || '', 10) || 0)
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP)
  const total = resolveSubreqBudget(envBudget, learnedCap, pcap)
  const deadlineMs = Math.min(120_000, Math.max(5_000, parseInt((env as unknown as { ADS_LOCALDATA_DEADLINE_MS?: string }).ADS_LOCALDATA_DEADLINE_MS || '', 10) || 20_000))
  return { budget: { left: total, limitHit: false, deadline: Date.now() + deadlineMs }, envBudget, learnedCap, total }
}

/**
 * 학습 상한 갱신 — 부딪혔으면 쓴 양보다 낮게, 무사히 끝났으면 조금 올린다(collect-budget SSOT).
 * ⚠️ 소비량은 **여기서** 시작값 기준으로 도출한다(호출자가 계산해 넘기면 백오프가 거꾸로 작동할 여지가 생긴다).
 */
async function persistLocalDataCap(env: Env, total: number, budget: FetchBudget, learnedCap: number, envBudget: number): Promise<void> {
  const nextCap = nextSubreqCap(total - budget.left, !!budget.limitHit, learnedCap, envBudget, platformSubreqCap(env.ADS_SUBREQ_PLATFORM_CAP))
  if (nextCap == null) return
  await env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(subreqCapKey('localdata'), String(nextCap)).run().catch(() => null)
}

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
  // ⚠️ '값 없음' 자리표시자("N/A" 등)는 값이 아니다 — 앞 별칭에서 걸리면 뒤 별칭의 진짜 값을 놓친다
  //   (통신판매 레인에서 실제로 31.7% 의 주소를 그렇게 잃고 있었다). 판정 SSOT 는 public-data-diag.
  for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) }
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

/** 인허가 1페이지 조회(URL 을 그대로 받는다 — 형태 후보 프로브와 같은 경로를 쓰기 위해). */
async function fetchLicenseUrl(url: string, budget?: FetchBudget): Promise<{ items: RawLicense[]; count: number; msg?: string }> {
  // ⚠️ 2026-07-28 수리: 예전엔 실패 시 `{items:[],count:0}` 만 반환해 **원인을 통째로 삼켰다** →
  //   stats 의 error 가 항상 undefined → 5회 실행 0건인데 화면상 "정상 0건"과 구분 불가(진단 실명).
  //   franchise-collect 가 이미 지키는 룰("실패 원인을 삼키지 않는다")을 이 레인에도 적용.
  let res: Response | null = null
  let netMsg = '네트워크 오류'
  if (budget) budget.left -= 1
  try { res = await fetch(url, { signal: AbortSignal.timeout(20000) }) } catch (err) {
    const m = err instanceof Error ? err.message : String(err || '')
    // 🩹 2026-07-29: 한도 판정을 `collect-budget` SSOT 로 위임 — 예전엔 `too many subrequests` 하나만 봐서
    //   Cloudflare 가 바인딩 소진에 던지는 "Too many API requests by single worker invocation" 을 놓쳤다
    //   (좁게 보면 *한도가 아닌 일반 오류*로 분류돼 학습 상한이 안 내려가고 매 실행 같은 지점에서 죽는다).
    if (isSubrequestLimitError(m)) {
      if (budget) budget.limitHit = true
      netMsg = '⛔ 인보케이션 요청한도 도달(업종×페이지 과다) — 남은 업종은 다음 틱이 이어받음'
    } else if (m) netMsg = `네트워크 오류: ${m.slice(0, 80)}`
  }
  // 🩺 실패 본문을 버리지 않는다 — data.go.kr 은 원인 코드를 본문에 담아 준다(public-data-diag SSOT).
  if (!res || !res.ok) return { items: [], count: 0, msg: await describePublicDataFailure(res, netMsg) }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  const { rows, msg } = extractRows(data)
  return { items: rows, count: rows.length, msg }
}

/**
 * 1업종 1페이지 — 활성 요청 형태(변종)로 URL 을 만들어 조회한다.
 * `size` 를 함께 돌려주는 이유: '마지막 페이지' 판정이 페이지 크기와 같아야 하는데, 크기가 이제
 * 변종/env 로 달라지기 때문이다(예전엔 500 하드코딩이라 크기를 바꾸는 순간 조용히 틀어졌다).
 */
async function fetchLicensePage(
  base: string, endpoint: string, key: string, dayYmd: string, pageIndex: number,
  variantId: string, sizeEnv: string | null | undefined, budget?: FetchBudget,
): Promise<{ items: RawLicense[]; count: number; msg?: string; size: number; url: string }> {
  const variant = findVariant(variantId)
  const size = resolveLicensePageSize(sizeEnv, variant)
  // 🔑 serviceKeyParam — 인코딩/디코딩 키 어느 쪽이 저장돼 있어도 이중 인코딩되지 않게(public-data-diag SSOT).
  const url = buildLicenseUrl({ base, endpoint, keyParam: serviceKeyParam(key), day: dayYmd, page: pageIndex, variant, size })
  const r = await fetchLicenseUrl(url, budget)
  return { ...r, size, url }
}

/** 원항목 → StoreProspect 매핑(SSOT — 일일 변동분·백필 공용). 소문자 우선 + 카멜 폴백. */
function toProspect(it: RawLicense, endpoint: string, category: string): StoreProspect {
  const road = g(it, 'rdnwhladdr', 'rdnWhlAddr', 'rdnWhladdr')
  const lot = g(it, 'sitewhladdr', 'siteWhlAddr', 'siteWhladdr')
  const trd = g(it, 'trdstategbn', 'trdStateGbn')
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
}

export interface LocalDataStats {
  last_run: string; day: string; found: number; saved: number; new_open: number; closed: number
  total_runs: number; total_saved: number
  /** 📏 예산 계측(2026-07-29) — 상태줄이 한도 근접을 숫자로 보게. 구 스냅샷 호환 위해 optional. */
  budget_total?: number; spent?: number; limit_hit?: boolean; pending_days?: number
  /** 📦 과거 백필 창(일). **0 = OFF** — 이 경우 유입은 '전일 변동분' 트리클뿐이다(2026-07-29). */
  backfill_days?: number
  diag: {
    configured: boolean; error?: string; sample?: unknown; endpoints?: string[]; backfill?: string
    /** 🔬 지금 쓰는 요청 형태(license-url SSOT) — "왜 이 URL 인가"의 답. */
    variant?: string
    /** 🩺 첫 실패의 **키를 가린** 실제 요청 — 500 처럼 본문이 원인을 안 알려줄 때 유일한 단서. */
    fail_probe?: { url: string; endpoint: string; day: string; page: number; msg?: string }
    /** 🔬 형태 후보 시도 이력(라이브 판정 근거). */
    probe?: { at: string; winner: string | null; attempts: ProbeAttempt[] }
  }
}
const STATS_KEY = 'ads_localdata_stats'
const BF_CURSOR_KEY = 'ads_localdata_backfill_ymd'
/** 활성 요청 형태 + 마지막 프로브 시각/이력(license-url `VariantState`). */
const VARIANT_KEY = 'ads_localdata_variant'

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
  // 🧾 스키마 DDL 비용도 예산에서 뺀다(2026-07-29) — 안 빼면 우리 계수(40)와 플랫폼 계수(49)가
  //   갈라져 그 차이만큼 조용히 죽는다. 이 레인이 total_saved:0 이던 잔여 원인.
  const schemaSpent = await ensureProspectSchema(DB)
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace('T', ' ')
  const todayYmd = ymd(now)
  const dayYmd = ymd(new Date(now.getTime() - 86400000)) // 전일 변동분
  const key = (env as unknown as { ADS_LOCALDATA_SERVICE_KEY?: string }).ADS_LOCALDATA_SERVICE_KEY || env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const base = (env as unknown as { ADS_LOCALDATA_ENDPOINT?: string }).ADS_LOCALDATA_ENDPOINT || LOCALDATA_BASE
  const endpoints = resolveEndpoints(env)

  // 🧾 세 키를 한 번에 읽는다(예전엔 각각 1 서브리퀘스트 = 3). D1 도 같은 지갑이라 이 절약이 곧 수집량이다.
  const settingRows = await DB.prepare('SELECT key, value FROM platform_settings WHERE key IN (?, ?, ?)')
    .bind(STATS_KEY, PENDING_KEY, VARIANT_KEY).all<{ key: string; value: string }>().catch(() => null)
  const setting = (k: string): string | null => (settingRows?.results || []).find(r => r.key === k)?.value ?? null
  let prev: LocalDataStats | null = null
  try { const v = setting(STATS_KEY); prev = v ? JSON.parse(v) as LocalDataStats : null } catch { prev = null }
  const persist = async (s: LocalDataStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const base0 = (err?: string, sample?: unknown): LocalDataStats => ({ last_run: stamp, day: dayYmd, found: 0, saved: 0, new_open: 0, closed: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: !err, error: err, sample, endpoints: Object.keys(endpoints) } })

  if (!key) { const s = base0('NOT_CONFIGURED: ADS_LOCALDATA_SERVICE_KEY/PUBLIC_DATA_SERVICE_KEY 미설정'); await persist(s); return s }
  if (!Object.keys(endpoints).length) { const s = base0('NO_ENDPOINTS: 업종 엔드포인트 미설정'); await persist(s); return s }

  const MAX_PAGES = Math.max(1, parseInt((env as unknown as { ADS_LOCALDATA_MAX_PAGES?: string }).ADS_LOCALDATA_MAX_PAGES || '', 10) || 6)
  const { budget, envBudget, learnedCap, total: budgetTotal } = await resolveLocalDataBudget(env)
  const spendD1 = () => { budget.left -= 1 } // D1 도 같은 지갑에서 지불(분모를 진실로)
  budget.left -= schemaSpent // 스키마 DDL 실비(위 주석)
  spendD1() // 위 설정 3키 일괄 조회(1회)
  let found = 0, saved = 0, closed = 0
  let sample: unknown; let lastMsg: string | undefined

  // 🔬 요청 형태(변종) — env 가 있으면 고정(프로브 금지), 없으면 DB 에 적힌 것, 그것도 없으면 현행 v1.
  //   env 고정은 "대표가 스펙을 확인했다" 는 뜻이므로 자동 탐색이 그 결정을 덮어쓰지 않는다.
  const envVariant = String((env as unknown as { ADS_LOCALDATA_VARIANT?: string }).ADS_LOCALDATA_VARIANT || '').trim()
  const sizeEnv = (env as unknown as { ADS_LOCALDATA_PAGE_SIZE?: string }).ADS_LOCALDATA_PAGE_SIZE || null
  let vState: VariantState | null = null
  try { const v = setting(VARIANT_KEY); vState = v ? JSON.parse(v) as VariantState : null } catch { vState = null }
  let variantId = findVariant(envVariant || vState?.id).id
  let probeInfo: { at: string; winner: string | null; attempts: ProbeAttempt[] } | undefined
  let failProbe: LocalDataStats['diag']['fail_probe']
  let probedThisRun = false

  // 📋 처리 대상 일자 = [미완으로 남겨둔 날들] + [이번 틱의 전일 변동분]. 앞에서부터 드레인하고,
  //   예산이 끊긴 지점(업종 인덱스)을 그대로 되남겨 다음 틱이 **같은 날의 남은 업종부터** 이어받는다.
  //   (이 커서가 없으면 예산이 짧은 날 뒤쪽 업종은 영영 미도달 — 전화 스윕이 `ORDER BY id ASC` 로
  //    tier1 에 영영 못 닿던 것과 같은 클래스의 버그.)
  let pending: PendingDay[] = []
  try { const p = JSON.parse(setting(PENDING_KEY) || '[]'); if (Array.isArray(p)) pending = p.filter(x => /^\d{8}$/.test(String(x?.day))).map(x => ({ day: String(x.day), idx: Math.max(0, Number(x.idx) || 0) })) } catch { pending = [] }
  const queue: PendingDay[] = [...pending]
  if (!queue.some(q => q.day === dayYmd)) queue.push({ day: dayYmd, idx: 0 })

  // 🎯 우선 업종 먼저(2026-07-29 대표 "음식점·카페·미용실·숙박에 힘을 써") — 예산이 끊겨도 이 넷은 훑고 끊긴다.
  //   ⚠️ 커서(`item.idx`)가 이 순서를 기준으로 저장되므로 정렬은 **매 실행 동일**해야 한다(안정 정렬).
  //   LICENSE_UPJONG 은 객체 리터럴이라 삽입 순서가 고정 → 같은 입력이면 같은 순서. env 병합분만 뒤로 간다.
  const eps = Object.entries(endpoints).sort((a, b) => {
    const rank = (cat: string) => (PRIORITY_UPJONG as readonly string[]).indexOf(cat)
    const ra = rank(a[1]), rb = rank(b[1])
    if (ra !== rb) return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb)
    return 0
  })
  const leftover: PendingDay[] = []
  for (let qi = 0; qi < queue.length; qi++) {
    const item = queue[qi]
    if (outOfBudget(budget)) { leftover.push(item); continue } // 예산 소진 — 손대지 않은 날은 그대로 보존
    let stoppedAt: number | null = null
    for (let ei = item.idx; ei < eps.length; ei++) {
      if (outOfBudget(budget)) { stoppedAt = ei; break }
      const [endpoint, category] = eps[ei]
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (outOfBudget(budget)) { stoppedAt = ei; break } // 이 업종은 아직 안 끝났다 → 다음 틱이 이 업종부터
        const { items, count, msg, size, url } = await fetchLicensePage(base, endpoint, key, item.day, page, variantId, sizeEnv, budget)
        if (msg) lastMsg = msg
        // ⚠️ 한도로 **이 요청이 실패**했으면 이 업종은 '완료'가 아니다. `!count` 로 빠져나가면 정상 0건과
        //   구분이 안 돼 다음 틱이 이 업종을 건너뛴다 = 그 업종 데이터 영구 누락(유닛테스트가 잡은 실버그).
        if (budget.limitHit) { stoppedAt = ei; break }
        if (!sample && items[0]) sample = items[0]
        // 🩺 첫 실패의 실제 요청을 **키를 가려** 남긴다 — 500 은 본문에 원인 코드가 없어, 이게 없으면
        //   "무엇을 보냈길래 500 인가"를 이 환경(외부 CONNECT 차단)에서 판정할 방법이 아예 없다.
        if (msg && !failProbe) failProbe = { url: redactServiceKey(url), endpoint, day: item.day, page, msg: msg.slice(0, 200) }
        // 🔬 형태 후보 프로브 — 1페이지가 실패했고, env 고정이 아니고, 쿨다운이 지났고, 예산이 남았을 때만.
        //   추측으로 URL 을 바꾸는 대신 **라이브가 고르게** 한다. 승자가 나오면 그 자리에서 재시도.
        if (msg && page === 1 && !count && !probedThisRun && !envVariant && shouldProbe(vState, Date.now()) && budget.left > LICENSE_VARIANT_PROBE_COST) {
          probedThisRun = true
          const pr = await probeLicenseVariants({
            base, endpoint, keyParam: serviceKeyParam(key), day: item.day, sizeOverride: sizeEnv, skip: [variantId],
            canSpend: () => !outOfBudget(budget),
            fetchPage: async (u) => { const r = await fetchLicenseUrl(u, budget); return { ok: !r.msg, rows: r.count, msg: r.msg } },
          })
          probeInfo = { at: stamp, winner: pr.winner, attempts: pr.attempts }
          vState = { id: pr.winner || variantId, probed_at: Date.now(), attempts: pr.attempts }
          spendD1()
          await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(VARIANT_KEY, JSON.stringify(vState)).run().catch(() => null)
          if (pr.winner && pr.winner !== variantId) { variantId = pr.winner; page--; continue } // 승자로 이 페이지 재시도
        }
        if (!count) break
        const rows: StoreProspect[] = items.map(it => toProspect(it, endpoint, category)).filter(r => r.opn_sf_team_code && r.mgt_no && r.biz_name)
        for (const r of rows) if (r.trd_state && r.trd_state !== '01') closed++
        found += rows.length
        spendD1()
        saved += await saveProspects(DB, rows, todayYmd).catch(() => 0)
        if (count < size) break // 마지막 페이지(⚠️ 페이지 크기는 변종/env 로 달라진다 — 상수 비교 금지)
      }
      if (stoppedAt != null) break
    }
    if (stoppedAt != null) leftover.push({ day: item.day, idx: stoppedAt })
  }
  // 미완 일자 영속 — 오래된 것부터 최대 MAX_PENDING_DAYS 일(그 이상 밀리면 백필 레인이 담당하므로 버린다).
  const nextPending = leftover.slice(-MAX_PENDING_DAYS)
  spendD1()
  if (nextPending.length) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(PENDING_KEY, JSON.stringify(nextPending)).run().catch(() => null)
  } else if (pending.length) {
    await DB.prepare('DELETE FROM platform_settings WHERE key = ?').bind(PENDING_KEY).run().catch(() => null)
  }
  await persistLocalDataCap(env, budgetTotal, budget, learnedCap, envBudget)

  // 신규 개업 집계(현재 DB 반영 상태).
  const no = await DB.prepare('SELECT COUNT(*) AS n FROM store_prospects WHERE is_new_open = 1').first<{ n: number }>().catch(() => null)
  const newOpen = Number(no?.n) || 0

  // 데이터 0건인데 API 메시지가 있으면 진단에 노출(키 오류/등록 대기 등).
  const err = found === 0 && lastMsg && !/정상|INFO-000/.test(lastMsg) ? `API: ${lastMsg}` : undefined
  const s: LocalDataStats = {
    last_run: stamp, day: dayYmd, found, saved, new_open: newOpen, closed,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    // 📏 예산 계측 — 한도에 닿기 **전에** 보이게(시트 미러가 `ok:true` 인 채 34시간 멈춰 있던 교훈).
    budget_total: budgetTotal, spent: budgetTotal - budget.left, limit_hit: !!budget.limitHit,
    pending_days: nextPending.length,
    // 📦 백필 상태(2026-07-29) — 기본이 **0=OFF** 라, 이게 꺼져 있으면 매장 DB 의 유일한 유입이
    //   '전일 변동분'(하루 수백 건 트리클)뿐이다. 전국 음식점을 쌓으려면 백필이 켜져야 하는데
    //   화면에 그 사실이 안 보여 "왜 안 쌓이지"가 판정 불가였다. 숫자를 그대로 노출한다.
    backfill_days: Math.max(0, parseInt((env as unknown as { ADS_LOCALDATA_BACKFILL_DAYS?: string }).ADS_LOCALDATA_BACKFILL_DAYS || '0', 10) || 0),
    diag: {
      configured: true, error: err, sample, endpoints: Object.keys(endpoints),
      // 🔬 "무엇을 어떻게 보내고 있고, 무엇이 실패했는가" — 추측 없이 판정하기 위한 최소 증거 3종.
      variant: variantId, fail_probe: failProbe, probe: probeInfo,
    },
  }
  await persist(s)
  return s
}

/**
 * 📦 과거 인허가 **백필**(수집 수량 확대) — 전일 변동분만으로는 DB 가 느리게 쌓임 →
 *   `ADS_LOCALDATA_BACKFILL_DAYS`(기본 0=OFF, 예: 180)일만큼 과거로 **하루씩 역방향** 소급 수집.
 *   시간당 1청크(maxDaysPerRun일)씩 진행(ur-ads 매시간 크론 + 수동 수집 버튼에 부착) — 커서 영속이라 중단/재개 안전.
 *   변동일 기준 조회라 과거로 갈수록 그날 변동된 매장이 계속 나옴 → 전국 매장이 점진 축적. 멱등 upsert 라 중복 0.
 */
export async function runLocalDataBackfill(env: Env, maxDaysPerRun = 2): Promise<{ enabled: boolean; done: boolean; days: string[]; found: number; saved: number; spent?: number; limit_hit?: boolean; endpoint_idx?: number }> {
  const DB = env.DB
  const windowDays = Math.max(0, parseInt((env as unknown as { ADS_LOCALDATA_BACKFILL_DAYS?: string }).ADS_LOCALDATA_BACKFILL_DAYS || '0', 10) || 0)
  if (!windowDays) return { enabled: false, done: true, days: [], found: 0, saved: 0 }
  const schemaSpent = await ensureProspectSchema(DB) // 스키마 DDL 실비(아래 예산에서 차감)
  const key = (env as unknown as { ADS_LOCALDATA_SERVICE_KEY?: string }).ADS_LOCALDATA_SERVICE_KEY || env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  if (!key) return { enabled: true, done: false, days: [], found: 0, saved: 0 }
  const base = (env as unknown as { ADS_LOCALDATA_ENDPOINT?: string }).ADS_LOCALDATA_ENDPOINT || LOCALDATA_BASE
  const endpoints = resolveEndpoints(env)
  const now = new Date()
  const todayYmd = ymd(now)
  const floorYmd = ymd(new Date(now.getTime() - windowDays * 86400000))
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(BF_CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cur = String(curRaw?.value || '').replace(/\D/g, '').slice(0, 8)
  if (cur.length !== 8) cur = ymd(new Date(now.getTime() - 2 * 86400000)) // 전일은 일일 틱 담당 → 그 전날부터 역방향
  const MAX_PAGES = Math.max(1, parseInt((env as unknown as { ADS_LOCALDATA_MAX_PAGES?: string }).ADS_LOCALDATA_MAX_PAGES || '', 10) || 6)
  // 🧮 2026-07-29: 이 레인이 가장 폭발적이었다 — maxDaysPerRun(2) × 16업종 × 6페이지 = **최대 192 fetch** 를
  //   매시간 인라인으로 쏟아부어, 같은 인보케이션의 다른 작업(시트 미러 등)까지 굶겼다. 예산 + 업종 커서로 제한.
  const { budget, envBudget, learnedCap, total: budgetTotal } = await resolveLocalDataBudget(env)
  budget.left -= schemaSpent // 스키마 DDL 실비(위 주석) — 안 빼면 이 레인도 조용히 천장을 넘는다
  const spendD1 = () => { budget.left -= 1 }
  spendD1() // 위 커서 조회
  const idxRaw = await DB.prepare('SELECT key, value FROM platform_settings WHERE key IN (?, ?)').bind(BF_IDX_KEY, VARIANT_KEY)
    .all<{ key: string; value: string }>().catch(() => null)
  spendD1()
  const bfSetting = (k: string): string | null => (idxRaw?.results || []).find(r => r.key === k)?.value ?? null
  let startIdx = Math.max(0, parseInt(String(bfSetting(BF_IDX_KEY) || ''), 10) || 0)
  // 🔬 백필도 **일일 레인이 라이브에서 확인한 요청 형태**를 그대로 쓴다(형태가 갈리면 한쪽만 조용히 0건).
  //   프로브는 여기서 돌리지 않는다 — 판정은 한 곳(일일 레인)에서만 하고 결과를 공유한다.
  let bfVariant = String((env as unknown as { ADS_LOCALDATA_VARIANT?: string }).ADS_LOCALDATA_VARIANT || '').trim()
  if (!bfVariant) { try { bfVariant = (JSON.parse(bfSetting(VARIANT_KEY) || '{}') as VariantState)?.id || '' } catch { bfVariant = '' } }
  const bfSizeEnv = (env as unknown as { ADS_LOCALDATA_PAGE_SIZE?: string }).ADS_LOCALDATA_PAGE_SIZE || null
  const eps = Object.entries(endpoints)
  let found = 0, saved = 0
  const days: string[] = []
  for (let i = 0; i < maxDaysPerRun && cur >= floorYmd; i++) {
    if (outOfBudget(budget)) break
    days.push(cur)
    let stoppedAt: number | null = null
    for (let ei = startIdx; ei < eps.length; ei++) {
      if (outOfBudget(budget)) { stoppedAt = ei; break }
      const [endpoint, category] = eps[ei]
      for (let page = 1; page <= MAX_PAGES; page++) {
        if (outOfBudget(budget)) { stoppedAt = ei; break }
        const { items, count, size } = await fetchLicensePage(base, endpoint, key, cur, page, bfVariant, bfSizeEnv, budget)
        if (budget.limitHit) { stoppedAt = ei; break } // 한도로 실패한 업종은 완료가 아니다(위 일일 레인과 동일)
        if (!count) break
        const rows = items.map(it => toProspect(it, endpoint, category)).filter(r => r.opn_sf_team_code && r.mgt_no && r.biz_name)
        found += rows.length
        spendD1()
        saved += await saveProspects(DB, rows, todayYmd).catch(() => 0)
        if (count < size) break
      }
      if (stoppedAt != null) break
    }
    // ⚠️ 날짜 커서는 **그날을 다 훑었을 때만** 넘긴다 — 예산으로 중간에 끊겼는데 넘기면 그날 뒤쪽 업종이
    //   영구 누락된다(멱등 upsert 라 이어받기 재조회는 안전).
    if (stoppedAt != null) {
      startIdx = stoppedAt
      spendD1()
      await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(BF_IDX_KEY, String(stoppedAt)).run().catch(() => null)
      break
    }
    startIdx = 0
    const d = new Date(Date.UTC(+cur.slice(0, 4), +cur.slice(4, 6) - 1, +cur.slice(6, 8)) - 86400000)
    cur = ymd(d)
    spendD1()
    await DB.batch([
      DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(BF_CURSOR_KEY, cur),
      DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(BF_IDX_KEY, '0'),
    ]).catch(() => null)
  }
  await persistLocalDataCap(env, budgetTotal, budget, learnedCap, envBudget)
  return { enabled: true, done: cur < floorYmd, days, found, saved, spent: budgetTotal - budget.left, limit_hit: !!budget.limitHit, endpoint_idx: startIdx }
}
