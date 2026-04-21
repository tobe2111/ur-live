import { useEffect, useRef, useState } from 'react'
import {
  Search, Play, Square, Download, RefreshCw,
  ChevronRight, Loader2, CheckCircle2, AlertCircle,
  Mail, Building2, Phone, Tag,
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'

// Worker 프록시 경로 (브라우저 → Worker → 스크래퍼 서버)
// /api/admin 경로 대신 /api/scraper 사용 — adminApp 미들웨어 충돌 회피
const API = '/api/scraper'

function getToken() {
  return localStorage.getItem('admin_token') || localStorage.getItem('access_token') || ''
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

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
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [keywords, setKeywords] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [concurrency, setConcurrency] = useState('3')

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [currentItem, setCurrentItem] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])

  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<number | null>(null)
  const [emails, setEmails] = useState<EmailRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  const sseAbortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => { checkServer() }, [])
  useEffect(() => { if (serverOk) loadSessions() }, [serverOk])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  async function checkServer() {
    try {
      const token = getToken()
      const res = await fetch(`${API}/api/status`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, string>
        console.error('[Scraper] auth fail', res.status, body, 'token present:', !!token, 'token prefix:', token.slice(0, 20))
        setServerOk(false)
        return
      }
      const data = await res.json() as { running: boolean }
      setServerOk(true)
      if (data.running) { setRunning(true); connectSSE() }
    } catch (e) {
      console.error('[Scraper] checkServer error:', e)
      setServerOk(false)
    }
  }

  function addLog(msg: string, type: LogEntry['type'] = 'info') {
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev.slice(-200), { time, msg, type }])
  }

  function handleSSEEvent(type: string, data: string) {
    try {
      const d = data ? JSON.parse(data) : {}
      if (type === 'connected') {
        addLog('스크래퍼 서버 연결됨')
      } else if (type === 'start') {
        addLog(`수집 시작: ${d.keywords?.join(', ')}`)
        setRunning(true); setProgress(0)
      } else if (type === 'progress') {
        setProgress(d.pct ?? 0)
        setPhase(d.phase === 'scrape' ? '광고 수집 중' : '이메일 크롤링 중')
        setCurrentItem(d.item ?? '')
        if ((d.found ?? 0) > 0) addLog(`${d.item?.split('/').slice(-1)[0]} → ${d.found}개`, 'found')
      } else if (type === 'done') {
        addLog(`✓ 완료!  광고주 ${d.stats?.totalAdvertisers}개 | 이메일 ${d.stats?.uniqueEmails}개`, 'done')
        setRunning(false); setProgress(100)
        loadSessions()
        if (d.sessionId) loadEmails(d.sessionId)
      } else if (type === 'stopped') {
        addLog('수집 중단됨', 'error'); setRunning(false)
      } else if (type === 'error') {
        addLog('오류: ' + (d.message ?? data), 'error')
      }
    } catch {}
  }

  function connectSSE() {
    if (sseAbortRef.current) sseAbortRef.current.abort()
    const controller = new AbortController()
    sseAbortRef.current = controller

    fetch(`${API}/events`, {
      headers: authHeaders(),
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) { addLog('SSE 연결 실패', 'error'); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let evtType = 'message'
      let evtData = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event:')) {
            evtType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            evtData = line.slice(5).trim()
          } else if (line === '' && evtData) {
            handleSSEEvent(evtType, evtData)
            evtType = 'message'; evtData = ''
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') addLog('SSE 연결 끊김', 'error')
    })
  }

  async function startScrape() {
    if (!keywords.trim()) return
    setLogs([]); setProgress(0)
    setRunning(true)

    const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean)
    addLog(`${keywordList.length}개 키워드 크롤링 시작...`, 'info')

    let totalFound = 0
    let totalEmails = 0

    for (let i = 0; i < keywordList.length; i++) {
      const kw = keywordList[i]
      setProgress(Math.round((i / keywordList.length) * 100))

      // 1단계: 광고주 URL 수집 (최대 5페이지 = ~50개)
      addLog(`[${i + 1}/${keywordList.length}] "${kw}" 광고주 수집 중...`, 'info')
      let advertisers: Array<{ url: string; title: string; domain: string }> = []
      try {
        const collectRes = await fetch('/api/naver-scraper/collect', {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ keyword: kw, pages: 5 }),
        }).then(r => r.json()) as any
        if (collectRes.success) {
          advertisers = collectRes.data.advertisers || []
          addLog(`  광고주 ${advertisers.length}개 발견`, 'info')
        }
      } catch (e: any) {
        addLog(`  수집 실패: ${e.message}`, 'error')
        continue
      }

      if (advertisers.length === 0) {
        addLog(`  "${kw}": 광고주 없음`, 'info')
        continue
      }

      // 2단계: 10개씩 배치로 이메일 추출 (배치 간 2초 딜레이 — 네이버 차단 방지)
      let keywordEmails = 0
      for (let batch = 0; batch < advertisers.length; batch += 10) {
        const chunk = advertisers.slice(batch, batch + 10)
        addLog(`  이메일 추출 중... (${batch + 1}-${Math.min(batch + 10, advertisers.length)}/${advertisers.length})`, 'info')

        try {
          const extractRes = await fetch('/api/naver-scraper/extract', {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ keyword: kw, advertisers: chunk }),
          }).then(r => r.json()) as any
          if (extractRes.success) {
            keywordEmails += extractRes.data.totalEmails || 0
          }
        } catch {}

        // 배치 간 2초 대기 (네이버 차단 방지)
        if (batch + 10 < advertisers.length) {
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      totalFound += advertisers.length
      totalEmails += keywordEmails
      addLog(`✓ "${kw}": 광고주 ${advertisers.length}개 / 이메일 ${keywordEmails}개`, 'found')
    }

    setProgress(100)
    addLog(`완료! 총 광고주 ${totalFound}개, 이메일 ${totalEmails}개 수집`, 'done')
    setRunning(false)
    loadSessions()
  }

  async function stopScrape() {
    await fetch(`${API}/api/stop`, { method: 'POST', headers: authHeaders() })
  }

  async function loadSessions() {
    try {
      const data = await fetch(`${API}/api/sessions`, { headers: authHeaders() }).then(r => r.json())
      setSessions(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function loadEmails(sessionId: number) {
    setSelectedSession(sessionId)
    try {
      const data = await fetch(`${API}/api/emails?sessionId=${sessionId}`, { headers: authHeaders() }).then(r => r.json()) as {
        emails: EmailRow[]
        stats: Stats
      }
      setEmails(data.emails ?? [])
      setStats(data.stats ?? null)
    } catch {}
  }

  async function exportCsv(type: 'emails' | 'all' = 'emails') {
    const params = new URLSearchParams()
    if (selectedSession) params.set('sessionId', String(selectedSession))
    params.set('type', type)
    try {
      const res = await fetch(`${API}/api/export?${params}`, { headers: authHeaders() })
      if (!res.ok) { addLog('CSV 다운로드 실패', 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type === 'all' ? 'contacts_all.csv' : 'emails.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch { addLog('CSV 다운로드 오류', 'error') }
  }

  return (
    <AdminLayout title="네이버 광고주 이메일 수집">

      {/* 연결 실패 배너 */}
      {serverOk === false && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>스크래퍼 서버에 연결할 수 없습니다. 세션을 새로 시작하거나 관리자에게 문의하세요.</span>
          <button onClick={checkServer} className="ml-auto text-xs underline underline-offset-2">재연결</button>
        </div>
      )}

      <div className="flex gap-5">

        {/* ── 왼쪽 패널 ─────────────────────────────────────────── */}
        <div className="w-72 shrink-0 space-y-4">

          {/* 수집 설정 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">수집 설정</h2>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">검색 키워드</label>
              <textarea
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                rows={5}
                placeholder={'키워드를 입력하세요\n줄바꿈 또는 쉼표로 구분\n\n예) 골프용품\n테니스\n스포츠의류'}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
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
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">동시 크롤링</label>
              <select
                value={concurrency}
                onChange={e => setConcurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400"
              >
                <option value="2">2개 (안전)</option>
                <option value="3">3개 (기본)</option>
                <option value="5">5개 (빠름)</option>
              </select>
            </div>

            {running ? (
              <button onClick={stopScrape}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 active:scale-95">
                <Square className="h-4 w-4" /> 수집 중단
              </button>
            ) : (
              <button onClick={startScrape}
                disabled={!serverOk || !keywords.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-300">
                <Play className="h-4 w-4" /> 수집 시작
              </button>
            )}
          </div>

          {/* 진행상황 */}
          {(running || progress > 0) && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">진행상황</h2>
                {running
                  ? <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                  : <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              <div className="mb-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${progress}%` }} />
              </div>
              <div className="mb-2 flex justify-between text-xs text-gray-400">
                <span>{phase || '준비 중'}</span>
                <span>{progress}%</span>
              </div>
              {currentItem && <p className="mb-2 truncate text-xs text-gray-500">{currentItem}</p>}
              <div ref={logRef}
                className="h-36 overflow-y-auto rounded-lg bg-gray-900 p-2 font-mono text-[10px] leading-relaxed">
                {logs.length === 0 && <span className="text-gray-500">로그 대기 중...</span>}
                {logs.map((l, i) => (
                  <div key={i} className={{
                    info: 'text-gray-400', found: 'text-green-400',
                    error: 'text-red-400', done: 'font-bold text-yellow-300',
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
            {sessions.length === 0
              ? <p className="py-4 text-center text-xs text-gray-400">수집 기록이 없습니다</p>
              : (
                <div className="space-y-1.5">
                  {sessions.map(s => (
                    <button key={s.id} onClick={() => loadEmails(s.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        selectedSession === s.id ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-800">{s.name}</p>
                        <p className="text-gray-400">{s.created_at.slice(0, 16)}</p>
                      </div>
                      <div className="ml-2 flex shrink-0 items-center gap-1">
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

          {/* 통계 */}
          {stats && (
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[
                { label: '총 광고주',   value: stats.totalAdvertisers, color: 'text-blue-600' },
                { label: '이메일 보유', value: stats.withEmail,        color: 'text-emerald-600' },
                { label: '고유 이메일', value: stats.uniqueEmails,     color: 'text-violet-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
                  <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* 이메일 테이블 */}
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
                  <button onClick={() => exportCsv('emails')}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    title="이메일 있는 광고주만">
                    <Download className="h-3.5 w-3.5" /> 이메일 CSV
                  </button>
                  <button onClick={() => exportCsv('all')}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                    title="이메일 없어도 전화/카카오 있으면 포함">
                    <Download className="h-3.5 w-3.5" /> 전체 연락처 CSV
                  </button>
                </div>
              )}
            </div>

            {emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
                <Search className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  {selectedSession ? '이 세션에서 수집된 이메일이 없습니다' : '왼쪽에서 수집을 시작하거나 세션을 선택하세요'}
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
                            <Tag className="h-3 w-3" />{row.keyword}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                            {row.phone || <span className="text-gray-300">-</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          <a href={row.advertiser_url} target="_blank" rel="noreferrer"
                            className="hover:text-blue-500 hover:underline">
                            {row.domain}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{row.crawled_at?.slice(0, 16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══ D1 수집 결과 (전체 이력) ══ */}
        <D1ResultsPanel />
      </div>
    </AdminLayout>
  )
}

function D1ResultsPanel() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ total: number; withEmail: number; uniqueEmails: number; keywords: number; latestScrape: string | null } | null>(null)

  const token = localStorage.getItem('admin_token') || ''
  const hdrs: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  async function loadStats() {
    try {
      const res = await fetch('/api/scraper/d1/stats', { headers: hdrs }).then(r => r.json()) as any
      if (res.success) setStats(res.data)
    } catch {}
  }

  async function loadData(p: number = 1) {
    setLoading(true)
    try {
      const qs = search ? `&keyword=${encodeURIComponent(search)}` : ''
      const res = await fetch(`/api/scraper/d1/emails?page=${p}&limit=50${qs}`, { headers: hdrs }).then(r => r.json()) as any
      if (res.success) {
        setData(res.data || [])
        setTotal(res.total || 0)
        setPage(p)
      }
    } catch {}
    setLoading(false)
  }

  function exportCSV() {
    if (data.length === 0) return
    const headers = ['키워드', '광고주', '이메일', '전화번호', '사이트', '수집일시']
    const rows = data.map((r: any) => [
      r.keyword, r.advertiser_name, r.email, r.phone || '', r.site_url, r.scraped_at
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map((c: string) => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `naver-ads-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  useEffect(() => { loadStats(); loadData() }, [])

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">📊 수집 결과 (D1)</h2>
        <button onClick={exportCSV} disabled={data.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-bold rounded-lg border border-green-200 disabled:opacity-40 hover:bg-green-100">
          <Download className="w-3.5 h-3.5" /> CSV 내보내기
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">총 수집</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-blue-600">{stats.uniqueEmails.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500">고유 이메일</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-purple-600">{stats.keywords}</p>
            <p className="text-[10px] text-gray-500">키워드 수</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-green-600">{stats.latestScrape?.slice(0, 10) || '-'}</p>
            <p className="text-[10px] text-gray-500">최근 수집</p>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadData(1)}
            placeholder="키워드로 검색..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-blue-400"
          />
        </div>
        <button onClick={() => loadData(1)} className="px-4 py-2 bg-gray-800 text-white text-sm font-bold rounded-lg">
          검색
        </button>
        <button onClick={() => { setSearch(''); loadData(1) }} className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">
          초기화
        </button>
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : data.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">수집된 데이터가 없습니다. 위에서 키워드를 입력하고 시작해보세요.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">키워드</th>
                  <th className="px-3 py-2">광고주</th>
                  <th className="px-3 py-2">이메일</th>
                  <th className="px-3 py-2">전화번호</th>
                  <th className="px-3 py-2">사이트</th>
                  <th className="px-3 py-2">수집일</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: any, i: number) => (
                  <tr key={row.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2.5"><Tag className="inline w-3 h-3 text-gray-400 mr-1" />{row.keyword}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-900">{row.advertiser_name}</td>
                    <td className="px-3 py-2.5">
                      <a href={`mailto:${row.email}`} className="text-blue-600 hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" />{row.email}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.phone || '-'}</td>
                    <td className="px-3 py-2.5">
                      <a href={row.site_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500 text-xs truncate block max-w-[150px]">
                        {row.site_url?.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{row.scraped_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">총 {total.toLocaleString()}건 중 {((page - 1) * 50 + 1)}-{Math.min(page * 50, total)}건</p>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => loadData(page - 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded disabled:opacity-30">이전</button>
                <span className="px-3 py-1 text-xs text-gray-600">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => loadData(page + 1)}
                  className="px-3 py-1 text-xs border border-gray-200 rounded disabled:opacity-30">다음</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
