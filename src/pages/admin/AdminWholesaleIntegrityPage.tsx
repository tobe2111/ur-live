import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { ShieldCheck, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { useTranslation } from 'react-i18next'
import AdminDataTable, { type AdminDataTableColumn } from '@/components/admin/AdminDataTable'

// 🏭 DATA-1 (2026-06-08) 어드민 도매몰 무결성(고아행) 리포트.
//   cron `wholesale-orphan-sweep` 이 매일 LEFT JOIN/NOT EXISTS 로 dangling 행을 집계 → 이 페이지는 그 결과만 표시.
//   ⚠️ flag-only: 자동 삭제 없음. 고아행 정리는 어드민 수동 판단 영역. 라이트 고정 테마.

interface OrphanCheck {
  key: string
  label: string
  count: number
  sample_ids: Array<number | string>
  error: string | null
}

interface IntegrityReport {
  run_at: string
  total_orphans: number
  checks: OrphanCheck[]
}

interface IntegrityResponse {
  success: boolean
  ran: boolean
  report: IntegrityReport | null
  flag_only: boolean
}

export default function AdminWholesaleIntegrityPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<IntegrityReport | null>(null)

  const { data, isLoading: loading, refetch } = useApiQuery<IntegrityResponse>(
    ['admin', 'wholesale-integrity'],
    '/api/admin/wholesale/integrity',
    { headers: h.headers, select: (r: any) => r as IntegrityResponse },
  )

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])
  useEffect(() => { if (data?.report) setReport(data.report) }, [data])

  // 지금 점검 실행 — cron 과 동일 스윕을 즉시 재실행하고 결과를 그대로 표시.
  async function runNow() {
    setRunning(true)
    try {
      const r = await api.get('/api/admin/wholesale/integrity', { ...h, params: { run: 1 } })
      const res = r.data as IntegrityResponse
      if (!res?.success) { toast.error(t('admin.integrity.runFail', { defaultValue: '점검 실행 실패' })); return }
      if (res.report) setReport(res.report)
      toast.success(t('admin.integrity.runDone', { defaultValue: '점검 완료' }))
      refetch()
    } catch {
      toast.error(t('admin.integrity.runFail', { defaultValue: '점검 실행 실패' }))
    } finally {
      setRunning(false)
    }
  }

  const checks = report?.checks ?? []
  const totalOrphans = report?.total_orphans ?? 0
  const failedChecks = checks.filter(c => c.error).length

  // 🧱 2026-06-10: 공통 AdminDataTable 레퍼런스 적용 — 기존 셀 마크업/클래스 그대로 컬럼 정의로 이동.
  const columns: Array<AdminDataTableColumn<OrphanCheck>> = [
    {
      key: 'label',
      label: t('admin.integrity.checkName', { defaultValue: '점검 항목' }),
      render: ch => (
        <>
          <div className="text-gray-900 font-medium">{ch.label}</div>
          <div className="text-xs text-gray-400 mt-0.5 font-mono">{ch.key}</div>
          {ch.error && (
            <div className="text-xs text-amber-600 mt-1">
              {t('admin.integrity.checkError', { defaultValue: '점검 실패' })}: {ch.error}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'count',
      label: t('admin.integrity.count', { defaultValue: '고아행 수' }),
      className: 'text-right',
      render: ch => ch.error ? (
        <span className="text-amber-500 text-xs">—</span>
      ) : (
        <span className={`font-semibold ${ch.count > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatNumber(ch.count)}
        </span>
      ),
    },
    {
      key: 'sample_ids',
      label: t('admin.integrity.sampleIds', { defaultValue: '샘플 ID' }),
      render: ch => (
        <span className="text-gray-600">
          {ch.sample_ids.length === 0 ? (
            <span className="text-gray-300">—</span>
          ) : (
            <span className="font-mono text-xs break-all">
              {ch.sample_ids.join(', ')}
              {ch.count > ch.sample_ids.length && (
                <span className="text-gray-400"> … (+{formatNumber(ch.count - ch.sample_ids.length)})</span>
              )}
            </span>
          )}
        </span>
      ),
    },
  ]

  return (
    <AdminLayout title={t('admin.integrity.navTitle', { defaultValue: '도매 무결성' })}>
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader
          icon={<ShieldCheck className="w-5 h-5" />}
          title={t('admin.integrity.title', { defaultValue: '도매몰 무결성 점검' })}
          subtitle={t('admin.integrity.subtitle', { defaultValue: '참조가 끊긴(고아) 행을 매일 자동 탐지 — 표시 전용, 자동 삭제 없음' })}
        />

        {/* flag-only 안내 배너 */}
        <div className="mt-4 mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {t('admin.integrity.flagOnly', { defaultValue: '이 점검은 참조가 끊긴 행을 표시만 합니다. 어떤 행도 자동으로 삭제하지 않습니다 — 정리 여부는 관리자가 직접 판단하세요.' })}
          </p>
        </div>

        {/* 요약 + 실행 버튼 */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-gray-500">
              {t('admin.integrity.lastRun', { defaultValue: '마지막 점검' })}:{' '}
              <span className="text-gray-900 font-medium">
                {report?.run_at ? new Date(report.run_at).toLocaleString('ko-KR') : t('admin.integrity.never', { defaultValue: '없음' })}
              </span>
            </span>
            <span className={`font-semibold ${totalOrphans > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {t('admin.integrity.totalOrphans', { defaultValue: '고아행 합계' })}: {formatNumber(totalOrphans)}
            </span>
            {failedChecks > 0 && (
              <span className="text-amber-600 font-medium">
                {t('admin.integrity.failedChecks', { defaultValue: '실행 실패 점검' })}: {formatNumber(failedChecks)}
              </span>
            )}
          </div>
          <button
            onClick={runNow}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {t('admin.integrity.runNow', { defaultValue: '지금 점검 실행' })}
          </button>
        </div>

        <AdminDataTable<OrphanCheck>
          columns={columns}
          rows={checks}
          loading={loading && !report}
          empty={
            <>
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{t('admin.integrity.noReport', { defaultValue: '아직 점검 기록이 없습니다. "지금 점검 실행"을 눌러 시작하세요.' })}</p>
            </>
          }
          rowKey={ch => ch.key}
          rowClassName="align-top"
        />
      </div>
    </AdminLayout>
  )
}
