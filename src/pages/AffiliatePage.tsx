import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, TrendingUp, Users, Gift, Loader2, Share2, ChevronRight } from 'lucide-react'
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
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold text-gray-900">추천 수익</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-500">로그인이 필요합니다</div>
      ) : (
        <div className="px-4 py-5 space-y-4">

          {/* 히어로 카드 */}
          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5" />
              <span className="text-sm font-bold opacity-90">추천하고 딜 포인트 받기</span>
            </div>
            <p className="text-3xl font-extrabold mb-1">{Number(data.total_earned).toLocaleString()}<span className="text-lg ml-1">딜</span></p>
            <p className="text-xs opacity-70">총 누적 수익</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold">{data.total_referrals}</p>
                <p className="text-[10px] opacity-70">추천 건수</p>
              </div>
              <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
                <p className="text-lg font-bold">{Number(data.monthly_earned || 0).toLocaleString()}</p>
                <p className="text-[10px] opacity-70">이번 달 수익</p>
              </div>
            </div>
          </div>

          {/* 추천 링크 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Share2 className="w-4 h-4 text-violet-600" />
              <p className="text-[15px] font-bold text-gray-900">내 추천 링크</p>
            </div>
            <p className="text-xs text-gray-500 mb-3">링크를 공유하세요. 누군가 구매하면 <strong className="text-violet-600">{data.commission_rate}%</strong>가 딜로 적립됩니다.</p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 truncate">
                {data.share_url}
              </div>
              <button onClick={() => copyLink(data.share_url)}
                className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95">
                <Copy className="w-3.5 h-3.5" /> 복사
              </button>
            </div>
          </div>

          {/* 이용 방법 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-[15px] font-bold text-gray-900 mb-3">이렇게 사용하세요</p>
            <div className="space-y-3">
              {[
                { step: '1', text: '마음에 드는 상품에서 "추천 링크 복사" 클릭', color: 'bg-violet-100 text-violet-700' },
                { step: '2', text: 'SNS, 카카오톡, 블로그에 링크 공유', color: 'bg-blue-100 text-blue-700' },
                { step: '3', text: '누군가 링크로 구매하면 자동 적립!', color: 'bg-green-100 text-green-700' },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full ${s.color} text-xs font-bold flex items-center justify-center shrink-0`}>{s.step}</span>
                  <p className="text-sm text-gray-700">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 수수료 안내 */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[15px] font-bold text-gray-900">수수료 안내</p>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { label: '수수료율', value: `${data.commission_rate}%` },
                { label: '적립 방식', value: '딜 포인트 즉시 적립' },
                { label: '사용처', value: '상품 구매, 셀러 후원' },
                { label: '유효기간', value: '링크 클릭 후 24시간' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 최근 내역 */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[15px] font-bold text-gray-900">추천 내역</p>
              <span className="text-xs text-gray-400">{data.recent.length}건</span>
            </div>
            {data.recent.length === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">아직 추천 내역이 없습니다</p>
                <p className="text-xs text-gray-300 mt-1">상품 링크를 공유해보세요!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.recent.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.product_name || '상품'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-green-600">+{Number(r.commission).toLocaleString()}딜</p>
                      <p className="text-[10px] text-gray-400">{Number(r.order_amount).toLocaleString()}원 구매</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 쇼핑하러 가기 */}
          <button onClick={() => navigate('/browse')}
            className="w-full py-3.5 bg-gray-900 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98]">
            상품 둘러보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
