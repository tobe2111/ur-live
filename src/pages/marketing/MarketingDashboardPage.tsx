import { useEffect, useState, useCallback } from 'react'
import MarketingLayout from '@/components/MarketingLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 멀티테넌트 입점 대시보드.
 *   tenant = 인증된 고객사(seller_token). 각 고객사가 자기 스마트스토어를 연동(SELF) → 발주 자동수집.
 *   owner_type='marketing' 으로 도매(supplier/distributor) 연결과 격리.
 *   ⚠️ 라이브: 커머스 앱 '상품주문/배송' 권한 + 엔드포인트 현행문서 검증 후 동작(이 환경 egress 차단).
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

interface TrendResult { keyword: string; latest: number; changePct: number }
interface ShoppingResult { total: number; items: Array<{ title: string; lprice: number; mallName: string }> }

const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

export default function MarketingDashboardPage() {
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [maskedId, setMaskedId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState<CollectedOrder[]>([])
  const [kw, setKw] = useState('')
  const [kwBusy, setKwBusy] = useState(false)
  const [kwTrend, setKwTrend] = useState<TrendResult[] | null>(null)
  const [kwShop, setKwShop] = useState<ShoppingResult | null>(null)

  const loadStatus = useCallback(async () => {
    if (!hasToken) { setConnected(false); return }
    try {
      const r = await api.get('/api/ads/naver/status', { headers: authHeader() })
      setConnected(!!r.data?.connected)
      setMaskedId(r.data?.client_id_masked || null)
    } catch { setConnected(false) }
  }, [hasToken])

  const loadOrders = useCallback(async () => {
    if (!hasToken) return
    try {
      const r = await api.get('/api/ads/orders', { headers: authHeader() })
      setOrders(r.data?.orders || [])
    } catch { /* graceful */ }
  }, [hasToken])

  useEffect(() => { loadStatus(); loadOrders() }, [loadStatus, loadOrders])

  async function connect() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setBusy(true)
    try {
      const r = await api.post('/api/ads/naver/connect', { client_id: clientId.trim(), client_secret: clientSecret.trim() }, { headers: authHeader() })
      if (r.data?.success) { toast.success('스마트스토어가 연결되었습니다'); setClientSecret(''); await loadStatus() }
      else toast.error(r.data?.error || '연결 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '연결 실패')
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

  async function analyzeKeyword() {
    const q = kw.trim()
    if (q.length < 2) { toast.error('키워드를 2자 이상 입력해주세요'); return }
    setKwBusy(true); setKwTrend(null); setKwShop(null)
    try {
      const [t, s] = await Promise.allSettled([
        api.get(`/api/ads/keywords/trend?keywords=${encodeURIComponent(q)}`, { headers: authHeader() }),
        api.get(`/api/ads/keywords/shopping?q=${encodeURIComponent(q)}`, { headers: authHeader() }),
      ])
      if (t.status === 'fulfilled' && t.value.data?.success) setKwTrend(t.value.data.results || [])
      if (s.status === 'fulfilled' && s.value.data?.success) setKwShop(s.value.data.data || null)
      if (t.status === 'rejected' && s.status === 'rejected') toast.error('키워드 분석 실패 (잠시 후 다시)')
    } finally { setKwBusy(false) }
  }

  const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'
  const input = 'w-full h-10 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

  return (
    <MarketingLayout>
      <SEO title="유어애즈 UR Ads - 유어팀 종합 마케팅" description="네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 + 키워드 — 유어팀 종합 마케팅 툴" url="/ads" />
      <h1 className="text-[22px] font-extrabold text-gray-900 dark:text-white">유어애즈 <span className="text-gray-400 dark:text-gray-500 text-[14px] font-medium">UR Ads</span></h1>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">고객사별 입점형 마케팅 툴 · 키워드 도구 사용 가능 · 자동입찰/발주수집 연동 예정</p>

      {!hasToken && (
        <div className={`mt-5 ${card}`}>
          <p className="text-[13px] text-gray-700 dark:text-gray-300">사업자(고객사) 계정으로 로그인 후 이용할 수 있습니다.</p>
          <a href="/seller/login" className="mt-3 inline-block rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[13px] font-bold text-white dark:text-[#0A0A0A]">로그인</a>
        </div>
      )}

      {hasToken && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {/* 1) 스마트스토어 연동 */}
          <div className={card}>
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">📦 스마트스토어 연동</div>
            {connected ? (
              <div className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
                연결됨 <span className="text-gray-400 dark:text-gray-500">({maskedId})</span>
                <div className="mt-3 flex gap-2">
                  <button onClick={sync} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-3 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">발주 동기화</button>
                  <button onClick={async () => { await api.delete('/api/ads/naver/connect', { headers: authHeader() }); loadStatus() }} className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-3 py-2 text-[12px] text-gray-500 dark:text-gray-400">연결 해제</button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-[11.5px] text-gray-400 dark:text-gray-500 leading-relaxed">커머스 API센터에서 발급한 앱의 <b>'상품주문/배송' 권한</b> 포함 client_id/secret 을 입력하세요.</p>
                <input className={input} placeholder="client_id" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                <input className={input} placeholder="client_secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                <button onClick={connect} disabled={busy} className="rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">연결</button>
              </div>
            )}
          </div>

          {/* 2) 키워드 도구 (오픈API — 즉시 사용) */}
          <div className={card}>
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">🔑 키워드 도구</div>
            <p className="mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">검색어 트렌드 + 쇼핑 경쟁(상품수·가격대). 연관키워드 추천·자동입찰은 검색광고 키 발급 후.</p>
            <div className="mt-2 flex gap-2">
              <input className={input} placeholder="키워드 (예: 무선이어폰)" value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') analyzeKeyword() }} />
              <button onClick={analyzeKeyword} disabled={kwBusy} className="shrink-0 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12px] font-bold text-white dark:text-[#0A0A0A] disabled:opacity-50">분석</button>
            </div>
            {kwShop && (
              <div className="mt-3 text-[12px]">
                <div className="text-gray-600 dark:text-gray-300">쇼핑 등록상품 <b className="text-gray-900 dark:text-white">{formatNumber(kwShop.total)}</b>개
                  {kwTrend && kwTrend[0] && <span className="ml-2 text-gray-400 dark:text-gray-500">· 검색추세 {kwTrend[0].changePct >= 0 ? '▲' : '▼'}{Math.abs(kwTrend[0].changePct)}%</span>}
                </div>
                <div className="mt-2 space-y-1">
                  {kwShop.items.slice(0, 5).map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                      <span className="truncate">{it.title}</span>
                      <span className="shrink-0 tabular-nums">₩{formatNumber(it.lprice)} <span className="text-gray-400 dark:text-gray-500">{it.mallName}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 수집된 발주 */}
      {hasToken && (
        <div className={`mt-3 ${card}`}>
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-bold text-gray-900 dark:text-white">수집된 발주 {orders.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-medium">({orders.length})</span>}</div>
          </div>
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
                    <tr key={o.productOrderId} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
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
      )}
    </MarketingLayout>
  )
}
