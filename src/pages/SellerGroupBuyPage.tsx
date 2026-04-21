import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Ticket, Users, CheckCircle, Clock, TrendingUp, Eye, Copy } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

interface GroupBuyProduct {
  id: number; name: string; price: number; image_url?: string
  restaurant_name?: string; group_buy_target: number; group_buy_current: number
  group_buy_deadline?: string; group_buy_status: string; store_verify_pin?: string
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

  if (loading) {
    return <SellerLayout title={t('seller.nav.mealVoucher')}><div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" /></div></SellerLayout>
  }

  return (
    <SellerLayout title={t('seller.nav.mealVoucher')}>
      <div className="max-w-3xl mx-auto space-y-5">

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

                  {/* 식당 사장 공유 링크 */}
                  <div className="mt-3 flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500">{t('seller.groupBuy.storeOwnerStatsLink')}</p>
                      <p className="text-xs text-gray-700 truncate font-mono">{window.location.origin}/store/stats/{p.id}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/store/stats/${p.id}`)
                        toast.success(t('seller.groupBuy.linkCopied'))
                      }}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shrink-0 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> {t('common.copy')}
                    </button>
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
