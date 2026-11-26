/**
 * 🏢 근무 기록 → 팀 상태. 순수 함수(시험 대상).
 *   started 뒤 90분 안에 done/failed 가 없으면 "일하는 중", 90분이 넘으면 "응답 없음"(루틴이 죽었을 수 있다).
 *   기록이 없는 팀은 "부르면 출근" — 실패로 위장하지 않는다.
 */
import { parseUTCDate } from '@/utils/date'

export interface ActivityRow {
  id: number
  team: string
  routine: string | null
  state: 'started' | 'done' | 'failed'
  summary: string | null
  grade: string | null
  session_url: string | null
  created_at: string
}

export type TeamState = 'working' | 'stuck' | 'failed' | 'done' | 'oncall'

export interface TeamStatus {
  state: TeamState
  last: ActivityRow | null
  lastDone: ActivityRow | null
}

export const WORKING_WINDOW_MS = 90 * 60 * 1000

export function deriveTeamStatus(rows: ActivityRow[], team: string, now = Date.now()): TeamStatus {
  const mine = rows.filter(r => r.team === team).sort((a, b) => b.id - a.id)
  const last = mine[0] ?? null
  const lastDone = mine.find(r => r.state !== 'started') ?? null
  if (!last) return { state: 'oncall', last: null, lastDone: null }
  if (last.state === 'started') {
    const age = now - parseUTCDate(last.created_at).getTime()
    return { state: age <= WORKING_WINDOW_MS ? 'working' : 'stuck', last, lastDone }
  }
  return { state: last.state === 'failed' ? 'failed' : 'done', last, lastDone }
}

export const STATE_LABEL: Record<TeamState, string> = {
  working: '일하는 중', stuck: '응답 없음', failed: '최근 실패', done: '대기', oncall: '부르면 출근',
}
