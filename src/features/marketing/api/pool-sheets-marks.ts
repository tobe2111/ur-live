/**
 * ✉️ **시트에서 "이메일 보냄" 표시 → DB 로 되돌려 저장** (2026-11-04 대표 *"그냥 시트 옆에 이메일 보냈다고 표기만 하고 싶은데"* → 방법 2).
 *
 * 시트 미러(`pool-sheets-sync.ts`)는 매시간 줄 순서대로 덮어쓴다. 그래서 시트에 적은 표시는 **덮어쓰기 전에 먼저 읽어서**
 * DB(`email_sent_at`)에 저장하고, 그다음 DB 값으로 다시 그린다. 표시는 그 줄의 **ID 열**로 업체를 찾는다 —
 * 줄이 위아래로 밀려도 엉뚱한 업체에 붙지 않는 이유다.
 *
 * 대량 표시는 두 길:
 *  ① `pool` 탭의 "이메일 보냄" 칸을 여러 개 골라 아무 글자나(o) 채운다(시트의 Ctrl+Enter).
 *  ② `발송기록` 탭 A열에 보낸 이메일 주소를 통째로 붙여넣는다 → 다음 동기화가 그 이메일의 업체를 전부 표시하고 목록을 비운다.
 *
 * ⚠️ **한 방향이다** — 표시를 지워도 DB 에서 지우지 않는다(다음 동기화가 날짜를 다시 그린다). 실수로 열을 통째로 지워도
 *    발송 기록이 날아가지 않게 하려는 것이다. 되돌리기는 어드민에서.
 */
import type { Env } from '@/worker/types/env'
import { sheetsFetch } from './sheets-sync'
import { runDdlOnce } from './ads-schema-guard'

export const LIST_TAB = '발송기록'
/** 한 회차에 `발송기록` 에서 처리할 최대 이메일 수 — 넘으면 남은 것은 탭에 남겨 다음 회차가 잇는다. */
const LIST_MAX_PER_RUN = 10_000
const LIST_CHUNK = 2_000

/**
 * `email_sent_at` 컬럼 + 이메일 부분 인덱스. 인덱스는 `발송기록` 매칭이 전수 스캔(업체 56만 행)이 되지 않게 —
 * 이메일 있는 행만 담는 부분 인덱스라 작다. 체크섬 1회 적용(`runDdlOnce`) — 이미 됐으면 조회 1번.
 */
export const MARK_DDL: string[] = [
  'ALTER TABLE ad_company_leads ADD COLUMN email_sent_at DATETIME',
  'ALTER TABLE store_prospects ADD COLUMN email_sent_at DATETIME',
  "CREATE INDEX IF NOT EXISTS idx_company_email_mark ON ad_company_leads(email) WHERE email IS NOT NULL AND email != ''",
  "CREATE INDEX IF NOT EXISTS idx_prospects_email_mark ON store_prospects(email) WHERE email IS NOT NULL AND email != ''",
]
const _done = new WeakSet<object>()
export async function ensureMarkSchema(DB: D1Database): Promise<number> {
  if (_done.has(DB)) return 0
  _done.add(DB)
  const { ran } = await runDdlOnce(DB, 'ads_ddl_pool_sheet_marks', MARK_DDL)
  return 1 + (ran ? MARK_DDL.length + 2 : 0)
}

/** 표시 저장 SQL — 처음 표시된 행만(이미 날짜가 있으면 그대로). 새 리드면 상태를 '연락함'으로 올린다. */
export function markSql(table: string, matchCol: 'id' | 'email'): string {
  const contacted = table === 'ad_company_leads' ? ", contacted_at = COALESCE(contacted_at, datetime('now'))" : ''
  const match = matchCol === 'id' ? 'id IN (SELECT value FROM json_each(?))' : "email IN (SELECT value FROM json_each(?)) AND email IS NOT NULL AND email != ''"
  return `UPDATE ${table} SET email_sent_at = datetime('now'), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END${contacted}
    WHERE ${match} AND email_sent_at IS NULL`
}

/** 시트 두 열(ID · 표시)을 줄 맞춰 받아 → 표시가 있는 줄의 ID 목록. 숫자가 아닌 ID(헤더 등)는 버린다. */
export function idsWithMark(idCol: unknown[][] | undefined, markCol: unknown[][] | undefined): number[] {
  const out: number[] = []
  const n = Math.max(idCol?.length || 0, markCol?.length || 0)
  for (let i = 0; i < n; i++) {
    const mark = String(markCol?.[i]?.[0] ?? '').trim()
    if (!mark) continue
    const id = Number(idCol?.[i]?.[0])
    if (Number.isInteger(id) && id > 0) out.push(id)
  }
  return out
}

/** 붙여넣은 이메일 목록 정규화 — 앞뒤 공백·꺾쇠·mailto 제거, 모양 검사, 중복 제거. 대소문자 두 벌을 같이 넘긴다(저장 형태를 모른다). */
export function normalizeEmailList(rows: unknown[][] | undefined): string[] {
  const set = new Set<string>()
  for (const r of rows || []) {
    for (const part of String(r?.[0] ?? '').split(/[\s,;]+/)) {
      const e = part.trim().replace(/^mailto:/i, '').replace(/^<|>$/g, '')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) continue
      set.add(e)
      set.add(e.toLowerCase())
    }
  }
  return [...set]
}

async function batchGet(token: string, sheetId: string, ranges: string[]): Promise<unknown[][][] | null> {
  const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
  const r = await sheetsFetch(token, sheetId, `/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`).catch(() => null)
  if (!r?.ok) return null
  const j = await r.json().catch(() => null) as { valueRanges?: { values?: unknown[][] }[] } | null
  return (j?.valueRanges || []).map(v => v.values || [])
}

/**
 * 덮어쓰기 직전, 그 구간(`fromRow`부터 `count`줄 — count 0 이면 끝까지)의 표시를 읽어 DB 에 저장.
 * @returns 새로 표시된 행 수(이미 날짜가 있던 행은 안 센다). 읽기 실패는 0 — 표시를 잃는 대신 이번 회차만 건너뛴다.
 */
export async function harvestMarks(
  DB: D1Database, token: string, sheetId: string, table: string, tab: string,
  markLetter: string, fromRow: number, count: number, cost: { subreq: number },
): Promise<number> {
  const end = count > 0 ? String(fromRow + count - 1) : ''
  cost.subreq += 1
  const got = await batchGet(token, sheetId, [`${tab}!A${fromRow}:A${end}`, `${tab}!${markLetter}${fromRow}:${markLetter}${end}`])
  if (!got) return 0
  const ids = idsWithMark(got[0], got[1])
  if (!ids.length) return 0
  let marked = 0
  for (let i = 0; i < ids.length; i += LIST_CHUNK) {
    cost.subreq += 1
    const r = await DB.prepare(markSql(table, 'id')).bind(JSON.stringify(ids.slice(i, i + LIST_CHUNK))).run().catch(() => null)
    marked += Number(r?.meta?.changes) || 0
  }
  return marked
}

/** `발송기록` 탭이 없으면 만든다(사이클 시작에 한 번). A1 에 안내를 적는다. */
export async function ensureListTab(token: string, sheetId: string, existingTitles: string[], cost: { subreq: number }): Promise<void> {
  if (existingTitles.includes(LIST_TAB)) return
  cost.subreq += 2
  const add = await sheetsFetch(token, sheetId, ':batchUpdate', {
    method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LIST_TAB, gridProperties: { rowCount: 20_000, columnCount: 3 } } } }] }),
  }).catch(() => null)
  if (!add?.ok) return
  await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${LIST_TAB}!A1`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ range: `${LIST_TAB}!A1`, majorDimension: 'ROWS', values: [['보낸 이메일 주소를 A2 부터 붙여넣으세요 (매시간 반영 후 비워집니다)']] }),
  }).catch(() => null)
}

/**
 * `발송기록` 탭의 이메일 목록을 반영하고 비운다. 처리 못 한 나머지는 다시 써 둔다(다음 회차가 잇는다).
 * @returns 새로 표시된 행 수 · 처리한 이메일 수.
 */
export async function applyEmailList(DB: D1Database, token: string, sheetId: string, table: string, cost: { subreq: number }): Promise<{ marked: number; emails: number }> {
  cost.subreq += 1
  const got = await batchGet(token, sheetId, [`${LIST_TAB}!A2:A`])
  const raw = got?.[0] || []
  if (!raw.length) return { marked: 0, emails: 0 }
  const now = raw.slice(0, LIST_MAX_PER_RUN)
  const rest = raw.slice(LIST_MAX_PER_RUN)
  const emails = normalizeEmailList(now)
  let marked = 0
  for (let i = 0; i < emails.length; i += LIST_CHUNK) {
    cost.subreq += 1
    const r = await DB.prepare(markSql(table, 'email')).bind(JSON.stringify(emails.slice(i, i + LIST_CHUNK))).run().catch(() => null)
    if (!r) return { marked, emails: 0 } // DB 실패 — 목록을 비우지 않는다(다음 회차가 다시 한다)
    marked += Number(r.meta?.changes) || 0
  }
  cost.subreq += 2
  await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${LIST_TAB}!A2:A`)}:clear`, { method: 'POST', body: '{}' }).catch(() => null)
  if (rest.length) {
    cost.subreq += 1
    await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${LIST_TAB}!A2`)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range: `${LIST_TAB}!A2`, majorDimension: 'ROWS', values: rest }),
    }).catch(() => null)
  }
  const kst = new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16)
  await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${LIST_TAB}!B1`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ range: `${LIST_TAB}!B1`, majorDimension: 'ROWS', values: [[`마지막 반영 ${kst} (한국시간) · 이메일 ${now.length}줄 → 새로 표시 ${marked}곳${rest.length ? ` · 남은 ${rest.length}줄은 다음 시간에` : ''}`]] }),
  }).catch(() => null)
  return { marked, emails: now.length }
}

/** DB 의 `email_sent_at`(UTC) → 시트에 보일 한국 날짜. 비면 빈칸. */
export function sentDayKST(v: unknown): string {
  const t = String(v ?? '').trim()
  if (!t) return ''
  const d = new Date(t.includes('T') ? t : `${t.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) return t.slice(0, 10)
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}
