/**
 * InterestListPage - 관심 맛집 목록
 * 다크 테마 (유저 대면 메인)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Bell, Trash2 } from 'lucide-react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface InterestItem {
  id: number
  restaurant_name: string
  product_id: number
  type: string
  created_at?: string
}

export default function InterestListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<InterestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/interest/my')
      .then(r => {
        if (r.data.success) setItems(r.data.data || [])
      })
      .catch(() => toast.error(t('interestList.loadError')))
      .finally(() => setLoading(false))
  }, [t])

  const handleRemove = (item: InterestItem) => {
    if (!confirm(t('interestList.removeConfirm', { defaultValue: '관심 목록에서 삭제하시겠습니까?' }))) return
    setItems(prev => prev.filter(i => i.id !== item.id))
    api.post('/api/interest/remove', { product_id: item.product_id, type: item.type })
      .then(() => toast.success(t('interestList.removed')))
      .catch(() => {
        setItems(prev => [...prev, item])
        toast.error(t('interestList.removeError'))
      })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] pb-20">
      <SEO title={t('interestList.seoTitle', { defaultValue: '관심 맛집 - 유어딜' })} description={t('interestList.seoDesc', { defaultValue: '관심 등록한 맛집과 공동구매 알림 목록' })} url="/interest-list" />

      {/* 헤더 */}
      <div className="sticky top-0 md:top-14 z-40 bg-white/90 dark:bg-[#020202]/90 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-5 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="text-gray-900 dark:text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900 dark:text-white font-bold text-[15px]">{t('interestList.title')}</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="ur-content-narrow px-5 lg:px-8 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4 animate-pulse border border-gray-200 dark:border-[#2A2A2A]">
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300 font-semibold text-[14px]">
              {t('interestList.empty')}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-[12px] mt-1">
              {t('interestList.emptyHint')}
            </p>
            <button
              onClick={() => navigate('/group-buy')}
              className="mt-5 px-5 py-2.5 bg-pink-500 text-white text-[13px] font-semibold rounded-full"
            >
              {t('interestList.browseGroupBuy')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-[#121212] rounded-xl px-4 py-3.5 border border-gray-200 dark:border-[#2A2A2A]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-900 dark:text-white text-[13px] font-medium truncate">
                      {item.restaurant_name || `상품 #${item.product_id}`}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-[11px] mt-0.5">
                      {item.type === 'group_buy' ? t('interestList.tagGroupBuy') : t('interestList.tagVoucher')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label={t('interestList.removeAria')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
