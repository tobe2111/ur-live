/**
 * 📊 유통스타트 — 해외 수요 인텔리전스 (2026-07-27).
 *   "바이어 연락처 수집"이 아니라 **"어느 나라가 무엇을 얼마나 사는지"** 를 읽는다.
 *   ① 관세청 무역통계 오픈API(data.go.kr) — 한국의 국가별/품목별 수출실적 = 그 나라의 한국산 수요.
 *   ② 이미 수집된 바이어 인콰이어리(overseas_buyer_leads) 집계 — 실시간 "지금 찾는 품목" 신호.
 *   ⚠️ 연락처 무관(마스킹 영향 없음) · 공개 통계라 합법 · 유어딜(소비자) 무관 — 도매 B2B 전용.
 */
import type { Env } from '@/worker/types/env'
import { parseFeedItems } from './buyer-discovery'

export interface TradeDemandRow {
  id?: number
  period: string          // 'YYYYMM' 또는 'YYYY'
  country: string         // 국가명(원문)
  item_name: string | null // 품목명(품목별 API 사용 시)
  hs_code: string | null
  export_usd: number      // 한국 → 그 나라 수출액(USD) = 그 나라의 한국산 수요
  import_usd: number      // 그 나라 → 한국 수입액(USD)
  source: string
}

let demandSchemaReady: WeakSet<D1Database> | null = null
/** 수요 통계 테이블 — 격리 테이블(유어딜/바이어리드와 무관). period+country+item 이 유니크(멱등 재수집). */
export async function ensureDemandSchema(DB: D1Database): Promise<void> {
  if (!demandSchemaReady) demandSchemaReady = new WeakSet()
  if (demandSchemaReady.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS trade_demand_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    country TEXT NOT NULL,
    item_name TEXT,
    hs_code TEXT,
    export_usd REAL NOT NULL DEFAULT 0,
    import_usd REAL NOT NULL DEFAULT 0,
    source TEXT,
    collected_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_demand_uniq
    ON trade_demand_stats (period, country, COALESCE(item_name,''), COALESCE(hs_code,''))`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_trade_demand_country ON trade_demand_stats (country)').run().catch(() => null)
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
export function mapDemandItem(raw: Record<string, unknown>, source: string): TradeDemandRow | null {
  const g = (...keys: string[]): string => { for (const k of keys) { const v = str(raw[k]); if (v) return v } return '' }
  const gn = (...keys: string[]): number => { for (const k of keys) { if (raw[k] != null && str(raw[k]) !== '') return num(raw[k]) } return 0 }
  // 국가 — 관세청 국가별: statKor(국가명 한글)/statCd(코드). 타 기관: natnNm/cntyNm/country.
  const country = g('statKor', 'statNm', 'natnNm', 'cntyNm', 'nationNm', 'country', 'countryName', 'statCdCntnKor')
  // 품목 — 품목별 API 사용 시. 없으면 국가 단위 집계(item_name=null).
  const itemName = g('hsCdNm', 'itemNm', 'prnm', 'itemName', 'hsNm', 'statItemNm') || null
  const hsCode = g('hsCd', 'hsSgn', 'hsCode', 'itemCd') || null
  // 금액(USD) — 관세청: expDlr/impDlr(달러). 타 표기: expUsd/expAmt/exportAmount.
  const exportUsd = gn('expDlr', 'expUsd', 'expAmt', 'exportAmount', 'expUsdAmt', 'expDlrAmt')
  const importUsd = gn('impDlr', 'impUsd', 'impAmt', 'importAmount', 'impUsdAmt', 'impDlrAmt')
  // 기간 — year+month 조합 또는 단일 필드.
  const y = g('year', 'baseYear', 'statYear', 'yy'), m = g('month', 'baseMonth', 'statMonth', 'mm')
  const period = g('period', 'statPeriod', 'baseDt', 'stdDt') || (y && m ? `${y}${String(m).padStart(2, '0')}` : y) || ''
  if (!country) return null // 국가 없으면 수요 신호로 못 씀
  if (!exportUsd && !importUsd) return null // 금액 0/미매핑 행은 저장 안 함(오매핑 조용한 유입 방지)
  return { period: period || 'unknown', country, item_name: itemName, hs_code: hsCode, export_usd: exportUsd, import_usd: importUsd, source }
}

/** 수요 통계 저장(멱등 — 같은 기간·국가·품목은 최신값으로 갱신). */
export async function saveDemandRows(DB: D1Database, rows: TradeDemandRow[]): Promise<number> {
  if (!rows.length) return 0
  await ensureDemandSchema(DB)
  let saved = 0
  for (const r of rows.slice(0, 2000)) {
    const res = await DB.prepare(
      `INSERT INTO trade_demand_stats (period, country, item_name, hs_code, export_usd, import_usd, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (period, country, COALESCE(item_name,''), COALESCE(hs_code,''))
       DO UPDATE SET export_usd = excluded.export_usd, import_usd = excluded.import_usd,
                     source = excluded.source, collected_at = datetime('now')`)
      .bind(r.period, r.country, r.item_name, r.hs_code, r.export_usd, r.import_usd, r.source)
      .run().catch(() => null)
    if (res) saved++
  }
  return saved
}

/** URL 목록(쉼표구분) — 관세청 무역통계 오픈API. serviceKey 포함해 env 에 저장. */
function demandUrls(env: Env): string[] {
  return String((env as unknown as Record<string, string>).TRADE_STATS_URLS || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
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

/** 관세청 무역통계 수집 — TRADE_STATS_URLS 의 각 URL 을 읽어 수요 통계로 저장. */
export async function collectTradeDemand(env: Env): Promise<{ ran: boolean; reason?: string; fetched: number; mapped: number; saved: number; perUrl: Array<Record<string, unknown>> }> {
  const urls = demandUrls(env)
  if (!urls.length) return { ran: false, reason: 'TRADE_STATS_URLS 환경변수가 없습니다(관세청 API URL 을 등록하세요).', fetched: 0, mapped: 0, saved: 0, perUrl: [] }
  await ensureDemandSchema(env.DB)
  let fetched = 0, mapped = 0, saved = 0
  const perUrl: Array<Record<string, unknown>> = []
  for (const url of urls) {
    const host = (() => { try { return new URL(url).host } catch { return 'invalid-url' } })()
    const r = await fetchFeed(url)
    fetched += r.items.length
    const rows = r.items.map(it => mapDemandItem(it, host)).filter((x): x is TradeDemandRow => !!x)
    mapped += rows.length
    const s = await saveDemandRows(env.DB, rows)
    saved += s
    // 매핑 0 이면 필드명 불일치 — 원본 키를 남겨 즉시 교정 가능하게(조용한 실패 방지).
    perUrl.push({ host, httpOk: r.ok, status: r.status, items: r.items.length, mapped: rows.length, saved: s,
      ...(rows.length === 0 && r.items.length > 0 ? { unmappedSampleKeys: Object.keys(r.items[0]).slice(0, 30) } : {}),
      ...(r.items.length === 0 ? { bodyHead: r.bodyHead } : {}) })
  }
  return { ran: true, fetched, mapped, saved, perUrl }
}

/** 진단 — 원본 응답의 실제 필드명/샘플값을 그대로 보여준다(매핑 교정용, 저장 안 함). */
export async function diagnoseTradeFeed(env: Env): Promise<Record<string, unknown>> {
  const urls = demandUrls(env)
  if (!urls.length) return { ok: false, reason: 'TRADE_STATS_URLS 미설정' }
  const out: Array<Record<string, unknown>> = []
  for (const url of urls.slice(0, 2)) {
    const host = (() => { try { return new URL(url).host } catch { return 'invalid-url' } })()
    const r = await fetchFeed(url)
    const first = r.items[0] || null
    out.push({
      host, httpOk: r.ok, status: r.status, itemCount: r.items.length,
      firstItemKeys: first ? Object.keys(first) : [],
      firstItem: first ? Object.fromEntries(Object.entries(first).slice(0, 25).map(([k, v]) => [k, String(v).slice(0, 60)])) : null,
      mapped: first ? mapDemandItem(first, host) : null,
      ...(r.items.length === 0 ? { bodyHead: r.bodyHead } : {}),
    })
  }
  return { ok: true, feeds: out }
}

/** 수요 통계 조회 — 국가별(또는 품목별) 한국산 수요 상위. */
export async function listTradeDemand(DB: D1Database, opts: { country?: string; limit?: number } = {}): Promise<Record<string, unknown>[]> {
  await ensureDemandSchema(DB)
  const limit = Math.min(200, Math.max(1, opts.limit || 50))
  if (opts.country) {
    const r = await DB.prepare(
      `SELECT country, item_name, hs_code, period, export_usd, import_usd FROM trade_demand_stats
       WHERE country = ? ORDER BY export_usd DESC LIMIT ?`).bind(opts.country, limit).all<Record<string, unknown>>()
    return r.results || []
  }
  // 국가별 합계(최신 기간 우선) — "어느 나라가 한국산을 많이 사는가".
  const r = await DB.prepare(
    `SELECT country, SUM(export_usd) AS export_usd, SUM(import_usd) AS import_usd,
            COUNT(*) AS rows_n, MAX(period) AS latest_period
     FROM trade_demand_stats GROUP BY country ORDER BY export_usd DESC LIMIT ?`).bind(limit).all<Record<string, unknown>>()
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
