import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import ImageUpload from '@/components/ImageUpload'
import AdminLayout from '@/components/AdminLayout'
import {
  Package, Plus, Edit, Trash2, Eye, EyeOff,
  Loader2, Image as ImageIcon, Star, X
} from 'lucide-react'

interface Product {
  id: number
  name: string
  description: string
  long_description?: string
  price: number
  compare_at_price?: number
  stock: number
  image_url: string
  detail_images?: string | string[]
  is_active: boolean
  product_type: 'live' | 'featured'
  category: string
  seller_id?: number
  seller_name?: string
  created_at: string
}

const EMPTY_FORM = {
  name: '', description: '', long_description: '', price: '', compare_at_price: '',
  stock: '', image_url: '', detail_images: ['', '', '', ''] as string[],
  category: 'lifestyle', product_type: 'featured' as 'live' | 'featured'
}

export default function AdminProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)

  useEffect(() => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
    if (!token) { navigate('/admin/login'); return }
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) setProducts(response.data.data)
    } catch (err: any) {
      setError('상품 목록을 불러올 수 없습니다.')
    } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const payload = {
        name: formData.name, description: formData.description,
        long_description: formData.long_description || undefined,
        price: Number(formData.price),
        compare_at_price: formData.compare_at_price ? Number(formData.compare_at_price) : undefined,
        stock: Number(formData.stock), image_url: formData.image_url,
        detail_images: JSON.stringify(formData.detail_images.filter(u => u.trim())),
        category: formData.category, product_type: formData.product_type, is_active: 1
      }
      if (editingProduct) {
        await api.put(`/api/admin/products/${editingProduct.id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        toast.success('상품이 수정되었습니다.')
      } else {
        await api.post('/api/admin/products', payload, { headers: { Authorization: `Bearer ${token}` } })
        toast.success('상품이 등록되었습니다.')
      }
      setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); loadProducts()
    } catch (err: any) {
      setError(err.response?.data?.error || '상품 저장에 실패했습니다.')
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('정말 이 상품을 삭제하시겠습니까?')) return
    setDeleting(productId)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.delete(`/api/admin/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('상품이 삭제되었습니다.'); loadProducts()
    } catch (err: any) {
      toast.error(err.response?.data?.error || '상품 삭제에 실패했습니다.')
    } finally { setDeleting(null) }
  }

  async function handleToggleActive(productId: number, current: boolean) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.patch(`/api/admin/products/${productId}`, { is_active: !current }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('상품 상태가 변경되었습니다.'); loadProducts()
    } catch (err: any) {
      toast.error(err.response?.data?.error || '상품 상태 변경에 실패했습니다.')
    }
  }

  function handleEdit(product: Product) {
    setEditingProduct(product)
    let detailImages = ['', '', '', '']
    if (product.detail_images) {
      try {
        const parsed = typeof product.detail_images === 'string' ? JSON.parse(product.detail_images) : product.detail_images
        detailImages = [...parsed, '', '', '', ''].slice(0, 4)
      } catch { /* ignore */ }
    }
    setFormData({
      name: product.name, description: product.description,
      long_description: product.long_description || '', price: product.price.toString(),
      compare_at_price: product.compare_at_price?.toString() || '',
      stock: product.stock.toString(), image_url: product.image_url,
      detail_images: detailImages, category: product.category, product_type: product.product_type
    })
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">상품 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title="상품 관리"
      headerRight={
        <button
          onClick={() => { setEditingProduct(null); setFormData(EMPTY_FORM); setShowModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" /> Ur 특가 상품 등록
        </button>
      }
    >
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* 상품 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {products.length === 0 ? (
          <div className="py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-4">등록된 상품이 없습니다.</p>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 mx-auto">
              <Plus className="w-4 h-4" /> 첫 상품 등록하기
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-gray-50">
                  {['이미지', '상품명', '타입', '가격', '재고', '상태', '액션'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                        {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{product.description || '설명 없음'}</p>
                    </td>
                    <td className="px-4 py-3">
                      {product.product_type === 'featured' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                          <Star className="w-3 h-3" /> Ur 특가
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">라이브</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{product.price.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${product.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {product.stock > 0 ? `${product.stock}개` : '품절'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggleActive(product.id, product.is_active)}>
                        {product.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">
                            <Eye className="w-3 h-3" /> 판매중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer">
                            <EyeOff className="w-3 h-3" /> 비활성
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(product)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} disabled={deleting === product.id} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50">
                          {deleting === product.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM) }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editingProduct ? '상품 수정' : 'Ur 특가 상품 등록'}</h2>
              <button onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM) }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상품명 <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">짧은 설명</label>
                <textarea name="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상세 설명</label>
                <textarea name="long_description" value={formData.long_description} onChange={e => setFormData({ ...formData, long_description: e.target.value })} rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '판매가격 *', name: 'price', placeholder: '89000' },
                  { label: '정가 (할인 전)', name: 'compare_at_price', placeholder: '149000' },
                  { label: '재고 수량 *', name: 'stock', placeholder: '50' },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">{f.label}</label>
                    <input type="number" name={f.name} value={(formData as any)[f.name]} onChange={e => setFormData({ ...formData, [f.name]: e.target.value })} required={f.label.includes('*')} min="0" placeholder={f.placeholder} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">대표 이미지</label>
                <ImageUpload value={formData.image_url} onChange={url => setFormData({ ...formData, image_url: url })} label="" maxSizeKB={800} />
                <input type="url" name="image_url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })} placeholder="또는 이미지 URL 직접 입력" className="w-full px-3 py-2 mt-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상세 이미지 (최대 4장)</label>
                <div className="space-y-2">
                  {formData.detail_images.map((url, i) => (
                    <input key={i} type="url" value={url} onChange={e => { const imgs = [...formData.detail_images]; imgs[i] = e.target.value; setFormData({ ...formData, detail_images: imgs }) }} placeholder={`상세 이미지 ${i + 1} URL`} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">카테고리 *</label>
                  <select name="category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {[['fashion', '패션'], ['beauty', '뷰티'], ['food', '식품'], ['electronics', '전자기기'], ['lifestyle', '라이프스타일']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">상품 타입 *</label>
                  <select name="product_type" value={formData.product_type} onChange={e => setFormData({ ...formData, product_type: e.target.value as 'live' | 'featured' })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="featured">Ur 특가 (메인 페이지 노출)</option>
                    <option value="live">라이브 방송 전용</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM) }} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">취소</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">{editingProduct ? '수정' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
