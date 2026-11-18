/**
 * 📌 **시트 안내 탭** (2026-11-18 대표 *"어떤 식으로 시트를 만지면 되는지 안내 사항을 시트들에 넣어줄 수 있어?
 *    나는 이메일을 보낸 업체들의 행들을 가리려고 하는데."*).
 *
 * 세 시트(인플루언서 · 파트너 · 매장후보) 맨 앞에 `안내` 탭을 만들어 사용법을 적는다. 시트에 손을 대는 사람이 시트 안에서
 * 바로 읽게 — 채팅으로 들은 설명은 남지 않는다.
 *
 * - **버전 표식으로 한 번만 쓴다** — 시트마다 `ads_sheet_guide_v:<시트ID>` 에 쓴 버전을 남기고, 버전이 같으면 설정 1줄
 *   읽기로 끝난다. 문구를 바꾸면 `GUIDE_VERSION` 을 올린다 → 세 시트가 다음 갱신에 새 안내로 바뀐다.
 * - 탭이 없을 때만 만든다(맨 앞). 사람이 지운 탭은 다음 버전에서 다시 생긴다.
 * - 실패해도 미러는 계속 간다(안내는 부가 기능 — 표식을 안 남기므로 다음 회차가 다시 시도한다).
 *
 * ⚠️ 문구의 사실(무엇이 저장되나 · 갱신 주기)은 코드에서 온다 — 시트 동기화 규칙이 바뀌면 여기도 같은 커밋에서 고칠 것.
 *    `influencer-sheet-marks` · `pool-sheets-marks` 시험이 핵심 문구와 코드 규칙을 대조한다.
 */
import { sheetsFetch } from './sheets-sync'

export const GUIDE_TAB = '안내'
/** 문구를 바꾸면 올린다(세 시트가 다음 갱신에 새로 쓴다). */
export const GUIDE_VERSION = 1
export const guideKey = (sheetId: string) => `ads_sheet_guide_v:${sheetId}`

export type GuideKind = 'influencer' | 'company' | 'store'

/** 시트별 안내 문구 — 한 줄 = 한 행(A열). 순수 함수(시험 대상). */
export function guideLines(kind: GuideKind): string[] {
  const who = kind === 'influencer' ? '인플루언서' : kind === 'company' ? '업체' : '매장'
  const cycle = kind === 'influencer'
    ? '인플루언서 시트는 58만 줄이라 한 시간에 1만 2천 줄씩 갱신합니다 — 전체 한 바퀴에 약 2일.'
    : kind === 'company'
      ? '업체 시트는 한 시간에 약 1만 9천 줄씩 갱신합니다 — 전체 한 바퀴에 약 6시간.'
      : '매장 시트는 매시간 전체를 갱신합니다.'
  return [
    `📌 이 시트 사용법 (자동으로 적힌 안내 · v${GUIDE_VERSION})`,
    '',
    '■ 이 시트는 DB 를 매시간 옮겨 적는 "거울"입니다',
    '· pool 탭의 칸을 고쳐도 다음 갱신 때 DB 값으로 되돌아갑니다. 상태·메모 같은 정보는 어드민 화면에서 고쳐 주세요.',
    `· ${cycle}`,
    '',
    '■ 시트에서 저장되는 것은 단 하나 — 맨 오른쪽 "이메일 보냄" 칸',
    `· 메일을 보낸 ${who}의 "이메일 보냄" 칸에 아무 글자(예: o)나 적으세요. 여러 칸을 골라 한 번에 채워도 됩니다(Ctrl+Enter).`,
    '· 다음 갱신 때 DB 에 "보냄"으로 저장되고, 그 칸에 보낸 날짜가 찍힙니다. 상태가 "새 리드"였다면 "연락함"으로 바뀝니다.',
    '· 표시는 그 줄의 ID 로 저장되므로 줄이 위아래로 밀려도 엉뚱한 곳에 붙지 않습니다. 실수로 지워도 DB 기록은 남습니다.',
    '· ⚡ 급하거나 많으면: "발송기록" 탭 A2 부터 보낸 이메일 주소를 붙여넣으세요. 매시간 바로 반영되고 탭은 비워집니다.',
    '   (위 "이메일 보냄" 칸은 그 줄 차례가 와야 저장되므로 늦을 수 있습니다.)',
    '',
    '■ 이메일 보낸 곳 가리기 — "필터 보기"를 쓰세요 (권장)',
    '  ① pool 탭에서 상단 메뉴 [데이터] → [필터 보기] → [새 필터 보기 만들기]',
    '  ② 맨 오른쪽 "이메일 보냄" 열 머리의 필터 아이콘(≡) 클릭',
    '  ③ [조건별 필터링] → [비어 있음] → [확인]',
    '  ④ 이제 이메일 보낸 곳은 숨겨집니다. 새로 "이메일 보냄"을 적으면 그 줄도 숨겨집니다(안 숨겨지면 필터 아이콘을 다시 눌러 확인).',
    '  ⑤ 필터 보기는 나에게만 적용되고 저장됩니다. 다음에는 [데이터] → [필터 보기]에서 만든 것을 고르면 됩니다.',
    '  · 이메일 있는 곳만 보기: 같은 방법으로 "이메일" 열 → [조건별 필터링] → [비어 있지 않음]. 두 조건을 함께 걸어도 됩니다.',
    ...(kind === 'influencer' ? ['  · 국가·카테고리·플랫폼도 같은 방법으로 그 열에 조건을 걸면 됩니다.'] : ['  · 업종·지역도 같은 방법으로 그 열에 조건을 걸면 됩니다.']),
    '',
    '■ 하지 마세요',
    '· 행 숨기기 · 행 색칠 — 숨김·색은 줄 위치에 붙습니다. 갱신 때 줄이 밀리면 다른 곳이 숨겨지거나 칠해집니다. (가리기는 위의 필터 보기로)',
    '· 행·열 삭제, 열 순서 바꾸기, pool 탭 전체 정렬 — 갱신이 어긋납니다. 정렬은 필터 보기 안에서 하세요(나에게만 적용).',
    '· 열 숨기기는 괜찮습니다(열 순서는 고정입니다).',
  ]
}

interface SettingsDb { prepare(sql: string): { bind(...a: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } } }

/**
 * 버전이 바뀌었을 때만 안내 탭을 만들고/다시 쓴다. 반환 = 이번에 썼는가.
 * @param titles 이미 알고 있는 탭 이름(없으면 시트 메타를 한 번 읽는다).
 */
export async function syncGuideTab(DB: SettingsDb, token: string, sheetId: string, kind: GuideKind, cost: { subreq: number }, titles?: string[]): Promise<boolean> {
  cost.subreq += 1
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(guideKey(sheetId)).first<{ value: string }>().catch(() => null)
  if (Number(row?.value) === GUIDE_VERSION) return false
  let names = titles
  if (!names) {
    cost.subreq += 1
    const meta = await sheetsFetch(token, sheetId, '?fields=sheets.properties(title)').catch(() => null)
    if (!meta?.ok) return false
    const j = await meta.json().catch(() => null) as { sheets?: { properties?: { title?: string } }[] } | null
    names = (j?.sheets || []).map(x => String(x.properties?.title || ''))
  }
  if (!names.includes(GUIDE_TAB)) {
    cost.subreq += 1
    const add = await sheetsFetch(token, sheetId, ':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: GUIDE_TAB, index: 0, gridProperties: { rowCount: 80, columnCount: 2 } } } }] }),
    }).catch(() => null)
    if (!add?.ok) return false
  }
  const lines = guideLines(kind)
  // 옛 버전이 더 길었을 수 있다 — 80줄을 채워 쓴다(남은 줄은 빈칸으로 덮인다).
  const values = Array.from({ length: 80 }, (_, i) => [lines[i] ?? ''])
  cost.subreq += 1
  const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${GUIDE_TAB}!A1:A80`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ range: `${GUIDE_TAB}!A1:A80`, majorDimension: 'ROWS', values }),
  }).catch(() => null)
  if (!w?.ok) return false
  cost.subreq += 1
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(guideKey(sheetId), String(GUIDE_VERSION)).run().catch(() => null)
  return true
}
