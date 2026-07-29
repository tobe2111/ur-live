/**
 * 📊 유통스타트 — 해외 수요 인텔리전스 (2026-07-27).
 *   "바이어 연락처 수집"이 아니라 **"어느 나라가 무엇을 얼마나 사는지"** 를 읽는다.
 *   ① 관세청 무역통계 오픈API(data.go.kr) — 한국의 국가별/품목별 수출실적 = 그 나라의 한국산 수요.
 *   ② 이미 수집된 바이어 인콰이어리(overseas_buyer_leads) 집계 — 실시간 "지금 찾는 품목" 신호.
 *   ⚠️ 연락처 무관(마스킹 영향 없음) · 공개 통계라 합법 · 유어딜(소비자) 무관 — 도매 B2B 전용.
 */
import type { Env } from '@/worker/types/env'
import { parseFeedItems } from './buyer-discovery'

/**
 * 차원(dimension) — 관세청 16종 데이터셋을 한 테이블로 흡수하기 위한 축 구분.
 *   수요축: country/item/item_country/continent/economy/nature — "해외 어디가 뭘 사는가"
 *   공급·물류축: region(시도)/customs(세관)/port(항구·공항) — "국내 어디서 나가는가"(공급사 발굴·물류)
 *   total: 수출입총괄(전체 추세) · unknown: 필드 미인식(진단 유도, 조용한 폐기 금지)
 */
export type DemandDim = 'country' | 'item' | 'item_country' | 'continent' | 'economy' | 'nature'
  | 'region' | 'region_item' | 'customs' | 'port' | 'total' | 'unknown'
/** 해외 수요 신호로 쓰는 축(대시보드 기본) — 국내 물류/지역축과 구분. */
export const DEMAND_DIMS: DemandDim[] = ['item_country', 'country', 'item', 'continent', 'economy', 'nature', 'total']

export interface TradeDemandRow {
  id?: number
  period: string           // 'YYYYMM' 또는 'YYYY'
  dim_type: DemandDim      // 어떤 축의 통계인가
  dim_value: string        // 그 축의 값(국가명/대륙명/시도명/세관명/항구명/'전체')
  country: string | null   // dim_type 이 국가 계열일 때만(하위호환·필터용)
  item_name: string | null // 품목/성질 명
  hs_code: string | null
  export_usd: number       // 한국 → 밖으로 나간 금액(USD) = 해외 수요
  import_usd: number       // 밖 → 한국 (USD)
  source: string
}

let demandSchemaReady: WeakSet<D1Database> | null = null
/** 수요 통계 테이블 — 격리 테이블(유어딜/바이어리드와 무관). 축+값+품목+기간이 유니크(멱등 재수집). */
export async function ensureDemandSchema(DB: D1Database): Promise<void> {
  if (!demandSchemaReady) demandSchemaReady = new WeakSet()
  if (demandSchemaReady.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS trade_demand_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    dim_type TEXT NOT NULL DEFAULT 'country',
    dim_value TEXT NOT NULL DEFAULT '',
    country TEXT,
    item_name TEXT,
    hs_code TEXT,
    export_usd REAL NOT NULL DEFAULT 0,
    import_usd REAL NOT NULL DEFAULT 0,
    source TEXT,
    collected_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_demand_uniq
    ON trade_demand_stats (period, dim_type, dim_value, COALESCE(item_name,''), COALESCE(hs_code,''))`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_trade_demand_dim ON trade_demand_stats (dim_type, export_usd)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_trade_demand_country ON trade_demand_stats (country)').run().catch(() => null)
  // 환율·규제처럼 금액 스키마가 아닌 참조 데이터(관세환율/세관장확인대상물품)는 원본 JSON 으로 보관.
  await DB.prepare(`CREATE TABLE IF NOT EXISTS trade_reference (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    ref_key TEXT NOT NULL,
    label TEXT,
    payload TEXT NOT NULL,
    source TEXT,
    collected_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_ref_uniq ON trade_reference (kind, ref_key)').run().catch(() => null)
  demandSchemaReady.add(DB)
}

/** 문자열 금액(콤마/공백 포함) → 숫자. 파싱 불가면 0(NaN 방지 — 대시보드 ₩NaN 룰). */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = parseFloat(String(v ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown): string => String(v ?? '').trim()

/**
 * 관세청/무역통계 항목 → TradeDemandRow 매핑.
 * ⚠️ data.go.kr 은 기관마다 필드명이 달라(statKor/statCd/expDlr/…) **넓은 별칭**으로 흡수한다.
 *    정확한 실제 키는 `/demand/diag` 로 원본을 1회 확인해 좁힌다(추측 매핑 실패 방지).
 */
export function mapDemandItem(raw: Record<string, unknown>, source: string, hint?: DemandDim): TradeDemandRow | null {
  const g = (...keys: string[]): string => { for (const k of keys) { const v = str(raw[k]); if (v) return v } return '' }
  const gn = (...keys: string[]): number => { for (const k of keys) { if (raw[k] != null && str(raw[k]) !== '') return num(raw[k]) } return 0 }
  // 💵 금액 — ⚠️ 관세청 GW API 의 expDlr/impDlr 단위는 **미화 천불(US$1,000)** 이다(공식 명세).
  //    그대로 쓰면 규모를 1000배 작게 읽는다 → 여기서 USD 로 정규화(×1000). 다른 소스의 일반 USD 필드는 그대로.
  const expThousand = gn('expDlr', 'expDlrAmt'), impThousand = gn('impDlr', 'impDlrAmt')
  const exportUsd = expThousand ? expThousand * 1000 : gn('expUsd', 'expAmt', 'exportAmount', 'expUsdAmt')
  const importUsd = impThousand ? impThousand * 1000 : gn('impUsd', 'impAmt', 'importAmount', 'impUsdAmt')
  if (!exportUsd && !importUsd) return null // 금액 없는 행은 통계로 못 씀(오매핑 조용한 유입 방지)

  // 축 후보 — 관세청 GW 는 데이터셋마다 라벨 필드가 다르다. 존재하는 필드로 축을 판별.
  //   ⚠️ statKor 은 '통계기준명'이라 데이터셋에 따라 국가/성질/대륙 등 무엇이든 담긴다 → hint(등록 시 지정)를 우선.
  const country = g('statKor', 'statNm', 'natnNm', 'cntyNm', 'nationNm', 'country', 'countryName')
  const itemName = g('hsCdNm', 'itemNm', 'prnm', 'itemName', 'hsNm', 'statItemNm', 'kndNm') || null
  const hsCode = g('hsCd', 'hsSgn', 'hsCode', 'itemCd') || null
  const region = g('ctprvnNm', 'sidoNm', 'cityNm', 'areaNm', 'ctpvNm')
  const customs = g('cstmNm', 'customsNm', 'cstmsNm')
  const port = g('portNm', 'aprtNm', 'hbprtNm', 'portName')
  const continent = g('cntnNm', 'continentNm', 'cntinentNm')
  const economy = g('ecnmyNm', 'econNm', 'ecnmZoneNm')
  const nature = g('natrNm', 'sqltNm', 'propNm', 'newNatrNm')

  // 축 결정 — hint(등록 시 명시) > 고유 라벨 필드 > 국가+품목 조합 > 국가 > 품목.
  let dimType: DemandDim = hint || 'unknown'
  let dimValue = ''
  if (hint) {
    dimValue = country || region || customs || port || continent || economy || nature || (hsCode ? String(hsCode) : '') || '전체'
  } else if (region) { dimType = hsCode || itemName ? 'region_item' : 'region'; dimValue = region }
  else if (customs) { dimType = 'customs'; dimValue = customs }
  else if (port) { dimType = 'port'; dimValue = port }
  else if (continent) { dimType = 'continent'; dimValue = continent }
  else if (economy) { dimType = 'economy'; dimValue = economy }
  else if (nature) { dimType = 'nature'; dimValue = nature }
  else if (country && (hsCode || itemName)) { dimType = 'item_country'; dimValue = country }
  else if (country) { dimType = 'country'; dimValue = country }
  else if (hsCode || itemName) { dimType = 'item'; dimValue = itemName || String(hsCode) }
  else { dimType = 'total'; dimValue = '전체' } // 수출입총괄(라벨 없이 금액만)

  // 기간 — year+month 조합 또는 단일 필드.
  const y = g('year', 'baseYear', 'statYear', 'yy'), m = g('month', 'baseMonth', 'statMonth', 'mm')
  const period = g('period', 'statPeriod', 'baseDt', 'stdDt') || (y && m ? `${y}${String(m).padStart(2, '0')}` : y) || ''
  const isCountryDim = dimType === 'country' || dimType === 'item_country'
  return {
    period: period || 'unknown', dim_type: dimType, dim_value: dimValue || '전체',
    country: isCountryDim ? (country || dimValue) : null,
    item_name: itemName, hs_code: hsCode, export_usd: exportUsd, import_usd: importUsd, source,
  }
}

/** 수요 통계 저장(멱등 — 같은 기간·축·값·품목은 최신값으로 갱신). */
export async function saveDemandRows(DB: D1Database, rows: TradeDemandRow[]): Promise<number> {
  if (!rows.length) return 0
  await ensureDemandSchema(DB)
  let saved = 0
  for (const r of rows.slice(0, 2000)) {
    const res = await DB.prepare(
      `INSERT INTO trade_demand_stats (period, dim_type, dim_value, country, item_name, hs_code, export_usd, import_usd, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (period, dim_type, dim_value, COALESCE(item_name,''), COALESCE(hs_code,''))
       DO UPDATE SET export_usd = excluded.export_usd, import_usd = excluded.import_usd,
                     country = excluded.country, source = excluded.source, collected_at = datetime('now')`)
      .bind(r.period, r.dim_type, r.dim_value, r.country, r.item_name, r.hs_code, r.export_usd, r.import_usd, r.source)
      .run().catch(() => null)
    if (res) saved++
  }
  return saved
}

/** 참조 데이터(관세환율·세관장확인대상물품) 저장 — 금액 스키마가 아니라 원본 JSON 보관. */
export async function saveReferenceRows(DB: D1Database, kind: string, items: Record<string, unknown>[], source: string): Promise<number> {
  if (!items.length) return 0
  await ensureDemandSchema(DB)
  let saved = 0
  for (const [i, it] of items.slice(0, 500).entries()) {
    const s = (...keys: string[]): string => { for (const k of keys) { const v = str(it[k]); if (v) return v } return '' }
    // 고유키 — 환율(통화/기준일) · 규제(HS코드/품목) 등에서 뽑고, 없으면 순번 폴백(중복 누적 방지).
    const refKey = (s('currSgn', 'curSgn', 'cntySgn', 'hsCd', 'hsSgn', 'itemCd', 'code') + '|' + s('aplyBgnDt', 'aplBgnDt', 'stdDt', 'baseDt', 'period')) || `idx${i}`
    const label = s('currNm', 'cntyNm', 'hsCdNm', 'itemNm', 'prnm', 'lawNm', 'cnfrmNm') || refKey
    const res = await DB.prepare(
      `INSERT INTO trade_reference (kind, ref_key, label, payload, source) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (kind, ref_key) DO UPDATE SET label = excluded.label, payload = excluded.payload,
         source = excluded.source, collected_at = datetime('now')`)
      .bind(kind, refKey.slice(0, 120), label.slice(0, 200), JSON.stringify(it).slice(0, 4000), source)
      .run().catch(() => null)
    if (res) saved++
  }
  return saved
}

const DIM_HINTS = new Set<string>(['country', 'item', 'item_country', 'continent', 'economy', 'nature', 'region', 'region_item', 'customs', 'port', 'total', 'unknown'])
/**
 * URL 목록 — `TRADE_STATS_URLS`(쉼표구분). 관세청 16종을 모두 넣을 수 있다.
 *   형식: `URL` 또는 **`축|URL`**(권장 — 예 `item_country|https://…`, `fx|https://…`, `restriction|https://…`).
 *   축을 명시하면 필드 자동판별 오류(statKor 이 데이터셋마다 다른 뜻)를 원천 차단한다.
 */
function demandUrls(env: Env): Array<{ url: string; hint?: DemandDim; kind?: 'demand' | 'fx' | 'restriction' }> {
  return String((env as unknown as Record<string, string>).TRADE_STATS_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)
    .map(entry => {
      const bar = entry.indexOf('|')
      if (bar > 0 && !/^https?:/i.test(entry.slice(0, bar))) {
        const tag = entry.slice(0, bar).trim().toLowerCase(), url = entry.slice(bar + 1).trim()
        if (tag === 'fx' || tag === 'exchange') return { url, kind: 'fx' as const }
        if (tag === 'restriction' || tag === 'ban') return { url, kind: 'restriction' as const }
        if (DIM_HINTS.has(tag)) return { url, hint: tag as DemandDim, kind: 'demand' as const }
        return { url, kind: 'demand' as const }
      }
      return { url: entry, kind: 'demand' as const }
    })
    .filter(x => /^https?:\/\//i.test(x.url))
}

async function fetchFeed(url: string): Promise<{ ok: boolean; items: Record<string, unknown>[]; status: number; bodyHead: string }> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 12000)
  try {
    const res = await fetch(url, { headers: { accept: 'application/json, application/xml;q=0.9, text/xml;q=0.9' }, signal: ac.signal })
    const text = await res.text()
    return { ok: res.ok, items: parseFeedItems(text), status: res.status, bodyHead: text.slice(0, 600) }
  } catch (e) {
    return { ok: false, items: [], status: 0, bodyHead: String(e).slice(0, 200) }
  } finally { clearTimeout(t) }
}

/**
 * 관세청 무역통계 수집 — TRADE_STATS_URLS 의 각 URL(최대 20)을 읽어 저장.
 *   금액 계열(14종)은 trade_demand_stats 에 축별로, 환율·규제는 trade_reference 에 원본 JSON 으로.
 *   ⚠️ Cloudflare subrequest 한도(~50) 고려 — URL 1개당 1회 fetch 라 20개까지 안전.
 */
export async function collectTradeDemand(env: Env): Promise<{ ran: boolean; reason?: string; fetched: number; mapped: number; saved: number; refSaved: number; perUrl: Array<Record<string, unknown>> }> {
  const entries = demandUrls(env)
  if (!entries.length) return { ran: false, reason: 'TRADE_STATS_URLS 환경변수가 없습니다(관세청 API URL 을 등록하세요).', fetched: 0, mapped: 0, saved: 0, refSaved: 0, perUrl: [] }
  await ensureDemandSchema(env.DB)
  let fetched = 0, mapped = 0, saved = 0, refSaved = 0
  const perUrl: Array<Record<string, unknown>> = []
  for (const { url, hint, kind } of entries) {
    const host = (() => { try { return new URL(url).host } catch { return 'invalid-url' } })()
    const r = await fetchFeed(url)
    fetched += r.items.length
    if (kind === 'fx' || kind === 'restriction') {
      const s = await saveReferenceRows(env.DB, kind, r.items, host)
      refSaved += s
      perUrl.push({ host, kind, httpOk: r.ok, status: r.status, items: r.items.length, refSaved: s,
        ...(r.items.length === 0 ? { bodyHead: r.bodyHead } : {}) })
      continue
    }
    const rows = r.items.map(it => mapDemandItem(it, host, hint)).filter((x): x is TradeDemandRow => !!x)
    mapped += rows.length
    const s = await saveDemandRows(env.DB, rows)
    saved += s
    const dims = Array.from(new Set(rows.map(x => x.dim_type)))
    // 매핑 0 이면 필드명 불일치 — 원본 키를 남겨 즉시 교정 가능하게(조용한 실패 방지).
    perUrl.push({ host, hint: hint || '(자동판별)', dims, httpOk: r.ok, status: r.status, items: r.items.length, mapped: rows.length, saved: s,
      ...(rows.length === 0 && r.items.length > 0 ? { unmappedSampleKeys: Object.keys(r.items[0]).slice(0, 30) } : {}),
      ...(r.items.length === 0 ? { bodyHead: r.bodyHead } : {}) })
  }
  return { ran: true, fetched, mapped, saved, refSaved, perUrl }
}

/** 진단 — 원본 응답의 실제 필드명/샘플값을 그대로 보여준다(매핑 교정용, 저장 안 함). */
export async function diagnoseTradeFeed(env: Env): Promise<Record<string, unknown>> {
  const urls = demandUrls(env)
  if (!urls.length) return { ok: false, reason: 'TRADE_STATS_URLS 미설정' }
  const out: Array<Record<string, unknown>> = []
  // 등록 URL 전부 진단(최대 20) — 16종을 한 번에 넣었을 때 어느 것이 안 먹는지 개별 확인.
  for (const { url, hint, kind } of urls) {
    const host = (() => { try { return new URL(url).host } catch { return 'invalid-url' } })()
    const r = await fetchFeed(url)
    const first = r.items[0] || null
    out.push({
      host, kind: kind || 'demand', hint: hint || '(자동판별)', httpOk: r.ok, status: r.status, itemCount: r.items.length,
      firstItemKeys: first ? Object.keys(first) : [],
      firstItem: first ? Object.fromEntries(Object.entries(first).slice(0, 25).map(([k, v]) => [k, String(v).slice(0, 60)])) : null,
      mapped: first && kind !== 'fx' && kind !== 'restriction' ? mapDemandItem(first, host, hint) : null,
      ...(r.items.length === 0 ? { bodyHead: r.bodyHead } : {}),
    })
  }
  return { ok: true, feeds: out }
}

/**
 * 수요 통계 조회.
 *   - `country` 지정 → 그 나라가 사가는 **품목 순위**(가장 실행가능한 신호).
 *   - `dim` 지정 → 그 축의 값별 합계(국가/대륙/경제권/성질/시도/세관/항구…).
 *   - 기본 → 국가 계열(country+item_country) 합계 = "어느 나라가 한국산을 많이 사는가".
 */
export async function listTradeDemand(DB: D1Database, opts: { country?: string; dim?: string; limit?: number } = {}): Promise<Record<string, unknown>[]> {
  await ensureDemandSchema(DB)
  const limit = Math.min(200, Math.max(1, opts.limit || 50))
  if (opts.country) {
    const r = await DB.prepare(
      `SELECT dim_type, dim_value, country, item_name, hs_code, period, export_usd, import_usd
       FROM trade_demand_stats WHERE country = ? ORDER BY export_usd DESC LIMIT ?`)
      .bind(opts.country, limit).all<Record<string, unknown>>()
    return r.results || []
  }
  if (opts.dim) {
    const r = await DB.prepare(
      `SELECT dim_type, dim_value, SUM(export_usd) AS export_usd, SUM(import_usd) AS import_usd,
              COUNT(*) AS rows_n, MAX(period) AS latest_period
       FROM trade_demand_stats WHERE dim_type = ?
       GROUP BY dim_type, dim_value ORDER BY export_usd DESC LIMIT ?`)
      .bind(opts.dim, limit).all<Record<string, unknown>>()
    return r.results || []
  }
  const r = await DB.prepare(
    `SELECT dim_type, dim_value, COALESCE(country, dim_value) AS country,
            SUM(export_usd) AS export_usd, SUM(import_usd) AS import_usd,
            COUNT(*) AS rows_n, MAX(period) AS latest_period
     FROM trade_demand_stats WHERE dim_type IN ('country','item_country')
     GROUP BY dim_value ORDER BY export_usd DESC LIMIT ?`).bind(limit).all<Record<string, unknown>>()
  return r.results || []
}

/** 어떤 축의 데이터가 얼마나 쌓였는지 — 대시보드 탭 구성 + "어느 데이터셋이 안 들어왔나" 확인용. */
export async function demandDimSummary(DB: D1Database): Promise<Record<string, unknown>[]> {
  await ensureDemandSchema(DB)
  const r = await DB.prepare(
    `SELECT dim_type, COUNT(*) AS rows_n, COUNT(DISTINCT dim_value) AS values_n,
            SUM(export_usd) AS export_usd, MAX(period) AS latest_period
     FROM trade_demand_stats GROUP BY dim_type ORDER BY rows_n DESC`).all<Record<string, unknown>>()
  return r.results || []
}

/** 참조 데이터(환율·규제) 조회 — 종류별 최신. */
export async function listTradeReference(DB: D1Database, kind: string, limit = 50): Promise<Record<string, unknown>[]> {
  await ensureDemandSchema(DB)
  const n = Math.min(200, Math.max(1, limit))
  const r = await DB.prepare(
    `SELECT kind, ref_key, label, payload, collected_at FROM trade_reference
     WHERE kind = ? ORDER BY collected_at DESC, id DESC LIMIT ?`).bind(kind, n).all<Record<string, unknown>>()
  return r.results || []
}

/**
 * 수집된 바이어 인콰이어리에서 "지금 무엇을 찾는지" 집계.
 *   ⚠️ 연락처(마스킹)와 무관하게 **품목·국가는 항상 보인다** → 13건이어도 즉시 신호가 된다.
 */
export async function aggregateInquiryDemand(DB: D1Database, limit = 50): Promise<{ byCountry: Record<string, unknown>[]; byCategory: Record<string, unknown>[]; recent: Record<string, unknown>[] }> {
  const n = Math.min(200, Math.max(1, limit))
  const byCountry = (await DB.prepare(
    `SELECT COALESCE(country,'?') AS country, COUNT(*) AS n
     FROM overseas_buyer_leads GROUP BY country ORDER BY n DESC LIMIT ?`).bind(n).all<Record<string, unknown>>()).results || []
  const byCategory = (await DB.prepare(
    `SELECT COALESCE(category,'?') AS category, COUNT(*) AS n
     FROM overseas_buyer_leads GROUP BY category ORDER BY n DESC LIMIT ?`).bind(n).all<Record<string, unknown>>()).results || []
  // 최근 인콰이어리 — 제목이 곧 "찾는 품목"(연락처 없어도 수요 신호로 유효).
  const recent = (await DB.prepare(
    `SELECT company, country, category, inquiry_title, est_volume, collected_at
     FROM overseas_buyer_leads
     WHERE inquiry_title IS NOT NULL AND inquiry_title != ''
     ORDER BY collected_at DESC, id DESC LIMIT ?`).bind(n).all<Record<string, unknown>>()).results || []
  return { byCountry, byCategory, recent }
}
