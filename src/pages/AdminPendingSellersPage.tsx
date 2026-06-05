/**
 * 🛡️ 2026-05-27 (사용자 결정 — 가장 이상적): admin 매장 검수 통합 페이지.
 *
 * 한 페이지에서:
 *   - status='pending' 셀러 목록
 *   - 각 셀러: NTS 진위확인 결과 / 영업 prospect 매칭 / 영업 증빙 (proof_image_url)
 *   - 1-click 승인 / 거부 / NTS 재호출
 *
 * 기존 분산된 admin 페이지 통합 → 어드민 검수 부담 ↓.
 */

import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface PendingSeller {
  id: number
  username: string
  business_name: string | null
  business_number: string | null
  representative_name: string | null
  business_start_date: string | null
  phone: string | null
  email: string | null
  store_category: string | null
  seller_type: string
  status: string
  nts_verified_at: string | null
  nts_verify_result: string | null
  introduced_by_agency_id: string | null
  introduced_by_influencer_id: string | null
  created_at: string
  prospect_proof_url?: string | null
  prospect_notes?: string | null
}

export default function AdminPendingSellersPage() {
  // 🛡️ 2026-06-01 Tier2(대시보드): 수동 페칭 → useApiQuery. 승인/거부 후 refetch.
  const { data: sellers = [], isLoading: loading, refetch } = useApiQuery<PendingSeller[]>(
    ['admin', 'pending-sellers'], '/api/admin/pending-sellers',
    { select: (r: any) => (r?.success ? r.data || [] : []) },
  )
  const load = () => refetch()

  async function approve(id: number) {
    if (!(await confirmDialog('이 셀러를 승인할까요?'))) return
    try {
      const r = await api.post(`/api/admin/sellers/${id}/approve`)
      if (r.data?.success) {
        toast.success('승인됨')
        load()
      }
    } catch {
      toast.error('승인 실패')
    }
  }

  async function reject(id: number) {
    const reason = prompt('거부 사유?')
    if (!reason) return
    try {
      const r = await api.post(`/api/admin/sellers/${id}/reject`, { reason })
      if (r.data?.success) {
        toast.success('거부됨')
        load()
      }
    } catch {
      toast.error('거부 실패')
    }
  }

  async function recheckNts(id: number) {
    try {
      const r = await api.post(`/api/admin/sellers/${id}/recheck-nts`)
      if (r.data?.success) {
        toast.success(r.data.message || 'NTS 재검증 완료')
        load()
      }
    } catch {
      toast.error('재검증 실패')
    }
  }

  return (
    <>
      <SEO title="매장 검수 - admin" description="pending 셀러 통합 검수" url="/admin/pending-sellers" />
      <div className="min-h-screen bg-gray-50 pb-24">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">🏪 매장 검수 ({sellers.length})</h1>
            <Link to="/admin" className="text-xs text-gray-500">← admin</Link>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">로딩 중...</div>
          ) : sellers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-sm text-gray-500">검수 대기 셀러 없음</p>
            </div>
          ) : (
            sellers.map((s) => {
              const ntsResult = s.nts_verify_result ? (() => {
                try { return JSON.parse(s.nts_verify_result) } catch { return null }
              })() : null
              const ntsValid = ntsResult?.valid === '01'
              const ntsActive = ntsResult?.status === '계속사업자'
              const ntsBadge = !ntsResult
                ? { label: '⏳ 검증 대기', color: 'bg-gray-100 text-gray-600' }
                : ntsValid && ntsActive
                  ? { label: '✅ NTS 진위 일치', color: 'bg-green-100 text-green-700' }
                  : ntsResult.valid === '02'
                    ? { label: '❌ NTS 불일치', color: 'bg-red-100 text-red-700' }
                    : { label: `⚠️ ${ntsResult?.status || '확인 필요'}`, color: 'bg-amber-100 text-amber-700' }
              const introducer = s.introduced_by_agency_id
                ? `🏢 에이전시 #${s.introduced_by_agency_id}`
                : s.introduced_by_influencer_id
                  ? `🎤 인플루언서 #${s.introduced_by_influencer_id}`
                  : null

              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-gray-900">{s.business_name || s.username}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {s.representative_name && <span>{s.representative_name} · </span>}
                        {s.business_number}
                        {s.business_start_date && <span> · 개업 {s.business_start_date}</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {s.phone} · {s.email} · {s.store_category || s.seller_type}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${ntsBadge.color}`}>
                      {ntsBadge.label}
                    </span>
                  </div>

                  {introducer && (
                    <div className="mb-2 text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1 inline-block">
                      영입: {introducer}
                    </div>
                  )}

                  {s.prospect_proof_url && (
                    <div className="mb-2">
                      <p className="text-[11px] text-gray-500 mb-1">영업 증빙:</p>
                      <a href={s.prospect_proof_url} target="_blank" rel="noopener noreferrer">
                        <img src={s.prospect_proof_url} alt="증빙" className="w-32 h-20 object-cover rounded border border-gray-200" />
                      </a>
                    </div>
                  )}

                  {ntsResult?.message && (
                    <p className="text-[11px] text-gray-600 mb-2">📋 {ntsResult.message}</p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => approve(s.id)}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg"
                    >
                      ✓ 승인
                    </button>
                    <button
                      onClick={() => recheckNts(s.id)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg"
                    >
                      NTS 재검증
                    </button>
                    <button
                      onClick={() => reject(s.id)}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg"
                    >
                      거부
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400 mt-2">
                    가입: {new Date(s.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
