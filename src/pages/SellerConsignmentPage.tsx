/**
 * 🛡️ 2026-04-28: MD 위탁 판매 — 셀러 대시보드 페이지
 *
 * - 내가 host (B 상품 받아서 라이브에 올린 거) / owner (B 가 내 상품 빌려간 거) 두 입장 모두 표시
 * - status 별 필터 (전체 / 진행중 / 대기 / 종료)
 * - pending 상태에서 승인/거부 버튼 (반대 측 액션)
 * - active 상태에서 종료 버튼
 *
 * 라우트: /seller/consignment
 */
import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardCard } from '@/components/dashboard'
import { Handshake, CheckCircle2, XCircle, Clock, Loader2, ArrowDown, ArrowUp } from 'lucide-react'

interface Partnership {
  id: number
  host_seller_id: number
  owner_seller_id: number
  product_id: number
  host_commission_rate: number
  status: 'pending' | 'active' | 'paused' | 'ended'
  invited_by: 'host' | 'owner'
  message: string | null
  approved_at: string | null
  ended_at: string | null
  created_at: string
  product_name: string | null
  product_thumbnail: string | null
  product_price: number | null
  host_seller_name: string | null
  owner_seller_name: string | null
}

// STATUS_LABEL is built dynamically using t() in the component

const STATUS_COLOR: Record<Partnership['status'], string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  paused: 'bg-gray-50 text-gray-700 border-gray-200',
  ended: 'bg-gray-50 text-gray-500 border-gray-200',
}

export default function SellerConsignmentPage() {
  const { t } = useTranslation()

  const STATUS_LABEL: Record<Partnership['status'], string> = {
    pending: t('seller.consignment.statusPending', { defaultValue: '승인 대기' }),
    active: t('seller.consignment.statusActive', { defaultValue: '진행 중' }),
    paused: t('seller.consignment.statusPaused', { defaultValue: '일시정지' }),
    ended: t('seller.consignment.statusEnded', { defaultValue: '종료됨' }),
  }

  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | 'host' | 'owner'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Partnership['status']>('all')
  const [actingId, setActingId] = useState<number | null>(null)

  const mySellerId = useMemo(() => {
    const v = localStorage.getItem('seller_id')
    return v ? Number(v) : null
  }, [])

  const reload = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (roleFilter !== 'all') params.role = roleFilter
      if (statusFilter !== 'all') params.status = statusFilter
      const res = await api.get('/api/seller/consignment', { params })
      setPartnerships(res.data?.data || [])
    } catch (err) {
      toast.error(t('seller.consignment.loadFailed', { defaultValue: '목록을 불러오지 못했어요' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [roleFilter, statusFilter])

  const handleApprove = async (id: number) => {
    setActingId(id)
    try {
      await api.post(`/api/seller/consignment/${id}/approve`)
      toast.success(t('seller.consignment.approved', { defaultValue: '승인되었습니다' }))
      reload()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('seller.consignment.approveBtn', { defaultValue: '승인 실패' }))
    } finally {
      setActingId(null)
    }
  }

  const handleTerminate = async (id: number) => {
    if (!confirm(t('seller.consignment.terminateConfirm', { defaultValue: '정말 종료하시겠어요? 종료 후 다시 시작할 수 없습니다.' }))) return
    setActingId(id)
    try {
      await api.post(`/api/seller/consignment/${id}/terminate`)
      toast.success(t('seller.consignment.terminated', { defaultValue: '종료되었습니다' }))
      reload()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('seller.consignment.terminateBtn', { defaultValue: '종료 실패' }))
    } finally {
      setActingId(null)
    }
  }

  return (
    <SellerLayout title={t('seller.consignment.title', { defaultValue: 'MD 위탁 판매' })}>
      <DashboardPageHeader
        title={t('seller.consignment.title', { defaultValue: 'MD 위탁 판매' })}
        subtitle={t('seller.consignment.subtitle', { defaultValue: '다른 셀러의 상품을 내 라이브에서 판매하거나, 내 상품을 다른 셀러에게 위탁할 수 있어요' })}
        icon={<Handshake className="w-5 h-5 text-pink-500" />}
      />

      {/* 필터 칩 */}
      <DashboardCard>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="text-xs font-semibold text-gray-700 self-center mr-2">{t('seller.consignment.roleLabel', { defaultValue: '입장' })}:</span>
          {[
            { key: 'all' as const, label: t('seller.consignment.all', { defaultValue: '전체' }) },
            { key: 'host' as const, label: t('seller.consignment.receivedProduct', { defaultValue: '내가 host (받은 상품)' }) },
            { key: 'owner' as const, label: t('seller.consignment.lentProduct', { defaultValue: '내가 owner (빌려준 상품)' }) },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                roleFilter === f.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >{f.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-gray-700 self-center mr-2">{t('seller.consignment.statusLabel', { defaultValue: '상태' })}:</span>
          {(['all', 'pending', 'active', 'paused', 'ended'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >{s === 'all' ? t('seller.consignment.all', { defaultValue: '전체' }) : STATUS_LABEL[s as Partnership['status']]}</button>
          ))}
        </div>
      </DashboardCard>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('seller.consignment.loading', { defaultValue: '불러오는 중...' })}
        </div>
      ) : partnerships.length === 0 ? (
        <DashboardCard>
          <div className="text-center py-12">
            <Handshake className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{t('seller.consignment.noPartnerships', { defaultValue: '위탁 파트너십이 없습니다.' })}</p>
            <p className="text-xs text-gray-400 mt-1">{t('seller.consignment.startPartnership', { defaultValue: '다른 셀러와 협업을 시작해보세요.' })}</p>
          </div>
        </DashboardCard>
      ) : (
        <div className="space-y-3">
          {partnerships.map(p => {
            const iAmHost = p.host_seller_id === mySellerId
            const iAmOwner = p.owner_seller_id === mySellerId
            // 내가 승인 가능: pending + 반대측 신청
            const canApprove = p.status === 'pending'
              && ((p.invited_by === 'host' && iAmOwner) || (p.invited_by === 'owner' && iAmHost))
            const canTerminate = (p.status === 'active' || p.status === 'paused') && (iAmHost || iAmOwner)

            return (
              <DashboardCard key={p.id}>
                <div className="flex items-start gap-3">
                  {p.product_thumbnail ? (
                    <img src={p.product_thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300">
                      <Handshake className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLOR[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">
                        {iAmHost ? <><ArrowDown className="w-3 h-3 inline" /> {t('seller.consignment.receivedProduct', { defaultValue: '받은 상품' })}</> : <><ArrowUp className="w-3 h-3 inline" /> {t('seller.consignment.lentProduct', { defaultValue: '빌려준 상품' })}</>}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{p.product_name || `상품 #${p.product_id}`}</h3>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>
                        <span className="text-gray-400">{t('seller.consignment.partner', { defaultValue: '파트너' })}:</span>{' '}
                        <span className="font-medium text-gray-700">
                          {iAmHost ? p.owner_seller_name : p.host_seller_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">{t('seller.consignment.commissionRate', { defaultValue: 'host 수수료율' })}:</span>{' '}
                        <span className="font-bold text-pink-600">{p.host_commission_rate}%</span>
                      </div>
                      {p.message && (
                        <div className="text-gray-600 italic mt-1 line-clamp-2">"{p.message}"</div>
                      )}
                    </div>
                  </div>
                </div>

                {(canApprove || canTerminate) && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    {canApprove && (
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={actingId === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 disabled:opacity-50"
                      >
                        {actingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        {t('seller.consignment.approveBtn', { defaultValue: '승인' })}
                      </button>
                    )}
                    {canTerminate && (
                      <button
                        onClick={() => handleTerminate(p.id)}
                        disabled={actingId === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> {t('seller.consignment.terminateBtn', { defaultValue: '종료' })}
                      </button>
                    )}
                  </div>
                )}
              </DashboardCard>
            )
          })}
        </div>
      )}
    </SellerLayout>
  )
}
