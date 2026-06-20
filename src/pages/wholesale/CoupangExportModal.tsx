/**
 * 🛒 2026-06-12 쿠팡 — "쿠팡으로 내보내기" 모달 (NaverExportModal 과 쌍둥이).
 *   미연결이면 인라인 연결 폼(Wing access/secret/업체코드/Wing ID — 별도 페이지 없이 모달 안에서).
 *   연결되면: 판매가(예상 마진 표시)·재고·배송비·출고지/반품지 선택 → 내보내기.
 *   카테고리는 쿠팡 추천 API 가 서버에서 자동 결정(입력 불필요 — 네이버보다 한 단계 적음).
 *   WT 라이트 고정. lazy 로드.
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, ShoppingBag } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won } from './wholesale-theme'

const COUPANG_BLUE = '#346AFF'
const sellerAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

interface Place { code: string; name: string }

export default function CoupangExportModal({ product, onClose }: {
  product: { id: number; name: string; retail_price?: number | null; distributor_price?: number | null; stock?: number }
  onClose: () => void
}) {
  const [phase, setPhase] = useState<'loading' | 'connect' | 'form'>('loading')
  // 연결 폼
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [vendorUserId, setVendorUserId] = useState('')
  const [connecting, setConnecting] = useState(false)
  // 내보내기 폼
  const [salePrice, setSalePrice] = useState(String(product.retail_price || ''))
  const [stock, setStock] = useState(String(Math.max(1, Math.min(Number(product.stock) || 1, 999))))
  const [shippingFee, setShippingFee] = useState('0')
  const [brand, setBrand] = useState('')
  const [outbound, setOutbound] = useState<Place[]>([])
  const [returns, setReturns] = useState<Place[]>([])
  const [outboundCode, setOutboundCode] = useState('')
  const [returnCode, setReturnCode] = useState('')
  const [placesError, setPlacesError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadPlaces = useCallback(async () => {
    try {
      const r = await api.get('/api/wholesale/coupang/shipping-places', sellerAuth())
      if (r.data?.success) {
        const ob: Place[] = r.data.outbound || []
        const rt: Place[] = r.data.returns || []
        setOutbound(ob); setReturns(rt)
        if (ob.length) setOutboundCode(ob[0].code)
        if (rt.length) setReturnCode(rt[0].code)
        if (!ob.length) setPlacesError('Wing 에 등록된 출고지가 없어요 — 쿠팡 Wing > 판매자정보에서 출고지를 먼저 등록해주세요.')
        else if (!rt.length) setPlacesError(r.data.returns_error || 'Wing 에 등록된 반품지가 없어요 — Wing 에서 반품지를 먼저 등록해주세요.')
        else setPlacesError('')
        setPhase('form')
      } else if (r.data?.code === 'NOT_CONNECTED') {
        setPhase('connect')
      } else {
        toast.error(r.data?.error || '쿠팡 정보를 불러오지 못했습니다'); setPhase('connect')
      }
    } catch (e) {
      const d = (e as { response?: { data?: { code?: string; error?: string } } })?.response?.data
      if (d?.code === 'NOT_CONNECTED') setPhase('connect')
      else { toast.error(d?.error || '쿠팡 정보를 불러오지 못했습니다'); setPhase('connect') }
    }
  }, [])

  useEffect(() => { loadPlaces() }, [loadPlaces])

  const connect = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      const r = await api.post('/api/wholesale/coupang/connect', {
        access_key: accessKey.trim(), secret_key: secretKey.trim(),
        vendor_id: vendorId.trim(), vendor_user_id: vendorUserId.trim(),
      }, sellerAuth())
      if (r.data?.success) { toast.success('쿠팡 계정이 연결되었습니다 🎉'); setPhase('loading'); loadPlaces() }
      else toast.error(r.data?.error || '연결 실패')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패')
    } finally { setConnecting(false) }
  }

  const submit = async () => {
    if (saving) return
    if (!outboundCode || !returnCode) { toast.error('출고지/반품지를 선택해주세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/wholesale/coupang/export', {
        product_id: product.id,
        sale_price: Number(salePrice),
        stock_quantity: Number(stock),
        shipping_fee: Number(shippingFee) || 0,
        outbound_code: outboundCode,
        return_center_code: returnCode,
        brand: brand.trim(),
      }, sellerAuth())
      if (r.data?.success) { toast.success('쿠팡에 등록 요청했습니다 — 쿠팡 검수 후 노출돼요 🎉'); onClose() }
      else toast.error(r.data?.error || '내보내기 실패')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '내보내기 실패')
    } finally { setSaving(false) }
  }

  const margin = Number(salePrice) > 0 && Number(product.distributor_price) > 0
    ? Number(salePrice) - Number(product.distributor_price) : null
  const inputCls = 'w-full h-11 px-3 rounded-xl text-[14px] text-gray-900 outline-none'
  const inputStyle = { border: `1.5px solid ${WT.line}`, background: WT.fill2 } as React.CSSProperties
  const labelCls = 'block text-[12px] font-bold mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: WT.ink }}>
            <ShoppingBag className="w-5 h-5" style={{ color: COUPANG_BLUE }} /> 쿠팡으로 내보내기
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] mb-4 truncate" style={{ color: WT.ink3 }}>{product.name}</p>

        {phase === 'loading' && <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>}

        {phase === 'connect' && (
          <div className="space-y-3">
            <div className="rounded-xl p-3.5" style={{ background: WT.fill2, border: `1px solid ${WT.line}` }}>
              <p className="text-[13px] font-bold" style={{ color: WT.ink }}>쿠팡 Wing 계정 연결</p>
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: WT.ink2 }}>
                Wing → 판매자정보 → 추가판매정보 → <b>OPEN API 키 발급</b>에서 키를 확인하세요.
                키는 암호화 저장되며, 연결 검증에 성공해야만 저장됩니다.
              </p>
            </div>
            <div>
              <label className={labelCls} style={{ color: WT.ink2 }}>Access Key</label>
              <input value={accessKey} onChange={e => setAccessKey(e.target.value)} disabled={connecting} className={inputCls} style={inputStyle} autoComplete="off" />
            </div>
            <div>
              <label className={labelCls} style={{ color: WT.ink2 }}>Secret Key</label>
              <input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} disabled={connecting} className={inputCls} style={inputStyle} autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>업체코드 (Vendor ID)</label>
                <input value={vendorId} onChange={e => setVendorId(e.target.value)} disabled={connecting} placeholder="A00012345" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>Wing 로그인 ID</label>
                <input value={vendorUserId} onChange={e => setVendorUserId(e.target.value)} disabled={connecting} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <button onClick={connect} disabled={connecting || !accessKey.trim() || !secretKey.trim() || !vendorId.trim() || !vendorUserId.trim()}
              className="w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50" style={{ background: COUPANG_BLUE }}>
              {connecting ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 연결 확인 중...</span> : '연결하기'}
            </button>
          </div>
        )}

        {phase === 'form' && (
          <div className="space-y-3">
            {placesError && (
              <div className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: '#f9fafb', color: '#9A6B00', border: '1px solid #F5E1B8' }}>
                ⚠️ {placesError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>판매가(원) *</label>
                <input type="number" min={100} value={salePrice} onChange={e => setSalePrice(e.target.value)} disabled={saving} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>재고 *</label>
                <input type="number" min={1} max={99999} value={stock} onChange={e => setStock(e.target.value)} disabled={saving} className={inputCls} style={inputStyle} />
              </div>
            </div>
            {margin !== null && (
              <p className="text-[12px] font-semibold" style={{ color: margin > 0 ? WT.pos : '#B3253B' }}>
                예상 마진: {won(margin)} / 개 (공급가 {won(product.distributor_price)})
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>배송비(원, 0=무료)</label>
                <input type="number" min={0} value={shippingFee} onChange={e => setShippingFee(e.target.value)} disabled={saving} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>브랜드 (선택)</label>
                <input value={brand} onChange={e => setBrand(e.target.value)} disabled={saving} placeholder="미입력 시 '기타'" className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>출고지 *</label>
                <select value={outboundCode} onChange={e => setOutboundCode(e.target.value)} disabled={saving} className={inputCls} style={inputStyle}>
                  {outbound.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: WT.ink2 }}>반품지 *</label>
                <select value={returnCode} onChange={e => setReturnCode(e.target.value)} disabled={saving} className={inputCls} style={inputStyle}>
                  {returns.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={submit} disabled={saving || !salePrice || !outboundCode || !returnCode}
              className="w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50" style={{ background: COUPANG_BLUE }}>
              {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</span> : '쿠팡에 등록하기'}
            </button>
            <p className="text-[10.5px]" style={{ color: WT.ink4 }}>
              카테고리는 쿠팡 추천 API 가 자동 결정 · 고시정보는 '상세페이지 참조'로 등록 · 등록 후 쿠팡 검수를 거쳐 노출됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
