/**
 * 🏢 2026-11-26 (대표 "유어딜 어드민 대시보드에 한 페이지에서 볼 수 있으면 좋겠는데?"):
 *   AI 팀 본사 — 12역할을 층별 조직도로 그리고, 각 팀 루틴이 남긴 근무 기록(/api/admin/ai-team/activity)으로
 *   책상 불빛을 켠다. 30초마다 새로 읽고, 탭이 가려지면 쉰다.
 *   조직도는 `./ai-team/teams.ts`, 근무 상태는 D1. 기록이 없는 팀은 "부르면 출근".
 *   2026-11-26 추가(대표 "실제로 자동으로 할 일들을 찾아서"): 규칙이 찾은 일감(/api/admin/ai-team/tasks)을
 *   담당 팀 책상에 더미로 쌓고, 아래 "일감 게시판"에 전부 보인다. 팀 루틴·당번이 이 목록을 보고 일한다.
 *   2026-11-26 추가(대표 "메타버스처럼 직원들이 움직이고"): 기본 보기는 사무실(`./ai-team/OfficeView`) — 같은 상태로 사람이 걷는다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { formatKSTShort, formatKSTDate, parseUTCDate, relativeFromNow } from '@/utils/date'
import { FLOORS, TEAMS } from './ai-team/teams'
import { deriveTeamStatus, type ActivityRow, type TeamStatus } from './ai-team/derive'
import Desk, { SEV_DOT, type AiTeamTask } from './ai-team/Desk'
import OfficeView, { type SessionRow } from './ai-team/OfficeView'
import NowPanel from './ai-team/NowPanel'

const REFRESH_MS = 30_000

export default function AdminAiTeamPage() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [tasks, setTasks] = useState<AiTeamTask[] | null>(null)
  const [taskErrors, setTaskErrors] = useState<string[]>([])
  const [error, setError] = useState(false)
  const [, setTick] = useState(0)
  const [view, setView] = useState<'office' | 'org'>('office')
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState === 'hidden') return
      api.get('/api/admin/ai-team/activity?limit=200')
        .then(res => { if (alive && res.data?.success) { setRows(res.data.items as ActivityRow[]); setError(false) } })
        .catch(() => { if (alive) setError(true) })
      api.get('/api/admin/ai-team/sessions?hours=48')
        .then(res => { if (alive && res.data?.success) setSessions(res.data.items as SessionRow[]) })
        .catch(() => { if (alive) setSessions([]) })
      api.get('/api/admin/ai-team/tasks')
        .then(res => { if (alive && res.data?.success) { setTasks(res.data.tasks as AiTeamTask[]); setTaskErrors(res.data.errors ?? []) } })
        .catch(() => { if (alive) setTaskErrors(['all']) })
      setTick(n => n + 1)
    }
    load()
    const id = window.setInterval(load, REFRESH_MS)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; window.clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])

  const status = useMemo(() => {
    const map: Record<string, TeamStatus> = {}
    for (const t of TEAMS) map[t.key] = deriveTeamStatus(rows ?? [], t.key)
    return map
  }, [rows])
  const working = TEAMS.filter(t => status[t.key].state === 'working').length
  const trouble = TEAMS.filter(t => ['failed', 'stuck'].includes(status[t.key].state)).length
  const teamName = (k: string) => TEAMS.find(t => t.key === k)?.name ?? k
  const tasksOf = (k: string) => (tasks ?? []).filter(x => x.team === k)
  const today = formatKSTDate(new Date().toISOString())
  const doneToday = (rows ?? []).filter(r => r.state === 'done' && formatKSTDate(r.created_at) === today).length
  const urgent = (tasks ?? []).filter(x => x.severity === 'high').length

  const stats: { label: string; value: number | string; alert?: boolean }[] = [
    { label: '지금 일하는 팀', value: working },
    { label: '남은 일감', value: tasks ? tasks.length : '—' },
    { label: '급한 일감', value: tasks ? urgent : '—', alert: urgent > 0 },
    { label: '오늘 끝낸 일', value: rows ? doneToday : '—' },
    { label: '실패·응답 없음', value: trouble, alert: trouble > 0 },
  ]
  const liveSessions = (sessions ?? []).filter(x => x.state === 'working' || Date.now() - parseUTCDate(x.updated_at).getTime() < 3600_000)

  return (
    <AdminLayout title="AI 팀 본사">
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900">AI 팀 본사</h1>
          </div>
          <p className="text-[13px] text-gray-500">팀 12개가 일을 시작하고 끝낼 때마다 기록이 남고, 서버가 찾은 일감이 담당 팀 책상에 쌓입니다. 30초마다 새로 읽습니다.</p>
        </div>
        <a href="/admin/decisions" className="shrink-0 ur-btn ur-btn-md ur-btn-primary">결재함 열기</a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {stats.map(x => (
          <div key={x.label} className={`rounded-xl p-3 ${x.alert ? 'bg-tone-bad-bg' : 'bg-white'}`}>
            <div className={`text-[12px] ${x.alert ? 'text-tone-bad' : 'text-gray-500'}`}>{x.label}</div>
            <div className={`mt-0.5 text-[24px] font-bold tabular-nums leading-tight ${x.alert ? 'text-tone-bad' : 'text-gray-900'}`}>{x.value}</div>
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-tone-bad">근무 기록을 불러오지 못했습니다. 조직도는 그대로 보입니다.</p>}

      <div className="flex gap-1 self-start rounded-lg bg-white p-1 text-[13px] font-semibold">
        {([['office', '사무실'], ['org', '조직도']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            className={`px-3 py-1.5 rounded-md ${view === k ? 'bg-brand text-white' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>
        ))}
      </div>

      {view === 'office' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
          <OfficeView sessions={liveSessions} status={status} tasksOf={tasksOf} selected={picked} onSelect={k => setPicked(p => (p === k ? null : k))} />
          <aside className="flex flex-col gap-3 min-w-0">
            {picked && picked !== 'ceo' && (() => {
              const t = TEAMS.find(x => x.key === picked)
              return t ? (
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => setPicked(null)} className="self-start text-[12px] text-gray-500 hover:text-gray-900">← 전체 상황으로</button>
                  <Desk t={t} s={status[picked]} tasks={tasksOf(picked)} history={rows ?? []} />
                </div>
              ) : null
            })()}
            {picked === 'ceo' && (
              <div className="rounded-xl bg-white p-4">
                <button type="button" onClick={() => setPicked(null)} className="text-[12px] text-gray-500 hover:text-gray-900">← 전체 상황으로</button>
                <h3 className="mt-2 text-[15px] font-semibold text-gray-900">6F 대표실</h3>
                <p className="mt-1 text-[13px] text-gray-600">방향·가격·대외 약속을 정하고 현장 영업(전화·방문)을 합니다.</p>
                <a href="/admin/decisions" className="mt-2 inline-block text-[13px] font-semibold text-brand">결재함 열기</a>
              </div>
            )}
            {!picked && <NowPanel status={status} tasksOf={tasksOf} sessions={liveSessions} onPick={setPicked} />}
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-[var(--dash-radius,16px)] bg-gray-200 p-1.5">
          {FLOORS.map(f => (
            <section key={f.no} className="grid grid-cols-1 sm:grid-cols-[88px_minmax(0,1fr)] rounded-xl bg-gray-50">
              <div className="px-3 py-2 sm:py-3 flex sm:flex-col gap-2 sm:gap-0.5 items-baseline border-b sm:border-b-0 sm:border-r border-dashed border-gray-200">
                <span className="font-mono text-[20px] text-brand">{f.no}</span>
                <span className="text-[12px] font-semibold text-gray-600 break-keep">{f.name}</span>
              </div>
              <div className="grid gap-2.5 p-3 grid-cols-[repeat(auto-fill,minmax(210px,1fr))] min-w-0">
                {f.teams.map(k => {
                  const t = TEAMS.find(x => x.key === k)
                  return t ? <Desk key={k} t={t} s={status[k]} tasks={tasksOf(k)} history={rows ?? []} /> : null
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2 items-start">
      <section className="rounded-xl bg-white p-4">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">열린 작업실 (Claude 세션)</h2>
        <p className="text-[12px] text-gray-400 mb-2">이 레포에서 열린 세션은 새로 만들어도 자동으로 여기 붙습니다(시작·질문·턴 끝마다 보고). 최근 48시간.</p>
        {!sessions ? <p className="text-[13px] text-gray-400">불러오는 중</p>
          : sessions.length === 0 ? <p className="text-[13px] text-gray-400">아직 보고한 세션이 없습니다. 다음에 열리는 세션부터 붙습니다.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {sessions.slice(0, 20).map(x => (
                <li key={x.session_id} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
                  <span className={`w-2 h-2 rounded-full shrink-0 self-center ${x.state === 'working' ? 'bg-tone-ok' : 'bg-gray-300'}`} />
                  <span className="font-semibold text-gray-900 min-w-0 flex-1">{x.title ?? '제목 없는 작업'}</span>
                  <span className="text-gray-400 font-mono text-[12px]">{x.branch ?? ''}</span>
                  <span className="text-gray-500 w-20 shrink-0 text-right">{x.state === 'working' ? '일하는 중' : relativeFromNow(x.updated_at)}</span>
                  {x.last_summary && <span className="basis-full pl-5 text-[12px] text-gray-500">{x.last_summary}</span>}
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="rounded-xl bg-white p-4">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-1">일감 게시판</h2>
        <p className="text-[12px] text-gray-400 mb-2">규칙이 찾은 일입니다(AI 를 쓰지 않는 집계). 해결되면 저절로 사라집니다.{taskErrors.length > 0 && <span className="text-tone-bad"> 확인 못 한 규칙: {taskErrors.join(', ')}</span>}</p>
        {!tasks ? <p className="text-[13px] text-gray-400">불러오는 중</p>
          : tasks.length === 0 ? <p className="text-[13px] text-gray-400">지금 쌓인 일감이 없습니다.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {tasks.map(k => (
                <li key={k.id} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[13px]">
                  <span className={`w-2 h-2 rounded-full shrink-0 self-center ${SEV_DOT[k.severity]}`} />
                  <span className="font-semibold text-gray-900 w-20 shrink-0">{teamName(k.team)}</span>
                  {k.link ? <a href={k.link} className="text-gray-900 hover:text-brand">{k.title}</a> : <span className="text-gray-900">{k.title}</span>}
                  {k.detail && <span className="text-gray-500 min-w-0 flex-1">{k.detail}</span>}
                </li>
              ))}
            </ul>
          )}
      </section>

      </div>

      <section className="rounded-xl bg-white p-4">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-2">최근 근무 기록</h2>
        {!rows ? <p className="text-[13px] text-gray-400">불러오는 중</p>
          : rows.length === 0 ? <p className="text-[13px] text-gray-400">아직 기록이 없습니다. 팀 루틴이 다음에 돌 때부터 쌓입니다.</p>
          : (
            <ul className="divide-y divide-gray-100">
              {rows.slice(0, 30).map(r => (
                <li key={r.id} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px]">
                  <span className="font-mono text-gray-400 w-24 shrink-0">{formatKSTShort(r.created_at)}</span>
                  <span className="font-semibold text-gray-900 w-20 shrink-0">{teamName(r.team)}</span>
                  <span className={r.state === 'failed' ? 'text-tone-bad' : 'text-gray-500'}>{r.state === 'started' ? '시작' : r.state === 'done' ? '끝' : '실패'}</span>
                  <span className="text-gray-700 min-w-0 flex-1">{r.grade ? `[${r.grade}] ` : ''}{r.summary ?? r.routine ?? ''}</span>
                  {r.session_url && (
                    <a href={r.session_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand">
                      <ExternalLink className="w-3 h-3" /> 작업 화면
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
    </AdminLayout>
  )
}
