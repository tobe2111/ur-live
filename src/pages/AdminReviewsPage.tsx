import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Star, Loader2, Trash2 } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'

interface Product {
  id: number; name: string; image_url?: string
}

export default function AdminReviewsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [count, setCount] = useState(50)
  const [avgRating, setAvgRating] = useState(4.5)
  const [options, setOptions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)

  const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }

  useEffect(() => {
    api.get('/api/admin/products', { headers })
      .then(r => { if (r.data.success) setProducts(r.data.data || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function generateReviews() {
    if (!selectedProduct) { toast.error('상품을 선택해주세요'); return }
    if (count < 1 || count > 500) { toast.error('1~500 사이로 입력해주세요'); return }

    setGenerating(true)
    try {
      const res = await api.post('/api/admin/reviews/generate', {
        product_id: selectedProduct,
        count,
        avg_rating: avgRating,
        options: options ? options.split(',').map(o => o.trim()) : [],
      }, { headers })

      if (res.data.success) {
        toast.success(res.data.message)
      } else {
        toast.error(res.data.error || '생성 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '리뷰 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <AdminLayout title="리뷰 관리"><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div></AdminLayout>
  }

  return (
    <AdminLayout title="리뷰 관리">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 리뷰 자동 생성 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-base font-bold text-gray-900">리뷰 자동 생성</h2>
          </div>

          <div className="space-y-4">
            {/* 상품 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택 *</label>
              <select
                value={selectedProduct || ''}
                onChange={e => setSelectedProduct(Number(e.target.value) || null)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">상품을 선택하세요</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 생성 개수 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">생성 개수</label>
                <input
                  type="number" value={count} onChange={e => setCount(Number(e.target.value))}
                  min={1} max={500}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">평균 평점</label>
                <input
                  type="number" value={avgRating} onChange={e => setAvgRating(Number(e.target.value))}
                  min={1} max={5} step={0.1}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            {/* 옵션 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상품 옵션 (콤마 구분, 선택)</label>
              <input
                value={options} onChange={e => setOptions(e.target.value)}
                placeholder="예: 블랙 M, 화이트 L, 네이비 XL"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {/* 미리보기 */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <p><strong>미리보기:</strong></p>
              <p>• 상품: {products.find(p => p.id === selectedProduct)?.name || '미선택'}</p>
              <p>• {count}개 리뷰, 평균 {avgRating}점</p>
              <p>• 한국인 이름 랜덤 (마스킹: 김*수)</p>
              <p>• 날짜: 최근 90일 랜덤</p>
              {options && <p>• 옵션: {options}</p>}
            </div>

            {/* 생성 버튼 */}
            <button
              onClick={generateReviews}
              disabled={!selectedProduct || generating}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl disabled:opacity-40 active:scale-[0.98]"
            >
              {generating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `${count}개 리뷰 생성하기`}
            </button>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <p className="font-bold mb-1">⚠️ 주의사항</p>
          <p>• 생성된 리뷰는 is_generated=1로 표시되어 실제 유저 리뷰와 구분됩니다</p>
          <p>• 평점은 목표 평균 ±0.5 범위에서 자연스럽게 분포됩니다</p>
          <p>• 한 번에 최대 500개까지 생성 가능합니다</p>
        </div>
      </div>
    </AdminLayout>
  )
}
