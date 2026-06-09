/**
 * Admin Bulk Email Page — 어드민 단체메일 (Wave 3b, 2026-06-09)
 *
 * 역할/등급/상태 필터로 수신자를 고르고 → 미리보기(수신자 수) → 작성 → 테스트발송 → 발송.
 * 기존 이메일 인프라(Resend) 재사용. 라이트 테마 고정(대시보드).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Send, Users, FlaskConical, RefreshCw, Clock } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatNumber } from '@/utils/format'

type Role = 'seller' | 'distributor' | 'supplier'
type StatusFilter = 'all' | 'approved' | 'pending'

interface PreviewData {
  count: number
  capped: boolean
  sample: { name: string; email: string }[]
}

interface LogRow {
  id: number
  admin_email: string | null
  filter_json: string | null
  subject: string
  recipient_count: number
  sent_count: number
  failed_count: number
  skipped_count: number
  is_test: number
  created_at: string
}

interface JobRow {
  id: number
  admin_email: string | null
  subject: string
  status: 'pending' | 'sending' | 'done' | 'failed'
  total: number
  sent: number
  failed: number
  created_at: string
  updated_at: string
}

const DISTRIBUTOR_GRADES = ['all', 'A', 'B', 'C', 'D']

export default function AdminBulkEmailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [role, setRole] = useState<Role>('seller')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [grade, setGrade] = useState<string>('all')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')

  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState<LogRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  const buildFilter = useCallback(() => {
    const f: { role: Role; status: StatusFilter; grade?: string } = { role, status }
    if (role === 'distributor' && grade !== 'all') f.grade = grade
    return f
  }, [role, status, grade])

  const loadPreview = useCallback(async () => {
    setPreviewing(true)
    try {
      const res = await api.post('/api/admin/bulk-email/preview', { filter: buildFilter() }, { headers })
      if (res.data?.success) setPreview(res.data.data as PreviewData)
      else {
        setPreview(null)
        toast.error(res.data?.error || t('admin.bulkEmail.previewFail', { defaultValue: '수신자 조회 실패' }))
      }
    } catch {
      setPreview(null)
      toast.error(t('admin.bulkEmail.previewFail', { defaultValue: '수신자 조회 실패' }))
    } finally {
      setPreviewing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildFilter, t])

  const loadLog = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/bulk-email/log', { headers })
      if (res.data?.success) setLog((res.data.data as LogRow[]) || [])
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/bulk-email/jobs', { headers })
      if (res.data?.success) setJobs((res.data.data as JobRow[]) || [])
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 필터 변경 시 미리보기 자동 갱신.
  useEffect(() => { loadPreview() }, [loadPreview])
  useEffect(() => { loadLog() }, [loadLog])
  useEffect(() => { loadJobs() }, [loadJobs])

  // 큐 처리 중(pending/sending) 작업이 있으면 5초마다 진척 자동 갱신.
  const hasActiveJob = jobs.some((j) => j.status === 'pending' || j.status === 'sending')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!hasActiveJob) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(() => { loadJobs() }, 5000)
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [hasActiveJob, loadJobs])

  async function handleSend(test: boolean) {
    if (!subject.trim()) {
      toast.error(t('admin.bulkEmail.needSubject', { defaultValue: '제목을 입력해주세요' }))
      return
    }
    if (!bodyText.trim()) {
      toast.error(t('admin.bulkEmail.needBody', { defaultValue: '본문을 입력해주세요' }))
      return
    }
    if (!test) {
      const n = preview?.count ?? 0
      if (n === 0) {
        toast.error(t('admin.bulkEmail.noRecipients', { defaultValue: '수신자가 없습니다' }))
        return
      }
      const ok = window.confirm(
        t('admin.bulkEmail.confirmSend', {
          defaultValue: `${formatNumber(n)}명에게 단체메일을 발송합니다. 진행할까요?`,
        }) as string,
      )
      if (!ok) return
    }

    setSending(true)
    try {
      const res = await api.post(
        '/api/admin/bulk-email',
        { filter: buildFilter(), subject: subject.trim(), body: bodyText, test },
        { headers },
      )
      if (res.data?.success) {
        const d = res.data.data
        toast.success(
          test
            ? t('admin.bulkEmail.testSent', { defaultValue: '테스트 메일을 본인에게 발송했습니다' })
            : t('admin.bulkEmail.enqueued', {
                defaultValue: `발송 작업이 등록되었습니다 (큐 처리 중 · ${formatNumber(d.total)}명)`,
              }),
        )
        if (!test) { setSubject(''); setBodyText('') }
        loadJobs()
        loadLog()
      } else {
        toast.error(res.data?.error || t('admin.bulkEmail.sendFail', { defaultValue: '발송 실패' }))
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('admin.bulkEmail.sendFail', { defaultValue: '발송 실패' }))
    } finally {
      setSending(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <AdminLayout title={t('admin.bulkEmail.title', { defaultValue: '단체메일' })}>
      <DashboardPageHeader
        title={t('admin.bulkEmail.title', { defaultValue: '단체메일' })}
        subtitle={t('admin.bulkEmail.subtitle', { defaultValue: '역할·등급·상태로 수신자를 골라 이메일을 일괄 발송합니다 (Resend)' })}
        icon={<Mail className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* 좌: 필터 + 작성 */}
        <div className="space-y-5 lg:col-span-2">
          {/* 수신자 필터 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Users className="h-4 w-4 text-blue-600" />
              {t('admin.bulkEmail.recipientFilter', { defaultValue: '수신자 필터' })}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {t('admin.bulkEmail.role', { defaultValue: '역할' })}
                </label>
                <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="seller">{t('admin.bulkEmail.roleSeller', { defaultValue: '셀러' })}</option>
                  <option value="distributor">{t('admin.bulkEmail.roleDistributor', { defaultValue: '유통사' })}</option>
                  <option value="supplier">{t('admin.bulkEmail.roleSupplier', { defaultValue: '제조사' })}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {t('admin.bulkEmail.status', { defaultValue: '상태' })}
                </label>
                <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
                  <option value="all">{t('admin.bulkEmail.statusAll', { defaultValue: '전체' })}</option>
                  <option value="approved">{t('admin.bulkEmail.statusApproved', { defaultValue: '승인됨' })}</option>
                  <option value="pending">{t('admin.bulkEmail.statusPending', { defaultValue: '대기중' })}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {t('admin.bulkEmail.grade', { defaultValue: '등급 (유통사)' })}
                </label>
                <select
                  className={inputCls}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={role !== 'distributor'}
                >
                  {DISTRIBUTOR_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g === 'all' ? t('admin.bulkEmail.gradeAll', { defaultValue: '전체 등급' }) : g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 미리보기 결과 */}
            <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
              <div className="text-sm">
                {previewing ? (
                  <span className="text-gray-500">{t('admin.bulkEmail.counting', { defaultValue: '집계 중…' })}</span>
                ) : (
                  <span className="font-semibold text-blue-700">
                    {t('admin.bulkEmail.willSendTo', {
                      defaultValue: `${formatNumber(preview?.count ?? 0)}명에게 발송`,
                    })}
                    {preview?.capped && (
                      <span className="ml-2 text-xs font-normal text-amber-600">
                        {t('admin.bulkEmail.capped', { defaultValue: '(상한 도달 — 일부만 표시)' })}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button
                onClick={loadPreview}
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-3 w-3" />
                {t('admin.bulkEmail.refresh', { defaultValue: '새로고침' })}
              </button>
            </div>
            {preview && preview.sample.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {t('admin.bulkEmail.sampleLabel', { defaultValue: '예시:' })}{' '}
                {preview.sample.map((s) => `${s.name || '-'} <${s.email}>`).join(', ')}
              </p>
            )}
          </div>

          {/* 메일 작성 */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Mail className="h-4 w-4 text-blue-600" />
              {t('admin.bulkEmail.compose', { defaultValue: '메일 작성' })}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {t('admin.bulkEmail.subjectLabel', { defaultValue: '제목' })}
                </label>
                <input
                  className={inputCls}
                  value={subject}
                  maxLength={200}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('admin.bulkEmail.subjectPh', { defaultValue: '메일 제목' }) as string}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  {t('admin.bulkEmail.bodyLabel', { defaultValue: '본문 (일반 텍스트 또는 간단한 HTML)' })}
                </label>
                <textarea
                  className={`${inputCls} min-h-[200px] resize-y font-mono`}
                  value={bodyText}
                  maxLength={50000}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder={t('admin.bulkEmail.bodyPh', { defaultValue: '안녕하세요, 유어딜입니다…' }) as string}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {t('admin.bulkEmail.bodyHint', {
                    defaultValue: '법적 안내 및 수신거부 문구는 자동으로 하단에 추가됩니다.',
                  })}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleSend(true)}
                disabled={sending}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <FlaskConical className="h-4 w-4" />
                {t('admin.bulkEmail.testSend', { defaultValue: '본인에게 테스트 발송' })}
              </button>
              <button
                onClick={() => handleSend(false)}
                disabled={sending || (preview?.count ?? 0) === 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending
                  ? t('admin.bulkEmail.sending', { defaultValue: '발송 중…' })
                  : t('admin.bulkEmail.sendNow', {
                      defaultValue: `${formatNumber(preview?.count ?? 0)}명에게 발송`,
                    })}
              </button>
            </div>
          </div>
        </div>

        {/* 우: 발송 작업 진행 + 최근 발송 로그 */}
        <div className="space-y-5">

        {/* 발송 작업 큐 (진행상황) — pending/sending 이면 자동 갱신 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Clock className="h-4 w-4 text-blue-600" />
              {t('admin.bulkEmail.jobsTitle', { defaultValue: '발송 작업 (큐)' })}
            </h2>
            <button onClick={loadJobs} className="text-gray-400 hover:text-gray-600" aria-label="새로고침">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {jobs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {t('admin.bulkEmail.noJobs', { defaultValue: '진행 중인 작업이 없습니다' })}
            </p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => {
                const processed = (job.sent ?? 0) + (job.failed ?? 0)
                const pct = job.total > 0 ? Math.min(100, Math.round((processed / job.total) * 100)) : 0
                const active = job.status === 'pending' || job.status === 'sending'
                const statusLabel =
                  job.status === 'done'
                    ? t('admin.bulkEmail.jobDone', { defaultValue: '완료' })
                    : job.status === 'failed'
                      ? t('admin.bulkEmail.jobFailed', { defaultValue: '실패' })
                      : job.status === 'sending'
                        ? t('admin.bulkEmail.jobSending', { defaultValue: '발송 중' })
                        : t('admin.bulkEmail.jobPending', { defaultValue: '대기 중' })
                const badgeCls =
                  job.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : job.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                return (
                  <li key={job.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900">{job.subject}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeCls}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${job.status === 'failed' ? 'bg-red-400' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span className="text-green-600">
                        {t('admin.bulkEmail.logSent', { defaultValue: '성공' })} {formatNumber(job.sent)}
                      </span>
                      {job.failed > 0 && (
                        <span className="text-red-500">
                          {t('admin.bulkEmail.logFailed', { defaultValue: '실패' })} {formatNumber(job.failed)}
                        </span>
                      )}
                      <span>/ {formatNumber(job.total)}</span>
                      <span className="ml-auto text-gray-400">{pct}%</span>
                    </div>
                    {active && (
                      <p className="mt-1 text-[11px] text-blue-500">
                        {t('admin.bulkEmail.jobAutoRefresh', { defaultValue: '큐 처리 중 — 자동 갱신됩니다' })}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 최근 발송 로그 (완료 요약) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              {t('admin.bulkEmail.recentLog', { defaultValue: '최근 발송 내역' })}
            </h2>
            <button onClick={loadLog} className="text-gray-400 hover:text-gray-600" aria-label="새로고침">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {log.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {t('admin.bulkEmail.noLog', { defaultValue: '발송 내역이 없습니다' })}
            </p>
          ) : (
            <ul className="space-y-3">
              {log.map((row) => (
                <li key={row.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">{row.subject}</p>
                    {row.is_test === 1 && (
                      <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                        {t('admin.bulkEmail.testBadge', { defaultValue: '테스트' })}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="text-green-600">
                      {t('admin.bulkEmail.logSent', { defaultValue: '성공' })} {formatNumber(row.sent_count)}
                    </span>
                    {row.failed_count > 0 && (
                      <span className="text-red-500">
                        {t('admin.bulkEmail.logFailed', { defaultValue: '실패' })} {formatNumber(row.failed_count)}
                      </span>
                    )}
                    {row.skipped_count > 0 && (
                      <span className="text-amber-500">
                        {t('admin.bulkEmail.logSkipped', { defaultValue: '건너뜀' })} {formatNumber(row.skipped_count)}
                      </span>
                    )}
                    <span>/ {formatNumber(row.recipient_count)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {row.created_at}
                    {row.admin_email ? ` · ${row.admin_email}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      </div>
    </AdminLayout>
  )
}
