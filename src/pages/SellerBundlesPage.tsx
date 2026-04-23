import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { isSellerAuthenticated, getSellerToken } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardEmptyState, DashboardLoading } from '@/components/dashboard'
import { Package, Plus, Trash2, Loader2, Pencil, ToggleLeft, ToggleRight, X, CheckCircle2 } from 'lucide-react'

interface BundleItem { product_id: number; quantity: number }
interface Bundle {
  id: number; name: string; description: string | null; seller_id: number
  discount_type: string; discount_value: number; is_active: number
  item_count: number; created_at: string
}
interface Product { id: number; name: string; price: number; image_url: string | null; stock: number }

export default function SellerBundlesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = getSellerToken()
  const headers = { Authorization: `Bearer ${token}` }

  const [bundles, setBundles] = useState<Bundle[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', discount_type: 'percent' as 'percent' | 'fixed',
    discount_value: 10, items: [] as BundleItem[],
  })

  useEffect(() => {
    if (!isSellerAuthenticated()) { navigate('/seller/login'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [bRes, pRes] = await Promise.allSettled([
        api.get('/api/seller/bundles', { headers }),
        api.get('/api/seller/products', { headers }),
      ])
      if (bRes.status === 'fulfilled' && bRes.value.data?.success) setBundles(bRes.value.data.data || [])
      if (pRes.status === 'fulfilled' && pRes.value.data?.success) setProducts(pRes.value.data.data || [])
    } catch { toast.error('데이터를 불러올 수 없습니다') }
    finally { setLoading(false) }
  }

  function resetForm() {
    setForm({ name: '', description: '', discount_type: 'percent', discount_value: 10, items: [] })
    setEditId(null); setShowForm(false)
  }

  function toggleProduct(pid: number) {
    setForm(f => {
      const exists = f.items.find(i => i.product_id === pid)
      return {
        ...f,
        items: exists
          ? f.items.filter(i => i.product_id !== pid)
          : [...f.items, { product_id: pid, quantity: 1 }],
      }
    })
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error('번들 이름을 입력하세요'); return }
    if (form.items.length < 2) { toast.error('최소 2개 상품을 선택하세요'); return }
    setSubmitting(true)
    try {
      if (editId) {
        await api.patch(`/api/seller/bundles/${editId}`, form, { headers })
        toast.success('번들이 수정되었습니다')
      } else {
        await api.post('/api/seller/bundles', form, { headers })
        toast.success('번들이 생성되었습니다')
      }
      resetForm(); loadData()
    } catch { toast.error('처리에 실패했습니다') }
    finally { setSubmitting(false) }
  }

  async function toggleActive(id: number, current: number) {
    try {
      await api.patch(`/api/seller/bundles/${id}`, { is_active: !current }, { headers })
      loadData()
    } catch { toast.error('상태 변경에 실패했습니다') }
  }

  async function deleteBundle(id: number) {
    if (!confirm('번들을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/seller/bundles/${id}`, { headers })
      toast.success('삭제되었습니다'); loadData()
    } catch { toast.error('삭제에 실패했습니다') }
  }

  const selectedTotal = form.items.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.product_id)
    return sum + (p?.price || 0) * item.quantity
  }, 0)
  const discountedTotal = form.discount_type === 'percent'
    ? Math.round(selectedTotal * (1 - form.discount_value / 100))
    : Math.max(0, selectedTotal - form.discount_value)

  return (
    <SellerLayout title={t('seller.nav.bundles', '번들 상품')}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.nav.bundles', '번들 상품')}
          subtitle={t('seller.bundlesSubtitle', '여러 상품을 묶어 세트 할인 판매')}
          icon={<Package className="h-5 w-5" />}
          actions={
            <button onClick={() => { resetForm(); setShowForm(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {t('seller.bundleCreate', '번들 만들기')}
            </button>
          }
        />

        {/* 생성/수정 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                {editId ? t('seller.bundleEdit', '번들 수정') : t('seller.bundleCreate', '번들 만들기')}
              </h3>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('seller.bundleName', '번들 이름')}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예) 맛집 세트 A" maxLength={80}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('common.description', '설명')}</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="번들 설명 (선택)" rows={2} maxLength={300}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 resize-none" />
            </div>

            {/* 할인 설정 */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('seller.discountType', '할인 방식')}</label>
                <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percent' | 'fixed' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
                  <option value="percent">% 할인</option>
                  <option value="fixed">원 할인</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {form.discount_type === 'percent' ? t('seller.discountPercent', '할인율') : t('seller.discountAmount', '할인액')}
                </label>
                <input type="number" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))}
                  min={0} max={form.discount_type === 'percent' ? 90 : 1000000}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            </div>

            {/* 상품 선택 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('seller.bundleProducts', '상품 선택')} <span className="text-red-500">*</span>
                {form.items.length > 0 && <span className="ml-1 text-blue-600 font-normal">{form.items.length}개 선택</span>}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {products.filter(p => p.stock > 0).map(p => {
                  const selected = form.items.some(i => i.product_id === p.id)
                  return (
                    <button key={p.id} onClick={() => toggleProduct(p.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      {p.image_url && <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded object-cover shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-gray-900">{p.name}</p>
                        <p className="text-gray-500">{p.price.toLocaleString()}원</p>
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 가격 요약 */}
            {form.items.length >= 2 && (
              <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <span className="line-through">{selectedTotal.toLocaleString()}원</span>
                  <span className="mx-1.5">→</span>
                  <span className="text-lg font-bold text-blue-700">{discountedTotal.toLocaleString()}원</span>
                </div>
                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  {form.discount_type === 'percent' ? `${form.discount_value}% OFF` : `${form.discount_value.toLocaleString()}원 할인`}
                </span>
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting || form.items.length < 2}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                editId ? t('common.save', '저장') : t('seller.bundleCreate', '번들 만들기')}
            </button>
          </div>
        )}

        {/* 번들 목록 */}
        {loading ? <DashboardLoading /> : bundles.length === 0 && !showForm ? (
          <DashboardEmptyState
            icon={<Package className="h-7 w-7" />}
            title={t('seller.noBundles', '등록된 번들이 없습니다')}
          />
        ) : (
          <div className="space-y-3">
            {bundles.map(b => (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-900 truncate">{b.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {b.is_active ? t('common.active', '활성') : t('common.inactive', '비활성')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {b.item_count}개 상품 · {b.discount_type === 'percent' ? `${b.discount_value}% 할인` : `${b.discount_value.toLocaleString()}원 할인`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleActive(b.id, b.is_active)}
                    className="p-2 rounded-lg hover:bg-gray-100" title={b.is_active ? '비활성화' : '활성화'}>
                    {b.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => deleteBundle(b.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
