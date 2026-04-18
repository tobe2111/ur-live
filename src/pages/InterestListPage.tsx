/**
 * InterestListPage - 관심 맛집 목록
 * 다크 테마 (유저 대면 메인)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [items, setItems] = useState<InterestItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/interest/my')
      .then(r => {
        if (r.data.success) setItems(r.data.data || [])
      })
      .catch(() => toast.error('관심 목록을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  const handleRemove = (item: InterestItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    api.post('/api/interest/remove', { product_id: item.product_id, type: item.type })
      .then(() => toast.success('관심 등록이 해제되었습니다'))
      .catch(() => {
        setItems(prev => [...prev, item])
        toast.error('삭제에 실패했습니다')
      })
  }

  return (
    <div className="min-h-screen bg-[#020202]">
      <SEO title="관심 맛집 - 유어딜" description="관심 등록한 맛집과 공동구매 알림 목록" url="/interest-list" />

      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-[15px]">관심 맛집</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#121212] rounded-xl p-4 animate-pulse border border-[#2A2A2A]">
                <div className="h-4 bg-gray-700 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-300 font-semibold text-[14px]">
              관심 등록한 맛집이 없습니다
            </p>
            <p className="text-gray-500 text-[12px] mt-1">
              공동구매나 식사권에서 관심 등록해보세요
            </p>
            <button
              onClick={() => navigate('/group-buy')}
              className="mt-5 px-5 py-2.5 bg-pink-500 text-white text-[13px] font-semibold rounded-full"
            >
              공동구매 보러가기
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-[#121212] rounded-xl px-4 py-3.5 border border-[#2A2A2A]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">
                      {item.restaurant_name || `상품 #${item.product_id}`}
                    </p>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                      {item.type === 'group_buy' ? '공동구매' : '식사권'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item)}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  aria-label="삭제"
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
