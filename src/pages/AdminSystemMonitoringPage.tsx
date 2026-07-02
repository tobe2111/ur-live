/**
 * 🛡️ 2026-05-07: Admin 시스템 운영 모니터링 — Cron 실패 + 알림톡 실패 통합 뷰.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState, DashboardCard } from '@/components/dashboard'
import { Activity, AlertTriangle, RefreshCw, CheckCircle2, MessageSquare, Loader2, Bell } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface CronFailure {
  id: number
  job_name: string
  error_message: string
  severity: 'warning' | 'error' | 'critical'
  resolved: number
  created_at: string
}

interface AlimtalkFailure {
  id: number
  phone: string
  template_code: string
  message: string
  error: string | null
  retry_count: number
  max_retries: number
  next_retry_at: string
  resolved: number
  created_at: string
}

// 🔔 2026-07-01: push_failures / email_failures dead-letter (재시도 크론은 있었지만 볼 UI 가 없었음)
interface PushFailure {
  id: number; user_type: string; user_id: number; title: string; body: string; url: string | null
  subscription_count: number; retry_count: number; max_retries: number
  next_retry_at: string; resolved: number; created_at: string
}
interface EmailFailure {
  id: number; recipient: string; subject: string; error: string | null
  retry_count: number; max_retries: number; next_retry_at: string; resolved: number; created_at: string
}
interface DeliveryStats { abandoned: number; pending: number; succeeded: number }
const EMPTY_DELIVERY = { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } }

const SEVERITY_BADGE: Record<string, string> = {
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-purple-100 text-purple-700 border-purple-200',
}

// 🔔 2026-07-01: 알림 채널별 설정 키(모두 있어야 해당 채널 발송 동작). /api/version 존재여부로 판정.
const CHANNEL_ROWS: Array<{ label: string; keys: string[] }> = [
  { label: '웹푸시', keys: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] },
  { label: '이메일', keys: ['RESEND_API_KEY'] },
  { label: '알림톡', keys: ['ALIGO_API_KEY', 'ALIGO_USER_ID'] },
  { label: '네이티브푸시', keys: ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'] },
]

export default function AdminSystemMonitoringPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'cron' | 'alimtalk' | 'delivery'>('cron')
  const [showResolved, setShowResolved] = useState(false)
  const [acting, setActing] = useState<number | null>(null)
  const [channels, setChannels] = useState<Record<string, boolean> | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    let alive = true
    api.get('/api/version').then(r => { if (alive && r.data?.secrets) setChannels(r.data.secrets) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  // 🔔 나에게 테스트 푸시 — 본인 구독에만 발송. 반환값으로 미도달 원인까지 안내.
  const sendTestPush = async () => {
    setTesting(true)
    try {
      const res = await api.post('/api/push/test', {}, auth)
      const r = res.data?.result
      if (r?.skipped) {
        toast.error(
          (r.subscription_count ?? 0) === 0
            ? '이 관리자 계정에 등록된 푸시 구독이 없어요 — 먼저 브라우저에서 알림을 켜세요'
            : '발송 skip — VAPID 미설정 또는 알림 꺼짐',
        )
      } else if ((r?.delivered ?? 0) > 0) {
        toast.success(`테스트 푸시 발송됨 (${r.delivered}개 기기)`)
      } else {
        toast.error(`전달 0 — 구독 ${r?.subscription_count ?? 0} · 만료 ${r?.expired ?? 0}`)
      }
    } catch { toast.error('테스트 발송 실패') } finally { setTesting(false) }
  }

  // 🛡️ 2026-06-03 Tier2(대시보드): 탭별 수동 페칭 → useApiQuery (cron / alimtalk, resolved key 반응형).
  const cronQ = useApiQuery<{ items: CronFailure[]; counts: Array<{ severity: string; cnt: number }> }>(
    ['admin', 'cron-failures', showResolved], '/api/admin/cron-failures',
    { params: { resolved: showResolved ? 1 : 0 }, enabled: tab === 'cron', select: (r: any) => ({ items: r?.success ? (r.data.items || []) : [], counts: r?.success ? (r.data.unresolved_counts || []) : [] }) },
  )
  const alimtalkQ = useApiQuery<{ items: AlimtalkFailure[]; stats: { abandoned: number; pending: number; succeeded: number }; by_template: Array<{ template_code: string; unresolved: number; abandoned: number; registered: boolean; last_error: string | null }> }>(
    ['admin', 'alimtalk-failures', showResolved], '/api/admin/alimtalk-failures',
    { params: { resolved: showResolved ? 1 : 0 }, enabled: tab === 'alimtalk', select: (r: any) => ({ items: r?.success ? (r.data.items || []) : [], stats: r?.success ? r.data.stats : { abandoned: 0, pending: 0, succeeded: 0 }, by_template: r?.success ? (r.data.by_template || []) : [] }) },
  )
  const deliveryQ = useApiQuery<{ push: { items: PushFailure[]; stats: DeliveryStats }; email: { items: EmailFailure[]; stats: DeliveryStats } }>(
    ['admin', 'delivery-failures', showResolved], '/api/admin/delivery-failures',
    { params: { resolved: showResolved ? 1 : 0 }, enabled: tab === 'delivery', select: (r: any) => ({ push: r?.success ? (r.data.push || EMPTY_DELIVERY) : EMPTY_DELIVERY, email: r?.success ? (r.data.email || EMPTY_DELIVERY) : EMPTY_DELIVERY }) },
  )
  const cronFailures = cronQ.data?.items ?? []
  const cronCounts = cronQ.data?.counts ?? []
  const alimtalkFailures = alimtalkQ.data?.items ?? []
  const alimtalkStats = alimtalkQ.data?.stats ?? { abandoned: 0, pending: 0, succeeded: 0 }
  const alimtalkByTemplate = alimtalkQ.data?.by_template ?? []
  const deliveryPush = deliveryQ.data?.push ?? EMPTY_DELIVERY
  const deliveryEmail = deliveryQ.data?.email ?? EMPTY_DELIVERY
  const loading = tab === 'cron' ? cronQ.isLoading : tab === 'alimtalk' ? alimtalkQ.isLoading : deliveryQ.isLoading
  const load = () => { if (tab === 'cron') cronQ.refetch(); else if (tab === 'alimtalk') alimtalkQ.refetch(); else deliveryQ.refetch() }

  const retryDelivery = async (kind: 'push' | 'email', id: number) => {
    setActing(id)
    try {
      const res = await api.post(`/api/admin/delivery-failures/${kind}/${id}/retry`, {}, auth)
      toast.success(res.data?.message || '재시도 예약됨')
      deliveryQ.refetch()
    } catch { toast.error('실패') } finally { setActing(null) }
  }

  const resolveCron = async (id: number) => {
    setActing(id)
    try {
      await api.patch(`/api/admin/cron-failures/${id}/resolve`, {}, auth)
      toast.success('해결 처리 완료')
      load()
    } catch { toast.error('실패') } finally { setActing(null) }
  }

  const retryAlimtalk = async (id: number) => {
    setActing(id)
    try {
      const res = await api.post(`/api/admin/alimtalk-failures/${id}/retry`, {}, auth)
      toast.success(res.data?.message || '재시도 예약됨')
      load()
    } catch { toast.error('실패') } finally { setActing(null) }
  }

  return (
    <AdminLayout title="시스템 모니터링">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          icon={<Activity className="h-5 w-5" />}
          title="시스템 모니터링"
          subtitle="Cron job 실패 + 알림톡 발송 실패 자동 추적"
        />

        {/* 🔔 알림 채널 상태 + 테스트 푸시 */}
        {channels && (
          <DashboardCard className="!p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-700 mr-1">알림 채널 설정</span>
              {CHANNEL_ROWS.map(({ label, keys }) => {
                const ok = keys.every(k => channels[k])
                return (
                  <span key={label}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      ok ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                    }`}>
                    {ok ? '✓' : '✕'} {label}
                  </span>
                )
              })}
              <div className="flex-1" />
              <button onClick={sendTestPush} disabled={testing}
                className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                나에게 테스트 푸시
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              ✕ 채널은 Cloudflare에 키 미설정으로 조용히 발송되지 않습니다. 테스트 푸시는 이 브라우저에서 알림을 켠 뒤 눌러야 도달합니다.
            </p>
          </DashboardCard>
        )}

        {/* 탭 */}
        <div className="flex gap-2">
          <button onClick={() => setTab('cron')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'cron' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            <AlertTriangle className="w-4 h-4" /> Cron 실패
            {cronCounts.reduce((s, c) => s + c.cnt, 0) > 0 && tab !== 'cron' && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {cronCounts.reduce((s, c) => s + c.cnt, 0)}
              </span>
            )}
          </button>
          <button onClick={() => setTab('alimtalk')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'alimtalk' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            <MessageSquare className="w-4 h-4" /> 알림톡 실패
            {alimtalkStats.pending + alimtalkStats.abandoned > 0 && tab !== 'alimtalk' && (
              <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1.5 py-0.5">
                {alimtalkStats.pending + alimtalkStats.abandoned}
              </span>
            )}
          </button>
          <button onClick={() => setTab('delivery')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'delivery' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            <Bell className="w-4 h-4" /> 푸시·이메일 실패
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            해결됨 보기
          </label>
          <button onClick={load} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
        </div>

        {/* 통계 */}
        {tab === 'cron' && cronCounts.length > 0 && (
          <DashboardCard className="!p-3">
            <div className="flex flex-wrap gap-2">
              {cronCounts.map(c => (
                <span key={c.severity} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SEVERITY_BADGE[c.severity] || 'bg-gray-100'}`}>
                  {c.severity}: {c.cnt}건
                </span>
              ))}
            </div>
          </DashboardCard>
        )}
        {tab === 'alimtalk' && (
          <DashboardCard className="!p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500">7일 성공</p>
                <p className="text-lg font-bold text-green-600">{alimtalkStats.succeeded}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">대기 중</p>
                <p className="text-lg font-bold text-amber-600">{alimtalkStats.pending}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">포기됨 (max 3회 초과)</p>
                <p className="text-lg font-bold text-red-600">{alimtalkStats.abandoned}</p>
              </div>
            </div>
          </DashboardCard>
        )}

        {tab === 'delivery' && (
          <DashboardCard className="!p-3">
            <div className="grid grid-cols-2 gap-4">
              {([['웹푸시', deliveryPush.stats], ['이메일', deliveryEmail.stats]] as const).map(([label, s]) => (
                <div key={label} className="text-center">
                  <p className="text-xs font-bold text-gray-700 mb-1">{label} (7일)</p>
                  <div className="grid grid-cols-3 gap-1">
                    <div><p className="text-[10px] text-gray-500">복구</p><p className="text-sm font-bold text-green-600">{s.succeeded}</p></div>
                    <div><p className="text-[10px] text-gray-500">대기</p><p className="text-sm font-bold text-amber-600">{s.pending}</p></div>
                    <div><p className="text-[10px] text-gray-500">포기</p><p className="text-sm font-bold text-red-600">{s.abandoned}</p></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              발송 실패는 5분 크론이 자동 재시도(max 3회)합니다. '즉시 재시도'는 포기된 건도 되살립니다.
            </p>
          </DashboardCard>
        )}

        {/* 🔔 진단: template_code 별 미해결 실패 — registered:false 반복 = Aligo 미등록 템플릿(등록 필요) */}
        {tab === 'alimtalk' && alimtalkByTemplate.length > 0 && (
          <DashboardCard className="!p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">템플릿별 진단 (미해결 기준)</p>
            <p className="text-[11px] text-gray-500 mb-2 leading-snug">
              ⚠️ <b>미등록</b> 템플릿이 반복 실패하면 Aligo 콘솔에 해당 <code>tpl_code</code>로 템플릿을 등록·승인해야 합니다.
              (알림톡엔 SMS 폴백이 없어 그동안 해당 알림은 전달되지 않고 인앱/푸시로만 도달합니다.)
            </p>
            <div className="space-y-1">
              {alimtalkByTemplate.map(t => (
                <div key={t.template_code} className="flex items-center justify-between gap-2 text-xs border-b border-gray-100 py-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 shrink-0">{t.template_code}</code>
                    {t.registered ? (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded shrink-0">등록됨</span>
                    ) : (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">미등록</span>
                    )}
                    {t.last_error && <span className="text-gray-400 truncate">{t.last_error}</span>}
                  </div>
                  <span className="text-gray-600 shrink-0">미해결 {t.unresolved} · 포기 {t.abandoned}</span>
                </div>
              ))}
            </div>
          </DashboardCard>
        )}

        {/* 목록 */}
        {loading ? <DashboardLoading /> : tab === 'cron' ? (
          cronFailures.length === 0 ? (
            <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title={showResolved ? '해결된 실패 없음' : '🎉 미해결 cron 실패 없음'} />
          ) : (
            <div className="space-y-2">
              {cronFailures.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{f.job_name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${SEVERITY_BADGE[f.severity]}`}>
                          {f.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 break-words">{f.error_message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(f.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    {!f.resolved && (
                      <button onClick={() => resolveCron(f.id)} disabled={acting === f.id}
                        className="shrink-0 px-3 py-1.5 bg-green-100 text-green-700 rounded text-[11px] font-bold disabled:opacity-50">
                        {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '해결'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'delivery' ? (
          deliveryPush.items.length === 0 && deliveryEmail.items.length === 0 ? (
            <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title={showResolved ? '복구된 발송 없음' : '🎉 미해결 푸시·이메일 실패 없음'} />
          ) : (
            <div className="space-y-2">
              {deliveryPush.items.map(f => (
                <div key={`p${f.id}`} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded font-bold shrink-0">웹푸시</span>
                        <p className="text-sm font-bold text-gray-900 truncate">{f.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          f.retry_count >= f.max_retries && !f.resolved ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{f.retry_count}/{f.max_retries}회</span>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{f.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {f.user_type}#{f.user_id} · 구독 {f.subscription_count} · {new Date(f.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    {!f.resolved && (
                      <button onClick={() => retryDelivery('push', f.id)} disabled={acting === f.id}
                        className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-[11px] font-bold disabled:opacity-50">
                        {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '즉시 재시도'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {deliveryEmail.items.map(f => (
                <div key={`e${f.id}`} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold shrink-0">이메일</span>
                        <p className="text-sm font-bold text-gray-900 truncate">{f.subject}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                          f.retry_count >= f.max_retries && !f.resolved ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{f.retry_count}/{f.max_retries}회</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{f.recipient}</p>
                      {f.error && <p className="text-[10px] text-red-500 mt-1">에러: {f.error}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{new Date(f.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    {!f.resolved && (
                      <button onClick={() => retryDelivery('email', f.id)} disabled={acting === f.id}
                        className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-[11px] font-bold disabled:opacity-50">
                        {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '즉시 재시도'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          alimtalkFailures.length === 0 ? (
            <DashboardEmptyState icon={<CheckCircle2 className="h-7 w-7 text-green-500" />} title={showResolved ? '성공한 발송 없음' : '🎉 미해결 알림톡 실패 없음'} />
          ) : (
            <div className="space-y-2">
              {alimtalkFailures.map(f => {
                const abandoned = f.retry_count >= f.max_retries && !f.resolved
                return (
                  <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-mono text-gray-900">{f.phone}</p>
                          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{f.template_code}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            abandoned ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {f.retry_count}/{f.max_retries}회
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">{f.message}</p>
                        {f.error && <p className="text-[10px] text-red-500 mt-1">에러: {f.error}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">
                          생성: {new Date(f.created_at).toLocaleString('ko-KR')} · 다음 시도: {new Date(f.next_retry_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      {!f.resolved && (
                        <button onClick={() => retryAlimtalk(f.id)} disabled={acting === f.id}
                          className="shrink-0 px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-[11px] font-bold disabled:opacity-50">
                          {acting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '즉시 재시도'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </AdminLayout>
  )
}
