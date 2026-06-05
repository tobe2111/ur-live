/**
 * 🛡️ 2026-05-28: 어드민 — 매장별 commission 관리 + 영입 ledger audit.
 *
 * 1) 매장 id 조회 → 영입 에이전시/크리에이터 표시 + referral_bonus_until 기간 / commission_rate 설정
 *    (GET/PATCH /api/admin/sellers/:id/commission-settings)
 * 2) 영입 commission ledger 불일치 audit (GET /api/admin/intro-commission-audit) + 수동 backfill
 *
 * 라이트 테마 고정 (대시보드 룰 — 다크 variant 금지).
 */

import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SEO from '@/components/SEO'
import AdminLayout from '@/components/AdminLayout'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface CommissionSettings {
  id: number
  business_name: string | null
  commission_rate: number | null
  referral_bonus_until: string | null
  introduced_by_agency_id: string | null
  introduced_by_influencer_id: string | null
  introduced_at: string | null
  agency_name?: string | null
  influencer_handle?: string | null
}

interface AuditRow {
  user_id: number
  handle: string | null
  name: string | null
  user_exists: boolean
  business_status: string
  entry_count: number
  total_amount: number
  possibly_mispaid_to_seller: number
}

interface PendingBusinessUser {
  id: number
  handle: string | null
  name: string | null
  business_number: string | null
  business_name: string | null
  tax_type: string | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
}

export default function AdminMerchantCommissionsPage() {
  const [sellerId, setSellerId] = useState('')
  const [cs, setCs] = useState<CommissionSettings | null>(null)
  const [bonusMonths, setBonusMonths] = useState('')
  const [bonusUntil, setBonusUntil] = useState('')
  const [rate, setRate] = useState('')
  const [loading, setLoading] = useState(false)

  // 🛡️ 2026-06-03 Tier2(대시보드): mount-time 페칭 → useApiQuery (audit + pendingBiz). cs 조회는 폼 채움 side-effect 라 명령형 유지.
  const auditQ = useApiQuery<{ affected_users: number; grand_total: number; data: AuditRow[] } | null>(['admin', 'intro-commission-audit'], '/api/admin/intro-commission-audit', { select: (r: any) => (r?.success ? { affected_users: r.affected_users, grand_total: r.grand_total, data: r.data } : null) })
  const audit = auditQ.data ?? null
  const auditLoading = auditQ.isFetching
  const loadAudit = () => auditQ.refetch()

  const pendingBizQ = useApiQuery<PendingBusinessUser[]>(['admin', 'pending-business-users'], '/api/admin/pending-business-users', { select: (r: any) => (r?.success ? r.data || [] : []) })
  const pendingBiz = pendingBizQ.data ?? []
  const loadPendingBiz = () => pendingBizQ.refetch()

  async function actBiz(id: number, action: 'business-approve' | 'business-reject') {
    if (action === 'business-reject' && !(await confirmDialog({ message: '이 사업자 등록을 거부할까요?', danger: true }))) return
    try {
      const res = await api.post(`/api/admin/users/${id}/${action}`, {})
      if (res.data?.success) { toast.success(action === 'business-approve' ? '승인됨 — 현금 정산 활성' : '거부됨'); pendingBizQ.refetch() }
      else toast.error(res.data?.error || '처리 실패')
    } catch { toast.error('처리 중 오류') }
  }

  async function loadSeller() {
    const id = Number(sellerId)
    if (!Number.isFinite(id) || id <= 0) { toast.error('매장(셀러) id를 입력하세요'); return }
    setLoading(true)
    try {
      const res = await api.get(`/api/admin/sellers/${id}/commission-settings`)
      if (res.data?.success) {
        setCs(res.data.data)
        setBonusUntil(res.data.data.referral_bonus_until?.slice(0, 10) || '')
        setRate(res.data.data.commission_rate != null ? String(res.data.data.commission_rate) : '')
        setBonusMonths('')
      } else {
        toast.error(res.data?.error || '조회 실패')
      }
    } catch {
      toast.error('조회 중 오류')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!cs) return
    const body: Record<string, unknown> = {}
    if (bonusMonths) body.bonus_months = Number(bonusMonths)
    else body.referral_bonus_until = bonusUntil ? bonusUntil : null
    if (rate !== '') body.commission_rate = Number(rate)
    try {
      const res = await api.patch(`/api/admin/sellers/${cs.id}/commission-settings`, body)
      if (res.data?.success) { toast.success('저장됨'); loadSeller() }
      else toast.error(res.data?.error || '저장 실패')
    } catch {
      toast.error('저장 중 오류')
    }
  }

  async function backfill(userId?: number) {
    if (!(await confirmDialog(userId ? `유저 #${userId} 영입 commission을 딜로 재적립할까요?` : '전체 영향 유저에게 딜을 재적립할까요? (idempotent)'))) return
    try {
      const res = await api.post('/api/admin/intro-commission-backfill', { confirm: true, user_id: userId })
      if (res.data?.success) { toast.success(`${res.data.reconciled}건 보정 (${formatWon(res.data.total_credited)})`); loadAudit() }
      else toast.error(res.data?.error || 'backfill 실패')
    } catch {
      toast.error('backfill 중 오류')
    }
  }

  const introducer = cs?.introduced_by_agency_id
    ? `에이전시: ${cs.agency_name || `#${cs.introduced_by_agency_id}`}`
    : cs?.introduced_by_influencer_id
      ? `크리에이터: ${cs.influencer_handle ? '@' + cs.influencer_handle : `#${cs.introduced_by_influencer_id}`}`
      : '영입자 없음'

  return (
    <AdminLayout title="매장 커미션 관리">
      <SEO title="매장 커미션 관리 - 유어딜" description="매장별 영입 커미션 기간/요율" url="/admin/merchant-commissions" />
      <div className="ur-content-full px-4 py-6 space-y-8">
        <h1 className="text-xl font-bold text-gray-900">매장별 커미션 관리</h1>

        {/* 매장별 설정 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">매장 설정 조회 / 변경</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="매장(셀러) id"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-900 w-40"
            />
            <button onClick={loadSeller} disabled={loading} className="px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg disabled:opacity-50">
              {loading ? '조회 중…' : '조회'}
            </button>
          </div>

          {cs && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">매장</span>
                <span className="font-bold text-gray-900">{cs.business_name || `#${cs.id}`}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">영입자</span>
                <span className="font-bold text-gray-900">{introducer}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">현재 기간 만료</span>
                <span className="text-gray-900">{cs.referral_bonus_until ? cs.referral_bonus_until.slice(0, 10) : '⚠️ 무기한(레거시 — 캡 설정 권장)'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="text-xs text-gray-600">
                  기간 (+개월, 우선)
                  <input value={bonusMonths} onChange={(e) => setBonusMonths(e.target.value)} placeholder="예: 6" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900" />
                </label>
                <label className="text-xs text-gray-600">
                  또는 만료일 (비우면 기본 12개월, 최대 24개월)
                  <input type="date" value={bonusUntil} onChange={(e) => setBonusUntil(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900" />
                </label>
                <label className="text-xs text-gray-600">
                  수수료율 (%)
                  <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="예: 5" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900" />
                </label>
              </div>
              <button onClick={save} className="mt-2 px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg">저장</button>
            </div>
          )}
        </section>

        {/* 영입 commission ledger audit */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">영입 commission ledger 불일치 audit</h2>
            <button onClick={loadAudit} disabled={auditLoading} className="text-xs text-gray-500 underline">{auditLoading ? '조회 중…' : '새로고침'}</button>
          </div>
          {audit && (
            <>
              <p className="text-xs text-gray-600 mb-3">
                영향 유저 <b>{audit.affected_users}</b>명 · 합계 <b>{formatWon(audit.grand_total)}</b>
                {audit.affected_users > 0 && (
                  <button onClick={() => backfill()} className="ml-3 px-3 py-1 bg-amber-500 text-white rounded-lg font-bold">전체 backfill</button>
                )}
              </p>
              {audit.data.length === 0 ? (
                <p className="text-sm text-gray-400">불일치 없음 ✅</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2">유저</th><th>상태</th><th>건수</th><th>금액</th><th>오송금</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.data.map((r) => (
                        <tr key={r.user_id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-900">{r.handle ? '@' + r.handle : (r.name || `#${r.user_id}`)}{!r.user_exists && <span className="text-red-500"> (없음)</span>}</td>
                          <td className="text-gray-600">{r.business_status}</td>
                          <td className="text-gray-600">{r.entry_count}</td>
                          <td className="text-gray-900 font-bold">{formatWon(r.total_amount)}</td>
                          <td className={r.possibly_mispaid_to_seller > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}>{r.possibly_mispaid_to_seller > 0 ? formatWon(r.possibly_mispaid_to_seller) : '-'}</td>
                          <td>{r.user_exists && <button onClick={() => backfill(r.user_id)} className="px-2 py-1 bg-amber-500 text-white rounded font-bold">backfill</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        {/* 유저 사업자 등록 수동 승인 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">유저 사업자 등록 승인 대기</h2>
            <button onClick={loadPendingBiz} className="text-xs text-gray-500 underline">새로고침</button>
          </div>
          {pendingBiz.length === 0 ? (
            <p className="text-sm text-gray-400">대기 중인 사업자 등록이 없습니다 ✅</p>
          ) : (
            <div className="space-y-2">
              {pendingBiz.map((u) => (
                <div key={u.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0">
                  <div className="text-xs">
                    <p className="font-bold text-gray-900">{u.business_name || '-'} <span className="text-gray-400 font-normal">({u.handle ? '@' + u.handle : u.name || `#${u.id}`})</span></p>
                    <p className="text-gray-500">사업자 {u.business_number || '-'} · {u.tax_type === 'other_income' ? '기타소득 8.8%' : '사업소득 3.3%'} · {u.bank_name} {u.bank_account} ({u.account_holder})</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => actBiz(u.id, 'business-approve')} className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-lg">승인</button>
                    <button onClick={() => actBiz(u.id, 'business-reject')} className="px-3 py-1 border border-gray-300 text-gray-600 text-xs font-bold rounded-lg">거부</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
