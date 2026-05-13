/**
 * 🛡️ 2026-05-13: 어드민 YouTube Quota & 라이브 대시보드.
 *
 * - 일일 quota 사용량 (오늘 vs 어제 비교)
 * - 셀러별 라이브 생성 횟수 (상위 20명)
 * - 좀비 의심 streams (수동 force-transition / reset-zombie 호출 가능)
 * - Stream 통계 (live / scheduled / ended 24h)
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, Loader2, Youtube } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface DashboardData {
  quota: {
    today: { date: string; total: number; limit: number; ratio: number; warning: string; calls: Record<string, number> }
    yesterday: { date: string; total: number }
  }
  sellers_today: Array<{ seller_id: number; seller_name?: string; count: number }>
  zombie_suspect: Array<{ id: number; seller_id: number; title: string; started_at: string; last_error: string | null }>
  stream_counts_24h: Record<string, number>
}

export default function AdminYoutubeQuotaPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/youtube/live/_admin-quota-dashboard')
      if (res.data?.success) setData(res.data.data)
    } catch (e) {
      toast.error('대시보드 로드 실패')
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)  // 30s 폴링
    return () => clearInterval(id)
  }, [])

  const formatNum = (n: number) => n.toLocaleString('ko-KR')

  const handleForceEnd = async (streamId: number, title: string) => {
    if (!confirm(`정말 stream #${streamId} "${title}" 을 강제 종료할까요?\n셀러에게 알림이 발송됩니다.`)) return
    const reason = prompt('종료 사유 (셀러에게 전송됨):', '좀비 의심 stream — 송출 신호 미감지') || '어드민 수동 종료'
    try {
      const res = await api.post(`/api/youtube/live/${streamId}/admin-force-end?reason=${encodeURIComponent(reason)}`)
      if (res.data?.success) {
        toast.success(`Stream #${streamId} 강제 종료 완료`)
        load()  // 대시보드 새로고침
      } else {
        toast.error(res.data?.error || '실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  return (
    <AdminLayout title="YouTube Quota 대시보드">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="YouTube Quota 대시보드"
          subtitle="일일 API 사용량 + 셀러별 활동 + 좀비 stream 모니터링"
          icon={<Youtube className="h-5 w-5" />}
          actions={
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              새로고침
            </button>
          }
        />

        {!data ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : (
          <>
            {/* Quota 카드 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={`rounded-2xl p-5 border ${
                data.quota.today.warning === 'critical' ? 'bg-red-50 border-red-200' :
                data.quota.today.warning === 'warn' ? 'bg-amber-50 border-amber-200' :
                'bg-white border-gray-200'
              }`}>
                <p className="text-xs font-semibold text-gray-700 mb-1">오늘 사용량</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNum(data.quota.today.total)}
                  <span className="text-sm text-gray-500 font-normal"> / {formatNum(data.quota.today.limit)}</span>
                </p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${data.quota.today.warning === 'critical' ? 'bg-red-500' : data.quota.today.warning === 'warn' ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, data.quota.today.ratio * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">{(data.quota.today.ratio * 100).toFixed(1)}% 사용</p>
                {data.quota.today.warning !== 'ok' && (
                  <p className="text-xs font-semibold text-red-700 mt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {data.quota.today.warning === 'critical' ? '95% 도달 — 새 broadcast 생성 차단됨' : '80% 도달 — 곧 한도 임박'}
                  </p>
                )}
              </div>

              <div className="rounded-2xl p-5 border bg-white border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">어제 사용량</p>
                <p className="text-2xl font-bold text-gray-900">{formatNum(data.quota.yesterday.total)}</p>
                <p className="text-[11px] text-gray-500 mt-1">{data.quota.yesterday.date}</p>
                {data.quota.today.total > 0 && data.quota.yesterday.total > 0 && (
                  <p className={`text-xs font-semibold mt-2 ${data.quota.today.total > data.quota.yesterday.total ? 'text-red-600' : 'text-green-600'}`}>
                    {data.quota.today.total > data.quota.yesterday.total ? '▲' : '▼'}{' '}
                    {Math.abs(((data.quota.today.total - data.quota.yesterday.total) / data.quota.yesterday.total) * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              <div className="rounded-2xl p-5 border bg-white border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-1">24h Stream 통계</p>
                <div className="space-y-1.5 mt-2">
                  {Object.entries(data.stream_counts_24h).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        status === 'live' ? 'bg-red-100 text-red-700' :
                        status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {status}
                      </span>
                      <span className="font-bold text-gray-900">{formatNum(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* API call 분포 */}
            {Object.keys(data.quota.today.calls).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-sm font-bold text-gray-900 mb-3">오늘 API 호출 분포 (units)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(data.quota.today.calls)
                    .sort(([, a], [, b]) => b - a)
                    .map(([label, units]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-500 truncate">{label}</p>
                        <p className="text-lg font-bold text-gray-900">{formatNum(units)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 셀러별 일일 생성 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-3">셀러별 오늘 라이브 생성 ({data.sellers_today.length}명)</p>
              {data.sellers_today.length === 0 ? (
                <p className="text-sm text-gray-500">오늘 라이브 생성 0건</p>
              ) : (
                <div className="space-y-1.5">
                  {data.sellers_today.map((s) => (
                    <div key={s.seller_id} className="flex items-center justify-between text-sm py-1.5 px-2 hover:bg-gray-50 rounded">
                      <div>
                        <span className="font-semibold text-gray-900">{s.seller_name || `Seller ${s.seller_id}`}</span>
                        <span className="text-[11px] text-gray-500 ml-2">#{s.seller_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{s.count}</span>
                        <span className="text-[10px] text-gray-500">/ 5</span>
                        {s.count >= 5 && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">한도</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 좀비 의심 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                좀비 의심 Streams
                {data.zombie_suspect.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                    {data.zombie_suspect.length}건
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-500 mb-3">
                status='live' 인데 started_at &gt; 5분 — cron 이 자동 복구. 직접 확인 가능.
              </p>
              {data.zombie_suspect.length === 0 ? (
                <p className="text-sm text-green-700">✅ 좀비 의심 없음</p>
              ) : (
                <div className="space-y-2">
                  {data.zombie_suspect.map((z) => (
                    <div key={z.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">#{z.id} · {z.title}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5">셀러 ID {z.seller_id} · 시작 {z.started_at}</p>
                          {z.last_error && <p className="text-[11px] text-red-600 mt-1 truncate">⚠️ {z.last_error}</p>}
                        </div>
                        <button
                          onClick={() => handleForceEnd(z.id, z.title)}
                          className="shrink-0 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
                        >
                          강제 종료
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
