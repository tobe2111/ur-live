/**
 * 🏢 팀 책상 하나 — 불빛(상태) · 일하는 중이면 타이핑 점과 말풍선 · 일감 더미 · 방금 끝낸 보고서가 올라가는 표시.
 *   움직임은 tailwind 기본 animate-* 만 쓰고 전부 motion-safe: 로 감싼다(움직임 줄이기 설정 존중).
 */
import { FileText, Send } from 'lucide-react'
import { relativeFromNow, parseUTCDate, formatKSTShort } from '@/utils/date'
import { scheduleLines, type TeamInfo } from './teams'
import { STATE_LABEL, type ActivityRow, type TeamState, type TeamStatus } from './derive'

export interface AiTeamTask {
  id: string
  team: string
  title: string
  count: number
  severity: 'high' | 'mid' | 'low'
  detail: string | null
  link: string | null
}

const LAMP: Record<TeamState, string> = {
  working: 'bg-tone-ok motion-safe:animate-pulse', stuck: 'bg-tone-warn', failed: 'bg-tone-bad', done: 'bg-brand', oncall: 'bg-gray-300',
}
const CHIP: Record<TeamState, string> = {
  working: 'bg-tone-ok-bg text-tone-ok', stuck: 'bg-tone-warn-bg text-tone-warn', failed: 'bg-tone-bad-bg text-tone-bad',
  done: 'bg-gray-100 text-gray-600', oncall: 'bg-gray-100 text-gray-500',
}
export const SEV_DOT: Record<AiTeamTask['severity'], string> = { high: 'bg-tone-bad', mid: 'bg-tone-warn', low: 'bg-gray-300' }

const JUST_DONE_MS = 3 * 60 * 1000

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3" aria-hidden>
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1 h-1 rounded-full bg-tone-ok motion-safe:animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  )
}

function Pile({ n }: { n: number }) {
  const sheets = Math.min(n, 4)
  return (
    <span className="relative inline-block w-6 h-6 shrink-0" aria-label={`일감 ${n}건`}>
      {Array.from({ length: sheets }).map((_, i) => (
        <span key={i} className="absolute left-0 w-5 h-3.5 rounded-sm bg-white border border-gray-300"
          style={{ bottom: `${i * 3}px`, transform: `rotate(${i % 2 ? -4 : 3}deg)` }} />
      ))}
      <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-tone-bad text-white text-[12px] leading-4 font-bold text-center">{n}</span>
    </span>
  )
}

/** 🔗 history — 이 팀의 최근 근무 기록(끝난 것). 사무실에서 사람을 누르면 "무슨 일을 했고 결과가 어디 있나"가 여기 뜬다
 *  (2026-11-26 대표 "진짜 일을 해서 움직이는거 맞아?" → 움직임마다 실제 결과로 이어지게). */
export default function Desk({ t, s, tasks, history }: { t: TeamInfo; s: TeamStatus; tasks: AiTeamTask[]; history?: ActivityRow[] }) {
  const recent = (history ?? []).filter(r => r.team === t.key && r.state !== 'started').slice(0, 3)
  const shown = s.state === 'working' || s.state === 'stuck' ? s.last : s.lastDone
  const justDone = s.state === 'done' && s.last && Date.now() - parseUTCDate(s.last.created_at).getTime() < JUST_DONE_MS
  return (
    <article className="relative rounded-xl bg-white p-3 flex flex-col gap-2 min-w-0">
      {s.state === 'working' && s.last?.routine && (
        <div className="absolute -top-3 left-12 max-w-[75%] px-2 py-0.5 rounded-lg bg-gray-900 text-white text-[12px] truncate">
          {s.last.routine} 하는 중
        </div>
      )}
      {justDone && (
        <span className="absolute right-3 top-3 text-brand motion-safe:animate-bounce" title="방금 보고서를 올렸습니다">
          <Send className="w-4 h-4" />
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <div className={`relative shrink-0 w-10 h-10 rounded-full bg-brand/10 text-brand grid place-items-center text-[14px] font-bold ${s.state === 'working' ? 'ring-2 ring-tone-ok' : ''}`}>
          {t.initial}
          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${LAMP[s.state]}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
            {t.name}{s.state === 'working' && <TypingDots />}
          </h3>
          <p className="text-[12px] text-gray-400">{t.key}</p>
        </div>
        {tasks.length > 0 && <Pile n={tasks.length} />}
      </div>
      <p className="text-[13px] text-gray-600">{t.job}</p>
      <span className={`self-start px-2 py-0.5 rounded-full text-[12px] font-semibold ${CHIP[s.state]}`}>
        {STATE_LABEL[s.state]}{s.last && s.state !== 'oncall' ? ` · ${relativeFromNow(s.last.created_at)}` : ''}
      </span>
      {shown?.summary && (
        <p className="text-[12px] text-gray-600 leading-snug">
          {shown.grade && <span className="font-mono text-gray-400 mr-1">[{shown.grade}]</span>}{shown.summary}
        </p>
      )}
      {tasks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {tasks.slice(0, 2).map(k => (
            <li key={k.id} className="flex items-start gap-1.5 text-[12px] text-gray-700">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[k.severity]}`} />
              {k.link ? <a href={k.link} className="hover:text-brand">{k.title}</a> : <span>{k.title}</span>}
            </li>
          ))}
          {tasks.length > 2 && <li className="text-[12px] text-gray-400 pl-3">외 {tasks.length - 2}건</li>}
        </ul>
      )}
      {recent.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[12px] font-semibold text-gray-500 mb-1">최근 한 일</p>
          <ul className="flex flex-col gap-1.5">
            {recent.map(r => (
              <li key={r.id} className="text-[12px] leading-snug">
                <span className="font-mono text-gray-400 mr-1.5">{formatKSTShort(r.created_at)}</span>
                <span className={r.state === 'failed' ? 'text-tone-bad' : 'text-gray-700'}>{r.grade ? `[${r.grade}] ` : ''}{r.summary ?? r.routine ?? ''}</span>
                {r.session_url && <a href={r.session_url} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-brand whitespace-nowrap">작업 화면</a>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="mt-auto pt-2 border-t border-gray-100 text-[12px] text-gray-400 space-y-0.5">
        {scheduleLines(t).length ? scheduleLines(t).map(x => <li key={x} className="flex items-center gap-1"><FileText className="w-3 h-3" />{x}</li>) : <li>요청 시</li>}
      </ul>
    </article>
  )
}
