import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Star, Loader2, Trash2, Sparkles, FileText } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'

interface Product {
  id: number; name: string; image_url?: string; price?: number; category?: string
}

export default function AdminReviewsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [count, setCount] = useState(50)
  const [avgRating, setAvgRating] = useState(4.5)
  const [options, setOptions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'template' | 'ai'>('template')
  const [progress, setProgress] = useState('')

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    api.get('/api/admin/products', { headers })
      .then(r => { if (r.data.success) setProducts(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  async function generateReviews() {
    if (!selectedProduct) { toast.error('상품을 선택해주세요'); return }
    if (count < 1 || count > 20000) { toast.error('1~20000 사이로 입력해주세요'); return }

    setGenerating(true)
    setProgress(mode === 'ai' ? 'AI가 리뷰를 작성하고 있습니다...' : '리뷰 생성 중...')

    try {
      const product = products.find(p => p.id === selectedProduct)
      const res = await api.post('/api/admin/reviews/generate', {
        product_id: selectedProduct,
        product_name: product?.name,
        product_price: product?.price,
        product_category: product?.category,
        count,
        avg_rating: avgRating,
        options: options ? options.split(',').map(o => o.trim()) : [],
        mode,
      }, { headers, timeout: 120000 })

      if (res.data.success) {
        toast.success(res.data.message)
        setProgress('')
      } else {
        toast.error(res.data.error || '생성 실패')
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || '리뷰 생성 실패')
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }

  const selectedProductInfo = products.find(p => p.id === selectedProduct)

  if (loading) {
    return <AdminLayout title="리뷰 관리"><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AdminLayout>
  }

  return (
    <AdminLayout title="리뷰 관리">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="리뷰 자동 생성"
          subtitle="테스트용 리뷰 일괄 생성 · 삭제"
          icon={<Star className="h-5 w-5" />}
        />

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-base font-bold text-gray-900">리뷰 자동 생성</h2>
          </div>

          <div className="space-y-4">
            {/* 생성 모드 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">생성 방식</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('template')}
                  className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                    mode === 'template'
                      ? 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className={`w-5 h-5 ${mode === 'template' ? 'text-yellow-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-gray-900">템플릿</p>
                    <p className="text-[11px] text-gray-500">빠르고 무료 · 36개 패턴</p>
                  </div>
                </button>
                <button
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                    mode === 'ai'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Sparkles className={`w-5 h-5 ${mode === 'ai' ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-gray-900">AI 생성</p>
                    <p className="text-[11px] text-gray-500">자연스러운 리뷰 · 건당 ~0.05원</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 상품 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택 *</label>
              <select
                value={selectedProduct || ''}
                onChange={e => setSelectedProduct(Number(e.target.value) || null)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              >
                <option value="">상품을 선택하세요</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 생성 개수 + 평점 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">생성 개수</label>
                <input
                  type="number" value={count} onChange={e => setCount(Number(e.target.value))}
                  min={1} max={mode === 'ai' ? 500 : 20000}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                />
                {mode === 'ai' && <p className="text-[10px] text-gray-400 mt-1">AI는 최대 500개</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">평균 평점</label>
                <input
                  type="number" value={avgRating} onChange={e => setAvgRating(Number(e.target.value))}
                  min={1} max={5} step={0.1}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                />
              </div>
            </div>

            {/* 옵션 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 옵션 (콤마 구분, 선택)</label>
              <input
                value={options} onChange={e => setOptions(e.target.value)}
                placeholder="예: 블랙 M, 화이트 L, 네이비 XL"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900"
              />
            </div>

            {/* 미리보기 */}
            <div className={`rounded-lg p-4 text-sm ${mode === 'ai' ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600'}`}>
              <p><strong>미리보기:</strong></p>
              <p>• 상품: {selectedProductInfo?.name || '미선택'}</p>
              <p>• {count}개 리뷰, 평균 {avgRating}점</p>
              <p>• 방식: {mode === 'ai' ? '🤖 AI (Claude Haiku)' : '📝 템플릿 (36개 패턴)'}</p>
              {mode === 'ai' && <p>• 예상 비용: ~{Math.ceil(count / 50 * 2.5)}원</p>}
              {mode === 'ai' && <p>• 상품 정보 기반 맞춤 리뷰 생성</p>}
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={generateReviews}
              disabled={!selectedProduct || generating}
              className={`w-full py-3 font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] text-white ${
                mode === 'ai' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {progress}
                </span>
              ) : (
                `${count}개 리뷰 ${mode === 'ai' ? 'AI' : '템플릿'}으로 생성하기`
              )}
            </button>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <p className="font-bold mb-1">💡 사용 가이드</p>
          <p>• <strong>템플릿:</strong> 무료, 최대 20,000개, 빠름 (36개 패턴 + 별점만 리뷰)</p>
          <p>• <strong>AI:</strong> 유료(건당 ~0.05원), 최대 500개, 상품에 맞는 자연스러운 리뷰</p>
          <p>• 추천: AI로 500개 + 템플릿으로 나머지 채우기</p>
        </div>
      </div>
    </AdminLayout>
  )
}
