import { useTranslation } from 'react-i18next'
/**
 * SellerSupplyPage - 셀러 공급가 시스템
 *
 * Tab 1: 어드민 공급 상품 목록 (샘플 신청 가능)
 * Tab 2: 내 샘플 신청 목록 (승인된 상품 등록 가능)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import {
  Truck, Package, Loader2,
  Search, CheckCircle, XCircle, Clock,
  ShoppingBag, Tag, Plus
} from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

interface SupplyProduct {
  id: number
  name: string
  description: string | null
  retail_price: number
  supply_price: number
  image_url: string | null
  stock: number
  category: string | null
  product_type: string | null
  request_id: number | null
  request_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  seller_memo: string | null
  admin_memo: string | null
  request_created_at: string | null
  approved_at: string | null
}

interface SampleRequest {
  id: number
  product_id: number
  product_name: string
  retail_price: number
  supply_price: number
  product_image: string | null
  category: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  seller_memo: string | null
  admin_memo: string | null
  created_at: string
  approved_at: string | null
}

export default function SellerSupplyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-requests'>('catalog')

  // Catalog
  const [products, setProducts] = useState<SupplyProduct[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // My requests
  const [requests, setRequests] = useState<SampleRequest[]>([])
  const [reqLoading, setReqLoading] = useState(false)

  // Sample request modal
  const [requestModal, setRequestModal] = useState<SupplyProduct | null>(null)
  const [sellerMemo, setSellerMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Register modal
  const [registerModal, setRegisterModal] = useState<SampleRequest | null>(null)
  const [sellerPrice, setSellerPrice] = useState('')
  const [registering, setRegistering] = useState(false)

  const token = () => localStorage.getItem('seller_token')

  useEffect(() => {
    if (!token()) { navigate('/seller/login'); return }
    loadCatalog()
  }, [search])

  useEffect(() => {
    if (activeTab === 'my-requests') loadMyRequests()
  }, [activeTab])

  async function loadCatalog() {
    setCatalogLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search) params.set('search', search)
      const res = await api.get(`/api/supply/products?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (res.data.success) setProducts(res.data.data?.items ?? [])
    } catch {
      toast.error(t('seller.loadSupplyProductsFailed'))
    } finally { setCatalogLoading(false) }
  }

  async function loadMyRequests() {
    setReqLoading(true)
    try {
      const res = await api.get('/api/supply/sample-requests', {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (res.data.success) setRequests(res.data.data ?? [])
    } catch {
      toast.error(t('seller.loadSampleRequestsFailed'))
    } finally { setReqLoading(false) }
  }

  async function handleSampleRequest() {
    if (!requestModal) return
    setSubmitting(true)
    try {
      await api.post('/api/supply/sample-requests', {
        product_id: requestModal.id,
        seller_memo: sellerMemo || undefined,
      }, { headers: { Authorization: `Bearer ${token()}` } })
      toast.success(t('seller.sampleRequestSuccess'))
      setRequestModal(null); setSellerMemo('')
      loadCatalog()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || t('seller.sampleRequestFailed'))
    } finally { setSubmitting(false) }
  }

  async function handleRegister() {
    if (!registerModal || !sellerPrice) return
    const price = Number(sellerPrice)
    if (price <= 0) { toast.error(t('seller.enterSellerPriceError')); return }
    setRegistering(true)
    try {
      await api.post('/api/supply/register', {
        product_id: registerModal.product_id,
        seller_price: price,
      }, { headers: { Authorization: `Bearer ${token()}` } })
      toast.success(t('seller.productRegisteredSuccess'))
      setRegisterModal(null); setSellerPrice('')
      loadMyRequests()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      toast.error(err_.response?.data?.error || t('seller.productRegisterFailedMsg'))
    } finally { setRegistering(false) }
  }

  const approvedCount = requests.filter(r => r.status === 'APPROVED').length

  return (
    <SellerLayout title={t('seller.supplyProducts')}>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.supplyProducts')}
          subtitle={t('seller.supplySubtitle', { defaultValue: '공급 상품 요청 및 관리' })}
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'catalog' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-1.5"><ShoppingBag className="w-4 h-4" /> {t('seller.supplyProductList')}</span>
          </button>
          <button
            onClick={() => setActiveTab('my-requests')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'my-requests' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4" /> {t('seller.myRequestList')}
              {approvedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-green-500 text-white text-xs rounded-full">{approvedCount}</span>
              )}
            </span>
          </button>
        </div>

        {/* ── 공급 상품 목록 ── */}
        {activeTab === 'catalog' && (
          <>
            {/* Search */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                  placeholder={t('seller.searchProductName')}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
                />
              </div>
              <button
                onClick={() => setSearch(searchInput)}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                {t('common.search')}
              </button>
            </div>

            {catalogLoading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" /></div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center">
                <Truck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t('seller.noSupplyProductsEmpty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map(product => (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-start">
                    {/* Image */}
                    <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                        : <Package className="w-8 h-8 text-gray-300" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Tag className="w-3 h-3" /> {t('seller.retailPrice')} <strong>{product.retail_price.toLocaleString()}{t('common.won')}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                          {t('seller.supplyPrice')} <strong>{product.supply_price.toLocaleString()}{t('common.won')}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{t('seller.stockCount', { count: product.stock })}</p>
                    </div>

                    {/* CTA */}
                    <div className="flex-shrink-0">
                      {product.request_status === null && (
                        <button
                          onClick={() => { setRequestModal(product); setSellerMemo('') }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t('seller.sampleRequest')}
                        </button>
                      )}
                      {product.request_status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-200">
                          <Clock className="w-3 h-3" /> {t('seller.reviewing')}
                        </span>
                      )}
                      {product.request_status === 'APPROVED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3" /> {t('seller.approved')}
                        </span>
                      )}
                      {product.request_status === 'REJECTED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-200">
                          <XCircle className="w-3 h-3" /> {t('seller.rejected')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 내 샘플 신청 목록 ── */}
        {activeTab === 'my-requests' && (
          <>
            {reqLoading ? (
              <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" /></div>
            ) : requests.length === 0 ? (
              <div className="py-20 text-center">
                <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-4">{t('seller.noSampleRequests')}</p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 mx-auto"
                >
                  <Truck className="w-4 h-4" /> {t('seller.browseSupplyProducts')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-start">
                    {/* Image */}
                    <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                      {req.product_image
                        ? <img src={req.product_image} alt={req.product_name} className="w-full h-full object-cover" loading="lazy" />
                        : <Package className="w-6 h-6 text-gray-300" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {req.status === 'PENDING' && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> {t('seller.reviewing')}</span>}
                        {req.status === 'APPROVED' && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> {t('seller.approved')}</span>}
                        {req.status === 'REJECTED' && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> {t('seller.rejected')}</span>}
                        <span className="text-xs text-gray-400">{formatKSTDate(req.created_at)}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{req.product_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{t('seller.retailPrice')} {req.retail_price?.toLocaleString()}{t('common.won')}</span>
                        <span className="text-xs text-purple-600 font-medium">{t('seller.supplyPrice')} {req.supply_price?.toLocaleString()}{t('common.won')}</span>
                      </div>
                      {req.seller_memo && (
                        <p className="mt-1 text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{t('seller.requestMemo')}: {req.seller_memo}</p>
                      )}
                      {req.admin_memo && (
                        <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{t('seller.adminMemo')}: {req.admin_memo}</p>
                      )}
                    </div>

                    {/* CTA */}
                    {req.status === 'APPROVED' && (
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => { setRegisterModal(req); setSellerPrice(req.retail_price?.toString() || '') }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                        >
                          <Plus className="w-3.5 h-3.5" /> {t('seller.storeRegister')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 샘플 신청 모달 ── */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setRequestModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('seller.sampleRequestTitle')}</h3>
            <p className="text-xs text-gray-500 mb-4">{requestModal.name}</p>

            <div className="bg-purple-50 rounded-lg p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{t('seller.retailPriceLabel')}</span>
                <span className="font-medium">{requestModal.retail_price.toLocaleString()}{t('common.won')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-purple-700 font-medium">{t('seller.supplyPriceLabel')}</span>
                <span className="text-purple-700 font-semibold">{requestModal.supply_price.toLocaleString()}{t('common.won')}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('seller.requestMemoOptional')}</label>
              <textarea
                value={sellerMemo}
                onChange={e => setSellerMemo(e.target.value)}
                rows={3}
                placeholder={t('seller.requestMemoPlaceholder')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRequestModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">{t('common.cancel')}</button>
              <button
                onClick={handleSampleRequest}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                {t('seller.submitRequest')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 상품 등록 모달 ── */}
      {registerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setRegisterModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('seller.storeRegisterTitle')}</h3>
            <p className="text-xs text-gray-500 mb-4">{registerModal.product_name}</p>

            <div className="bg-green-50 rounded-lg p-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">{t('seller.supplyPriceCost')}</span>
                <span className="font-medium text-purple-700">{registerModal.supply_price?.toLocaleString()}{t('common.won')}</span>
              </div>
              <p className="text-xs text-green-700 mt-1">{t('seller.profitExplain')}</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">{t('seller.setSellerPrice')} <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={sellerPrice}
                onChange={e => setSellerPrice(e.target.value)}
                min={registerModal.supply_price || 1}
                placeholder={t('seller.enterSellerPrice')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
              {sellerPrice && Number(sellerPrice) > (registerModal.supply_price || 0) && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  {t('seller.expectedMargin', { amount: (Number(sellerPrice) - (registerModal.supply_price || 0)).toLocaleString() })}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRegisterModal(null)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">{t('common.cancel')}</button>
              <button
                onClick={handleRegister}
                disabled={registering || !sellerPrice || Number(sellerPrice) <= 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                {t('seller.registerProductBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
