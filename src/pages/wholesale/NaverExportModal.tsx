/**
 * 🛒 2026-06-12 네이버 커머스API Phase A — "스마트스토어로 내보내기" 모달.
 *   판매가(기본=권장가)·재고·배송비·A/S 연락처·네이버 카테고리(검색 select) 입력 →
 *   POST /api/wholesale/naver/export. 미연결(NOT_CONNECTED)이면 연동 페이지로 안내.
 *   WT 라이트 고정. 모달은 상품 상세에서 lazy 로드(연동 안 쓴 판매사는 chunk 비용 0).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, Store, Search } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won } from './wholesale-theme'

const sellerAuth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

interface CategoryItem { id: string; label: string }

export default function NaverExportModal({ product, onClose }: {
  product: { id: number; name: string; retail_price?: number | null; distributor_price?: number | null; stock?: number }
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [salePrice, setSalePrice] = useState(String(product.retail_price || ''))
  const [stock, setStock] = useState(String(Math.max(1, Math.min(Number(product.stock) || 1, 999))))
  const [shippingFee, setShippingFee] = useState('0')
  const [asTel, setAsTel] = useState('')
  const [catQuery, setCatQuery] = useState('')
  const [catItems, setCatItems] = useState<CategoryItem[]>([])
  const [catSelected, setCatSelected] = useState<CategoryItem | null>(null)
  const [catLoading, setCatLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notConnected, setNotConnected] = useState(false)

  // 카테고리 검색 — 400ms 디바운스.
  useEffect(() => {
    const q = catQuery.trim()
    if (q.length < 2) { setCatItems([]); return }
    setCatLoading(true)
    const tm = setTimeout(() => {
      api.get(`/api/wholesale/naver/categories?q=${encodeURIComponent(q)}`, sellerAuth())
        .then(r => {
          if (r.data?.success) setCatItems(r.data.items || [])
          else if (r.data?.code === 'NOT_CONNECTED') setNotConnected(true)
        })
        .catch(e => {
          if ((e as { response?: { data?: { code?: string } } })?.response?.data?.code === 'NOT_CONNECTED') setNotConnected(true)
        })
        .finally(() => setCatLoading(false))
    }, 400)
    return () => clearTimeout(tm)
  }, [catQuery])

  const submit = async () => {
    if (saving) return
    if (!catSelected) { toast.error('네이버 카테고리를 선택해주세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/wholesale/naver/export', {
        product_id: product.id,
        sale_price: Number(salePrice),
        stock_quantity: Number(stock),
        shipping_fee: Number(shippingFee) || 0,
        leaf_category_id: catSelected.id,
        as_telephone: asTel.trim(),
      }, sellerAuth())
      if (r.data?.success) {
        toast.success('스마트스토어에 등록되었습니다 🎉')
        onClose()
      } else {
        toast.error(r.data?.error || '내보내기 실패')
      }
    } catch (e) {
      const d = (e as { response?: { data?: { error?: string; code?: string } } })?.response?.data
      if (d?.code === 'NOT_CONNECTED') setNotConnected(true)
      else toast.error(d?.error || '내보내기 실패')
    } finally { setSaving(false) }
  }

  const margin = Number(salePrice) > 0 && Number(product.distributor_price) > 0
    ? Number(salePrice) - Number(product.distributor_price)
    : null
  const inputCls = 'w-full h-11 px-3 rounded-xl text-[14px] text-gray-900 outline-none'
  const inputStyle = { border: `1.5px solid ${WT.line}`, background: WT.fill2 } as React.CSSProperties
  const labelCls = 'block text-[12px] font-bold mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: WT.ink }}>
            <Store className="w-5 h-5" style={{ color: '#03C75A' }} /> 스마트스토어로 내보내기
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] mb-4 truncate" style={{ color: WT.ink3 }}>{product.name}</p>

        {notConnected ? (
          <div className="rounded-xl p-4 text-center" style={{ background: WT.fill2, border: `1px solid ${WT.line}` }}>
            <p className="text-[13.5px] font-bold mb-1" style={{ color: WT.ink }}>아직 스마트스토어가 연결되지 않았어요</p>
            <p className="text-[12.5px] mb-3" style={{ color: WT.ink3 }}>커머스API 앱을 연결하면 버튼 한 번으로 등록할 수 있어요.</p>
            <button onClick={() => navigate('/wholesale/naver')} className="px-4 h-10 rounded-xl text-[13px] font-bold text-white" style={{ background: '#03C75A' }}>
              연동하러 가기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
                <label className={labelCls} style={{ color: WT.ink2 }}>A/S 연락처 *</label>
                <input value={asTel} onChange={e => setAsTel(e.target.value)} disabled={saving} placeholder="010-0000-0000" className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: WT.ink2 }}>네이버 카테고리 *</label>
              {catSelected ? (
                <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: WT.brandSoft, border: `1px solid #F8C9D2` }}>
                  <span className="text-[12.5px] font-bold truncate" style={{ color: WT.ink }}>{catSelected.label}</span>
                  <button onClick={() => setCatSelected(null)} className="text-[11px] font-bold shrink-0" style={{ color: WT.brand }}>변경</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: WT.ink4 }} />
                    <input value={catQuery} onChange={e => setCatQuery(e.target.value)} disabled={saving}
                      placeholder="카테고리 검색 (예: 커피, 영양제, 주방)" className={inputCls} style={{ ...inputStyle, paddingLeft: 36 }} />
                  </div>
                  {(catLoading || catItems.length > 0) && (
                    <div className="mt-1 rounded-xl overflow-hidden max-h-44 overflow-y-auto" style={{ border: `1px solid ${WT.line}` }}>
                      {catLoading ? (
                        <div className="py-3 text-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300 mx-auto" /></div>
                      ) : catItems.map(item => (
                        <button key={item.id} onClick={() => { setCatSelected(item); setCatItems([]) }}
                          className="w-full text-left px-3 py-2.5 text-[12.5px] hover:bg-gray-50 border-b last:border-b-0"
                          style={{ color: WT.ink2, borderColor: WT.fill }}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <button onClick={submit} disabled={saving || !catSelected || !salePrice || !asTel.trim()}
              className="w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50" style={{ background: '#03C75A' }}>
              {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 등록 중...</span> : '스마트스토어에 등록하기'}
            </button>
            <p className="text-[10.5px]" style={{ color: WT.ink4 }}>등록 직후 스마트스토어센터에서 상세설명·옵션을 보완할 수 있어요. 원산지는 '상세설명 참조'로 등록됩니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
