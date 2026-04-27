import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ticket, Copy, Send, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface GroupBuyProduct {
  id: number; name: string; price: number; image_url?: string
  restaurant_name?: string; restaurant_phone?: string
  group_buy_target: number; group_buy_current: number
  group_buy_deadline?: string; group_buy_status: string; store_verify_pin?: string
  store_owner_token?: string
}

interface VoucherStat {
  product_id: number; total: number; used: number; unused: number; expired: number
}

export default function SellerGroupBuyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [products, setProducts] = useState<GroupBuyProduct[]>([])
  const [voucherStats, setVoucherStats] = useState<Record<number, VoucherStat>>({})
  const [loading, setLoading] = useState(true)

  const headers = { Authorization: `Bearer ${getSellerToken()}` }

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.get('/api/seller/products', { headers })
      if (res.data.success) {
        const mealVouchers = (res.data.data || []).filter((p: { category?: string }) => p.category === 'meal_voucher')
        setProducts(mealVouchers)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // 🛡️ 2026-04-27: 사장님께 알림톡 재발송 (Magic Link)
  async function resendStoreLink(productId: number, rotate = false) {
    try {
      const res = await api.post(`/api/seller/products/${productId}/resend-store-link`, { rotate }, { headers })
      if (res.data.success) {
        toast.success(rotate ? '새 링크로 재발송되었습니다 (이전 링크 만료)' : '사장님께 알림톡이 발송되었습니다')
        loadData()
      } else {
        toast.error(res.data.error || '발송 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '발송 실패')
    }
  }

  if (loading) {
    return <SellerLayout title={t('seller.nav.mealVoucher')}><div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" /></div></SellerLayout>
  }

  return (
    <SellerLayout title={t('seller.nav.mealVoucher')}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.nav.mealVoucher')}
          subtitle={t('seller.groupBuySubtitle', { defaultValue: '공동구매 / 식사권 관리' })}
          icon={<Ticket className="h-5 w-5" />}
        />

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('seller.groupBuy.active'), value: products.filter(p => p.group_buy_status === 'active').length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: t('seller.groupBuy.achieved'), value: products.filter(p => p.group_buy_status === 'achieved').length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: t('seller.groupBuy.totalParticipants'), value: products.reduce((s, p) => s + (p.group_buy_current || 0), 0), color: 'text-pink-600', bg: 'bg-pink-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 상품 없음 */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-900 font-bold mb-1">{t('seller.groupBuy.noVouchers')}</p>
            <p className="text-sm text-gray-500 mb-4">{t('seller.groupBuy.noVouchersDesc')}</p>
            <button onClick={() => navigate('/seller/meal-voucher/new')} className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-bold">{t('seller.groupBuy.registerVoucher')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(p => {
              const progress = p.group_buy_target > 0 ? Math.min(100, (p.group_buy_current / p.group_buy_target) * 100) : 0
              const isActive = p.group_buy_status === 'active'
              const isAchieved = p.group_buy_status === 'achieved'

              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex gap-3">
                    {p.image_url && <img src={p.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-blue-100 text-blue-600' :
                          isAchieved ? 'bg-green-100 text-green-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {isActive ? t('seller.groupBuy.active') : isAchieved ? t('seller.groupBuy.achieved') : t('seller.groupBuy.closed')}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 truncate">{p.name}</h4>
                      </div>
                      {p.restaurant_name && <p className="text-xs text-gray-500">{p.restaurant_name}</p>}

                      {/* 진행률 */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">{t('seller.groupBuy.participantCount', { current: p.group_buy_current, target: p.group_buy_target })}</span>
                          <span className="font-bold text-pink-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className={`h-full rounded-full transition-all ${isAchieved ? 'bg-green-500' : 'bg-pink-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      {/* 마감일 */}
                      {p.group_buy_deadline && (
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {t('seller.groupBuy.deadline')}: {new Date(p.group_buy_deadline).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 식당 사장 공유 링크 (Magic Link 우선) */}
                  <div className="mt-3 p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                          {p.store_owner_token ? '🔗 사장님 전용 링크 (자동 인증)' : t('seller.groupBuy.storeOwnerStatsLink')}
                        </p>
                        <p className="text-xs text-gray-700 truncate font-mono">
                          {window.location.origin}/store/stats/{p.id}
                          {p.store_owner_token && '?t=...'}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const url = p.store_owner_token
                            ? `${window.location.origin}/store/stats/${p.id}?t=${p.store_owner_token}`
                            : `${window.location.origin}/store/stats/${p.id}`
                          navigator.clipboard.writeText(url)
                          toast.success(t('seller.groupBuy.linkCopied'))
                        }}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shrink-0 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> {t('common.copy')}
                      </button>
                    </div>
                    {p.restaurant_phone ? (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => resendStoreLink(p.id, false)}
                          className="flex-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <Send className="w-3 h-3" /> 사장님께 알림톡 발송
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('이전 링크가 만료되고 새 링크가 발송됩니다. 진행하시겠습니까?')) resendStoreLink(p.id, true)
                          }}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium flex items-center gap-1"
                          title="새 링크 발급 (이전 링크 무효화)"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-600 mt-2">⚠️ 식당 연락처 미등록 — 알림톡 발송 불가</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
