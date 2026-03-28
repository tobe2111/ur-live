import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  MessageSquare, Loader2, Zap,
  CreditCard, History, CheckCircle2, XCircle,
  Package
} from 'lucide-react'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

// 충전 패키지 (백엔드와 동일하게 유지)
const PACKAGES = [
  { id: 'p100',  credits: 100,  price: 900,   label: '100건',   unit: '9원/건' },
  { id: 'p500',  credits: 500,  price: 4500,  label: '500건',   unit: '9원/건' },
  { id: 'p1000', credits: 1000, price: 9000,  label: '1,000건', unit: '9원/건' },
  { id: 'p3000', credits: 3000, price: 27000, label: '3,000건', unit: '9원/건' },
  { id: 'p5000', credits: 5000, price: 45000, label: '5,000건', unit: '9원/건' },
]

interface CreditHistory {
  id: number
  type: 'charge' | 'deduct' | 'refund'
  amount: number
  price_paid: number | null
  description: string | null
  created_at: string
}

interface AlimtalkLog {
  id: number
  receiver: string
  template_code: string
  order_id: string | null
  success: number
  error_msg: string | null
  created_at: string
}

declare global {
  interface Window {
    TossPayments: any
  }
}

export default function SellerAlimtalkPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'logs'>('overview')
  const [balance, setBalance] = useState(0)
  const [creditHistory, setCreditHistory] = useState<CreditHistory[]>([])
  const [logs, setLogs] = useState<AlimtalkLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [chargeModal, setChargeModal] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState(PACKAGES[2])  // 기본: 1000건
  const [paying, setPaying] = useState(false)
  const [clientKey, setClientKey] = useState('')

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadCredits()
  }, [navigate])

  useEffect(() => {
    if (activeTab === 'logs') loadLogs()
  }, [activeTab])

  async function loadCredits() {
    setLoading(true)
    try {
      const res = await api.get('/api/seller/alimtalk/credits', {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (res.data.success) {
        setBalance(res.data.data.balance ?? 0)
        setCreditHistory(res.data.data.history ?? [])
        setClientKey(res.data.data.clientKey ?? '')
      }
    } catch {
      // 테이블 미생성 시 조용히 처리
    } finally { setLoading(false) }
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const res = await api.get('/api/seller/alimtalk/logs', {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (res.data.success) setLogs(res.data.data ?? [])
    } catch { /* ignore */ } finally { setLogsLoading(false) }
  }

  async function handleCharge() {
    setPaying(true)
    try {
      // 1. 충전 주문 생성
      const res = await api.post('/api/seller/alimtalk/credits/charge',
        { package_id: selectedPkg.id },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
      if (!res.data.success) { toast.error(res.data.error); return }

      const { orderId, amount, orderName, clientKey: ck } = res.data.data
      const key = ck || clientKey

      if (!key) {
        toast.error('결제 설정을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      // 2. 토스페이먼츠 결제창 호출
      const toss = window.TossPayments(key)
      await toss.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        successUrl: `${window.location.origin}/seller/alimtalk?charge=success&orderId=${orderId}`,
        failUrl: `${window.location.origin}/seller/alimtalk?charge=fail`,
      })
    } catch (err: any) {
      if (err?.code !== 'USER_CANCEL') {
        toast.error(err?.message || '결제 중 오류가 발생했습니다.')
      }
    } finally { setPaying(false) }
  }

  // 결제 완료 후 리다이렉트 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const charge = params.get('charge')
    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = params.get('amount')

    if (charge === 'success' && paymentKey && orderId && amount) {
      window.history.replaceState({}, '', '/seller/alimtalk')
      api.post('/api/seller/alimtalk/credits/confirm',
        { paymentKey, orderId, amount: Number(amount) },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      ).then(res => {
        if (res.data.success) {
          toast.success(res.data.message || '충전이 완료되었습니다!')
          loadCredits()
        } else {
          toast.error(res.data.error || '충전 처리에 실패했습니다.')
        }
      }).catch(() => toast.error('충전 처리에 실패했습니다.'))
    } else if (charge === 'fail') {
      window.history.replaceState({}, '', '/seller/alimtalk')
      toast.error('결제가 취소되었습니다.')
    }
  }, [])

  const headerRight = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">잔여 크레딧</span>
      <span className={`text-sm font-bold ${balance > 0 ? 'text-blue-600' : 'text-red-500'}`}>
        {balance.toLocaleString()}건
      </span>
      <button
        onClick={() => setChargeModal(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
      >
        <CreditCard className="w-3.5 h-3.5" /> 충전
      </button>
    </div>
  )

  if (loading) {
    return (
      <SellerLayout title="알림톡" headerRight={headerRight}>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </SellerLayout>
    )
  }

  return (
    <SellerLayout title="알림톡" headerRight={headerRight}>
      <div className="max-w-2xl mx-auto">
        {/* 잔액 카드 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white mb-5 shadow">
          <p className="text-xs text-blue-100 mb-1">알림톡 크레딧 잔액</p>
          <p className="text-3xl font-bold">{balance.toLocaleString()}<span className="text-lg font-normal ml-1">건</span></p>
          <p className="text-xs text-blue-100 mt-2">
            주문 완료·배송 시작 시 자동 발송 · 건당 9원
          </p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {([
            { id: 'overview', label: '자동 발송 목록', icon: Zap },
            { id: 'history', label: '충전 이력', icon: CreditCard },
            { id: 'logs', label: '발송 이력', icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ── 자동 발송 목록 탭 ── */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
            {[
              { trigger: '주문 접수 완료',   desc: '구매자에게 주문 확인 알림톡 발송',     active: true },
              { trigger: '배송 시작',         desc: '운송장 번호 포함 배송 시작 알림톡 발송', active: true },
              { trigger: '배송 완료',         desc: '배송 완료 안내 알림톡',               active: false },
              { trigger: '라이브 10분 전',    desc: '팔로워에게 라이브 예고 알림톡',        active: false },
              { trigger: '주문 취소',         desc: '취소 처리 완료 알림톡',               active: true },
            ].map(item => (
              <div key={item.trigger} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.trigger}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {item.active ? '활성' : '준비 중'}
                </span>
              </div>
            ))}
            <div className="p-4 bg-yellow-50">
              <p className="text-xs text-yellow-700">
                카카오 템플릿 검수 완료 후 자동 발송이 시작됩니다. 크레딧이 0건이면 발송되지 않습니다.
              </p>
            </div>
          </div>
        )}

        {/* ── 충전 이력 탭 ── */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm">
            {creditHistory.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">충전 이력이 없습니다.</p>
                <button onClick={() => setChargeModal(true)} className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                  첫 충전하기
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {creditHistory.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-800">{tx.description ?? (tx.type === 'charge' ? '충전' : '차감')}</p>
                      <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}건
                      </p>
                      {tx.price_paid && (
                        <p className="text-xs text-gray-400">{tx.price_paid.toLocaleString()}원</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 발송 이력 탭 ── */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm">
            {logsLoading ? (
              <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center">
                <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">발송 이력이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                    {log.success
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">
                        {log.receiver.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                        {log.order_id && <span className="text-xs text-gray-400 ml-2">주문 {log.order_id}</span>}
                      </p>
                      {log.error_msg && <p className="text-xs text-red-400">{log.error_msg}</p>}
                      <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 충전 모달 ── */}
      {chargeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setChargeModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">크레딧 충전</h3>
            <p className="text-xs text-gray-400 mb-4">건당 9원 · 카카오 알림톡 자동 발송</p>

            <div className="space-y-2 mb-5">
              {PACKAGES.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${selectedPkg.id === pkg.id ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <Package className={`w-4 h-4 ${selectedPkg.id === pkg.id ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className="text-left">
                      <p className={`text-sm font-semibold ${selectedPkg.id === pkg.id ? 'text-blue-700' : 'text-gray-800'}`}>{pkg.label}</p>
                      <p className="text-xs text-gray-400">{pkg.unit}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${selectedPkg.id === pkg.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {pkg.price.toLocaleString()}원
                  </p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setChargeModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                취소
              </button>
              <button
                onClick={handleCharge}
                disabled={paying}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {selectedPkg.price.toLocaleString()}원 결제
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
