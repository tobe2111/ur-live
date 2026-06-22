/**
 * 📥 2026-06-12 (사용자 요청): "내 스토어 상품 가져오기" — 제조사 역방향 임포트.
 *   본인 스마트스토어/쿠팡 계정 연결 → 내 상품 목록 → 선택 → 공급률(%) 일괄 적용 →
 *   공급상품(승인 대기)으로 일괄 등록. 입력 노가다 0 — "지금 파는 상품 5분 만에 입점".
 *   공식 API 의 본인 데이터만 사용. 이미지는 서버가 R2 미러(핫링크 깨짐 방지).
 *   라이트 고정(대시보드 계열). lazy 로드.
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Download, Store } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'

type Channel = 'naver' | 'coupang'
interface StoreItem { name: string; sale_price?: number; stock?: number; image_url?: string | null; status?: string; origin_no?: string; product_id?: string }

export default function StoreImportModal({ t, onClose, onImported }: {
  t: (k: string, o?: Record<string, unknown>) => string
  onClose: () => void
  onImported: () => void
}) {
  const [channel, setChannel] = useState<Channel>('naver')
  const [connected, setConnected] = useState<{ naver: boolean; coupang: boolean } | null>(null)
  const [items, setItems] = useState<StoreItem[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [ratePct, setRatePct] = useState('70')
  // 연결 폼 (채널 공용 — 쿠팡은 vendor_id 추가)
  const [f1, setF1] = useState(''); const [f2, setF2] = useState(''); const [f3, setF3] = useState('')
  const [connecting, setConnecting] = useState(false)

  const loadStatus = useCallback(async () => {
    try {
      const r = await supplierApi.get<{ naver_connected?: boolean; coupang_connected?: boolean }>('/api/supplier/store/status')
      setConnected({ naver: !!r.naver_connected, coupang: !!r.coupang_connected })
    } catch { setConnected({ naver: false, coupang: false }) }
  }, [])
  useEffect(() => { loadStatus() }, [loadStatus])

  const loadProducts = useCallback(async (ch: Channel) => {
    setLoading(true); setItems([]); setSelected(new Set())
    try {
      const r = await supplierApi.get<{ items?: StoreItem[] }>(`/api/supplier/store/products?channel=${ch}`)
      const list = r.items || []
      setItems(list)
      setSelected(new Set(list.map((_, i) => i))) // 기본 전체 선택
      if (!list.length) toast.error('스토어에 상품이 없거나 불러오지 못했어요')
    } catch (e) {
      toast.error((e as Error)?.message || '상품 목록을 불러오지 못했어요')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (connected?.[channel]) loadProducts(channel)
    else { setItems([]); setSelected(new Set()) }
  }, [channel, connected, loadProducts])

  const connect = async () => {
    if (connecting) return
    setConnecting(true)
    try {
      if (channel === 'naver') {
        await supplierApi.post('/api/supplier/store/naver/connect', { client_id: f1.trim(), client_secret: f2.trim() })
      } else {
        await supplierApi.post('/api/supplier/store/coupang/connect', { access_key: f1.trim(), secret_key: f2.trim(), vendor_id: f3.trim() })
      }
      toast.success('연결되었습니다 🎉')
      setF1(''); setF2(''); setF3('')
      await loadStatus()
    } catch (e) {
      toast.error((e as Error)?.message || '연결 실패')
    } finally { setConnecting(false) }
  }

  const runImport = async () => {
    if (importing) return
    const rate = Number(ratePct)
    if (!Number.isFinite(rate) || rate < 10 || rate > 100) { toast.error('공급률은 10~100% 사이로 입력해주세요'); return }
    const picked = items.filter((_, i) => selected.has(i))
    if (!picked.length) { toast.error('가져올 상품을 선택해주세요'); return }
    setImporting(true)
    try {
      const body = channel === 'naver'
        ? { channel, supply_rate_pct: rate, items: picked.map(p => ({ name: p.name, sale_price: p.sale_price ?? 0, stock: p.stock ?? 0, image_url: p.image_url ?? null })) }
        : { channel, supply_rate_pct: rate, product_ids: picked.map(p => p.product_id).filter(Boolean) }
      const r = await supplierApi.post<{ summary?: { created: number; failed: number }; results?: Array<{ name: string; status: string; reason?: string }> }>('/api/supplier/store/import', body)
      const s = r.summary
      toast.success(`${s?.created ?? 0}건 등록(승인 대기), ${s?.failed ?? 0}건 실패`)
      const failed = (r.results || []).filter(x => x.status === 'error').slice(0, 5)
      if (failed.length) toast.error(failed.map(fr => `${fr.name}: ${fr.reason || '오류'}`).join('\n'), { duration: 10000 } as never)
      onImported()
      onClose()
    } catch (e) {
      toast.error((e as Error)?.message || '가져오기 실패')
    } finally { setImporting(false) }
  }

  const isConnected = !!connected?.[channel]
  const inputCls = 'w-full h-11 px-3 rounded-xl text-[14px] text-gray-900 outline-none border border-gray-200 bg-gray-50'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-600" /> {t('supplier.storeImportTitle', { defaultValue: '내 스토어 상품 가져오기' })}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] text-gray-500 mb-4">{t('supplier.storeImportSub', { defaultValue: '이미 판매 중인 상품을 그대로 도매 공급상품으로 등록해요 (관리자 승인 후 노출).' })}</p>

        {/* 채널 탭 */}
        <div className="flex gap-2 mb-4">
          {(['naver', 'coupang'] as Channel[]).map(ch => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`flex-1 h-10 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-1.5 border ${channel === ch ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>
              <Store className="w-4 h-4" style={{ color: ch === 'naver' ? '#03C75A' : '#346AFF' }} />
              {ch === 'naver' ? '스마트스토어' : '쿠팡'}
              {connected?.[ch] && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>

        {connected === null ? (
          <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : !isConnected ? (
          /* 연결 폼 */
          <div className="space-y-3">
            <p className="text-[12.5px] text-gray-600">
              {channel === 'naver'
                ? t('supplier.storeConnectNaver', { defaultValue: '커머스API센터(apicenter.commerce.naver.com)에서 발급한 애플리케이션 ID/시크릿을 입력하세요.' })
                : t('supplier.storeConnectCoupang', { defaultValue: '쿠팡 Wing → 판매자정보 → 추가판매정보 → OPEN API 키의 Access/Secret Key 와 업체코드를 입력하세요.' })}
            </p>
            <input value={f1} onChange={e => setF1(e.target.value)} disabled={connecting} className={inputCls}
              placeholder={channel === 'naver' ? '애플리케이션 ID' : 'Access Key'} autoComplete="off" />
            <input type="password" value={f2} onChange={e => setF2(e.target.value)} disabled={connecting} className={inputCls}
              placeholder={channel === 'naver' ? '애플리케이션 시크릿' : 'Secret Key'} autoComplete="off" />
            {channel === 'coupang' && (
              <input value={f3} onChange={e => setF3(e.target.value)} disabled={connecting} className={inputCls} placeholder="업체코드 (예: A00012345)" />
            )}
            <button onClick={connect} disabled={connecting || !f1.trim() || !f2.trim() || (channel === 'coupang' && !f3.trim())}
              className="w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
              style={{ background: channel === 'naver' ? '#03C75A' : '#346AFF' }}>
              {connecting ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 연결 확인 중...</span> : '연결하기'}
            </button>
          </div>
        ) : (
          /* 상품 선택 + 공급률 */
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-gray-800">{t('supplier.storeRateLabel', { defaultValue: '공급률 일괄 적용' })}</p>
                <p className="text-[11px] text-gray-500">{t('supplier.storeRateHint', { defaultValue: '공급가 = 스토어 판매가 × 공급률. 권장가는 판매가 그대로.' })}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" min={10} max={100} value={ratePct} onChange={e => setRatePct(e.target.value)}
                  className="w-16 h-10 px-2 rounded-lg border border-gray-300 text-center text-[14px] font-bold text-gray-900" />
                <span className="text-[13px] font-bold text-gray-500">%</span>
              </div>
            </div>

            {loading ? (
              <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[12px] text-gray-500">
                  <span>{items.length}개 중 {selected.size}개 선택</span>
                  <button onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((_, i) => i)))}
                    className="font-bold text-gray-700 underline">
                    {selected.size === items.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {items.map((p, i) => {
                    const rate = Number(ratePct) || 0
                    const supply = p.sale_price ? Math.round(p.sale_price * rate / 100) : null
                    return (
                      <label key={i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selected.has(i)}
                          onChange={() => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                          className="w-4 h-4 accent-gray-900 shrink-0" />
                        {p.image_url ? <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" loading="lazy" /> : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-gray-900 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {p.sale_price ? `판매가 ${p.sale_price.toLocaleString('ko-KR')}원` : '가격은 가져올 때 조회'}
                            {supply ? ` → 공급가 ${supply.toLocaleString('ko-KR')}원` : ''}
                            {p.status ? ` · ${p.status}` : ''}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                <button onClick={runImport} disabled={importing || selected.size === 0}
                  className="w-full h-12 rounded-xl bg-[#FC5424] text-white text-[14px] font-bold disabled:opacity-50">
                  {importing
                    ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 가져오는 중...</span>
                    : t('supplier.storeImportBtn', { defaultValue: '{{n}}개 공급상품으로 등록', n: selected.size }).replace('{{n}}', String(selected.size))}
                </button>
                <p className="text-[10.5px] text-gray-400">{t('supplier.storeImportNote', { defaultValue: '등록 후 카탈로그 탭에서 공급가·상세를 수정할 수 있어요. 관리자 승인 후 판매사에게 노출됩니다.' })}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
