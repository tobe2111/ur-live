import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, TrendingUp, Users, DollarSign, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

export default function AffiliatePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/affiliate/stats')
      .then(r => { if (r.data.success) setData(r.data.data) })
      .catch(() => toast.error('로그인이 필요합니다'))
      .finally(() => setLoading(false))
  }, [])

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('추천 링크가 복사되었습니다!')
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-lg font-bold text-gray-900">추천 수익</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">로그인이 필요합니다</div>
      ) : (
        <div className="px-4 py-6 space-y-5">
          {/* 통계 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">{data.total_referrals}</p>
              <p className="text-[10px] text-gray-500">추천 건수</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">{Number(data.total_earned).toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">적립 딜</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">{Number(data.total_sales).toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">추천 매출</p>
            </div>
          </div>

          {/* 추천 링크 */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-900 mb-1">내 추천 링크</p>
            <p className="text-xs text-gray-500 mb-3">이 링크로 구매하면 금액의 {data.commission_rate}%가 딜로 적립됩니다</p>
            <div className="flex gap-2">
              <input readOnly value={data.share_url} className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700" />
              <button onClick={() => copyLink(data.share_url)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0">
                <Copy className="w-3 h-3" /> 복사
              </button>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs text-gray-600">
            <p className="font-bold text-gray-900">추천 수익 안내</p>
            <p>• 상품 링크를 공유하고, 누군가 해당 링크로 구매하면 수수료가 적립됩니다</p>
            <p>• 수수료율: 구매 금액의 <strong>{data.commission_rate}%</strong></p>
            <p>• 적립된 딜 포인트는 상품 구매, 후원에 사용할 수 있습니다</p>
            <p>• 본인이 본인 링크로 구매하는 것은 적립되지 않습니다</p>
          </div>

          {/* 최근 실적 */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">최근 추천 내역</h2>
            {data.recent.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">아직 추천 내역이 없습니다</p>
            ) : (
              <div className="space-y-2">
                {data.recent.map((r: any, i: number) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.product_name || '상품'}</p>
                      <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">+{Number(r.commission).toLocaleString()}딜</p>
                      <p className="text-[10px] text-gray-400">{Number(r.order_amount).toLocaleString()}원</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
