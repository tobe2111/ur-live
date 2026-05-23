import { useEffect, useState } from 'react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

/**
 * 🛡️ 2026-05-23 어드민 frontend 에러 대시보드.
 *
 * /api/_errors/log 가 D1 frontend_errors 에 모은 에러를 시각화.
 * 운영자가 사용자 신고 전에 어떤 에러가 어디서 발생 중인지 즉시 파악.
 */

interface ErrorRow {
  id: number
  message: string
  type: string
  url: string
  user_id: string | null
  created_at: string
}

interface GroupedError {
  message: string
  type: string
  count: number
  latest: string
  urls: Set<string>
  user_ids: Set<string>
  rows: ErrorRow[]
}

export default function AdminErrorsPage() {
  const [hours, setHours] = useState(1)
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/api/_errors/recent?hours=${hours}&limit=500`)
      if (res.data?.success) setRows(res.data.data || [])
      else setError(res.data?.error || 'load failed')
    } catch (e) {
      const err = e as { response?: { data?: { error?: string; code?: string } } }
      setError(err?.response?.data?.error || (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [hours])

  // 메시지로 그룹화
  const groups: GroupedError[] = []
  const groupMap = new Map<string, GroupedError>()
  for (const row of rows) {
    const key = `${row.type}:${row.message.slice(0, 100)}`
    let g = groupMap.get(key)
    if (!g) {
      g = {
        message: row.message,
        type: row.type,
        count: 0,
        latest: row.created_at,
        urls: new Set(),
        user_ids: new Set(),
        rows: [],
      }
      groupMap.set(key, g)
      groups.push(g)
    }
    g.count++
    if (row.created_at > g.latest) g.latest = row.created_at
    if (row.url) g.urls.add(row.url)
    if (row.user_id) g.user_ids.add(row.user_id)
    g.rows.push(row)
  }
  groups.sort((a, b) => b.count - a.count)

  function toggleExpand(key: string) {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SEO title="Frontend 에러 대시보드" url="/admin/errors" noindex />
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Frontend 에러 대시보드</h1>
            <div className="flex gap-2">
              {[1, 6, 24, 168].map(h => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`px-3 py-1.5 text-sm rounded ${
                    hours === h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {h === 168 ? '7일' : `${h}h`}
                </button>
              ))}
              <button onClick={load} className="px-3 py-1.5 text-sm bg-gray-100 rounded">새로고침</button>
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            최근 {hours}시간 — {rows.length}건 ({groups.length} 그룹)
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
            ⚠️ {error}
          </div>
        )}

        {loading && <div className="text-center py-8 text-gray-500">로딩 중...</div>}

        {!loading && groups.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            🎉 최근 {hours}시간 동안 발생한 에러 없음
          </div>
        )}

        <div className="space-y-2">
          {groups.map((g, i) => {
            const key = `${g.type}:${g.message.slice(0, 100)}`
            const isOpen = expanded.has(key)
            return (
              <div key={i} className="bg-white rounded-lg shadow">
                <button
                  onClick={() => toggleExpand(key)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full font-bold text-white shrink-0 ${
                    g.count >= 10 ? 'bg-red-500' : g.count >= 3 ? 'bg-amber-500' : 'bg-gray-400'
                  }`}>
                    {g.count}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        g.type === 'error' ? 'bg-red-100 text-red-700' :
                        g.type === 'unhandledrejection' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {g.type}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(g.latest).toLocaleString('ko-KR')}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        · {g.urls.size} URLs · {g.user_ids.size} users
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-mono break-all line-clamp-2">{g.message}</p>
                  </div>
                  <span className="text-gray-400 shrink-0">{isOpen ? '▼' : '▶'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">발생 URL</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(g.urls).slice(0, 20).map(u => (
                          <code key={u} className="text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200">{u}</code>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">최근 발생 (최대 10건)</p>
                      <div className="space-y-1">
                        {g.rows.slice(0, 10).map(r => (
                          <div key={r.id} className="text-[11px] font-mono text-gray-700">
                            <span className="text-gray-400">{new Date(r.created_at).toLocaleTimeString('ko-KR')}</span>
                            {' '}
                            <span className="text-gray-500">{r.url}</span>
                            {' '}
                            <span className="text-gray-400">user={r.user_id || 'anon'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
