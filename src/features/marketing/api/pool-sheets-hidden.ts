/**
 * 🙈 **행 숨기기 = '이메일 보냄'** (2026-11-18 대표 *"이메일 보냄 버튼 하나하나 누르기가 쉽지 않아서 그냥 보낸 DB 행들은
 *    숨기기로 하려고 하는거야 표시 차원에서"*).
 *
 * ## 왜 그냥 두면 안 되나
 * 시트의 행 숨김은 **줄 위치**에 붙는다. 동기화는 매 사이클 id 순으로 위에서부터 다시 쓰므로, 앞 줄 하나만 빠져도 그 아래가
 * 한 칸씩 올라가 **숨김이 다른 업체로 옮겨 간다** — 보낸 곳이 다시 보이고, 안 보낸 곳이 숨는다.
 *
 * ## 그래서 둘을 한다(구간마다, 덮어쓰기 앞뒤로)
 * 1. **거두기**(덮어쓰기 전): 그 구간에서 사람이 숨긴 줄(`hiddenByUser`)의 **ID 열**을 읽어 '이메일 보냄'으로 저장한다.
 *    필터로 가려진 줄(`hiddenByFilter`)은 세지 않는다 — 필터 보기는 보낸 표시가 아니다.
 * 2. **다시 숨기기**(덮어쓴 뒤): 방금 쓴 줄 중 DB 상 '보냄'인 줄만 숨기고 나머지는 편다. 숨김이 **업체를 따라다닌다**.
 *    '이메일 보냄' 칸·발송기록 탭으로 표시한 곳도 이때 같이 숨겨진다.
 *
 * ⚠️ 한 방향이다 — 숨긴 줄을 펴도 '보냄' 기록은 지워지지 않고, 다음 갱신에 다시 숨겨진다(실수로 전부 펴도 기록이 안 날아간다).
 * ⚠️ 그 줄 차례가 와야 거둔다(인플루언서 약 2일 · 업체 약 6시간 한 바퀴). 그때까지 숨김은 사람이 한 자리에 그대로 있다
 *    — 그 사이엔 그 구간을 다시 쓰지 않으므로 밀리지 않는다.
 */
import { sheetsFetch } from './sheets-sync'
import { markSql } from './pool-sheets-marks'

const MARK_CHUNK = 2_000

/** 탭의 숫자 ID(gid) — 숨기기 요청에 필요하다. 없으면 null. */
export async function tabGid(token: string, sheetId: string, tab: string, cost: { subreq: number }): Promise<number | null> {
  cost.subreq += 1
  const r = await sheetsFetch(token, sheetId, '?fields=sheets.properties(sheetId,title)').catch(() => null)
  if (!r?.ok) return null
  const j = await r.json().catch(() => null) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] } | null
  const p = j?.sheets?.find(x => x.properties?.title === tab)?.properties
  return typeof p?.sheetId === 'number' ? p.sheetId : null
}

type GridResp = { sheets?: { data?: { startRow?: number; rowMetadata?: { hiddenByUser?: boolean }[]; rowData?: { values?: { effectiveValue?: { numberValue?: number; stringValue?: string } }[] }[] }[] }[] }

/** 그리드 응답 → 사람이 숨긴 줄의 ID. 순수 함수(시험 대상). */
export function hiddenIds(j: GridResp | null): number[] {
  const out: number[] = []
  for (const d of j?.sheets?.[0]?.data || []) {
    const meta = d.rowMetadata || []
    const rows = d.rowData || []
    for (let i = 0; i < meta.length; i++) {
      if (!meta[i]?.hiddenByUser) continue
      const v = rows[i]?.values?.[0]?.effectiveValue
      const id = Number(v?.numberValue ?? v?.stringValue)
      if (Number.isInteger(id) && id > 0) out.push(id)
    }
  }
  return out
}

/**
 * 덮어쓰기 전: `fromRow`(1-기반)부터 `count` 줄 중 사람이 숨긴 줄을 '이메일 보냄'으로 저장. 반환 = 새로 표시된 행 수.
 * 읽기 실패는 0 — 표시를 잃는 대신 이번 회차만 건너뛴다(다음 바퀴에 다시 본다).
 */
export async function harvestHidden(
  DB: D1Database, token: string, sheetId: string, table: string, tab: string, fromRow: number, count: number, cost: { subreq: number },
): Promise<number> {
  if (!(count > 0)) return 0
  const range = `${tab}!A${fromRow}:A${fromRow + count - 1}`
  cost.subreq += 1
  const r = await sheetsFetch(token, sheetId,
    `?ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent('sheets(data(startRow,rowMetadata(hiddenByUser),rowData(values(effectiveValue))))')}`).catch(() => null)
  if (!r?.ok) return 0
  const ids = hiddenIds(await r.json().catch(() => null) as GridResp | null)
  let marked = 0
  for (let i = 0; i < ids.length; i += MARK_CHUNK) {
    cost.subreq += 1
    const res = await DB.prepare(markSql(table, 'id')).bind(JSON.stringify(ids.slice(i, i + MARK_CHUNK))).run().catch(() => null)
    marked += Number(res?.meta?.changes) || 0
  }
  return marked
}

/** 숨김 요청 — 구간 전체를 편 뒤, '보냄'인 연속 줄 묶음마다 숨긴다. 순수 함수(시험 대상). `fromRow` 는 1-기반. */
export function hideRequests(gid: number, fromRow: number, sent: readonly boolean[]): unknown[] {
  if (!sent.length) return []
  const start = fromRow - 1 // API 는 0-기반
  const prop = (s: number, e: number, hidden: boolean) => ({ updateDimensionProperties: {
    range: { sheetId: gid, dimension: 'ROWS', startIndex: s, endIndex: e }, properties: { hiddenByUser: hidden }, fields: 'hiddenByUser',
  } })
  const reqs: unknown[] = [prop(start, start + sent.length, false)]
  for (let i = 0; i < sent.length; i++) {
    if (!sent[i]) continue
    let j = i
    while (j + 1 < sent.length && sent[j + 1]) j++
    reqs.push(prop(start + i, start + j + 1, true))
    i = j
  }
  return reqs
}

/** 덮어쓴 뒤: 방금 쓴 줄을 DB 상태대로 숨기고 편다. 실패는 조용히(다음 바퀴가 다시 맞춘다). */
export async function applyHidden(token: string, sheetId: string, gid: number | null, fromRow: number, sent: readonly boolean[], cost: { subreq: number }): Promise<void> {
  if (gid == null || !sent.length) return
  cost.subreq += 1
  await sheetsFetch(token, sheetId, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: hideRequests(gid, fromRow, sent) }) }).catch(() => null)
}
