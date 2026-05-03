import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Ticket, AlertCircle } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { requireLogin, isLoggedInSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'

interface Coupon {
  id: number
  code: string
  name: string
  type: 'fixed' | 'percent'
  value: number
  min_order_amount: number
  max_discount: number | null
  expires_at: string | null
}

export default function MyCouponsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedInSync()) {
      requireLogin(navigate, '로그인이 필요합니다.')
      return
    }
    loadCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadCoupons() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/coupons/my')
      if (res.data.success) {
        setCoupons(Array.isArray(res.data.data) ? res.data.data : [])
      } else {
        setError(res.data.error || '쿠폰을 불러올 수 없습니다.')
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('세션이 만료되었습니다. 다시 로그인해주세요.')
      } else {
        setError('쿠폰을 불러올 수 없습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  function formatDiscount(c: Coupon) {
    if (c.type === 'percent') {
      return `${c.value}%`
    }
    return `${formatNumber(c.value)}원`
  }

  function formatExpiry(expires_at: string | null) {
    if (!expires_at) return '상시'
    const d = new Date(expires_at)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const dateStr = d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    if (diffDays <= 0) return `만료됨`
    if (diffDays <= 7) return `${dateStr}까지 (${diffDays}일 남음)`
    return `${dateStr}까지`
  }

  return (
    <div className="min-h-screen bg-white">
      <SEO title="내 쿠폰 - 유어딜" description="보유 중인 쿠폰을 확인하세요" url="/my-coupons" noindex />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="ur-content-narrow flex items-center justify-between px-4 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5 text-gray-900" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900">{t('myCoupons.title')}</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 py-4 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-[14px] text-gray-900 mb-4">{error}</p>
            <button
              onClick={loadCoupons}
              className="px-5 py-2 bg-gray-900 text-white text-[13px] font-semibold rounded-full"
            >
              다시 시도
            </button>
          </div>
        ) : coupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <Ticket className="h-10 w-10 text-gray-400" strokeWidth={1.5} />
            </div>
            <h2 className="text-[16px] font-bold text-gray-900 mb-1.5">{t('myCoupons.empty')}</h2>
            <p className="text-[13px] text-gray-500">{t('myCoupons.emptySub')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-gray-500 mb-2">사용 가능 {coupons.length}장</p>
            {coupons.map(c => {
              const expiry = formatExpiry(c.expires_at)
              const isUrgent = expiry.includes('일 남음')
              return (
                <article
                  key={c.id}
                  className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <div className="flex">
                    {/* 할인 금액 */}
                    <div className="flex flex-col items-center justify-center px-5 py-4 bg-gradient-to-br from-pink-500 to-rose-500 text-white min-w-[100px]">
                      <p className="text-[10px] font-bold tracking-wide opacity-90">
                        {c.type === 'percent' ? '할인율' : '할인'}
                      </p>
                      <p className="text-[22px] font-extrabold leading-tight mt-0.5">
                        {formatDiscount(c)}
                      </p>
                      {c.type === 'percent' && c.max_discount && (
                        <p className="text-[9px] opacity-80 mt-0.5">최대 {formatNumber(c.max_discount)}원</p>
                      )}
                    </div>
                    {/* Notched divider */}
                    <div className="relative w-[1px] bg-gray-100">
                      <span className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-gray-50 border border-gray-100" aria-hidden="true" />
                      <span className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-gray-50 border border-gray-100" aria-hidden="true" />
                    </div>
                    {/* 내용 */}
                    <div className="flex-1 px-4 py-3.5 min-w-0">
                      <p className="text-[14px] font-bold text-gray-900 line-clamp-2">
                        {c.name}
                      </p>
                      <div className="mt-1.5 space-y-0.5">
                        {c.min_order_amount > 0 && (
                          <p className="text-[11px] text-gray-500">
                            {formatNumber(c.min_order_amount)}원 이상 결제 시
                          </p>
                        )}
                        <p className={`text-[11px] font-semibold ${isUrgent ? 'text-red-500' : 'text-gray-500'}`}>
                          {expiry}
                        </p>
                      </div>
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100">
                        <span className="text-[10px] font-mono font-semibold text-gray-700">{c.code}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}

            <p className="text-[11px] text-gray-400 text-center pt-2">
              쿠폰은 결제 페이지에서 선택하여 적용할 수 있습니다
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
