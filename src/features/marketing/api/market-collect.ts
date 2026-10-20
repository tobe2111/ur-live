/**
 * 🏪 **상권 축 수집 — 전국전통시장표준데이터** (2026-08-03 대표 지시 *"상인회·상권 DB"*).
 *
 * ## 왜 이 소스가 중심축인가
 * 대표가 준 네 소스(전통시장 표준데이터 · 소상공인 상가정보 · 지자체 고시 · 보조금/낙찰) 중
 * **연락처가 붙어 오는 건 이것 하나뿐**이다. 유어애즈의 지표는 총 인원이 아니라
 * *"제안 보낼 수 있는 리드 수"* 이므로(CLAUDE.md), 나머지 셋은 **이 위에 딱지를 붙이는 용도**다.
 *
 * 실측 응답(2026-08-03 라이브):
 * ```json
 *   {"mrktNm":"사기막골도자기시장","mrktType":"상설장","phoneNumber":"031-638-8388",
 *    "homepageUrl":"www.sagimakgol.com","storNumber":"62","rdnmadr":"경기도 이천시 …",
 *    "latitude":"37.29483104","longitude":"127.4119796","trtmntPrdlst":"의류+…"}
 *   totalCount: 1393
 * ```
 * 전화·홈페이지·점포수·**좌표**까지 온다 — 좌표가 있어 소상공인 상가정보 반경조회로 바로 조인된다.
 *
 * ## ⚠️ 이 게이트웨이는 모르는 파라미터를 **거부**한다
 * `apis.data.go.kr`(기관별 서비스)는 모르는 파라미터를 조용히 무시하지만, 표준데이터
 * (`api.data.go.kr` — **'s' 가 없다**)는 거부한다. 라이브가 그렇게 말해 줬다:
 * ```
 *   {"resultCode":"10","resultMsg":"INVALID_REQUEST_PARAMETER_ERROR (pageIndex)"}
 * ```
 * ⇒ **`serviceKey`/`pageNo`/`numOfRows`/`type` 넷만** 보낸다. `pageIndex`·`pageSize`·`resultType`·
 *   `_type` 을 "혹시 몰라" 얹으면 **인증까지 통과한 요청이 죽는다.**
 *
 * ## 📌 원부가 작다 — 하루 1회면 충분
 * 1,393건이라 `numOfRows=500` 이면 **3요청에 전량**이다. 표준데이터는 개발계정 월 1,000요청이라
 * 매시간 돌리면 낭비이고(정적에 가까운 원부), 하루 1회로 충분하다.
 *
 * 게이트 `ADS_MARKET_ENABLED`. 키 `PUBLIC_DATA_SERVICE_KEY`(활용신청: 데이터셋 15012894).
 * 엔드포인트는 `ADS_MARKET_ENDPOINT`/`ADS_MARKET_OP` 로 무배포 교체 가능.
 */
import type { Env } from '@/worker/types/env'
import { saveCompanyLeadsCounted, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam, laneShouldSkip, updateLaneHealth, laneHealthNote, type LaneHealth, isNoValue } from './public-data-diag'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

/** 표준데이터 게이트웨이 — `apis.` 가 아니라 `api.` 다(글자 하나 차이의 **별개 호스트**). */
export const MARKET_BASE = 'https://api.data.go.kr/openapi'
export const MARKET_OP = 'tn_pubr_public_trdit_mrkt_api'

/** 카테고리 축 — `company-classify` 에 이미 있는 `지역조직/상인회`(tier 3)를 **그대로** 쓴다(새로 만들지 않는다). */
export const MARKET_CATEGORY = '지역조직'
export const MARKET_SUBCATEGORY = '상인회'
export const MARKET_TIER = 3

type RawMarket = Record<string, unknown>
const stripTag = (s: unknown): string => String(s ?? '').replace(/<[^>]+>/g, '').trim()
/** 첫 유효값. ⚠️ `isNoValue` 통과 필수 — 포털이 '값 없음'을 `"N/A"` 로 주는데 truthy 라 앞 별칭이 진짜 값을 가린다. */
const g = (it: RawMarket, ...keys: string[]): string => { for (const k of keys) { const v = it[k]; if (!isNoValue(v)) return stripTag(v) } return '' }

/**
 * 홈페이지 정규화 — 원부가 스킴 없이 `www.sagimakgol.com` 으로 주는 경우가 있다(실측).
 * 그대로 저장하면 링크가 상대경로로 깨지고, 나중에 크롤러도 못 연다.
 */
export function normalizeMarketSite(raw: string): string | null {
  const t = String(raw || '').trim()
  if (!t || t.length < 4) return null
  if (/^https?:\/\//i.test(t)) return t
  if (!/^[\w.-]+\.[a-z]{2,}/i.test(t)) return null // 도메인 꼴이 아니면 버린다(추측 금지)
  return `https://${t}`
}

/** 주소에서 시/군/구를 뽑는다(파트너 풀 `region` 규약과 동일 — 접미사 제거). */
export function pickMarketRegion(addr: string): string | null {
  const m = String(addr || '').match(/([가-힣]+?)(시|군|구)\s/)
  return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null
}

/** 원항목 → 파트너 리드. 필드명은 **라이브 응답 실측**(추측 아님). */
export function toMarketLead(it: RawMarket): CompanyLead | null {
  const name = g(it, 'mrktNm', 'mrktName')
  if (name.length < 2) return null
  const road = g(it, 'rdnmadr')
  const lot = g(it, 'lnmadr')
  const stores = g(it, 'storNumber')
  const type = g(it, 'mrktType')
  const goods = g(it, 'trtmntPrdlst')
  return {
    company_name: name,
    category: MARKET_CATEGORY, subcategory: MARKET_SUBCATEGORY, tier: MARKET_TIER,
    region: pickMarketRegion(road || lot),
    address: road || lot || null,
    phone: g(it, 'phoneNumber') || null,
    email: null,
    website: normalizeMarketSite(g(it, 'homepageUrl')),
    business_no: null,
    // 규모·업종 구성은 우선순위 판단의 재료다(점포 수가 큰 시장부터 접촉).
    description: [type, stores ? `점포 ${stores}개` : '', goods].filter(Boolean).join(' · ') || null,
    contact_source: g(it, 'phoneNumber') ? 'govreg' : null, // 공시된 것만 — 추측 생성 안 한다
    source: 'market', source_keyword: type || 'market',
  }
}

/** 1페이지 조회. 봉투는 `response.body.items.item` 표준형. */
async function fetchMarketPage(base: string, op: string, key: string, page: number, rows: number, budget: { left: number }): Promise<{ items: RawMarket[]; count: number; total: number; msg?: string }> {
  if (budget.left <= 0) return { items: [], count: 0, total: 0 }
  budget.left -= 1
  // ⚠️ 파라미터 넷 고정 — 위 헤더 주석 참조(더 얹으면 INVALID_REQUEST_PARAMETER_ERROR).
  const url = `${base}/${op}?serviceKey=${serviceKeyParam(key)}&pageNo=${page}&numOfRows=${rows}&type=json`
  let res: Response | null = null
  let netMsg = '네트워크 오류'
  try { res = await fetch(url, { signal: AbortSignal.timeout(15000) }) } catch (err) {
    const m = err instanceof Error ? err.message : String(err || '')
    if (/too many subrequests/i.test(m)) netMsg = '⛔ 플랫폼 요청한도 도달 — 페이지 수를 줄여 나눠 수집'
  }
  if (!res || !res.ok) return { items: [], count: 0, total: 0, msg: await describePublicDataFailure(res, netMsg) }
  const raw = await res.text().catch(() => '')
  let data: Record<string, unknown> | null = null
  try { data = JSON.parse(raw) as Record<string, unknown> } catch { data = null }
  if (!data) return { items: [], count: 0, total: 0, msg: raw.slice(0, 160).replace(/<[^>]+>/g, ' ').trim() || '비JSON 응답' }
  const resp = (data.response ?? data) as Record<string, unknown>
  const header = resp.header as Record<string, unknown> | undefined
  const rc = header ? String(header.resultCode ?? '') : ''
  const rm = header ? String(header.resultMsg ?? '') : ''
  const body = (resp.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? body?.item ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawMarket[] : (items && typeof items === 'object' ? [items as RawMarket] : [])
  const total = Number(body?.totalCount) || 0
  // ⚠️ 200 이어도 헤더가 실패를 말할 수 있다(이 게이트웨이의 `resultCode:"10"` 이 그 경우) — 삼키지 않는다.
  const msg = (rc && rc !== '00' && rc !== '0') || (rm && !/normal|정상|success/i.test(rm)) ? `${rc} ${rm}`.trim() : undefined
  return { items: arr, count: arr.length, total, msg }
}

export interface MarketStats {
  last_run: string; found: number; saved: number; upserted: number; page: number; total: number
  total_runs: number; total_saved: number
  /** 회차가 **왜 멈췄나** — `deadline` 이 잦으면 페이지 수/행 수를 줄여야 한다(무배포 노브). */
  stopped_by?: string
  diag: { configured: boolean; error?: string; sample?: unknown }
  health?: LaneHealth
}
const STATS_KEY = 'ads_market_stats'
const CURSOR_KEY = 'ads_market_cursor'

export async function runMarketCollect(env: Env): Promise<MarketStats> {
  const DB = adsLeadsDb(env)
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || ''
  const base = (env as unknown as { ADS_MARKET_ENDPOINT?: string }).ADS_MARKET_ENDPOINT || MARKET_BASE
  const op = (env as unknown as { ADS_MARKET_OP?: string }).ADS_MARKET_OP || MARKET_OP
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: MarketStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as MarketStats : null } catch { prev = null }
  const persist = async (s: MarketStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const base0 = (error?: string, health?: LaneHealth): MarketStats => ({
    last_run: stamp, found: 0, saved: 0, upserted: 0, page: prev?.page || 1, total: prev?.total || 0,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0,
    diag: { configured: !error?.startsWith('NOT_CONFIGURED'), error }, health,
  })
  if (!key) { const s = base0('NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정'); await persist(s); return s }

  // 하드 실패(활용신청·경로) 백오프 — 낫지 않는 실패를 계속 쏘면 잘 도는 레인의 서브리퀘스트를 빼앗는다.
  const now = Date.now()
  if (laneShouldSkip(prev?.health, now)) {
    const s = base0(`대기: ${laneHealthNote(prev?.health, now)}`, prev?.health); await persist(s); return s
  }

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let page = parseInt(curRaw?.value || '1', 10); if (!Number.isFinite(page) || page < 1) page = 1
  const rows = Math.min(1000, Math.max(50, parseInt((env as unknown as { ADS_MARKET_ROWS?: string }).ADS_MARKET_ROWS || '', 10) || 500))
  const budget = { left: Math.min(10, Math.max(1, parseInt((env as unknown as { ADS_MARKET_PAGES?: string }).ADS_MARKET_PAGES || '', 10) || 6)) }

  // ⏱️ **벽시계 마감선** — 페이지 수만으로 묶으면 상대가 느릴 때(페이지당 최대 15s) 루프가 CPU/시간
  //   한도에 먼저 걸리고, 그러면 **아래 커서 저장에 도달하지 못해** 다음 회차가 같은 지점을 또 훑는다.
  //   이 레포가 "조용한 전진 0"이라 부르는 자리다(`check-cursor-after-loop` 가 이 코드를 실제로 잡았다).
  //   ⚠️ 마감선으로 멈출 땐 커서를 **진행한 만큼** 남긴다 — 리셋하면 전진이 사라진다.
  const deadline = Date.now() + Math.min(60_000, Math.max(5_000,
    parseInt((env as unknown as { ADS_MARKET_DEADLINE_MS?: string }).ADS_MARKET_DEADLINE_MS || '', 10) || 20_000))
  let found = 0, saved = 0, upserted = 0, total = prev?.total || 0, sample: unknown, lastMsg: string | undefined
  let stoppedBy: 'pages' | 'deadline' | 'end' | 'empty' = 'pages'
  // 🧾 루프 **뒤**에 D1 쓰기가 둘 있다(커서·통계). D1 도 서브리퀘스트라, 예산을 페이지에 다 쓰면
  //   "돌긴 돌았는데 기록이 없는" 회차가 된다 — 그러면 관측이 죽고 다음 회차가 같은 곳을 또 훑는다.
  const RESERVE = 2
  while (budget.left > RESERVE) {
    if (Date.now() >= deadline) { stoppedBy = 'deadline'; break }
    const r = await fetchMarketPage(base, op, key, page, rows, budget)
    if (r.msg) lastMsg = r.msg
    if (!sample && r.items[0]) sample = r.items[0]
    if (r.total) total = r.total
    if (!r.count) { stoppedBy = 'empty'; break }
    const leads = r.items.map(toMarketLead).filter((l): l is CompanyLead => !!l)
    found += leads.length
    // requireContact:true — 전화가 있는 시장은 바로 접촉 풀에, 없는 곳은 보류(active=0) 후
    //   기존 보강 레인이 홈페이지에서 연락처를 찾는다. 없는 연락처를 지어내지 않는다.
    const c = await saveCompanyLeadsCounted(DB, leads, { requireContact: true }).catch(() => ({ inserted: 0, upserted: 0 }))
    saved += c.inserted; upserted += c.upserted
    page++
    // 🔁 원부를 다 돌면 1페이지로 되돌아간다 — 커서가 끝에 박히면 갱신분을 영영 못 받는다.
    if (total && (page - 1) * rows >= total) { page = 1; stoppedBy = 'end'; break }
    if (r.count < rows) { page = 1; stoppedBy = 'end'; break } // 마지막 페이지
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(page)).run().catch(() => null)
  const hint = lastMsg && /INVALID_REQUEST_PARAMETER/i.test(lastMsg)
    ? ' — 이 게이트웨이는 모르는 파라미터를 **거부**한다. 메시지 괄호 안 이름이 범인이니 그 파라미터를 빼라(serviceKey/pageNo/numOfRows/type 넷만 허용).'
    : ''
  const error = found === 0 && lastMsg ? `API: ${lastMsg}${hint}` : undefined
  const s: MarketStats = {
    last_run: stamp, found, saved, upserted, page, total, stopped_by: stoppedBy,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    diag: { configured: true, error, sample }, health: updateLaneHealth(prev?.health, error || null, now),
  }
  await persist(s)
  return s
}
