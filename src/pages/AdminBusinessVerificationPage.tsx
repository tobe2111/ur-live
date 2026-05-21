/**
 * 🛡️ 2026-05-18: 어드민 — 사업자등록증 검증 대기 큐.
 *
 *   /admin/business-verification 신규 페이지.
 *   - GET /api/admin/sellers/business-registration/pending → 대기 셀러 목록
 *   - 셀러별: 셀러 정보 + 업로드한 이미지 표시 + verify/reject 버튼
 *   - PATCH /api/admin/sellers/:id/business-registration/verify
 *     { action: 'verify' | 'reject', reason?: string }
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Shield, CheckCircle, XCircle, ExternalLink, Phone, Mail } from 'lucide-react'

interface PendingSeller {
  id: number
  name: string
  business_name: string
  business_number: string | null
  business_registration_image_url: string
  business_registration_status: string
  business_registration_reject_reason: string | null
  created_at: string
  updated_at: string
}

export default function AdminBusinessVerificationPage() {
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<PendingSeller[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function h() { return { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  async function load() {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/sellers/business-registration/pending', { headers: h() })
      if (r.data?.success) setSellers(r.data.data || [])
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  async function verify(sellerId: number) {
    if (!confirm('이 셀러의 사업자등록증을 승인하시겠습니까?\n승인 후 현금 정산 + 딜 환급 가능.')) return
    try {
      const r = await api.patch(`/api/admin/sellers/${sellerId}/business-registration/verify`,
        { action: 'verify' }, { headers: h() })
      if (r.data?.success) { toast.success('승인 완료'); load() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  async function reject(sellerId: number) {
    const reason = prompt('반려 사유를 입력하세요 (셀러에게 표시):')
    if (!reason?.trim()) return
    try {
      const r = await api.patch(`/api/admin/sellers/${sellerId}/business-registration/verify`,
        { action: 'reject', reason: reason.trim() }, { headers: h() })
      if (r.data?.success) { toast.success('반려 처리됨'); load() }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '실패')
    }
  }

  return (
    <AdminLayout title="사업자 검증">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="사업자등록증 검증"
          subtitle="셀러가 제출한 사업자등록증 확인 후 승인/반려 — 검증 셀러만 현금 정산 가능"
          icon={<Shield className="h-5 w-5" />}
        />

        {loading ? (
          <DashboardLoading />
        ) : sellers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">검증 대기 중인 셀러가 없습니다</p>
            <p className="text-[11px] text-gray-400 mt-1">
              셀러가 /seller/settlements 에서 사업자등록증을 제출하면 여기 표시됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              ⚠️ <strong>{sellers.length}건</strong> 검증 대기 — 보통 1-3 영업일 내 처리 권장.
              승인 시 셀러는 현금 정산 + 딜 환급 가능 (8.8% 원천징수 자동 적용).
            </div>

            {sellers.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {/* 좌측: 이미지 */}
                  <div className="bg-gray-50 p-4 flex items-center justify-center min-h-[300px]">
                    {s.business_registration_image_url ? (
                      <a href={s.business_registration_image_url} target="_blank" rel="noopener noreferrer"
                        className="block max-w-full max-h-[400px]">
                        <img
                          src={s.business_registration_image_url}
                          alt={`${s.name} 사업자등록증`}
                          className="max-w-full max-h-[400px] object-contain rounded shadow-sm cursor-zoom-in"
                        />
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400">이미지 없음</p>
                    )}
                  </div>

                  {/* 우측: 정보 + 액션 */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{s.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">셀러 ID #{s.id}</p>
                      </div>
                      <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                        {s.business_registration_reject_reason ? '재제출' : '검증 대기'}
                      </span>
                    </div>

                    <dl className="space-y-1.5 text-xs">
                      <div className="flex">
                        <dt className="text-gray-500 w-24 shrink-0">상호</dt>
                        <dd className="text-gray-900 font-medium">{s.business_name || '(미입력)'}</dd>
                      </div>
                      <div className="flex">
                        <dt className="text-gray-500 w-24 shrink-0">사업자번호</dt>
                        <dd className="text-gray-900 font-mono">{s.business_number || '(미입력)'}</dd>
                      </div>
                      <div className="flex">
                        <dt className="text-gray-500 w-24 shrink-0">제출일</dt>
                        <dd className="text-gray-700">{new Date(s.updated_at).toLocaleString('ko-KR')}</dd>
                      </div>
                    </dl>

                    {s.business_registration_reject_reason && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                        ⚠️ 이전 반려 사유: {s.business_registration_reject_reason}
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1">
                      <p className="font-bold">검증 체크리스트</p>
                      <ul className="space-y-0.5 ml-3 list-disc">
                        <li>이미지가 사업자등록증인지 확인</li>
                        <li>상호/대표자/사업자번호 명확하게 보이는지</li>
                        <li>입력된 사업자번호와 이미지 일치 여부</li>
                        <li>발급일 (오래된 것 X — 최근 6개월 권장)</li>
                      </ul>
                    </div>

                    {/* 외부 도구 — 국세청 사업자번호 조회 */}
                    {s.business_number && (
                      <a href={`https://teht.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/ab/a/a/UTEABAAA13.xml`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-[11px] text-blue-600 hover:underline">
                        <ExternalLink className="w-3 h-3" /> 홈택스에서 사업자번호 진위 확인
                      </a>
                    )}

                    <div className="flex gap-2 mt-5">
                      <button onClick={() => reject(s.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-100">
                        <XCircle className="w-3.5 h-3.5" /> 반려
                      </button>
                      <button onClick={() => verify(s.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" /> 승인
                      </button>
                    </div>
                    {/* 🛡️ 2026-05-21 Phase D: 사장님 매직링크 재발송 (어드민 1-click) */}
                    <button
                      onClick={async () => {
                        if (!confirm(`${s.business_name || s.id} 사장님 매장 매직링크 (QR 스캔 페이지) 카톡 발송?`)) return
                        try {
                          const r = await api.post(`/api/admin/sellers/${s.id}/notify-magic-link`, {}, { headers: h() })
                          if (r.data?.success) {
                            alert(`✅ 발송 완료\n링크: ${r.data.data?.stats_url || ''}`)
                          } else {
                            alert(`❌ ${r.data?.error || '실패'}`)
                          }
                        } catch (err: unknown) {
                          const ax = err as { response?: { data?: { error?: string } } }
                          alert(`❌ ${ax.response?.data?.error || '실패'}`)
                        }
                      }}
                      className="w-full mt-2 inline-flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100"
                    >
                      📱 매장 사장님께 매직링크 카톡 발송
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

// dead-import 가드
void Phone; void Mail
