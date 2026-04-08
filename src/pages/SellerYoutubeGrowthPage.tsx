import { useTranslation } from 'react-i18next'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { Youtube, Loader2, CheckCircle, Clock, XCircle, Users } from 'lucide-react'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

interface GrowthPackage {
  subscribers: number
  price: number
  label: string
}

interface GrowthRequest {
  id: number
  channel_url: string
  target_subscribers: number
  price: number
  status: string
  admin_memo: string | null
  requested_at: string
  completed_at: string | null
}

const STATUS_STYLES: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending:    { label: '검토 중', icon: Clock,       color: 'text-amber-600 bg-amber-50' },
  processing: { label: '진행 중', icon: Loader2,     color: 'text-blue-600 bg-blue-50' },
  completed:  { label: '완료',   icon: CheckCircle,  color: 'text-green-600 bg-green-50' },
  rejected:   { label: '거부됨', icon: XCircle,      color: 'text-red-600 bg-red-50' },
}

export default function SellerYoutubeGrowthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [packages, setPackages] = useState<GrowthPackage[]>([])
  const [requests, setRequests] = useState<GrowthRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [channelUrl, setChannelUrl] = useState('')
  const [selected, setSelected] = useState<GrowthPackage | null>(null)
  const [showWidget, setShowWidget] = useState(false)
  const widgetsRef = useRef<unknown>(null)
  const orderRef = useRef<{ orderId: string; orderName: string } | null>(null)

  const token = localStorage.getItem('seller_token')

  useEffect(() => {
    if (!token) { navigate('/seller/login'); return }
    Promise.all([loadPackages(), loadRequests()]).finally(() => setLoading(false))
  }, [])

  // 토스 위젯 마운트
  useEffect(() => {
    if (!showWidget || !widgetsRef.current) return
    const widgets = widgetsRef.current as { renderPaymentMethods: Function; renderAgreement: Function }

    const timer = setTimeout(async () => {
      try {
        await widgets.renderPaymentMethods({ selector: '#ytg-payment-method', variantKey: 'DEFAULT' })
        await widgets.renderAgreement({ selector: '#ytg-agreement', variantKey: 'AGREEMENT' })
        setProcessing(false)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : '결제창 로드에 실패했습니다.')
        setShowWidget(false)
        setProcessing(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [showWidget])

  async function loadPackages() {
    try {
      const res = await api.get('/api/youtube-growth/packages')
      if (res.data.success) {
        setPackages(res.data.data)
        setSelected(res.data.data[2]) // 1,000명 기본 선택
      }
    } catch {}
  }

  async function loadRequests() {
    try {
      const res = await api.get('/api/youtube-growth/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) setRequests(res.data.data || [])
    } catch {}
  }

  async function handleStartPayment() {
    if (!selected || !channelUrl.trim()) {
      toast.error('YouTube 채널 URL을 입력해주세요')
      return
    }
    setProcessing(true)

    try {
      const res = await api.post('/api/youtube-growth/request', {
        channel_url: channelUrl,
        subscribers: selected.subscribers,
      }, { headers: { Authorization: `Bearer ${token}` } })

      if (!res.data.success) {
        toast.error(res.data.error || '신청 시작에 실패했습니다.')
        setProcessing(false)
        return
      }

      const { orderId, amount, orderName, clientKey: serverClientKey } = res.data.data
      const sellerId = token ? JSON.parse(atob(token.split('.')[1])).sellerId || 'seller' : 'seller'
      const tossPayments = await loadTossPayments(serverClientKey || clientKey)
      const sanitizedId = String(sellerId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
      const widgets = tossPayments.widgets({ customerKey: `seller_${sanitizedId}` })

      await widgets.setAmount({ currency: 'KRW', value: amount })

      widgetsRef.current = widgets
      orderRef.current = { orderId, orderName }
      setShowWidget(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '결제 준비에 실패했습니다.')
      setProcessing(false)
    }
  }

  async function handleConfirmPayment() {
    const widgets = widgetsRef.current as { requestPayment: Function } | null
    if (!widgets || !orderRef.current) return

    setProcessing(true)
    try {
      await widgets.requestPayment({
        orderId: orderRef.current.orderId,
        orderName: orderRef.current.orderName,
        successUrl: `${window.location.origin}/seller/youtube-growth/success`,
        failUrl: `${window.location.origin}/seller/youtube-growth?fail=true`,
      })
    } catch (err: unknown) {
      setProcessing(false)
      const code = (err as Record<string, string>)?.code
      if (code === 'USER_CANCEL') return
      toast.error(err instanceof Error ? err.message : '결제 요청에 실패했습니다.')
    }
  }

  function cancelWidget() {
    setShowWidget(false)
    widgetsRef.current = null
    orderRef.current = null
  }

  const hasPending = requests.some(r => r.status === 'pending' || r.status === 'processing')

  if (loading) {
    return (
      <SellerLayout title="구독자 늘리기">
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto" />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="구독자 늘리기">
      <div className="space-y-6">
        {/* 안내 */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 border border-red-100">
          <div className="flex items-start gap-3">
            <Youtube className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">YouTube 구독자 늘리기 서비스</h3>
              <p className="text-xs text-gray-600 mt-1">
                YouTube 라이브 방송을 위해 구독자 1,000명 이상이 필요합니다.<br />
                원하시는 패키지를 선택하고 결제하시면 관리자가 확인 후 처리해드립니다.
              </p>
            </div>
          </div>
        </div>

        {/* 신청 폼 */}
        {!hasPending && !showWidget && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-red-500" />
              구독자 패키지 선택
            </h3>

            <div className="space-y-4">
              {/* 채널 URL */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">YouTube 채널 URL *</label>
                <input
                  type="text"
                  value={channelUrl}
                  onChange={e => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@your-channel"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                  required
                />
              </div>

              {/* 패키지 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">늘릴 구독자 수</label>
                <div className="space-y-2">
                  {packages.map(pkg => (
                    <button
                      key={pkg.subscribers}
                      onClick={() => setSelected(pkg)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                        selected?.subscribers === pkg.subscribers
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-bold text-gray-900">
                        +{pkg.subscribers.toLocaleString()}명
                      </span>
                      <span className={`text-sm font-bold ${
                        selected?.subscribers === pkg.subscribers ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {pkg.price.toLocaleString()}원
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 결제 안내 */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-amber-700 font-medium">결제 완료 후 환불이 불가합니다.</p>
                <p className="text-xs text-amber-600 mt-0.5">결제 후 관리자 확인 절차를 거쳐 처리됩니다.</p>
              </div>

              {/* 결제 버튼 */}
              <button
                onClick={handleStartPayment}
                disabled={!selected || !channelUrl.trim() || processing}
                className="w-full py-3.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 결제 준비 중...
                  </span>
                ) : selected ? (
                  `${selected.price.toLocaleString()}원 결제하기`
                ) : (
                  '패키지를 선택해주세요'
                )}
              </button>
            </div>
          </div>
        )}

        {/* 토스 결제 위젯 */}
        {showWidget && (
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div className="bg-red-50 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">결제 내용</span>
              <span className="text-sm font-bold text-red-600">
                구독자 +{selected?.subscribers.toLocaleString()}명 / {selected?.price.toLocaleString()}원
              </span>
            </div>
            <div id="ytg-payment-method" className="min-h-[200px] bg-white rounded-xl border border-gray-200 p-2" />
            <div id="ytg-agreement" className="min-h-[80px] bg-white rounded-xl border border-gray-200 p-2" />
            <p className="text-xs text-center text-amber-600 font-medium">결제 완료 후 환불이 불가합니다.</p>
            <div className="flex gap-2">
              <button
                onClick={cancelWidget}
                className="flex-1 py-3.5 bg-gray-100 text-gray-700 text-sm font-bold rounded-xl"
              >
                뒤로
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="flex-[2] py-3.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-60"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `${selected?.price.toLocaleString()}원 결제하기`}
              </button>
            </div>
          </div>
        )}

        {/* 신청 내역 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">신청 내역</h3>
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">신청 내역이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending
                const Icon = style.icon
                return (
                  <div key={req.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${style.color}`}>
                        <Icon className="w-3 h-3" /> {style.label}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(req.requested_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-sm text-gray-900 truncate">{req.channel_url}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-500">
                        구독자 +{(req.target_subscribers || 0).toLocaleString()}명
                      </p>
                      {req.price > 0 && (
                        <p className="text-xs font-medium text-red-600">
                          {req.price.toLocaleString()}원
                        </p>
                      )}
                    </div>
                    {req.admin_memo && (
                      <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded">{req.admin_memo}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}
