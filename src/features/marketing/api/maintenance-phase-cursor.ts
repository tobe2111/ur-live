/**
 * 🔁 **정비 단계 회전 — 시각이 아니라 커서로** (2026-08-02).
 *
 * ## 왜 바꾸나
 * 지금 회전은 `MAINT_SCHEDULE[hourUTC % 12]` 다. 즉 **한 단계는 하루 2~4회**뿐이고, 그 회차가 죽으면
 * 다음 기회는 6~12시간 뒤다. 라이브에서 그 대가가 그대로 나왔다:
 *
 * ```
 *   KST 21:00  merge      CPU 한도로 사망(기록됨)
 *   KST 22:00  reextract  디스패치됐는데 성공·실패 어느 기록도 없음
 *   ads_reextract_cursor  아침 10:00 이후 13시간째 제자리 · region_pending 32,761 불변
 * ```
 *
 * 알람 레인(`worker-ads/lane-alarm.ts`)은 **자기 인보케이션**으로 시간당 12회 깨어난다. 그런데 단계가
 * `hourUTC` 에 묶여 있으면 **한 시간 안의 12회차가 전부 같은 단계**를 돌아 아무 의미가 없다.
 * ⇒ 회전축을 시각에서 **커서**로 옮긴다. 배정표(`MAINT_SCHEDULE`)의 가중치는 그대로 쓴다 —
 *   슬롯 수가 곧 빈도라는 계약이 커서 회전에서도 동일하게 성립한다(순서대로 한 바퀴 = 슬롯 비율).
 *
 * ## 🅿️ 커서는 **집기 전에** 전진시킨다
 * 단계가 죽어도 커서는 이미 넘어가 있어야 한다. 안 그러면 무거운 단계 하나가 죽을 때마다 **같은 자리를
 * 무한 재시도**하며 뒤 단계를 영원히 굶긴다 — 이 레포가 재추출 커서에서 이미 겪은 실패 양식이다
 * (`REEXTRACT_RULES_VERSION` 도장 방식이 그 수습이었다).
 *
 * ⚠️ 이 모듈이 **하지 않는 것**: 리스 획득·실행. 그건 `runMaintenancePhase` 가 한다(단일화 계약 불변).
 *   여기는 "다음에 무엇을 할 차례인가"만 정한다 — 순수함수로 갈라야 유닛이 붙는다.
 */

/** 커서 저장 키. 값 = `"{version}:{index}"` — 배정표가 바뀌면 처음부터 한 바퀴 돈다. */
export const MAINT_PHASE_CURSOR_KEY = 'ads_maint_phase_cursor'

/**
 * 배정표 판(version). **`MAINT_SCHEDULE` 을 바꾸면 반드시 +1** 한다.
 * 안 올리면 옛 인덱스가 새 배정표에 그대로 적용돼 **엉뚱한 단계가 엉뚱한 빈도로** 돈다
 * (인덱스는 같은데 가리키는 단계가 달라지므로 — 조용히 틀리는 종류의 오류다).
 */
export const MAINT_SCHEDULE_VERSION = 1

/** `"v:i"` 파싱 — 판이 다르거나 깨졌으면 0(처음부터). 재추출 커서와 같은 계약. */
export function parsePhaseCursor(raw: string | null | undefined, version: number): number {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const i = s.indexOf(':')
  if (i < 0) return 0 // 판 없는 옛 값 — 처음부터
  const v = parseInt(s.slice(0, i), 10)
  const c = parseInt(s.slice(i + 1), 10)
  if (!Number.isFinite(v) || v !== version) return 0
  return Number.isFinite(c) && c >= 0 ? c : 0
}

export const formatPhaseCursor = (version: number, cursor: number): string =>
  `${version}:${Math.max(0, Math.floor(Number.isFinite(cursor) ? cursor : 0))}`

/** 이번 차례의 슬롯 인덱스와 **다음에 저장할 커서**. 집기 전에 전진시키는 것이 핵심이다. */
export function nextPhaseSlot(cursor: number, scheduleLength: number): { index: number; nextCursor: number } {
  const len = Math.max(1, Math.floor(scheduleLength))
  const c = Number.isFinite(cursor) && cursor >= 0 ? Math.floor(cursor) : 0
  const index = c % len
  return { index, nextCursor: (index + 1) % len }
}
