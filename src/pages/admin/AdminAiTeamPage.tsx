/**
 * 🏢 2026-11-26 (대표 "유어딜 어드민 대시보드에 한 페이지에서 볼 수 있으면 좋겠는데?"):
 *   AI 팀 본사 — 12역할을 층별 조직도로 그리고, 각 팀 루틴이 남긴 근무 기록(/api/admin/ai-team/activity)으로
 *   책상 불빛을 켠다. 30초마다 새로 읽고, 탭이 가려지면 쉰다.
 *   조직도·역할 설명은 레포 파일(빌드 인라인), 근무 상태는 D1. 기록이 없는 팀은 "부르면 출근".
 */
import { useEffect, useMemo, useState } from 'react'
import { Building2, ExternalLink } from 'lucide-react'
import api from '@/lib/api'
import { formatKSTShort, relativeFromNow } from '@/utils/date'
import { AGENT_RAW, FLOORS, TEAMS, agentDescription, type TeamInfo } from './ai-team/teams'
import { deriveTeamStatus, STATE_LABEL, type ActivityRow, type TeamState, type TeamStatus } from './ai-team/derive'

const LAMP: Record<TeamState, string> = {
  working: 'bg-tone-ok animate-pulse', stuck: 'bg-tone-warn', failed: 'bg-tone-bad', done: 'bg-brand', oncall: 'bg-gray-300',
}
const CHIP: Record<TeamState, string> = {
  working: 'bg-tone-ok-bg text-tone-ok', stuck: 'bg-tone-warn-bg text-tone-warn', failed: 'bg-tone-bad-bg text-tone-bad',
  done: 'bg-gray-100 text-gray-600', oncall: 'bg-gray-100 text-gray-500',
}
const REFRESH_MS = 30_000

function Desk({ t, s }: { t: TeamInfo; s: TeamStatus }) {
  const desc = agentDescription(AGENT_RAW[t.key])
  const shown = s.state === 'working' || s.state === 'stuck' ? s.last : s.lastDone
  return (
    <article className="rounded-xl bg-white p-3 flex flex-col gap-2 min-w-0" title={desc}>
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0 w-10 h-10 rounded-full bg-brand/10 text-brand grid place-items-center text-[14px] font-bold">
          {t.initial}
          <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-white ${LAMP[s.state]}`} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{t.name}</h3>
          <p className="text-[12px] text-gray-400">{t.key}</p>
        </div>
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
      <ul className="mt-auto pt-2 border-t border-gray-100 text-[12px] text-gray-400 space-y-0.5">
        {t.schedule.length ? t.schedule.map(x => <li key={x}>{x}</li>) : <li>요청 시</li>}
      </ul>
    </article>
  )
}

export default function AdminAiTeamPage() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [error, setError] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState === 'hidden') return
      api.get('/api/admin/ai-team/activity?limit=200')
        .then(res => { if (alive && res.data?.success) { setRows(res.data.items as ActivityRow[]); setError(false) } })
        .catch(() => { if (alive) setError(true) })
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h1 className="text-xl font-bold text-gray-900">AI 팀 본사</h1>
        </div>
        <p className="text-[13px] text-gray-500">
          대표 1 · 비서실장 1 · 4본부 · 품질·보안실, 팀 12. 지금 일하는 중 <b className="text-gray-900">{working}</b> · 실패·응답 없음 <b className="text-gray-900">{trouble}</b>.
          팀이 일을 시작하고 끝낼 때마다 기록이 남고, 이 화면은 30초마다 새로 읽습니다.
        </p>
        {error && <p className="mt-2 text-[13px] text-tone-bad">근무 기록을 불러오지 못했습니다. 조직도는 그대로 보입니다.</p>}
      </div>

      <section className="rounded-xl bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-900 text-white grid place-items-center text-[14px] font-bold">대</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-gray-900">6F 대표실</h2>
          <p className="text-[13px] text-gray-600">방향·가격·대외 약속을 정하고 현장 영업(전화·방문)을 합니다.</p>
        </div>
        <a href="/admin/decisions" className="text-[13px] font-semibold text-brand">결재함 열기</a>
      </section>

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
                return t ? <Desk key={k} t={t} s={status[k]} /> : null
              })}
            </div>
          </section>
        ))}
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
  )
}
