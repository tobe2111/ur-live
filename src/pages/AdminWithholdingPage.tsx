/**
 * 🛡️ 2026-05-19: 어드민 — 원천징수 + 지급조서 export.
 *
 *   소득세법 §164, §165 — 지급자(법인) 매년 1월말까지 국세청 제출 의무.
 *   비사업자 셀러에게 지급한 정산금 (현금 / KT Alpha 교환권) 원천징수 8.8%.
 *
 *   여기서:
 *     - 연도별 셀러별 누계 표 (300만 초과 = 종합소득 신고 의무 마킹)
 *     - CSV 다운로드 (홈택스 업로드)
 *     - 제출 완료 마킹 (reported_at)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatWon, formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'

interface SellerSummary {
  seller_id: number
  seller_name: string
  seller_email: string
  business_number: string | null
  total_gross: number
  total_withheld: number
  total_net: number
  payout_count: number
  reportable: number
  last_payout_at: string | null
}

interface Totals {
  total_gross: number
  total_withheld: number
  unique_sellers: number
  reportable_count: number
  reported_count: number
  total_rows: number
}

export default function AdminWithholdingPage() {
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear())
  const [sellers, setSellers] = useState<SellerSummary[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  async function load() {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const r = await api.get(`/api/admin/withholding/summary?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.data?.success) {
        setSellers(r.data.data.sellers || [])
        setTotals(r.data.data.totals || null)
      }
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  function downloadCsv(reportableOnly: boolean) {
    const token = localStorage.getItem('admin_token')
    const url = `/api/admin/withholding/csv?year=${year}${reportableOnly ? '&reportable_only=1' : ''}`
    // 새 탭 + Bearer 헤더로 다운로드 (fetch + blob).
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `withholding-${year}${reportableOnly ? '-reportable' : ''}.csv`
        link.click()
        URL.revokeObjectURL(link.href)
      })
      .catch((e) => toast.error(`CSV 다운로드 실패: ${e.message}`))
  }

  async function markReported() {
    if (!confirm(`${year}년도 reportable 행을 모두 '제출 완료' 마킹할까요?\n홈택스 업로드 후에만 실행하세요.`)) return
    setMarking(true)
    try {
      const token = localStorage.getItem('admin_token')
      const r = await api.post('/api/admin/withholding/mark-reported',
        { year },
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(`✅ ${r.data.data.updated}건 제출 완료 마킹`)
        load()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '마킹 실패')
    } finally { setMarking(false) }
  }

  return (
    <AdminLayout title="원천징수 / 지급조서">
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="📋 원천징수 / 지급조서"
          subtitle="비사업자 셀러 정산 원천징수 (8.8%) 추적 · 매년 1월말 국세청 제출 의무"
          icon={<FileSpreadsheet className="h-5 w-5" />}
        />

        {/* 연도 선택 */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-gray-700">연도</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {[0, 1, 2, 3].map((delta) => {
              const y = new Date().getFullYear() - delta
              return <option key={y} value={y}>{y}년</option>
            })}
          </select>
        </div>

        {/* KPI */}
        {totals && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="총 지급액 (gross)" value={formatWon(totals.total_gross)} sub={`${formatNumber(totals.total_rows)}건`} />
            <Kpi label="총 원천징수액" value={formatWon(totals.total_withheld)} sub={`8.8% 기준`} accent="amber" />
            <Kpi label="대상 셀러" value={`${formatNumber(totals.unique_sellers)}명`} sub={`reportable ${totals.reportable_count}건`} />
            <Kpi label="국세청 제출" value={`${formatNumber(totals.reported_count)}/${totals.reportable_count}`} sub={totals.reported_count === totals.reportable_count ? '✅ 완료' : '⚠️ 미제출'}
              accent={totals.reported_count === totals.reportable_count ? 'emerald' : 'red'} />
          </div>
        )}

        {/* Action 버튼 */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-700">
            <Download className="w-4 h-4" /> 전체 CSV ({year})
          </button>
          <button onClick={() => downloadCsv(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600">
            <Download className="w-4 h-4" /> 300만 초과 CSV (홈택스용)
          </button>
          <button onClick={markReported} disabled={marking}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" /> {marking ? '처리 중...' : '제출 완료 마킹'}
          </button>
        </div>

        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[12px] text-blue-900 space-y-1">
          <p className="font-bold flex items-center gap-1">ℹ️ 운영 가이드</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>매년 1월 1~31일 사이에 전년도 (위 셀렉터에서 연도 변경) 지급조서 국세청 제출 (홈택스).</li>
            <li><b>'300만 초과 CSV'</b> 다운로드 → 홈택스 → "기타소득 지급명세서" → CSV 업로드.</li>
            <li>제출 완료 후 <b>'제출 완료 마킹'</b> 클릭 → reported_at 기록 (중복 제출 방지).</li>
            <li>비사업자 셀러는 본인이 5월 종합소득세 신고 시 본 원천징수액을 세액공제로 활용 가능.</li>
          </ul>
        </div>

        {/* 셀러별 누계 표 */}
        {loading ? <DashboardLoading /> : sellers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{year}년 원천징수 이력 없음</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-500">
                    {['셀러', '이메일', '사업자번호', '지급 횟수', '총 지급액', '원천징수액', '실수령액', '상태'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sellers.map((s) => (
                    <tr key={s.seller_id} className="hover:bg-gray-50 text-xs">
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-bold text-gray-900">{s.seller_name}</p>
                          <p className="text-[10px] text-gray-400">ID {s.seller_id}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 font-mono text-[11px]">{s.seller_email}</td>
                      <td className="px-3 py-3 text-gray-600 font-mono text-[11px]">{s.business_number || '-'}</td>
                      <td className="px-3 py-3 text-gray-700 text-right">{formatNumber(s.payout_count)}건</td>
                      <td className="px-3 py-3 text-gray-700 text-right font-semibold">{formatWon(s.total_gross)}</td>
                      <td className="px-3 py-3 text-amber-700 text-right font-bold">{formatWon(s.total_withheld)}</td>
                      <td className="px-3 py-3 text-gray-900 text-right font-bold">{formatWon(s.total_net)}</td>
                      <td className="px-3 py-3">
                        {s.reportable ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> 300만 초과
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600">
                            분리과세
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'amber' | 'red' | 'emerald' }) {
  const color = accent === 'amber' ? 'text-amber-700'
              : accent === 'red' ? 'text-red-600'
              : accent === 'emerald' ? 'text-emerald-700'
              : 'text-gray-900'
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
