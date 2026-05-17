import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Plus, Edit2, Package, Loader2, ArrowLeft } from 'lucide-react'

export default function AgencyProductsPage() {
  const { t } = useTranslation()
  const { sellerId } = useParams<{ sellerId: string }>()
  const navigate = useNavigate()
  const [products, setProducts] = useState<any[]>([])
  const [sellerName, setSellerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', description: '', price: 0, original_price: 0, stock: 100, image_url: '', category: 'general' })
  const [submitting, setSubmitting] = useState(false)
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }

  useEffect(() => {
    if (!sellerId) return
    Promise.all([
      api.get(`/api/agency/sellers/${sellerId}/products`, { headers }),
      api.get('/api/agency/sellers', { headers }),
    ]).then(([prodRes, sellersRes]) => {
      if (prodRes.data.success) setProducts(prodRes.data.data || [])
      const seller = (sellersRes.data.data || []).find((s: { id: number | string; name?: string }) => String(s.id) === sellerId)
      if (seller) setSellerName(seller.name)
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [sellerId])

  async function handleSubmit() {
    if (!form.name || !form.price) { toast.error('상품명과 가격을 입력하세요'); return }
    setSubmitting(true)
    try {
      if (editingId) {
        await api.put(`/api/agency/sellers/${sellerId}/products/${editingId}`, form, { headers })
        toast.success('상품이 수정되었습니다')
      } else {
        await api.post(`/api/agency/sellers/${sellerId}/products`, form, { headers })
        toast.success('상품이 등록되었습니다')
      }
      setShowForm(false); setEditingId(null)
      setForm({ name: '', description: '', price: 0, original_price: 0, stock: 100, image_url: '', category: 'general' })
      const r = await api.get(`/api/agency/sellers/${sellerId}/products`, { headers })
      if (r.data.success) setProducts(r.data.data || [])
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e.response?.data?.error || '실패') }
    finally { setSubmitting(false) }
  }

  return (
    <AgencyLayout title={`${sellerName} 상품 관리`}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={`${sellerName} 상품 관리`}
          subtitle={`${products.length}개 상품`}
          icon={<Package className="h-5 w-5" />}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/agency/sellers')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <ArrowLeft className="h-3.5 w-3.5" /> 셀러 목록
              </button>
              <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', description: '', price: 0, original_price: 0, stock: 100, image_url: '', category: 'general' }) }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> 상품 등록
              </button>
            </div>
          }
        />
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">{editingId ? '상품 수정' : '새 상품 등록'}</h2>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="상품명 *"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="설명" rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">판매가 *</label>
                <input type="number" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-xs text-gray-500">정가</label>
                <input type="number" value={form.original_price || ''} onChange={e => setForm(f => ({ ...f, original_price: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-xs text-gray-500">재고</label>
                <input type="number" value={form.stock || ''} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            </div>
            <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="이미지 URL"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={submitting} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {submitting ? '처리 중...' : editingId ? '수정' : '등록'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">취소</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">등록된 상품이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p: { id: number; name: string; price?: number; stock?: number; image_url?: string; description?: string; original_price?: number; category?: string }) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" loading="lazy" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">{formatNumber(p.price)}원 · 재고 {p.stock}개</p>
                </div>
                <button onClick={() => { setEditingId(p.id); setForm({ name: p.name, description: p.description || '', price: p.price ?? 0, original_price: p.original_price || 0, stock: p.stock || 0, image_url: p.image_url || '', category: p.category || 'general' }); setShowForm(true) }}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
