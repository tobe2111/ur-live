/**
 * 🏢 AI 팀 사무실 — 메타버스 보기 (2026-11-26 대표 "메타버스처럼 직원들이 움직이고 그런거 있잖아 사무실에서").
 *   위에서 내려다본 사무실 평면에 팀원 12명 + 대표가 있다. 움직임은 **실제 근무 상태**에서 나온다:
 *   - 일하는 중  → 자기 책상에 앉아 타이핑(말풍선에 하는 일)
 *   - 방금 끝냄  → 보고서를 들고 비서실까지 걸어가 놓고 돌아온다(기록 id 당 한 번)
 *   - 실패·응답 없음 → 자리에서 빨간 느낌표 / 주황 물음표
 *   - 그 밖     → 자리에 있다가 가끔 탕비실·회의실에 다녀온다
 *   - 일감      → 책상 위 서류 더미 + 숫자
 *   위치 갱신은 requestAnimationFrame 으로 DOM transform 만 바꾼다(React 재렌더 없음).
 *   움직임 줄이기 설정이면 모두 자리에 앉아 있고 걷지 않는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseUTCDate } from '@/utils/date'
import { TEAMS } from './teams'
import type { TeamStatus } from './derive'
import type { AiTeamTask } from './Desk'
import { ROOMS, VIEW, DEPT_COLOR, TEAM_DEPT, SPOTS, deskOf, route, type Pt } from './office-layout'

const SPEED = 70 // px/초
const JUST_DONE_MS = 10 * 60 * 1000

interface Agent { key: string; x: number; y: number; drawn: string; path: Pt[]; wait: number; carrying: boolean; delivered: Set<number>; moving: boolean; away: boolean; spot: string | null }
const spotKey = (p: Pt) => `${p.x},${p.y}`

const PEOPLE = [{ key: 'ceo', name: '대표', initial: '대' }, ...TEAMS.map(t => ({ key: t.key, name: t.name, initial: t.initial }))]
const CEO_SEAT = { desk: { x: 870, y: 85 }, seat: { x: 870, y: 120 } }
// ⚡ 자리 좌표는 고정이라 한 번만 계산한다(그림을 그릴 때마다 방 목록을 뒤지지 않게).
const SEATS: Record<string, { desk: Pt; seat: Pt } | null> = Object.fromEntries(
  [['ceo', CEO_SEAT], ...TEAMS.map(t => [t.key, deskOf(t.key)])],
)
const seatOf = (k: string) => SEATS[k] ?? null
/** ⚡ 30fps — 걷는 속도(초당 70)에서는 60fps 와 눈으로 구분이 안 되고, 계산은 절반이다. */
const FRAME_MS = 1000 / 30
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function bubbleFor(s: TeamStatus | undefined): { text: string; tone: 'work' | 'bad' | 'warn' } | null {
  if (!s) return null
  if (s.state === 'working') return { text: (s.last?.routine ?? '일하는 중').replace(/^당번:\s*/, '').slice(0, 16), tone: 'work' }
  if (s.state === 'failed') return { text: '!', tone: 'bad' }
  if (s.state === 'stuck') return { text: '?', tone: 'warn' }
  return null
}

export interface SessionRow { session_id: string; title: string | null; branch: string | null; state: 'working' | 'idle'; last_summary: string | null; updated_at: string }

/** 회의실 탁자 둘레 자리 — 지금 열린 작업실(세션)이 여기 앉는다(최대 6). */
const MEETING_SEATS: Pt[] = [{ x: 85, y: 62 }, { x: 130, y: 58 }, { x: 175, y: 62 }, { x: 85, y: 130 }, { x: 130, y: 134 }, { x: 175, y: 130 }]

export default function OfficeView({ status, tasksOf, onSelect, selected, sessions = [] }: {
  sessions?: SessionRow[]
  status: Record<string, TeamStatus>
  tasksOf: (k: string) => AiTeamTask[]
  onSelect: (k: string) => void
  selected: string | null
}) {
  const refs = useRef<Record<string, SVGGElement | null>>({})
  const agents = useRef<Record<string, Agent>>({})
  const statusRef = useRef(status)
  statusRef.current = status
  const [carry, setCarry] = useState<Record<string, boolean>>({})
  const boxRef = useRef<HTMLDivElement | null>(null)
  const reduce = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  // 처음 자리에 앉힌다
  if (Object.keys(agents.current).length === 0) {
    for (const p of PEOPLE) {
      const s = seatOf(p.key)
      if (s) agents.current[p.key] = { key: p.key, x: s.seat.x, y: s.seat.y, drawn: '', path: [], wait: Math.random() * 4, carrying: false, delivered: new Set(), moving: false, away: false, spot: null }
    }
  }

  useEffect(() => {
    if (reduce) return
    let raf = 0
    let last = performance.now()
    // ⚡ 사무실이 화면 밖(아래로 스크롤)이거나 탭이 가려지면 멈춘다 — 안 보이는 그림을 그리지 않는다.
    let visible = true
    const start = () => { if (!raf && visible && document.visibilityState === 'visible') { last = performance.now(); raf = requestAnimationFrame(tick) } }
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0 } }
    const io = typeof IntersectionObserver !== 'undefined' && boxRef.current
      ? new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; if (visible) start(); else stop() })
      : null
    if (io && boxRef.current) io.observe(boxRef.current)
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop())
    document.addEventListener('visibilitychange', onVis)
    // 🧍 2026-11-26 대표 "사람이 그리고 겹쳐" — 쉬는 곳·보고 자리는 한 자리에 한 명. 빈 자리가 없으면 안 간다.
    const taken = new Map<string, string>()
    const release = (a: Agent) => { if (a.spot) { taken.delete(a.spot); a.spot = null } }
    const claim = (a: Agent, list: Pt[]): Pt | null => {
      const free = list.filter(p => !taken.has(spotKey(p)))
      if (!free.length) return null
      const p = pick(free)
      release(a)
      a.spot = spotKey(p)
      taken.set(a.spot, a.key)
      return p
    }
    const decide = (a: Agent) => {
      const seat = seatOf(a.key)?.seat
      if (!seat) return
      const s = statusRef.current[a.key]
      const back = () => { release(a); return route({ x: a.x, y: a.y }, seat) }
      // 방금 끝낸 일 → 보고서 전달(한 번만)
      const done = s?.lastDone
      if (a.key !== 'ceo' && a.key !== 'ceo-office' && done && done.state === 'done' && !a.delivered.has(done.id)
        && Date.now() - parseUTCDate(done.created_at).getTime() < JUST_DONE_MS) {
        const drop = claim(a, SPOTS.secretaryDrop)
        if (drop) {
          a.delivered.add(done.id)
          a.carrying = true
          setCarry(c => ({ ...c, [a.key]: true }))
          a.path = route({ x: a.x, y: a.y }, drop)
          a.wait = 1.5
          return
        }
      }
      const atSeat = Math.hypot(a.x - seat.x, a.y - seat.y) < 2
      if (s && ['working', 'failed', 'stuck'].includes(s.state)) { if (!atSeat) a.path = back(); a.wait = 3; return }
      if (!atSeat) { a.path = back(); a.wait = 4 + Math.random() * 6; return }
      const r = Math.random()
      const to = a.key === 'ceo' ? null : r < 0.18 ? claim(a, SPOTS.coffee) : r < 0.28 ? claim(a, SPOTS.meeting) : null
      if (to) { a.path = route(seat, to); a.wait = 3 + Math.random() * 5 }
      else a.wait = 5 + Math.random() * 8
    }
    function tick(now: number) {
      raf = requestAnimationFrame(tick)
      if (now - last < FRAME_MS - 1) return
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      for (const a of Object.values(agents.current)) {
        if (a.path.length) {
          const t = a.path[0]
          const d = Math.hypot(t.x - a.x, t.y - a.y)
          const step = SPEED * dt
          if (d <= step) {
            a.x = t.x; a.y = t.y; a.path.shift()
            if (!a.path.length && a.carrying && SPOTS.secretaryDrop.some(d => Math.hypot(a.x - d.x, a.y - d.y) < 2)) {
              a.carrying = false
              setCarry(c => ({ ...c, [a.key]: false }))
            }
          } else { a.x += ((t.x - a.x) / d) * step; a.y += ((t.y - a.y) / d) * step }
        } else {
          a.wait -= dt
          if (a.wait <= 0) decide(a)
        }
        const moving = a.path.length > 0
        const el = refs.current[a.key]
        if (el) {
          const tf = `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`
          if (tf !== a.drawn) { el.setAttribute('transform', tf); a.drawn = tf } // ⚡ 서 있는 사람은 건드리지 않는다
          if (moving !== a.moving) { el.classList.toggle('ai-walk', moving); a.moving = moving }
          const st = seatOf(a.key)?.seat
          const away = !!st && Math.hypot(a.x - st.x, a.y - st.y) > 2
          if (away !== a.away) { el.classList.toggle('ai-away', away); a.away = away }
        }
      }
    }
    start()
    return () => { stop(); io?.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [reduce])

  return (
    <div ref={boxRef} className="rounded-[var(--dash-radius,16px)] bg-white p-2 overflow-x-auto">
      <style>{`
        @keyframes aiBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes aiType { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        .ai-walk .ai-body { animation: aiBob .35s ease-in-out infinite }
        .ai-dot { animation: aiType 1s ease-in-out infinite }
        .ai-name { display: none }
        .ai-away .ai-name { display: inline }
        @media (prefers-reduced-motion: reduce) { .ai-walk .ai-body, .ai-dot { animation: none } }
      `}</style>
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="w-full min-w-[640px] h-auto select-none" role="img" aria-label="AI 팀 사무실">
        <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="#F4F5F7" rx="12" />
        {ROOMS.map(r => (
          <g key={r.id}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill={r.floor} stroke="#D9DCE3" />
            <text x={r.x + 12} y={r.y + 22} fontSize="13" fontWeight="600" fill="#4B5563">{r.name}</text>
          </g>
        ))}
        {/* 탕비실 커피머신 · 회의 탁자 */}
        <rect x="300" y="60" width="26" height="20" rx="3" fill="#8B5E3C" />
        <rect x="70" y="70" width="120" height="44" rx="10" fill="#CBD5E1" />
        {/* 책상 + 서류 더미 */}
        {PEOPLE.map(p => {
          const s = seatOf(p.key)
          if (!s) return null
          const n = p.key === 'ceo' ? 0 : tasksOf(p.key).length
          const sel = selected === p.key
          return (
            <g key={`desk-${p.key}`} onClick={() => onSelect(p.key)} style={{ cursor: 'pointer' }}>
              {sel && <rect x={s.desk.x - 40} y={s.desk.y - 20} width="80" height="78" rx="8" fill="#1C69EF" opacity=".08" />}
              <text x={s.seat.x} y={s.seat.y + 30} fontSize="11" fontWeight="600" fill="#6B7280" textAnchor="middle">{p.name}</text>
              <rect x={s.desk.x - 34} y={s.desk.y - 14} width="68" height="28" rx="4" fill="#FFFFFF" stroke="#C7CCD6" />
              <rect x={s.desk.x - 12} y={s.desk.y - 10} width="24" height="15" rx="2" fill="#1F2937" />
              {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
                <rect key={i} x={s.desk.x + 16} y={s.desk.y - 6 - i * 3} width="14" height="10" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="0.8" />
              ))}
              {n > 0 && (
                <g>
                  <circle cx={s.desk.x + 32} cy={s.desk.y - 16} r="8" fill="#DC2626" />
                  <text x={s.desk.x + 32} y={s.desk.y - 12} fontSize="10" fontWeight="700" fill="#FFFFFF" textAnchor="middle">{n}</text>
                </g>
              )}
            </g>
          )
        })}
        {/* 열린 작업실(세션) — 회의실 탁자 둘레. 일하는 중이면 타이핑 점 */}
        {sessions.slice(0, MEETING_SEATS.length).map((ss, i) => {
          const p = MEETING_SEATS[i]
          return (
            <g key={ss.session_id} transform={`translate(${p.x} ${p.y})`}>
              <title>{(ss.title ?? '제목 없는 작업') + (ss.branch ? ` · ${ss.branch}` : '')}</title>
              <rect x="-7" y="-2" width="14" height="12" rx="5" fill={ss.state === 'working' ? '#475569' : '#94A3B8'} />
              <circle cx="0" cy="-7" r="6" fill="#F5D0B5" />
              {ss.state === 'working' && [0, 1, 2].map(k => <circle key={k} className="ai-dot" cx={-5 + k * 5} cy="-18" r="1.8" fill="#16A34A" style={{ animationDelay: `${k * 0.2}s` }} />)}
            </g>
          )
        })}
        {sessions.length > MEETING_SEATS.length && (
          <text x="230" y="160" fontSize="11" fill="#6B7280" textAnchor="end">+{sessions.length - MEETING_SEATS.length}</text>
        )}
        {/* 사람 */}
        {PEOPLE.map(p => {
          const a = agents.current[p.key]
          if (!a) return null
          const color = DEPT_COLOR[TEAM_DEPT[p.key]] ?? '#6B7280'
          const b = p.key === 'ceo' ? null : bubbleFor(status[p.key])
          const sel = selected === p.key
          return (
            <g key={p.key} ref={el => { refs.current[p.key] = el }} transform={`translate(${a.x} ${a.y})`}
              onClick={() => onSelect(p.key)} style={{ cursor: 'pointer' }}>
              <ellipse cx="0" cy="14" rx="12" ry="4" fill="#000" opacity=".12" />
              <g className="ai-body">
                {sel && <circle cx="0" cy="-2" r="19" fill="none" stroke="#1C69EF" strokeWidth="2" />}
                <rect x="-10" y="-4" width="20" height="18" rx="7" fill={color} />
                <circle cx="0" cy="-10" r="8" fill="#F5D0B5" />
                <text x="0" y="10" fontSize="9" fontWeight="700" fill="#FFFFFF" textAnchor="middle">{p.initial}</text>
                {carry[p.key] && <rect x="9" y="-2" width="10" height="13" rx="1" fill="#FFFFFF" stroke="#6B7280" strokeWidth="0.8" />}
              </g>
              <g className="ai-name"><rect x={-p.name.length * 6 - 4} y="19" width={p.name.length * 12 + 8} height="15" rx="7" fill="#FFFFFF" opacity=".92" /><text x="0" y="30" fontSize="11" fontWeight="600" fill="#111827" textAnchor="middle">{p.name}</text></g>
              {b && (
                <g transform="translate(0 -44)">
                  {b.tone === 'work' ? (
                    <>
                      <rect x={-Math.max(26, b.text.length * 5.5)} y="-12" width={Math.max(52, b.text.length * 11)} height="18" rx="9" fill="#111827" />
                      <text x="0" y="1" fontSize="10" fill="#FFFFFF" textAnchor="middle">{b.text}</text>
                      {[0, 1, 2].map(i => <circle key={i} className="ai-dot" cx={-6 + i * 6} cy="12" r="2" fill="#16A34A" style={{ animationDelay: `${i * 0.2}s` }} />)}
                    </>
                  ) : (
                    <>
                      <circle cx="0" cy="-3" r="10" fill={b.tone === 'bad' ? '#DC2626' : '#F59E0B'} />
                      <text x="0" y="1" fontSize="13" fontWeight="700" fill="#FFFFFF" textAnchor="middle">{b.text}</text>
                    </>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </svg>
      <p className="px-2 pt-1 text-[12px] text-gray-400">사람이나 책상을 누르면 오른쪽에 그 팀 카드가 열립니다.</p>
    </div>
  )
}
