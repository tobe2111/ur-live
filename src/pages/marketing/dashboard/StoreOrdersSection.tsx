import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { CARD_CLS, INPUT_CLS } from '../dashboard-tabs'

/**
 * 📦 스마트스토어 발주수집(베타) + 수집된 발주 목록 — MarketingDashboardPage 에서 추출
 *   (2026-07-27 탭 재편 · 600줄 캡). 상태·로직 byte-동일 이동, '부가 도구' 탭 전용 섹션.
 */
interface CollectedOrder {
  productOrderId: string
  orderId: string | null
  productName: string | null
  quantity: number
  totalAmount: number
  status: string | null
  ordererName: string | null
  orderedAt: string | null
}

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function StoreOrdersSection() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [maskedId, setMaskedId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [connectErr, setConnectErr] = useState<string | null>(null)
  const [storeOpen, setStoreOpen] = useState(false) // 연동 폼 기본 접힘 — 검색광고 키 오입력 방지
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<CollectedOrder[]>([])

  const loadStatus = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/naver/status', { headers: authHeader() })
      setConnected(!!r.data?.connected)
      setMaskedId(r.data?.client_id_masked || null)
    } catch { setConnected(false) }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      const r = await api.get('/api/ads/orders', { headers: authHeader() })
      setOrders(r.data?.orders || [])
    } catch { /* graceful */ }
  }, [])

  useEffect(() => { loadStatus(); loadOrders() }, [loadStatus, loadOrders])

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setBusy(true); setConnectErr(null)
    try {
      const r = await api.post('/api/ads/naver/connect', { client_id: clientId.trim(), client_secret: clientSecret.trim() }, { headers: authHeader() })
      if (r.data?.success) { toast.success('스마트스토어가 연결되었습니다'); setClientSecret(''); setConnectErr(null); await loadStatus() }
      else { const m = r.data?.error || '연결 실패'; setConnectErr(m); toast.error(m) }
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패 — 네트워크 또는 키 오류'
      setConnectErr(m); toast.error(m)
    } finally { setBusy(false) }
  }

  async function sync() {
    setBusy(true)
    try {
      const r = await api.post('/api/ads/orders/sync', {}, { headers: authHeader() })
      if (r.data?.success) { toast.success(`발주 ${r.data.collected ?? 0}건 수집`); await loadOrders() }
      else toast.error(r.data?.error || '동기화 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '동기화 실패')
    } finally { setBusy(false) }
  }

  return (
    <>
      <div id="sec-store" className={`mt-3 ${CARD_CLS}`} style={{ scrollMarginTop: 76 }}>
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">스마트스토어 발주수집 <span className="text-[10.5px] font-medium text-amber-600 dark:text-amber-500">베타</span></div>
        {connected ? (
          <div className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
            연결됨 <span className="text-gray-400 dark:text-gray-500">({maskedId})</span>
            <div className="mt-3 flex gap-2">
              <button onClick={sync} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-3 py-2 text-[12px] font-bold text-white dark:text-[#0F151D] disabled:opacity-50">발주 동기화</button>
              <button onClick={async () => { await api.delete('/api/ads/naver/connect', { headers: authHeader() }); loadStatus() }} className="rounded-lg border border-gray-200 dark:border-[#2A3446] px-3 py-2 text-[12px] text-gray-500 dark:text-gray-400">연결 해제</button>
            </div>
          </div>
        ) : !storeOpen ? (
          <div className="mt-1.5">
            <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-relaxed">스마트스토어 주문을 자동 수집합니다(선택). 커머스 API센터의 '상품주문/배송' 권한 키가 필요합니다.</p>
            <button onClick={() => setStoreOpen(true)} className="mt-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200">발주수집 연동 설정 →</button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-relaxed">
              <b className="text-gray-600 dark:text-gray-300">발주수집(베타)</b> — <a href="https://apicenter.commerce.naver.com" target="_blank" rel="noopener noreferrer" className="underline">커머스 API센터</a>에서 발급한 앱의 <b>'상품주문/배송' 권한</b> 포함 client_id/secret 을 입력하세요.
              <br /><span className="text-amber-600 dark:text-amber-500">※ 검색광고 키(고객ID·액세스라이선스·비밀키)와는 다른 키입니다 — 그건 '광고 성과' 탭의 계정 연동에 입력하세요.</span>
            </p>
            <input className={INPUT_CLS} placeholder="client_id (커머스 API 애플리케이션 ID)" value={clientId} onChange={(e) => setClientId(e.target.value)} />
            <input className={INPUT_CLS} placeholder="client_secret (커머스 API 시크릿)" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
            {connectErr && (
              <p className="text-[11.5px] text-red-600 dark:text-red-400 leading-relaxed">{connectErr}</p>
            )}
            <div className="flex gap-2">
              <button onClick={connect} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0F151D] disabled:opacity-50">{busy ? '검증 중…' : '연결'}</button>
              <button onClick={() => { setStoreOpen(false); setConnectErr(null) }} className="rounded-lg px-3 py-2 text-[12px] text-gray-500 dark:text-gray-400">취소</button>
            </div>
          </div>
        )}
      </div>

      {/* 수집된 발주 */}
      <div className={`mt-3 ${CARD_CLS}`}>
        <div className="text-[14px] font-bold text-gray-900 dark:text-white">수집된 발주 {orders.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-medium">({orders.length})</span>}</div>
        {orders.length === 0 ? (
          <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">아직 수집된 발주가 없습니다. 연동 후 '발주 동기화'를 눌러주세요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
                <th className="py-1 pr-3">상품</th><th className="py-1 pr-3">수량</th><th className="py-1 pr-3">금액</th><th className="py-1 pr-3">상태</th><th className="py-1">주문자</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.productOrderId} className="border-t border-gray-100 dark:border-[#2A3446] text-gray-700 dark:text-gray-300">
                    <td className="py-1.5 pr-3">{o.productName || '-'}</td>
                    <td className="py-1.5 pr-3">{o.quantity}</td>
                    <td className="py-1.5 pr-3">₩{formatNumber(o.totalAmount)}</td>
                    <td className="py-1.5 pr-3">{o.status || '-'}</td>
                    <td className="py-1.5">{o.ordererName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
