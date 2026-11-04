/**
 * 📊 **파트너 풀 · 매장후보 풀 → 구글 스프레드시트 미러** (2026-11-04 대표 *"파트너풀, 매장후보 풀 모두 다 연동하고픈데"*).
 *
 * 인플루언서 풀 미러(`sheets-sync.ts`)와 **같은 서비스계정·같은 커서 미러 방식**이다. 다른 점은 셋:
 *
 * 1. **풀마다 시트 파일이 따로다** — 시트 ID 는 `platform_settings`(`ads_sheets_id_{pool}`)에 두고 어드민 화면에서
 *    주소를 붙여넣어 정한다. 같은 파일에 탭만 더하지 않은 이유: 인플루언서 탭 하나가 이미 50만 행 × 30열이다.
 *    한 파일에 셋을 몰면 파일 셀 한도에 가까워지고, 그때 **인플루언서 미러까지 같이 멎는다**(가장 쓰는 시트가 인질이 된다).
 *    또 시트 ID 를 워커 Variables 가 아니라 DB 에 두는 것은 대표가 대시보드를 안 열고 화면에서 바로 정하게 하려는 것이다.
 * 2. **OFFSET 이 아니라 id 커서(keyset)로 읽는다** — OFFSET 은 매 회차 앞 행을 전부 다시 읽는다(풀 40만이면 회차당
 *    수십만 행 읽기). id 커서는 한 바퀴에 테이블을 한 번만 읽는다.
 * 3. **화면에 보이는 행만** — 파트너 풀은 `active=1 AND merged_into IS NULL`(연락처 없는 보류 47만 행·중복 병합 패자 제외 —
 *    어드민 목록 기본값과 같은 조건), 매장후보는 `active=1`(폐업 제외).
 *
 * 값은 `valueInputOption=RAW` 로 쓴다 — 시트가 `=…` 를 수식으로 실행하지 않는다(수식 인젝션 방어는 RAW 가 한다).
 * 실패해도 throw 하지 않고 결과를 `ads_sheets_last_sync_{pool}` 에 남긴다(인플루언서 미러가 34시간 무음 정지로 배운 것).
 */
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '../../../shared/ads/leads-db'
import { getToken, sheetsFetch, parseSheetCursor, startCursor, cycleRoom, type SyncTrigger } from './sheets-sync'
import { ensureCompanySchema } from './company-discovery'
import { ensureProspectSchema } from './store-prospects'
import { ensureMarkSchema, harvestMarks, ensureListTab, applyEmailList, sentDayKST } from './pool-sheets-marks'

export type SheetPool = 'company' | 'store'
export const SHEET_POOLS: readonly SheetPool[] = ['company', 'store']
export const isSheetPool = (v: unknown): v is SheetPool => v === 'company' || v === 'store'

const TAB = 'pool'
/** 한 회차가 쓰는 셀 수 상한 — 인플루언서 미러의 12,000행 × 30열과 같은 무게. 열이 적으면 행을 더 쓴다. */
const CELLS_PER_RUN = 360_000
const PAGE = 10_000

type Row = Record<string, string | number | null>
interface PoolDef {
  label: string
  table: string
  where: string
  cols: string
  header: readonly string[]
  toRow: (r: Row) => (string | number)[]
}

const s = (v: unknown): string => (v == null ? '' : String(v))
const day = (v: unknown): string => s(v).slice(0, 10)

export const POOL_DEFS: Record<SheetPool, PoolDef> = {
  company: {
    label: '파트너 풀',
    table: 'ad_company_leads',
    where: 'active = 1 AND merged_into IS NULL',
    cols: 'id, tier, category, subcategory, company_name, region, phone, email, website, address, status, contact_channel, contacted_at, follow_up_at, memo, source, source_keyword, collected_at, email_sent_at',
    header: ['ID', '티어', '업종', '세부업종', '업체명', '지역', '전화', '이메일', '웹사이트', '주소', '상태', '컨택채널', '컨택일', '팔로업', '메모', '출처', '수집키워드', '수집일', '이메일 보냄'],
    toRow: r => [Number(r.id), s(r.tier), s(r.category), s(r.subcategory), s(r.company_name), s(r.region), s(r.phone), s(r.email), s(r.website), s(r.address),
      s(r.status), s(r.contact_channel), s(r.contacted_at), s(r.follow_up_at), s(r.memo), s(r.source), s(r.source_keyword), day(r.collected_at), sentDayKST(r.email_sent_at)],
  },
  store: {
    label: '매장후보 풀',
    table: 'store_prospects',
    where: 'active = 1',
    cols: 'id, category, biz_name, region, phone, email, website, addr_road, status, is_new_open, apv_perm_ymd, contact_channel, follow_up_at, memo, collected_at, email_sent_at',
    header: ['ID', '업종', '상호', '지역', '전화', '이메일', '웹사이트', '도로명주소', '상태', '신규개업', '인허가일', '컨택채널', '팔로업', '메모', '수집일', '이메일 보냄'],
    toRow: r => [Number(r.id), s(r.category), s(r.biz_name), s(r.region), s(r.phone), s(r.email), s(r.website), s(r.addr_road), s(r.status),
      Number(r.is_new_open) ? '개업' : '', s(r.apv_perm_ymd), s(r.contact_channel), s(r.follow_up_at), s(r.memo), day(r.collected_at), sentDayKST(r.email_sent_at)],
  },
}

export const sheetIdKey = (p: SheetPool) => `ads_sheets_id_${p}`
export const cursorKey = (p: SheetPool) => `ads_sheets_cursor_${p}`
export const stampKey = (p: SheetPool) => `ads_sheets_last_sync_${p}`
export const rowsPerRun = (p: SheetPool) => Math.max(1000, Math.floor(CELLS_PER_RUN / POOL_DEFS[p].header.length))

/**
 * 붙여넣은 값 → 스프레드시트 ID. 시트 주소 전체(`…/spreadsheets/d/{ID}/edit#gid=0`)도, ID 만도 받는다.
 * 모양이 아니면 null — 아무 문자열이나 저장해 두면 매시간 "접근 실패" 만 쌓인다.
 */
export function parseSheetId(input: unknown): string | null {
  const t = String(input ?? '').trim()
  const m = t.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)
  const id = m ? m[1]! : t
  return /^[A-Za-z0-9_-]{20,100}$/.test(id) ? id : null
}

/** 열 번호(1-기반) → 시트 열 문자(1→A, 27→AA). 꼬리 지우기 범위에 쓴다. */
export function colLetter(n: number): string {
  let out = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out
  return out
}

/** id 커서 — `off`(시트에 쓴 행 수) · `lastId`(마지막으로 쓴 id) · `total`(사이클 시작 시 스냅샷). */
export function parsePoolCursor(raw: string | null | undefined): { off: number; total: number; lastId: number; cols: number } {
  const base = parseSheetCursor(raw)
  let lastId = 0
  let cols = 0
  try {
    const v = JSON.parse(String(raw || '{}')) as { lastId?: unknown; cols?: unknown }
    lastId = Math.max(0, Math.floor(Number(v.lastId) || 0))
    cols = Math.max(0, Math.floor(Number(v.cols) || 0))
  } catch { lastId = 0; cols = 0 }
  // off 가 0 이면 lastId 도 0 이어야 한다(새 사이클). 둘이 어긋나면 처음부터 — 누락보다 중복 쓰기가 낫다.
  return base.off === 0 ? { ...base, lastId: 0, cols } : { ...base, lastId, cols }
}

/**
 * 열 수가 바뀌었으면(예: '이메일 보냄' 열 추가) 사이클을 처음부터 — 그리드 폭·헤더는 사이클 시작에만 맞추므로,
 * 도중에 열이 늘면 그리드 밖에 쓰다 400 이 난다. 열 수를 모르는 옛 커서도 처음부터(한 회차 손해뿐).
 */
export function cursorForCols(saved: { off: number; total: number; lastId: number; cols: number }, nCols: number): { off: number; total: number; lastId: number } {
  if (saved.off > 0 && saved.cols !== nCols) return { off: 0, total: 0, lastId: 0 }
  const st = startCursor(saved)
  return { off: st.off, total: st.total, lastId: st.off === 0 ? 0 : saved.lastId }
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const r = await adsLeadsDb(env).prepare('SELECT value FROM platform_settings WHERE key = ?').bind(key)
    .first<{ value: string }>().catch(() => null)
  return r?.value ?? null
}
async function writeSetting(env: Env, key: string, value: string): Promise<void> {
  await adsLeadsDb(env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value).run().catch(() => null)
}

export async function getPoolSheetId(env: Env, pool: SheetPool): Promise<string | null> {
  return parseSheetId(await readSetting(env, sheetIdKey(pool)))
}

/** 시트 바꾸기 — 커서도 0 으로(새 파일엔 처음부터 써야 한다). 빈 값이면 연동 해제. */
export async function setPoolSheetId(env: Env, pool: SheetPool, input: string): Promise<{ ok: boolean; sheetId?: string | null; error?: string }> {
  if (!String(input || '').trim()) {
    await adsLeadsDb(env).prepare('DELETE FROM platform_settings WHERE key IN (?, ?)').bind(sheetIdKey(pool), cursorKey(pool)).run().catch(() => null)
    return { ok: true, sheetId: null }
  }
  const id = parseSheetId(input)
  if (!id) return { ok: false, error: '구글 시트 주소가 아닙니다 — 시트를 열고 주소창의 주소를 그대로 붙여넣어 주세요' }
  await writeSetting(env, sheetIdKey(pool), id)
  await writeSetting(env, cursorKey(pool), JSON.stringify({ off: 0, total: 0, lastId: 0, at: new Date().toISOString() }))
  return { ok: true, sheetId: id }
}

export type PoolSyncResult = { ok: boolean; skipped?: string; rows?: number; error?: string; partial?: boolean; next?: number; total?: number; marked?: number }

/** 한 풀 한 회차. 절대 throw 하지 않는다 — 결과를 스탬프에 남긴다. */
export async function syncPoolToSheets(env: Env, pool: SheetPool, trigger: SyncTrigger = 'unknown'): Promise<PoolSyncResult> {
  const cost = { subreq: 0 }
  let r: PoolSyncResult
  try {
    r = await core(env, pool, cost)
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    r = { ok: false, error: `CRASH ${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }
  }
  if (r.skipped !== 'not_configured') {
    await writeSetting(env, stampKey(pool), JSON.stringify({
      at: new Date().toISOString(), ok: r.ok, rows: r.rows ?? null, partial: !!r.partial, total: r.total ?? null,
      error: (r.error || '').slice(0, 300) || null, subreq: cost.subreq, trigger, marked: r.marked ?? 0,
    }))
  }
  return r
}

async function core(env: Env, pool: SheetPool, cost: { subreq: number }): Promise<PoolSyncResult> {
  const def = POOL_DEFS[pool]
  const sheetId = await getPoolSheetId(env, pool)
  cost.subreq += 1
  if (!sheetId) return { ok: true, skipped: 'not_configured' }
  if (!env.GSHEETS_SA_EMAIL || !env.GSHEETS_SA_KEY) return { ok: false, error: 'NOT_CONFIGURED: 서비스계정(GSHEETS_SA_EMAIL/KEY)이 ur-ads 에 없습니다' }
  cost.subreq += 1
  const token = await getToken(env)
  if (!token) return { ok: false, error: 'AUTH: 서비스계정 토큰 발급 실패' }

  const DB = adsLeadsDb(env)
  cost.subreq += pool === 'company' ? await ensureCompanySchema(DB) : await ensureProspectSchema(DB)
  cost.subreq += await ensureMarkSchema(DB)

  const nCols = def.header.length
  const lastCol = colLetter(nCols) // 마지막 열 = '이메일 보냄'
  cost.subreq += 1
  let { off, total, lastId } = cursorForCols(parsePoolCursor(await readSetting(env, cursorKey(pool))), nCols)
  let marked = 0

  if (off === 0) {
    lastId = 0
    cost.subreq += 1
    const cnt = await DB.prepare(`SELECT COUNT(*) AS n FROM ${def.table} WHERE ${def.where}`).first<{ n: number }>().catch(() => null)
    if (!cnt) return { ok: false, error: 'READ: 총건수 조회 실패' }
    total = Math.max(0, Number(cnt.n) || 0)
    cost.subreq += 2
    const tabs = await ensureTab(token, sheetId, total + 2, nCols)
    if (tabs.error) return { ok: false, error: tabs.error }
    await ensureListTab(token, sheetId, tabs.titles, cost)
    cost.subreq += 1
    const h = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${TAB}!A1`)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range: `${TAB}!A1`, majorDimension: 'ROWS', values: [[...def.header]] }),
    }).catch(() => null)
    if (!h?.ok) return { ok: false, error: `HEADER: 시트 접근 실패(${h?.status || 'net'}) — 시트를 ${env.GSHEETS_SA_EMAIL} 에 편집자로 공유했는지 확인` }
  }

  // ✉️ '발송기록' 탭에 붙여넣은 이메일 목록 → 표시(회차당 한 번). 아래 페이지 SELECT 보다 먼저라 이번 회차 그림에 바로 반영된다.
  marked += (await applyEmailList(DB, token, sheetId, def.table, cost)).marked

  const budget = rowsPerRun(pool)
  let wrote = 0
  let done = false
  while (wrote < budget) {
    const room = cycleRoom(off, total)
    if (room <= 0) { done = true; break }
    const take = Math.min(PAGE, budget - wrote, room)
    // ✉️ 덮어쓰기 **전에** 이 구간의 '이메일 보냄' 표시를 읽어 DB 에 저장한다(줄의 ID 로 찾는다 — 밀려도 안전).
    marked += await harvestMarks(DB, token, sheetId, def.table, TAB, lastCol, off + 2, take, cost)
    cost.subreq += 1
    const res = await DB.prepare(`SELECT ${def.cols} FROM ${def.table} WHERE ${def.where} AND id > ? ORDER BY id ASC LIMIT ?`)
      .bind(lastId, take).all<Row>().catch(() => null)
    if (!res) {
      await saveCursor(env, pool, off, total, lastId, nCols)
      return { ok: false, error: `READ: D1 읽기 실패(id>${lastId}) — 다음 회차가 같은 자리부터 다시 합니다`, rows: wrote, marked }
    }
    const page = res.results || []
    if (!page.length) { done = true; break }
    const rowNo = off + 2
    const range = `${TAB}!A${rowNo}`
    cost.subreq += 1
    const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values: page.map(def.toRow) }),
    }).catch(() => null)
    if (!w?.ok) {
      await saveCursor(env, pool, off, total, lastId, nCols)
      return { ok: false, error: `WRITE: ${rowNo}행부터 기록 실패(${w?.status || 'net'})`, rows: wrote, marked }
    }
    off += page.length
    wrote += page.length
    lastId = Number(page[page.length - 1]!.id) || lastId
    if (page.length < take) { done = true; break }
  }

  if (done) {
    // 사이클 끝 — 지난 바퀴보다 줄어든 꼬리만 지운다(전체 clear 를 안 하므로 시트가 비는 순간이 없다).
    // 지우기 전에 그 꼬리의 표시도 거둔다(빠진 업체라도 보냈다는 기록은 남긴다).
    marked += await harvestMarks(DB, token, sheetId, def.table, TAB, lastCol, off + 2, 0, cost)
    cost.subreq += 1
    await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${TAB}!A${off + 2}:${lastCol}`)}:clear`, { method: 'POST', body: '{}' }).catch(() => null)
    await saveCursor(env, pool, 0, off, 0, nCols)
    return { ok: true, rows: off, partial: false, total: off, marked }
  }
  await saveCursor(env, pool, off, total, lastId, nCols)
  return { ok: true, rows: wrote, partial: true, next: off, total, marked }
}

async function saveCursor(env: Env, pool: SheetPool, off: number, total: number, lastId: number, cols: number): Promise<void> {
  await writeSetting(env, cursorKey(pool), JSON.stringify({ off, total, lastId, cols, at: new Date().toISOString() }))
}

/** `pool` 탭 보장 + 그리드를 필요한 크기로(작을 때만) 넓힌다. 실패는 문자열로 — 그리드가 작은 채 쓰면 400 만 반복된다. */
async function ensureTab(token: string, sheetId: string, needRows: number, needCols: number): Promise<{ error: string | null; titles: string[] }> {
  const meta = await sheetsFetch(token, sheetId, '?fields=sheets.properties(sheetId,title,gridProperties)').catch(() => null)
  if (!meta?.ok) return { error: `META: 시트를 열 수 없습니다(${meta?.status || 'net'}) — 주소와 공유 설정을 확인`, titles: [] }
  const j = await meta.json().catch(() => null) as { sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] } | null
  const titles = (j?.sheets || []).map(x => String(x.properties?.title || ''))
  const tab = j?.sheets?.find(x => x.properties?.title === TAB)?.properties
  const req = tab
    ? ((tab.gridProperties?.rowCount || 0) >= needRows && (tab.gridProperties?.columnCount || 0) >= needCols
      ? null
      : { updateSheetProperties: {
        properties: { sheetId: tab.sheetId, gridProperties: { rowCount: Math.max(tab.gridProperties?.rowCount || 0, needRows), columnCount: Math.max(tab.gridProperties?.columnCount || 0, needCols) } },
        fields: 'gridProperties.rowCount,gridProperties.columnCount',
      } })
    : { addSheet: { properties: { title: TAB, gridProperties: { rowCount: needRows, columnCount: needCols } } } }
  if (!req) return { error: null, titles }
  const r = await sheetsFetch(token, sheetId, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [req] }) }).catch(() => null)
  if (r?.ok) return { error: null, titles }
  const body = r ? (await r.text().catch(() => '')).slice(0, 160) : ''
  return { error: `GRID: 시트 크기 확장 실패(${r?.status || 'net'}) ${body}`, titles }
}

/** 화면용 상태 — 시트 ID·마지막 회차·진행률. */
export async function poolSheetStatus(env: Env, pool: SheetPool): Promise<{ sheetId: string | null; sheetUrl: string | null; last: unknown; cursor: { off: number; total: number } }> {
  const sheetId = await getPoolSheetId(env, pool)
  let last: unknown = null
  try { last = JSON.parse((await readSetting(env, stampKey(pool))) || 'null') } catch { last = null }
  const c = parsePoolCursor(await readSetting(env, cursorKey(pool)))
  return { sheetId, sheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null, last, cursor: { off: c.off, total: c.total } }
}
