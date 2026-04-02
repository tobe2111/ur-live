import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import ImageUpload from '@/components/ImageUpload'
import ProductOptionForm, { ProductOption } from '@/components/ProductOptionForm'
import AdminLayout from '@/components/AdminLayout'
import {
  Package, Plus, Edit, Trash2, Eye, EyeOff,
  Loader2, Image as ImageIcon, Star, X, Truck, CheckCircle, XCircle, Clock,
  BarChart2, TrendingUp, Download, Upload
} from 'lucide-react'
import { downloadAdminTemplate } from '@/utils/product-template'
import BulkUploadModal from '@/components/BulkUploadModal'
import { formatKSTDate } from '@/utils/date'

interface Product {
  id: number
  name: string
  description: string
  long_description?: string
  price: number
  compare_at_price?: number
  supply_price?: number
  is_supply_product?: boolean
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

interface SupplySalesRow {
  supply_product_id: number
  supply_product_name: string
  supply_price: number
  seller_product_id: number
  seller_product_name: string
  seller_price: number
  seller_id: number
  seller_name: string
  business_name: string
  order_count: number
  total_qty: number
  total_revenue: number
  total_supply_cost: number
  seller_margin: number
}

interface SupplySalesSummary {
  total_orders: number
  total_qty: number
  total_revenue: number
  total_supply_cost: number
}

interface SampleRequest {
  id: number
  seller_id: number
  seller_name: string
  seller_email: string
  product_id: number
  product_name: string
  retail_price: number
  supply_price: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  seller_memo: string | null
  admin_memo: string | null
  created_at: string
  approved_at: string | null
}

const EMPTY_FORM = {
  name: '', description: '', long_description: '', price: '', compare_at_price: '',
  supply_price: '', stock: '', image_url: '', detail_images: ['', '', '', ''] as string[],
  category: 'lifestyle', product_type: 'featured' as 'live' | 'featured',
  is_supply_product: false
}

export default function AdminProductsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'products' | 'sample-requests' | 'supply-sales'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [sampleRequests, setSampleRequests] = useState<SampleRequest[]>([])
  const [supplySales, setSupplySales] = useState<SupplySalesRow[]>([])
  const [supplySummary, setSupplySummary] = useState<SupplySalesSummary | null>(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [srLoading, setSrLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [adminMemoMap, setAdminMemoMap] = useState<Record<number, string>>({})
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
    if (!token) { navigate('/admin/login'); return }
    loadProducts()
  }, [])

  useEffect(() => {
    if (activeTab === 'sample-requests') loadSampleRequests()
    if (activeTab === 'supply-sales') loadSupplySales()
  }, [activeTab])

  async function loadProducts() {
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const response = await api.get('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      if (response.data.success) setProducts(response.data.data)
    } catch {
      setError('상품 목록을 불러올 수 없습니다.')
    } finally { setLoading(false) }
  }

  async function loadSampleRequests() {
    setSrLoading(true)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const res = await api.get('/api/admin/sample-requests', { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) setSampleRequests(res.data.data?.items ?? [])
    } catch {
      toast.error('샘플 신청 목록을 불러올 수 없습니다.')
    } finally { setSrLoading(false) }
  }

  async function loadSupplySales() {
    setSalesLoading(true)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const res = await api.get('/api/admin/supply/sales', { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) {
        setSupplySales(res.data.data?.rows ?? [])
        setSupplySummary(res.data.data?.summary ?? null)
      }
    } catch {
      toast.error('판매 현황을 불러올 수 없습니다.')
    } finally { setSalesLoading(false) }
  }

  async function handleSampleAction(reqId: number, action: 'approve' | 'reject') {
    setActionLoading(reqId)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.patch(`/api/admin/sample-requests/${reqId}`, {
        action,
        admin_memo: adminMemoMap[reqId] || null,
      }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(action === 'approve' ? '샘플 신청이 승인되었습니다.' : '샘플 신청이 거부되었습니다.')
      loadSampleRequests()
    } catch (err: any) {
      toast.error(err.response?.data?.error || '처리에 실패했습니다.')
    } finally { setActionLoading(null) }
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
        supply_price: formData.supply_price ? Number(formData.supply_price) : undefined,
        is_supply_product: formData.is_supply_product ? 1 : 0,
        stock: Number(formData.stock), image_url: formData.image_url,
        detail_images: JSON.stringify(formData.detail_images.filter(u => u.trim())),
        category: formData.category, product_type: formData.product_type, is_active: 1
      }
      if (editingProduct) {
        await api.put(`/api/admin/products/${editingProduct.id}`, payload, { headers: { Authorization: `Bearer ${token}` } })
        toast.success('상품이 수정되었습니다.')
      } else {
        const createRes = await api.post('/api/admin/products', payload, { headers: { Authorization: `Bearer ${token}` } })
        const productId = createRes.data.data?.id || createRes.data.data?.productId
        if (productOptions.length > 0 && productId) {
          try {
            await api.post(`/api/admin/products/${productId}/options`, { options: productOptions }, { headers: { Authorization: `Bearer ${token}` } })
          } catch { toast.error('상품은 등록되었으나 옵션 저장에 실패했습니다.') }
        }
        toast.success('상품이 등록되었습니다.')
      }
      setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([]); loadProducts()
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
      supply_price: product.supply_price?.toString() || '',
      stock: product.stock.toString(), image_url: product.image_url,
      detail_images: detailImages, category: product.category, product_type: product.product_type,
      is_supply_product: !!product.is_supply_product
    })
    setShowModal(true)
  }

  const pendingCount = sampleRequests.filter(r => r.status === 'PENDING').length

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
        activeTab === 'products' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAdminTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold rounded-lg hover:bg-green-100"
            >
              <Download className="w-3.5 h-3.5" /> 양식 다운로드
            </button>
            <button
              onClick={() => setShowBulkUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100"
            >
              <Upload className="w-3.5 h-3.5" /> 대량등록
            </button>
            <button
              onClick={() => { setEditingProduct(null); setFormData(EMPTY_FORM); setShowModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" /> 상품 등록
            </button>
          </div>
        ) : undefined
      }
    >
      {/* 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Package className="w-4 h-4" /> 상품 목록</span>
        </button>
        <button
          onClick={() => setActiveTab('sample-requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sample-requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5">
            <Truck className="w-4 h-4" /> 샘플 신청 목록
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{pendingCount}</span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('supply-sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'supply-sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> 공급 판매 현황</span>
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>}

      {/* ── 상품 목록 탭 ── */}
      {activeTab === 'products' && (
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
                    {['이미지', '상품명', '타입', '판매가 / 공급가', '재고', '상태', '액션'].map(h => (
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
                        {product.is_supply_product && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
                            <Truck className="w-3 h-3" /> 공급 상품
                          </span>
                        )}
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
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{product.price.toLocaleString()}원</p>
                        {product.is_supply_product && product.supply_price != null && product.supply_price > 0 && (
                          <p className="text-xs text-purple-600 mt-0.5">공급가 {product.supply_price.toLocaleString()}원</p>
                        )}
                      </td>
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
      )}

      {/* ── 샘플 신청 목록 탭 ── */}
      {activeTab === 'sample-requests' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {srLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            </div>
          ) : sampleRequests.length === 0 ? (
            <div className="py-20 text-center">
              <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">샘플 신청 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sampleRequests.map(req => (
                <div key={req.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {req.status === 'PENDING' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> 대기중</span>}
                        {req.status === 'APPROVED' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> 승인됨</span>}
                        {req.status === 'REJECTED' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> 거부됨</span>}
                        <span className="text-xs text-gray-400">{formatKSTDate(req.created_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{req.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        셀러: <span className="font-medium">{req.seller_name || req.seller_email}</span>
                        &nbsp;·&nbsp; 판매가 {req.retail_price?.toLocaleString()}원
                        &nbsp;·&nbsp; 공급가 <span className="text-purple-600 font-medium">{req.supply_price?.toLocaleString()}원</span>
                      </p>
                      {req.seller_memo && (
                        <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">셀러 메모: {req.seller_memo}</p>
                      )}
                      {req.admin_memo && req.status !== 'PENDING' && (
                        <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">어드민 메모: {req.admin_memo}</p>
                      )}
                    </div>
                    {req.status === 'PENDING' && (
                      <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                        <textarea
                          placeholder="어드민 메모 (선택)"
                          value={adminMemoMap[req.id] || ''}
                          onChange={e => setAdminMemoMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                          rows={2}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSampleAction(req.id, 'approve')}
                            disabled={actionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            승인
                          </button>
                          <button
                            onClick={() => handleSampleAction(req.id, 'reject')}
                            disabled={actionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" /> 거부
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 공급 판매 현황 탭 ── */}
      {activeTab === 'supply-sales' && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          {supplySummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: '총 주문 수', value: `${supplySummary.total_orders.toLocaleString()}건`, color: 'text-blue-700' },
                { label: '총 판매 수량', value: `${supplySummary.total_qty.toLocaleString()}개`, color: 'text-gray-700' },
                { label: '셀러 총 매출', value: `${supplySummary.total_revenue.toLocaleString()}원`, color: 'text-gray-700' },
                { label: '어드민 공급 수익', value: `${supplySummary.total_supply_cost.toLocaleString()}원`, color: 'text-purple-700' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                  <p className={`text-base font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {salesLoading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
            ) : supplySales.length === 0 ? (
              <div className="py-20 text-center">
                <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">공급 상품 판매 내역이 없습니다.</p>
                <p className="text-xs text-gray-300 mt-1">셀러가 공급 상품을 등록하고 판매하면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['공급 상품', '셀러', '셀러 판매가', '공급가', '주문', '판매량', '셀러 매출', '어드민 수익', '셀러 마진'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {supplySales.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-900 line-clamp-1">{row.supply_product_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-900">{row.business_name || row.seller_name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-right">{row.seller_price.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-xs text-purple-600 font-medium text-right">{row.supply_price.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-center">{row.order_count}건</td>
                        <td className="px-4 py-3 text-xs text-gray-700 text-center">{row.total_qty}개</td>
                        <td className="px-4 py-3 text-xs text-gray-900 font-medium text-right">{row.total_revenue.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-xs text-purple-700 font-semibold text-right">{row.total_supply_cost.toLocaleString()}원</td>
                        <td className="px-4 py-3 text-xs text-emerald-600 text-right">{row.seller_margin.toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([]) }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editingProduct ? '상품 수정' : '상품 등록'}</h2>
              <button onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([]) }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상품명 <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">짧은 설명</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">상세 설명</label>
                <textarea value={formData.long_description} onChange={e => setFormData({ ...formData, long_description: e.target.value })} rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">판매가 (Ur 특가 노출) <span className="text-red-500">*</span></label>
                  <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required min="0" placeholder="89000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">정가 (할인 전)</label>
                  <input type="number" value={formData.compare_at_price} onChange={e => setFormData({ ...formData, compare_at_price: e.target.value })} min="0" placeholder="149000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>

              {/* 공급가 섹션 */}
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={formData.is_supply_product}
                    onChange={e => setFormData({ ...formData, is_supply_product: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-xs font-semibold text-purple-800 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> 셀러 공급 상품으로 등록
                  </span>
                </label>
                {formData.is_supply_product && (
                  <div>
                    <label className="block text-xs font-medium text-purple-700 mb-1.5">공급가 (셀러에게만 노출)</label>
                    <input
                      type="number"
                      value={formData.supply_price}
                      onChange={e => setFormData({ ...formData, supply_price: e.target.value })}
                      min="0"
                      placeholder="55000"
                      className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                    />
                    <p className="text-xs text-purple-600 mt-1">셀러가 샘플 신청 후 승인되면 공급가로 상품을 등록해 판매할 수 있습니다.</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">재고 수량 <span className="text-red-500">*</span></label>
                <input type="number" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} required min="0" placeholder="50" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">대표 이미지</label>
                <ImageUpload value={formData.image_url} onChange={url => setFormData({ ...formData, image_url: url })} label="" maxSizeKB={800} />
                <input type="url" value={formData.image_url} onChange={e => setFormData({ ...formData, image_url: e.target.value })} placeholder="또는 이미지 URL 직접 입력" className="w-full px-3 py-2 mt-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
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
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">카테고리 <span className="text-red-500">*</span></label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {[['fashion', '패션'], ['beauty', '뷰티'], ['food', '식품'], ['electronics', '전자기기'], ['lifestyle', '라이프스타일']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">상품 타입 <span className="text-red-500">*</span></label>
                  <select value={formData.product_type} onChange={e => setFormData({ ...formData, product_type: e.target.value as 'live' | 'featured' })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="featured">Ur 특가 (메인 페이지 노출)</option>
                    <option value="live">라이브 방송 전용</option>
                  </select>
                </div>
              </div>

              {/* 상품 옵션 */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <ProductOptionForm
                  options={productOptions}
                  onChange={setProductOptions}
                  disabled={false}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([]) }} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">취소</button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">{editingProduct ? '수정' : '등록'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        tokenKey="admin_token"
        onSuccess={loadProducts}
      />
    </AdminLayout>
  )
}
