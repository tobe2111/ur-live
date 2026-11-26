/**
 * 🧭 사무실 옆 "지금 상황" (2026-11-26 대표 "더 UI 적으로 개선할 수 있는건?").
 *   사무실 그림만으로는 "그래서 지금 뭐가 문제냐"가 한눈에 안 들어온다 → 오른쪽에 세 줄로 요약한다:
 *   손이 필요한 팀(실패·응답 없음·일감) · 일하는 팀 · 열린 작업실. 줄을 누르면 그 팀 카드로 바뀐다.
 *   아래에 범례(몸통 색 = 본부, 머리 위 표시 = 상태).
 */
import { TEAMS } from './teams'
import { STATE_LABEL, type TeamStatus } from './derive'
import { SEV_DOT, type AiTeamTask } from './Desk'
import { DEPT_COLOR } from './office-layout'
import type { SessionRow } from './OfficeView'

const DEPTS: [string, string][] = [
  ['ceo-office', '비서실'], ['growth', '성장본부'], ['ops', '운영본부'], ['product', '제품본부'], ['support', '경영지원·품질'],
]

export default function NowPanel({ status, tasksOf, sessions, onPick }: {
  status: Record<string, TeamStatus>
  tasksOf: (k: string) => AiTeamTask[]
  sessions: SessionRow[]
  onPick: (k: string) => void
}) {
  const needHand = TEAMS
    .map(t => ({ t, s: status[t.key], tasks: tasksOf(t.key) }))
    .filter(x => x.s.state === 'failed' || x.s.state === 'stuck' || x.tasks.length > 0)
    .sort((a, b) => rank(b) - rank(a))
  const working = TEAMS.filter(t => status[t.key].state === 'working')
  const liveSessions = sessions.filter(x => x.state === 'working')

  return (
    <div className="rounded-xl bg-white p-4 flex flex-col gap-4">
      <section>
        <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">손이 필요한 팀</h3>
        {needHand.length === 0 ? <p className="text-[13px] text-gray-400">없습니다.</p> : (
          <ul className="flex flex-col">
            {needHand.map(({ t, s, tasks }) => (
              <li key={t.key}>
                <button type="button" onClick={() => onPick(t.key)} className="w-full flex items-center gap-2 py-1.5 text-left text-[13px] hover:text-brand">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${s.state === 'failed' ? 'bg-tone-bad' : s.state === 'stuck' ? 'bg-tone-warn' : SEV_DOT[topSeverity(tasks)]}`} />
                  <span className="font-semibold text-gray-900 shrink-0">{t.name}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-500">
                    {s.state === 'failed' || s.state === 'stuck' ? STATE_LABEL[s.state] : tasks[0]?.title}
                  </span>
                  {tasks.length > 0 && <span className="shrink-0 text-[12px] font-bold text-tone-bad tabular-nums">{tasks.length}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">일하는 팀</h3>
        {working.length === 0 ? <p className="text-[13px] text-gray-400">지금은 없습니다. 정해진 시간과 당번 때 출근합니다.</p> : (
          <ul className="flex flex-col">
            {working.map(t => (
              <li key={t.key}>
                <button type="button" onClick={() => onPick(t.key)} className="w-full flex items-center gap-2 py-1.5 text-left text-[13px] hover:text-brand">
                  <span className="w-2 h-2 rounded-full shrink-0 bg-tone-ok motion-safe:animate-pulse" />
                  <span className="font-semibold text-gray-900 shrink-0">{t.name}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-500">{status[t.key].last?.routine ?? '일하는 중'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-gray-900 mb-1.5">회의실 (열린 Claude 작업실)</h3>
        {liveSessions.length === 0 ? <p className="text-[13px] text-gray-400">지금 일하는 작업실이 없습니다.</p> : (
          <ul className="flex flex-col">
            {liveSessions.slice(0, 6).map(x => (
              <li key={x.session_id} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="w-2 h-2 rounded-full shrink-0 bg-tone-ok" />
                <span className="min-w-0 flex-1 truncate text-gray-700">{x.title ?? '제목 없는 작업'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-3 border-t border-gray-100">
        <h3 className="text-[12px] font-semibold text-gray-500 mb-1.5">보는 법</h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-600">
          {DEPTS.map(([k, label]) => (
            <li key={k} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: DEPT_COLOR[k] }} />{label}</li>
          ))}
        </ul>
        <ul className="mt-2 flex flex-col gap-1 text-[12px] text-gray-600">
          <li>검은 말풍선과 초록 점: 자리에서 일하는 중</li>
          <li>빨간 ! 는 실패, 주황 ? 는 응답 없음</li>
          <li>서류를 들고 걷기: 일을 끝내고 비서실로 보고하러 가는 중</li>
          <li>책상 위 빨간 숫자: 쌓인 일감</li>
        </ul>
      </section>
    </div>
  )
}

function topSeverity(tasks: AiTeamTask[]): AiTeamTask['severity'] {
  return tasks.some(t => t.severity === 'high') ? 'high' : tasks.some(t => t.severity === 'mid') ? 'mid' : 'low'
}

function rank(x: { s: TeamStatus; tasks: AiTeamTask[] }): number {
  if (x.s.state === 'failed') return 100
  if (x.s.state === 'stuck') return 90
  const sev = topSeverity(x.tasks)
  return (sev === 'high' ? 50 : sev === 'mid' ? 30 : 10) + x.tasks.length
}
