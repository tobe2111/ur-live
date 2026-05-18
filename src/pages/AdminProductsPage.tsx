import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import {
  Package, Plus, Edit, Trash2, Eye, EyeOff,
  Loader2, Image as ImageIcon, Star, Truck,
  BarChart2, Download, Upload
} from 'lucide-react'
import { downloadAdminTemplate } from '@/utils/product-template'
import BulkUploadModal from '@/components/BulkUploadModal'
import { formatNumber } from '@/utils/format'

import { EMPTY_FORM } from './admin-products/types'
import type { Product, SupplySalesRow, SupplySalesSummary, SampleRequest } from './admin-products/types'
import ProductFormModal from './admin-products/ProductFormModal'
import SampleRequestsTab from './admin-products/SampleRequestsTab'
import SupplySalesTab from './admin-products/SupplySalesTab'
import type { ProductOption } from '@/components/ProductOptionForm'

export default function AdminProductsPage() {
  const { t } = useTranslation()
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
  // 🛡️ 2026-05-18: 체크박스 선택 상태 — 일괄 삭제/활성화/비활성화.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState<'delete' | 'activate' | 'deactivate' | null>(null)

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
      setError(t('admin.products.k001', { defaultValue: '상품 목록을 불러올 수 없습니다.' }))
    } finally { setLoading(false) }
  }

  async function loadSampleRequests() {
    setSrLoading(true)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const res = await api.get('/api/admin/sample-requests', { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) setSampleRequests(res.data.data?.items ?? [])
    } catch {
      toast.error(t('admin.products.k002', { defaultValue: '샘플 신청 목록을 불러올 수 없습니다.' }))
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
      toast.error(t('admin.products.k003', { defaultValue: '판매 현황을 불러올 수 없습니다.' }))
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
      toast.success(action === 'approve' ? t('admin.products.k004', { defaultValue: '샘플 신청이 승인되었습니다.' }) : t('admin.products.k005', { defaultValue: '샘플 신청이 거부되었습니다.' }))
      loadSampleRequests()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || t('admin.products.k006', { defaultValue: '처리에 실패했습니다.' }))
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
        toast.success(t('admin.products.k007', { defaultValue: '상품이 수정되었습니다.' }))
      } else {
        const createRes = await api.post('/api/admin/products', payload, { headers: { Authorization: `Bearer ${token}` } })
        const productId = createRes.data.data?.id || createRes.data.data?.productId
        if (productOptions.length > 0 && productId) {
          try {
            await api.post(`/api/admin/products/${productId}/options`, { options: productOptions }, { headers: { Authorization: `Bearer ${token}` } })
          } catch { toast.error(t('admin.products.k008', { defaultValue: '상품은 등록되었으나 옵션 저장에 실패했습니다.' })) }
        }
        toast.success(t('admin.products.k009', { defaultValue: '상품이 등록되었습니다.' }))
      }
      setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([]); loadProducts()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || t('admin.products.k010', { defaultValue: '상품 저장에 실패했습니다.' }))
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm(t('admin.products.k011', { defaultValue: '정말 이 상품을 삭제하시겠습니까?' }))) return
    setDeleting(productId)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.delete(`/api/admin/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(t('admin.products.k012', { defaultValue: '상품이 삭제되었습니다.' })); loadProducts()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || t('admin.products.k013', { defaultValue: '상품 삭제에 실패했습니다.' }))
    } finally { setDeleting(null) }
  }

  // 🛡️ 2026-05-18: 체크박스 토글 & 일괄 작업 핸들러.
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleSelectAll() {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)))
    }
  }
  async function handleBulkAction(action: 'delete' | 'activate' | 'deactivate') {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const label = action === 'delete' ? '삭제' : action === 'activate' ? '활성화' : '비활성화'
    const warn = action === 'delete'
      ? `\n\n· 주문 이력 있는 상품은 자동 비활성화 (이력 보존)\n· 주문 이력 없는 상품은 완전 삭제`
      : ''
    if (!confirm(`선택한 ${ids.length}개 상품을 일괄 ${label}하시겠습니까?${warn}`)) return
    setBulkAction(action)
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      const res = await api.post('/api/admin/products/bulk-action', { ids, action }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) {
        toast.success(res.data.message || `${ids.length}건 ${label} 완료`)
        setSelectedIds(new Set())
        loadProducts()
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || `일괄 ${label} 실패`)
    } finally {
      setBulkAction(null)
    }
  }

  async function handleToggleActive(productId: number, current: boolean) {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
      await api.patch(`/api/admin/products/${productId}`, { is_active: !current }, { headers: { Authorization: `Bearer ${token}` } })
      toast.success(t('admin.products.k014', { defaultValue: '상품 상태가 변경되었습니다.' })); loadProducts()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || t('admin.products.k015', { defaultValue: '상품 상태 변경에 실패했습니다.' }))
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

  function handleCloseModal() {
    setShowModal(false); setEditingProduct(null); setFormData(EMPTY_FORM); setProductOptions([])
  }

  const pendingCount = sampleRequests.filter(r => r.status === 'PENDING').length

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.products.k016', { defaultValue: '상품 목록을 불러오는 중...' })}</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title={t('admin.products.k017', { defaultValue: '상품 관리' })}
      headerRight={
        activeTab === 'products' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAdminTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold rounded-lg hover:bg-green-100"
            >
              <Download className="w-3.5 h-3.5" /> {t('admin.products.downloadTemplate', { defaultValue: '양식 다운로드' })}
            </button>
            <button
              onClick={() => setShowBulkUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100"
            >
              <Upload className="w-3.5 h-3.5" /> {t('admin.products.bulkRegister', { defaultValue: '대량등록' })}
            </button>
            <button
              onClick={() => { setEditingProduct(null); setFormData(EMPTY_FORM); setShowModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" /> {t('admin.products.k049', { defaultValue: '상품 등록' })}
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
          <span className="flex items-center gap-1.5"><Package className="w-4 h-4" /> {t('admin.products.k018', { defaultValue: '상품 목록' })}</span>
        </button>
        <button
          onClick={() => setActiveTab('sample-requests')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sample-requests' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5">
            <Truck className="w-4 h-4" /> {t('admin.products.sampleRequestsTab', { defaultValue: '샘플 신청 목록' })}
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{pendingCount}</span>
            )}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('supply-sales')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'supply-sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> {t('admin.products.k019', { defaultValue: '공급 판매 현황' })}</span>
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">{error}</div>}

      {/* 🛡️ 2026-05-18: 일괄 작업 액션 바 — 1건 이상 선택 시 노출. */}
      {activeTab === 'products' && selectedIds.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-blue-900">{selectedIds.size}개 선택됨</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-700 underline underline-offset-2 hover:text-blue-900"
            >
              선택 해제
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkAction('activate')}
              disabled={bulkAction !== null}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Eye className="w-3 h-3" /> {bulkAction === 'activate' ? '처리 중...' : '활성화'}
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('deactivate')}
              disabled={bulkAction !== null}
              className="inline-flex items-center gap-1 rounded-md bg-gray-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600 disabled:opacity-50"
            >
              <EyeOff className="w-3 h-3" /> {bulkAction === 'deactivate' ? '처리 중...' : '비활성화'}
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkAction !== null}
              className="inline-flex items-center gap-1 rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> {bulkAction === 'delete' ? '처리 중...' : `${selectedIds.size}건 삭제`}
            </button>
          </div>
        </div>
      )}

      {/* 상품 목록 탭 */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {products.length === 0 ? (
            <div className="py-20 text-center">
              <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 mb-4">{t('admin.products.k020', { defaultValue: '등록된 상품이 없습니다.' })}</p>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 mx-auto">
                <Plus className="w-4 h-4" /> {t('admin.products.firstRegister', { defaultValue: '첫 상품 등록하기' })}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-gray-50">
                    {/* 🛡️ 2026-05-18: 전체 선택 체크박스 — indeterminate 지원. */}
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.size === products.length}
                        ref={(el) => {
                          if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < products.length
                        }}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    {[
                      t('admin.products.k021', { defaultValue: '이미지' }),
                      t('admin.products.k022', { defaultValue: '상품명' }),
                      t('admin.products.k023', { defaultValue: '타입' }),
                      t('admin.products.k024', { defaultValue: '판매가 / 공급가' }),
                      t('admin.products.k025', { defaultValue: '재고' }),
                      t('admin.products.k026', { defaultValue: '판매 수' }),
                      t('admin.products.k027', { defaultValue: '상태' }),
                      t('admin.products.k028', { defaultValue: '액션' }),
                    ].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map(product => {
                    const checked = selectedIds.has(product.id)
                    return (
                    <tr key={product.id} className={`hover:bg-gray-50 ${checked ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-3 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelect(product.id)}
                          aria-label={`"${product.name}" 선택`}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{product.description || t('admin.products.k029', { defaultValue: '설명 없음' })}</p>
                        {product.is_supply_product && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
                            <Truck className="w-3 h-3" /> {t('admin.products.supplyProduct', { defaultValue: '공급 상품' })}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.product_type === 'featured' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                            <Star className="w-3 h-3" /> {t('admin.products.typeFeatured', { defaultValue: 'Ur 특가' })}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">{t('admin.products.k030', { defaultValue: '라이브' })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{formatNumber(product.price)}{t('common.won', { defaultValue: '원' })}</p>
                        {product.is_supply_product && product.supply_price != null && product.supply_price > 0 && (
                          <p className="text-xs text-purple-600 mt-0.5">{t('admin.products.supplyPriceLabel', { defaultValue: '공급가' })} {formatNumber(product.supply_price)}{t('common.won', { defaultValue: '원' })}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {/* 🛡️ 2026-05-18: 재고 인라인 편집 — Number input + onBlur 자동 저장.
                              0 = 품절 (red), 1-9 = 부족 (amber), 10+ = 정상 (emerald).
                              테두리 색이 시각 신호를 제공해 한눈에 재고 상태 파악. */}
                        <input
                          type="number"
                          key={`stock-${product.id}-${product.stock}`}
                          defaultValue={product.stock}
                          min={0}
                          aria-label={`"${product.name}" 재고 수정`}
                          className={`w-16 px-1.5 py-1 text-xs text-center border rounded-lg focus:outline-none ${
                            product.stock === 0
                              ? 'border-red-300 bg-red-50 text-red-600 focus:border-red-500'
                              : product.stock < 10
                                ? 'border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-500'
                                : 'border-emerald-200 bg-white text-gray-900 focus:border-emerald-500'
                          }`}
                          onBlur={async (e) => {
                            const val = Number(e.target.value)
                            if (!Number.isFinite(val) || val < 0) {
                              e.target.value = String(product.stock)
                              toast.error(t('admin.products.stockInvalid', { defaultValue: '재고는 0 이상의 숫자여야 합니다' }))
                              return
                            }
                            if (val === product.stock) return
                            try {
                              const tk = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
                              await api.patch(`/api/admin/products/${product.id}`, { stock: val }, { headers: { Authorization: `Bearer ${tk}` } })
                              setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: val } : p))
                              toast.success(t('admin.products.stockChanged', { val, defaultValue: `재고 ${val}개로 변경` }))
                            } catch (err: unknown) {
                              e.target.value = String(product.stock)
                              const ax = err as { response?: { data?: { error?: string } } }
                              toast.error(ax.response?.data?.error || t('admin.products.stockChangeFail', { defaultValue: '재고 변경 실패' }))
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          defaultValue={product.sold_count || 0}
                          min={0}
                          className="w-16 px-1.5 py-1 text-xs text-center border border-gray-200 rounded-lg text-gray-900 focus:border-blue-400 focus:outline-none"
                          onBlur={async (e) => {
                            const val = Number(e.target.value)
                            if (val === (product.sold_count || 0)) return
                            try {
                              const tk = localStorage.getItem('admin_token') || localStorage.getItem('access_token')
                              await api.patch(`/api/admin/products/${product.id}`, { sold_count: val }, { headers: { Authorization: `Bearer ${tk}` } })
                              setProducts(prev => prev.map(p => p.id === product.id ? { ...p, sold_count: val } : p))
                              toast.success(t('admin.products.soldCountChanged', { val, defaultValue: `판매 수 ${val}으로 변경` }))
                            } catch { toast.error(t('admin.products.k031', { defaultValue: '변경 실패' })) }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleActive(product.id, product.is_active)}>
                          {product.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">
                              <Eye className="w-3 h-3" /> {t('admin.products.statusActive', { defaultValue: '판매중' })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer">
                              <EyeOff className="w-3 h-3" /> {t('admin.products.statusInactive', { defaultValue: '비활성' })}
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
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sample-requests' && (
        <SampleRequestsTab
          loading={srLoading}
          sampleRequests={sampleRequests}
          adminMemoMap={adminMemoMap}
          setAdminMemoMap={setAdminMemoMap}
          actionLoading={actionLoading}
          onAction={handleSampleAction}
        />
      )}

      {activeTab === 'supply-sales' && (
        <SupplySalesTab
          loading={salesLoading}
          supplySummary={supplySummary}
          supplySales={supplySales}
        />
      )}

      <ProductFormModal
        open={showModal}
        editingProduct={editingProduct}
        formData={formData}
        setFormData={setFormData}
        productOptions={productOptions}
        setProductOptions={setProductOptions}
        error={error}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />

      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        tokenKey="admin_token"
        onSuccess={loadProducts}
      />
    </AdminLayout>
  )
}
