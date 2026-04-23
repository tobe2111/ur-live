import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardEmptyState, DashboardLoading } from '@/components/dashboard'
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Image as ImageIcon,
  DollarSign,
  Box,
  Download,
  Upload
} from 'lucide-react'
import { downloadSellerTemplate } from '@/utils/product-template'
import BulkUploadModal from '@/components/BulkUploadModal'

interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  image_url: string
  is_active: boolean
  live_stream_title?: string
  created_at: string
}

export default function SellerProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [supplyProducts, setSupplyProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [activeTab, setActiveTab] = useState<'my' | 'supply'>('my')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      const headers = { 'Authorization': `Bearer ${sessionToken}` }
      const [prodRes, supplyRes] = await Promise.allSettled([
        api.get('/api/seller/products', { headers }),
        api.get('/api/supply/products', { headers }),
      ])
      if (prodRes.status === 'fulfilled' && prodRes.value.data.success) {
        // 내 상품에서 공급 상품(is_supply_product=1) 제외
        const allProducts = prodRes.value.data.data || []
        setProducts(allProducts.filter((p: Product & { is_supply_product?: boolean }) => !p.is_supply_product))
      }
      if (supplyRes.status === 'fulfilled' && supplyRes.value.data?.success) {
        const d = supplyRes.value.data.data
        const items = Array.isArray(d) ? d : d?.items || []
        setSupplyProducts(items.filter((p: Record<string, unknown>) =>
          String(p.request_status || '').toUpperCase() === 'APPROVED'
        ).map((p: Record<string, unknown>) => ({
          id: p.id, name: p.name, description: p.description || '',
          price: p.retail_price || p.price, stock: p.stock || 0,
          image_url: p.image_url || '', is_active: 1, category: p.category || '',
        } as unknown as Product)))
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to load products:', error)
      setError(t('seller.productListLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(productId: number, currentStatus: boolean) {
    if (!confirm(t('seller.confirmToggleActive', { status: currentStatus ? t('seller.toggleDeactivate') : t('seller.toggleActivate') }))) {
      return
    }

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      const response = await api.put(
        `/api/seller/products/${productId}`,
        { is_active: !currentStatus, status: !currentStatus ? 'ACTIVE' : 'PAUSED' },
        { headers: { 'Authorization': `Bearer ${sessionToken}` } }
      )

      if (response.data.success) {
        toast.success(t('seller.productStatusChanged'))
        loadProducts()
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to toggle product:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || t('seller.productStatusChangeFailed'))
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm(t('seller.confirmDeleteProduct'))) {
      return
    }

    setDeleting(productId)

    try {
      const sessionToken = localStorage.getItem('seller_token')
      

      const response = await api.delete(`/api/seller/products/${productId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success(t('seller.productDeleted'))
        loadProducts()
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to delete product:', error)
      const axiosErr = error as { response?: { data?: { error?: string } } }
      toast.error(axiosErr.response?.data?.error || t('seller.productDeleteFailed'))
    } finally {
      setDeleting(null)
    }
  }

  function formatPrice(price: number) {
    return price.toLocaleString('ko-KR')
  }

  return (
    <SellerLayout title={t('seller.nav.products')}>
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 127: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.nav.products')}
          subtitle={t('seller.manageProducts')}
          icon={<Package className="h-5 w-5" />}
          actions={
            <>
              <Button
                onClick={downloadSellerTemplate}
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 h-9 px-3 text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                <span>{t('seller.bulkTemplateDownload')}</span>
              </Button>
              <Button
                onClick={() => setShowBulkUpload(true)}
                variant="outline"
                className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 h-9 px-3 text-xs"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                <span>{t('seller.bulkUpload')}</span>
              </Button>
              <Button
                onClick={() => navigate('/seller/products/new')}
                className="h-9 bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                <span>{t('seller.addProduct')}</span>
              </Button>
            </>
          }
        />

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              {t('seller.retryButton')}
            </button>
          </div>
        )}

        {/* 탭: 내 상품 / 공급 상품 */}
        <div className="mb-4 inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'my' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t('seller.myProducts')} <span className="ml-1 opacity-70">{products.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('supply')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'supply' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t('seller.supplyProductsTab')} <span className="ml-1 opacity-70">{supplyProducts.length}</span>
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <DashboardLoading variant="skeleton" rows={4} />
        ) : (
          /* Products List */
          <div>
            {(activeTab === 'my' ? products : supplyProducts).length === 0 ? (
              <DashboardEmptyState
                icon={<Package className="h-7 w-7" />}
                title={t('seller.noProductsRegistered')}
                action={
                  <Button
                    onClick={() => navigate('/seller/products/new')}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('seller.firstProductRegister')}
                  </Button>
                }
              />
            ) : (
              <>
                {/* Desktop Table View - Hidden on mobile */}
                <div className="hidden lg:block bg-white rounded-lg shadow-sm border overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.image')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('seller.productName')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.price')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('common.stock')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('seller.liveStreamColumn')}</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('seller.actionColumn')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(activeTab === 'my' ? products : supplyProducts).map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {product.image_url && product.image_url.trim() !== '' ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500 line-clamp-1 mt-1">{product.description || t('seller.noDescription')}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900 font-medium">
                            {formatPrice(product.price)}{t('common.won')}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={product.stock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                              {product.stock > 0 ? `${product.stock}${t('common.count')}` : t('seller.soldOut')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggleActive(product.id, product.is_active)}
                              className="inline-flex items-center gap-1"
                            >
                              {product.is_active ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200">
                                  <Eye className="w-3 h-3 mr-1" />
                                  {t('seller.onSale')}
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800 border-gray-200 cursor-pointer hover:bg-gray-200">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  {t('seller.inactiveStatus')}
                                </Badge>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {product.live_stream_title || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                                className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                title={t('common.edit')}
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(product.id)}
                                disabled={deleting === product.id}
                                className="text-red-600 hover:text-red-800 transition-colors p-1 disabled:opacity-50"
                                title={t('common.delete')}
                              >
                                {deleting === product.id ? (
                                  <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-5 h-5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View - Shown on mobile/tablet */}
                <div className="lg:hidden space-y-3 sm:space-y-4">
                  {(activeTab === 'my' ? products : supplyProducts).map((product) => (
                    <div key={product.id} className="bg-white rounded-lg shadow-sm border p-3 sm:p-4">
                      <div className="flex gap-3 sm:gap-4">
                        {/* Product Image */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                          {product.image_url && product.image_url.trim() !== '' ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : null}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-2">
                              {product.name}
                            </h3>
                            <button
                              onClick={() => handleToggleActive(product.id, product.is_active)}
                              className="flex-shrink-0"
                            >
                              {product.is_active ? (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-200 text-xs">
                                  <Eye className="w-3 h-3 mr-1" />
                                  {t('seller.onSale')}
                                </Badge>
                              ) : (
                                <Badge className="bg-gray-100 text-gray-800 border-gray-200 cursor-pointer hover:bg-gray-200 text-xs">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  {t('seller.inactiveStatus')}
                                </Badge>
                              )}
                            </button>
                          </div>

                          {product.description && (
                            <p className="text-xs sm:text-sm text-gray-500 line-clamp-1 mb-2">
                              {product.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1 text-gray-900">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span className="text-base sm:text-lg font-bold">
                                {formatPrice(product.price)}{t('common.won')}
                              </span>
                            </div>
                            <Badge className={product.stock > 0 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>
                              <Box className="w-3 h-3 mr-1" />
                              {product.stock > 0 ? `${product.stock}${t('common.count')}` : t('seller.soldOut')}
                            </Badge>
                          </div>

                          {product.live_stream_title && (
                            <p className="text-xs text-gray-500 mb-2">
                              📺 {product.live_stream_title}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                            >
                              <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              {t('common.edit')}
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 text-xs sm:text-sm"
                            >
                              {deleting === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  {t('common.delete')}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Stats Card */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('common.product')}</p>
                  <p className="text-2xl font-bold text-gray-900">{products.length}{t('common.count')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('seller.onSale')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.filter(p => p.is_active).length}{t('common.count')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Box className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('common.stock')}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {products.reduce((sum, p) => sum + p.stock, 0)}{t('common.count')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <BulkUploadModal
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        tokenKey="seller_token"
        onSuccess={loadProducts}
      />
    </SellerLayout>
  )
}
