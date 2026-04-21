import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { Package, AlertTriangle, Plus, Minus, BarChart3, QrCode, Search, ArrowUpDown, Camera, X } from 'lucide-react'
import JsBarcode from 'jsbarcode'

interface Product {
  id: number
  name: string
  stock: number
  barcode: string | null
  min_stock_alert: number
  image_url: string | null
  price: number
  is_supply_product?: boolean
}

interface StockMovement {
  id: number
  type: 'in' | 'out' | 'adjust' | 'return'
  quantity: number
  stock_before: number
  stock_after: number
  reason: string
  created_at: string
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  in:     { label: 'stockHistoryIn', color: 'text-green-600 bg-green-50' },
  out:    { label: 'stockHistoryOut', color: 'text-red-600 bg-red-50' },
  adjust: { label: 'stockHistoryAdjust', color: 'text-blue-600 bg-blue-50' },
  return: { label: 'stockHistoryReturn', color: 'text-amber-600 bg-amber-50' },
}

export default function SellerInventoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [alerts, setAlerts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [history, setHistory] = useState<StockMovement[]>([])
  const [showModal, setShowModal] = useState(false)
  const [stockAction, setStockAction] = useState<'in' | 'out' | 'adjust'>('in')
  const [quantity, setQuantity] = useState(0)
  const [reason, setReason] = useState('')
  const [scanInput, setScanInput] = useState('')
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = mediaStream
      setShowCamera(true)

      // Wait for video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          videoRef.current.play()

          // Try BarcodeDetector if available
          if ('BarcodeDetector' in window) {
            scanningRef.current = true
            const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
              formats: ['ean_13', 'qr_code', 'code_128']
            })
            const scanLoop = async () => {
              if (!scanningRef.current || !videoRef.current) return
              try {
                const barcodes = await detector.detect(videoRef.current)
                if (barcodes.length > 0) {
                  const value = barcodes[0].rawValue
                  setScanInput(value)
                  stopCamera()
                  // Auto-trigger scan
                  try {
                    const token = localStorage.getItem('seller_token')
                    const res = await api.get(`/api/inventory/barcode/scan/${value.trim()}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    if (res.data.success) {
                      const p = res.data.data.product
                      setSelectedProduct(p as Product)
                      setHistory(res.data.data.recent_movements || [])
                      setShowModal(true)
                      setScanInput('')
                    } else {
                      toast.error(res.data.error)
                    }
                  } catch {
                    toast.error(t('seller.productNotFound'))
                  }
                  return
                }
              } catch { /* detection failed, retry */ }
              if (scanningRef.current) {
                requestAnimationFrame(scanLoop)
              }
            }
            scanLoop()
          }
        }
      }, 100)
    } catch {
      toast.error(t('seller.cameraUnavailable'))
    }
  }, [stopCamera])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      if (!token) { navigate('/seller/login'); return }
      const headers = { Authorization: `Bearer ${token}` }

      const [prodRes, alertRes] = await Promise.all([
        api.get('/api/seller/products', { headers }),
        api.get('/api/inventory/stock/alerts', { headers }),
      ])

      if (prodRes.data.success) {
        const all = prodRes.data.data?.products || prodRes.data.data || []
        setProducts(all.filter((p: Product) => !p.is_supply_product))
      }
      if (alertRes.data.success) {
        setAlerts(alertRes.data.data || [])
      }
    } catch {
      toast.error(t('seller.dataLoadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function generateBarcode(productId: number) {
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.post(`/api/inventory/barcode/generate/${productId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        toast.success(t('seller.barcodeGenerated', { barcode: res.data.data.barcode }))
        loadData()
      }
    } catch {
      toast.error(t('seller.barcodeGenerateFailed'))
    }
  }

  async function handleScan(barcodeValue?: string) {
    const code = (barcodeValue ?? scanInput).trim()
    if (!code) return
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.get(`/api/inventory/barcode/scan/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        const p = res.data.data.product
        setSelectedProduct(p as Product)
        setHistory(res.data.data.recent_movements || [])
        setShowModal(true)
        setScanInput('')
      } else {
        toast.error(res.data.error)
      }
    } catch {
      toast.error(t('seller.productNotFound'))
    }
  }

  async function handleStockAction() {
    if (!selectedProduct) return
    const token = localStorage.getItem('seller_token')
    const headers = { Authorization: `Bearer ${token}` }

    try {
      if (stockAction === 'adjust') {
        await api.post('/api/inventory/stock/adjust', {
          product_id: selectedProduct.id, new_stock: quantity, reason
        }, { headers })
      } else {
        await api.post(`/api/inventory/stock/${stockAction}`, {
          product_id: selectedProduct.id, quantity, reason
        }, { headers })
      }
      toast.success(stockAction === 'in' ? t('seller.stockInComplete') : stockAction === 'out' ? t('seller.stockOutComplete') : t('seller.stockAdjustComplete'))
      setShowModal(false)
      setQuantity(0)
      setReason('')
      loadData()
    } catch (err: unknown) {
      const errMsg = (err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.error || t('seller.processFailed')
      toast.error(errMsg)
    }
  }

  async function viewProduct(product: Product) {
    setSelectedProduct(product)
    try {
      const token = localStorage.getItem('seller_token')
      const res = await api.get(`/api/inventory/stock/history/${product.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) setHistory(res.data.data)
    } catch { setHistory([]) }
    setShowModal(true)
  }

  // 바코드 SVG 렌더링
  function BarcodeDisplay({ value }: { value: string }) {
    const ref = (el: SVGSVGElement | null) => {
      if (el && value) {
        try { JsBarcode(el, value, { format: 'EAN13', width: 2, height: 50, fontSize: 14 }) } catch { /* invalid */ }
      }
    }
    return <svg ref={ref} />
  }

  if (loading) {
    return (
      <SellerLayout title={t('seller.inventory')}>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title={t('seller.inventory')}>
      {/* 바코드 스캔 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
              placeholder={t('seller.barcodeScanInput')}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={startCamera}
            className="px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            title={t('seller.cameraScanBarcode')}
          >
            <Camera className="w-4 h-4" />
          </button>
          <button onClick={handleScan} className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            {t('seller.lookupButton')}
          </button>
        </div>
      </div>

      {/* 재고 부족 알림 */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">{t('seller.lowStockProducts', { count: alerts.length })}</h3>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-amber-700">{p.name}</span>
                <span className="font-bold text-red-600">{t('seller.remainingStock', { count: p.stock })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상품 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            <Package className="w-4 h-4 inline mr-1" />{t('seller.inventory')}
          </h3>
        </div>
        <div className="divide-y divide-gray-50">
          {products.map(p => (
            <div
              key={p.id}
              onClick={() => viewProduct(p)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer"
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-400">
                  {p.barcode ? `${t('seller.barcodePrefix')}: ${p.barcode}` : t('seller.barcodeNotGenerated')}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${p.stock <= (p.min_stock_alert || 5) ? 'text-red-600' : 'text-gray-900'}`}>
                  {p.stock}{t('common.count')}
                </p>
                {!p.barcode && (
                  <button
                    onClick={e => { e.stopPropagation(); generateBarcode(p.id) }}
                    className="text-[10px] text-blue-600 font-medium mt-0.5"
                  >
                    <QrCode className="w-3 h-3 inline" /> {t('seller.generateButton')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 상품 상세 + 입출고 모달 */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{selectedProduct.name}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* 바코드 표시 + 다운로드/인쇄 */}
              {selectedProduct.barcode && (
                <div className="text-center py-3 bg-gray-50 rounded-xl">
                  <div id="barcode-container">
                    <BarcodeDisplay value={selectedProduct.barcode} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{selectedProduct.barcode}</p>
                  <div className="flex gap-2 justify-center mt-3">
                    <button
                      onClick={() => {
                        const svg = document.querySelector('#barcode-container svg')
                        if (!svg) return
                        const svgData = new XMLSerializer().serializeToString(svg)
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        const img = new Image()
                        img.onload = () => {
                          canvas.width = img.width * 2
                          canvas.height = img.height * 2
                          ctx!.fillStyle = 'white'
                          ctx!.fillRect(0, 0, canvas.width, canvas.height)
                          ctx!.drawImage(img, 0, 0, canvas.width, canvas.height)
                          const a = document.createElement('a')
                          a.download = `barcode-${selectedProduct.barcode}.png`
                          a.href = canvas.toDataURL('image/png')
                          a.click()
                        }
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg"
                    >
                      {t('common.save')}
                    </button>
                    <button
                      onClick={() => {
                        const svg = document.querySelector('#barcode-container svg')
                        if (!svg) return
                        const printWin = window.open('', '_blank', 'width=400,height=300')
                        if (!printWin) return
                        printWin.document.write(`
                          <html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
                            <h3 style="margin-bottom:8px">${selectedProduct.name}</h3>
                            ${new XMLSerializer().serializeToString(svg)}
                            <p style="margin-top:4px;font-size:12px">${selectedProduct.barcode}</p>
                          </body></html>
                        `)
                        printWin.document.close()
                        printWin.print()
                      }}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg"
                    >
                      Print
                    </button>
                  </div>
                </div>
              )}

              {/* 현재 재고 */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <span className="text-sm text-gray-700">{t('common.stock')}</span>
                <span className={`text-xl font-bold ${selectedProduct.stock <= (selectedProduct.min_stock_alert || 5) ? 'text-red-600' : 'text-blue-600'}`}>
                  {selectedProduct.stock}{t('common.count')}
                </span>
              </div>

              {/* 입고/출고/조정 */}
              <div>
                <div className="flex gap-1 mb-3">
                  {(['in', 'out', 'adjust'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => { setStockAction(type); setQuantity(0) }}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        stockAction === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {type === 'in' ? t('seller.stockIn') : type === 'out' ? t('seller.stockOut') : t('seller.stockAdjust')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={quantity || ''}
                    onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                    placeholder={stockAction === 'adjust' ? t('common.quantity') : t('common.quantity')}
                    min={0}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={t('seller.reasonOptional')}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleStockAction}
                  disabled={!quantity && stockAction !== 'adjust'}
                  className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {stockAction === 'in' ? <><Plus className="w-3.5 h-3.5 inline" /> {t('seller.stockInProcess')}</> :
                   stockAction === 'out' ? <><Minus className="w-3.5 h-3.5 inline" /> {t('seller.stockOutProcess')}</> :
                   <><ArrowUpDown className="w-3.5 h-3.5 inline" /> {t('seller.stockAdjustProcess')}</>}
                </button>
              </div>

              {/* 입출고 이력 */}
              {history.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">
                    <BarChart3 className="w-3.5 h-3.5 inline mr-1" />{t('seller.stockHistory')}
                  </h4>
                  <div className="space-y-1.5">
                    {history.map(h => {
                      const style = TYPE_LABELS[h.type] || { label: h.type, color: 'text-gray-600 bg-gray-50' }
                      return (
                        <div key={h.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.color}`}>{t(`seller.${style.label}`)}</span>
                            <span className="text-gray-500">{h.reason}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-semibold text-gray-700">{h.stock_before} → {h.stock_after}</span>
                            <span className="text-gray-400 ml-1">({h.quantity > 0 ? '+' : ''}{h.quantity})</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 카메라 스캔 모달 */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/70" onClick={stopCamera} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                {t('seller.barcodeScan')}
              </h3>
              <button onClick={stopCamera} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-24 border-2 border-blue-400 rounded-lg opacity-70" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              {!('BarcodeDetector' in window) && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  {t('seller.noBarcodeDetector')}
                </p>
              )}
              {'BarcodeDetector' in window && (
                <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                  {t('seller.barcodeAutoDetect')}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('seller.enterBarcodeManual')}
                  className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val) {
                        setScanInput(val)
                        stopCamera()
                        handleScan(val)
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    stopCamera()
                  }}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
