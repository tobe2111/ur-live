import { useEffect, useRef, useState } from 'react'
import {
  Search, Play, Square, Download, RefreshCw,
  ChevronRight, Loader2, CheckCircle2, AlertCircle,
  Mail, Building2, Phone, Tag, Settings, X,
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'

// 스크래퍼 서버 URL (별도 Node.js 서버)
const DEFAULT_SERVER = 'http://localhost:3456'

interface Session {
  id: number
  name: string
  keywords: string
  status: 'running' | 'done' | 'error'
  created_at: string
  finished_at: string | null
}

interface EmailRow {
  id: number
  email: string
  domain: string | null
  company_name: string | null
  phone: string | null
  keyword: string
  advertiser_url: string
  crawled_at: string
}

interface Stats {
  totalAdvertisers: number
  withEmail: number
  uniqueEmails: number
}

interface LogEntry {
  time: string
  msg: string
  type: 'info' | 'found' | 'error' | 'done'
}

export default function AdminAdScraperPage() {
  const [serverUrl, setServerUrl] = useState(
    () => localStorage.getItem('scraper_server_url') || DEFAULT_SERVER
  )
  const [showSettings, setShowSettings] = useState(false)
  const [serverOk, setServerOk] = useState<boolean | null>(null)

  // 폼
  const [keywords, setKeywords] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [concurrency, setConcurrency] = useState('3')

  // 상태
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [currentItem, setCurrentItem] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])

  // 데이터
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<number | null>(null)
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // 서버 연결 확인
  useEffect(() => {
    checkServer()
  }, [serverUrl])

  // 세션 목록 초기 로드
  useEffect(() => {
    if (serverOk) loadSessions()
  }, [serverOk])

  // 로그 자동 스크롤
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  async function checkServer() {
    try {
      const res = await fetch(`${serverUrl}/api/status`, { signal: AbortSignal.timeout(3000) })
      const data = await res.json() as { running: boolean }
      setServerOk(true)
      if (data.running) {
        setRunning(true)
        connectSSE()
      }
    } catch {
      setServerOk(false)
    }
  }

  function addLog(msg: string, type: LogEntry['type'] = 'info') {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-200), { time, msg, type }])
  }

  // ── SSE 연결 ────────────────────────────────────────────────────
  function connectSSE() {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(`${serverUrl}/events`)
    esRef.current = es

    es.addEventListener('connected', () => addLog('스크래퍼 서버 연결됨'))

    es.addEventListener('start', (e) => {
      const d = JSON.parse(e.data)
      addLog(`수집 시작: ${d.keywords?.join(', ')}`)
      setRunning(true)
      setProgress(0)
    })

    es.addEventListener('progress', (e) => {
      const d = JSON.parse(e.data)
      setProgress(d.pct ?? 0)
      setPhase(d.phase === 'scrape' ? '광고 수집 중' : '이메일 크롤링 중')
      setCurrentItem(d.item ?? '')
      if ((d.found ?? 0) > 0) {
        addLog(`${d.item?.split('/').slice(-1)[0]} → ${d.found}개 발견`, 'found')
      }
    })

    es.addEventListener('done', (e) => {
      const d = JSON.parse(e.data)
      addLog(`✓ 완료!  광고주 ${d.stats?.totalAdvertisers}개 | 이메일 ${d.stats?.uniqueEmails}개`, 'done')
      setRunning(false)
      setProgress(100)
      loadSessions()
      if (d.sessionId) loadEmails(d.sessionId)
    })

    es.addEventListener('stopped', () => {
      addLog('수집 중단됨', 'error')
      setRunning(false)
    })

    es.addEventListener('error', (e) => {
      if ((e as MessageEvent).data) {
        addLog('오류: ' + JSON.parse((e as MessageEvent).data).message, 'error')
      }
    })

    return () => es.close()
  }

  // ── 수집 시작 ────────────────────────────────────────────────────
  async function startScrape() {
    if (!keywords.trim()) return
    setLogs([])
    setProgress(0)

    connectSSE()

    const res = await fetch(`${serverUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, sessionName: sessionName || undefined, concurrency }),
    }).then(r => r.json()) as { error?: string }

    if (res.error) {
      addLog(res.error, 'error')
      setRunning(false)
    }
  }

  async function stopScrape() {
    await fetch(`${serverUrl}/api/stop`, { method: 'POST' })
  }

  async function loadSessions() {
    try {
      const data = await fetch(`${serverUrl}/api/sessions`).then(r => r.json()) as Session[]
      setSessions(data)
    } catch {}
  }

  async function loadEmails(sessionId: number) {
    setSelectedSession(sessionId)
    try {
      const data = await fetch(`${serverUrl}/api/emails?sessionId=${sessionId}`).then(r => r.json()) as {
        emails: EmailRow[]
        stats: Stats
      }
      setEmails(data.emails ?? [])
      setStats(data.stats ?? null)
    } catch {}
  }

  function exportCsv(type: 'emails' | 'all' = 'emails') {
    const params = new URLSearchParams()
    if (selectedSession) params.set('sessionId', String(selectedSession))
    params.set('type', type)
    window.open(`${serverUrl}/api/export?${params}`, '_blank')
  }

  function saveServerUrl(url: string) {
    setServerUrl(url)
    localStorage.setItem('scraper_server_url', url)
    setShowSettings(false)
    setServerOk(null)
  }

  // ── 렌더 ─────────────────────────────────────────────────────────
  return (
    <AdminLayout title="네이버 광고주 이메일 수집">

      {/* 서버 상태 배너 */}
      {serverOk === false && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            스크래퍼 서버에 연결할 수 없습니다.{' '}
            <code className="rounded bg-amber-100 px-1">{serverUrl}</code>에서 서버를 실행하세요.
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto text-xs underline underline-offset-2"
          >
            서버 주소 변경
          </button>
        </div>
      )}

      <div className="flex gap-5">

        {/* ── 왼쪽: 입력 + 진행 ─────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* 수집 설정 카드 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">수집 설정</h2>
              <button
                onClick={() => setShowSettings(s => !s)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>

            {showSettings && (
              <ServerSettingsForm
                current={serverUrl}
                onSave={saveServerUrl}
                onCancel={() => setShowSettings(false)}
              />
            )}

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                검색 키워드
              </label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                rows={5}
                placeholder={'키워드를 입력하세요\n줄바꿈 또는 쉼표로 구분\n\n예) 골프용품\n테니스\n스포츠의류'}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-gray-400">키워드당 최대 20개 광고주 수집</p>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">세션 이름</label>
              <input
                type="text"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                placeholder="스포츠업체_2024"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">동시 크롤링</label>
              <select
                value={concurrency}
                onChange={e => setConcurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="2">2개 (안전)</option>
                <option value="3">3개 (기본)</option>
                <option value="5">5개 (빠름)</option>
              </select>
            </div>

            {running ? (
              <button
                onClick={stopScrape}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-95"
              >
                <Square className="h-4 w-4" />
                수집 중단
              </button>
            ) : (
              <button
                onClick={startScrape}
                disabled={!serverOk || !keywords.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Play className="h-4 w-4" />
                수집 시작
              </button>
            )}
          </div>

          {/* 진행상황 카드 */}
          {(running || progress > 0) && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">진행상황</h2>
                {running && <Loader2 className="h-4 w-4 animate-spin text-green-500" />}
                {!running && progress === 100 && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>

              {/* 진행바 */}
              <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                <span>{phase || '준비 중'}</span>
                <span>{progress}%</span>
              </div>

              {currentItem && (
                <p className="mb-2 truncate text-xs text-gray-500">{currentItem}</p>
              )}

              {/* 로그 콘솔 */}
              <div
                ref={logRef}
                className="h-36 overflow-y-auto rounded-lg bg-gray-900 p-2 font-mono text-[10px] leading-relaxed"
              >
                {logs.length === 0 && (
                  <span className="text-gray-500">로그 대기 중...</span>
                )}
                {logs.map((l, i) => (
                  <div key={i} className={{
                    info: 'text-gray-400',
                    found: 'text-green-400',
                    error: 'text-red-400',
                    done: 'text-yellow-300 font-bold',
                  }[l.type]}>
                    [{l.time}] {l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 세션 목록 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">수집 기록</h2>
              <button onClick={loadSessions} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">수집 기록이 없습니다</p>
            ) : (
              <div className="space-y-1.5">
                {sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadEmails(s.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedSession === s.id
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800">{s.name}</p>
                      <p className="text-gray-400">{s.created_at.slice(0, 16)}</p>
                    </div>
                    <div className="ml-2 flex items-center gap-1 shrink-0">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        s.status === 'done'    ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'running' ? 'bg-blue-100 text-blue-700' :
                                                 'bg-red-100 text-red-600'
                      }`}>
                        {s.status === 'done' ? '완료' : s.status === 'running' ? '진행중' : '오류'}
                      </span>
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 결과 ──────────────────────────────────────── */}
        <div className="min-w-0 flex-1">

          {/* 통계 카드 */}
          {stats && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[
                { label: '총 광고주', value: stats.totalAdvertisers, color: 'text-blue-600' },
                { label: '이메일 보유', value: stats.withEmail, color: 'text-emerald-600' },
                { label: '고유 이메일', value: stats.uniqueEmails, color: 'text-violet-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* 결과 테이블 */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700">수집된 이메일</h2>
                {emails.length > 0 && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {emails.length.toLocaleString()}개
                  </span>
                )}
              </div>
              {emails.length > 0 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => exportCsv('emails')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    title="이메일 있는 광고주만"
                  >
                    <Download className="h-3.5 w-3.5" />
                    이메일 CSV
                  </button>
                  <button
                    onClick={() => exportCsv('all')}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                    title="이메일 없어도 전화/카카오 있으면 포함"
                  >
                    <Download className="h-3.5 w-3.5" />
                    전체 연락처 CSV
                  </button>
                </div>
              )}
            </div>

            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  {selectedSession
                    ? '이 세션에서 수집된 이메일이 없습니다'
                    : '왼쪽에서 수집을 시작하거나 세션을 선택하세요'}
                </p>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <th className="px-4 py-3 text-left">이메일</th>
                      <th className="px-4 py-3 text-left">회사명</th>
                      <th className="px-4 py-3 text-left">키워드</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">도메인</th>
                      <th className="px-4 py-3 text-left">수집일시</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {emails.map(row => (
                      <tr key={row.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                            <span className="font-medium text-blue-600">{row.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                            {row.company_name || <span className="text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <Tag className="h-3 w-3" />
                            {row.keyword}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                            {row.phone || <span className="text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          <a
                            href={row.advertiser_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-blue-500 hover:underline"
                          >
                            {row.domain}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {row.crawled_at?.slice(0, 16)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

// ── 서버 설정 인라인 폼 ──────────────────────────────────────────
function ServerSettingsForm({
  current,
  onSave,
  onCancel,
}: {
  current: string
  onSave: (url: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(current)
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600">스크래퍼 서버 주소</p>
        <button onClick={onCancel}><X className="h-3.5 w-3.5 text-gray-400" /></button>
      </div>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        className="mb-2 w-full rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
        placeholder="http://localhost:3456"
      />
      <button
        onClick={() => onSave(val)}
        className="w-full rounded bg-blue-500 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
      >
        저장
      </button>
      <p className="mt-1.5 text-[10px] text-gray-400">
        스크래퍼 서버: <code>cd naver-ad-scraper && npm start</code>
      </p>
    </div>
  )
}
