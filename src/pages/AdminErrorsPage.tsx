import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { formatKST, formatKSTTime } from '@/utils/date'
import { shortUA, parseBootStuck, bootStuckNote, looksAutomated } from './admin-errors/diagnose'

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
  /** 🔎 2026-08-01: 저장은 되고 있었지만 조회 API 가 안 돌려주던 필드 — 부팅 실패 분류의 핵심 축 */
  user_agent?: string | null
  stack?: string | null
  created_at: string
}

interface GroupedError {
  message: string
  type: string
  count: number
  latest: string
  urls: Set<string>
  user_ids: Set<string>
  /** UA 짧은 라벨 → 건수. "어떤 브라우저에서만 나는가" 가 한눈에 보여야 한다. */
  agents: Map<string, number>
  /** 봇/크롤러가 만든 건수 — 사람 트래픽과 섞으면 통계가 왜곡된다 */
  botCount: number
  rows: ErrorRow[]
}

// 클립보드 복사 (fallback 포함 — 구형 브라우저/비HTTPS 대비).
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function AdminErrorsPage() {
  const [hours, setHours] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (hours별 캐시).
  const { data: rows = [], isLoading: loading, isError, refetch } = useApiQuery<ErrorRow[]>(
    ['admin', 'errors', hours], '/api/_errors/recent',
    { params: { hours, limit: 500 }, select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const error = isError ? 'load failed' : ''
  const load = () => refetch()

  // 그룹 1건을 복사용 텍스트로 직렬화.
  function formatGroupText(g: GroupedError): string {
    const lines = [
      `[${g.type}] ${g.message}`,
      `발생 ${g.count}회 · 최근 ${formatKST(g.latest)}`,
    ]
    if (g.urls.size) lines.push(`URL: ${Array.from(g.urls).join(', ')}`)
    if (g.agents.size) lines.push(`환경: ${Array.from(g.agents.entries()).sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u} ${n}`).join(' / ')}`)
    const f = parseBootStuck(g.message)
    const note = f && bootStuckNote(f)
    if (note) lines.push(`소견: ${note}`)
    return lines.join('\n')
  }

  async function doCopy(key: string, text: string) {
    const ok = await copyText(text)
    if (ok) {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1500)
    }
  }

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
        agents: new Map(),
        botCount: 0,
        rows: [],
      }
      groupMap.set(key, g)
      groups.push(g)
    }
    g.count++
    if (row.created_at > g.latest) g.latest = row.created_at
    if (row.url) g.urls.add(row.url)
    if (row.user_id) g.user_ids.add(row.user_id)
    const ua = shortUA(row.user_agent)
    g.agents.set(ua, (g.agents.get(ua) || 0) + 1)
    if (looksAutomated(row.user_agent)) g.botCount++
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
    <AdminLayout title="Frontend 에러">
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
                    hours === h ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {h === 168 ? '7일' : `${h}h`}
                </button>
              ))}
              <button onClick={load} className="px-3 py-1.5 text-sm bg-gray-100 rounded">새로고침</button>
              {groups.length > 0 && (
                <button
                  onClick={() => doCopy('__all__', groups.map(formatGroupText).join('\n\n'))}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded"
                >
                  {copiedKey === '__all__' ? '✓ 복사됨' : '전체 복사'}
                </button>
              )}
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
                <div className="flex items-stretch">
                  <button
                    onClick={() => toggleExpand(key)}
                    className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
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
                          {formatKST(g.latest)}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          · {g.urls.size} URLs · {g.user_ids.size} users
                        </span>
                        {/* 🔎 어떤 환경에서 나는 에러인지 — 접지 않아도 보이게 */}
                        {Array.from(g.agents.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ua, n]) => (
                          <span key={ua} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{ua} {n}</span>
                        ))}
                        {g.botCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700" title="봇/크롤러가 만든 건수 — 사람 트래픽과 분리해서 볼 것">
                            봇 {g.botCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-mono break-all line-clamp-2">{g.message}</p>
                    </div>
                    <span className="text-gray-400 shrink-0">{isOpen ? '▼' : '▶'}</span>
                  </button>
                  <button
                    onClick={() => doCopy(key, formatGroupText(g))}
                    title="이 에러 문구 복사"
                    className="shrink-0 px-3 border-l border-gray-100 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {copiedKey === key ? '✓ 복사됨' : '복사'}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">전체 메시지</p>
                      <pre className="text-[11px] text-gray-900 bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap break-all select-text max-h-60 overflow-auto">{g.message}</pre>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">발생 URL</p>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(g.urls).slice(0, 20).map(u => (
                          <code key={u} className="text-[11px] bg-white px-2 py-0.5 rounded border border-gray-200">{u}</code>
                        ))}
                      </div>
                    </div>
                    {/* 🔎 2026-08-01: `[boot-stuck]` 은 진단 필드를 한 줄에 욱여넣은 형식이라 눈으로 읽어야 했다.
                        쪼개서 표로 보여 주고, 이상한 조합에는 소견을 붙인다(판정이 아니라 무엇이 이상한지 표시). */}
                    {(() => {
                      const f = parseBootStuck(g.message)
                      if (!f) return null
                      const note = bootStuckNote(f)
                      return (
                        <div>
                          <p className="text-[11px] font-bold text-gray-500 mb-1">부팅 실패 진단</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              ['원인', f.reason], ['엔트리 실행', f.entryRan === 'y' ? '예' : '아니오'],
                              ['청크에러 확증', f.chunkSeen === 'true' ? '예' : '아니오'],
                              ['경과', f.t != null ? `${f.t}ms` : undefined],
                              ['문서상태', f.ready], ['진입방식', f.nav || '기록없음'], ['탭', f.vis],
                            ] as Array<[string, string | undefined]>).filter(([, v]) => v).map(([k, v]) => (
                              <span key={k} className="text-[11px] bg-white border border-gray-200 rounded px-2 py-0.5">
                                <span className="text-gray-400">{k}</span> <span className="text-gray-900 font-medium">{v}</span>
                              </span>
                            ))}
                          </div>
                          {note && <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{note}</p>}
                          {f.lastErr && f.lastErr !== '(none)' && (
                            <p className="mt-1.5 text-[11px] font-mono text-gray-700 break-all">마지막 에러: {f.lastErr}</p>
                          )}
                        </div>
                      )
                    })()}

                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">최근 발생 (최대 10건)</p>
                      <div className="space-y-1">
                        {g.rows.slice(0, 10).map(r => (
                          <div key={r.id} className="text-[11px] font-mono text-gray-700">
                            <span className="text-gray-400">{formatKSTTime(r.created_at)}</span>
                            {' '}
                            <span className="text-gray-500">{r.url}</span>
                            {' '}
                            <span className="text-gray-400">user={r.user_id || 'anon'}</span>
                            {' '}
                            <span className="text-indigo-600">{shortUA(r.user_agent)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {g.rows.some(r => r.stack) && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 mb-1">스택 (최근 1건)</p>
                        <pre className="text-[11px] text-gray-800 bg-white border border-gray-200 rounded p-2 whitespace-pre-wrap break-all max-h-48 overflow-auto select-text">{g.rows.find(r => r.stack)?.stack}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </AdminLayout>
  )
}
