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

interface DbPackage {
  id: number
  label: string
  credits: number
  price: number
  is_active: number
  sort_order: number
}

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
  const [packages, setPackages] = useState<DbPackage[]>([])
  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

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
        const pkgs: DbPackage[] = res.data.data.packages ?? []
        setPackages(pkgs)
        // 기본 선택: 중간 패키지
        if (pkgs.length > 0 && selectedPkgId === null) {
          setSelectedPkgId(pkgs[Math.floor(pkgs.length / 2)]?.id ?? pkgs[0].id)
        }
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

  // TossPayments V2 SDK 동적 로드
  function loadTossPaymentsSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.TossPayments) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://js.tosspayments.com/v1/payment'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('TossPayments SDK 로드 실패'))
      document.head.appendChild(script)
    })
  }

  async function handleCharge() {
    if (!selectedPkgId) { toast.error('패키지를 선택해주세요'); return }
    setPaying(true)
    try {
      // 1. 충전 주문 생성
      const res = await api.post('/api/seller/alimtalk/credits/charge',
        { package_id: selectedPkgId },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
      if (!res.data.success) { toast.error(res.data.error); return }

      const { orderId, amount, orderName, clientKey } = res.data.data

      if (!clientKey) {
        toast.error('결제 설정을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.')
        return
      }

      // 2. TossPayments V2 SDK 동적 로드 후 결제창 호출
      await loadTossPaymentsSDK()
      const toss = window.TossPayments(clientKey)
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


  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

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

  return (
    <SellerLayout title="브랜드메시지" headerRight={headerRight}>
      <div className="max-w-2xl mx-auto">
        {/* 잔액 카드 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white mb-5 shadow">
          <p className="text-xs text-blue-100 mb-1">브랜드메시지 크레딧 잔액</p>
          <p className="text-3xl font-bold">{balance.toLocaleString()}<span className="text-lg font-normal ml-1">건</span></p>
          <p className="text-xs text-blue-100 mt-2">
            라이브 팔로워에게 마케팅 메시지 발송 · 건당 25원
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
              { trigger: '주문 접수 완료',   desc: '자동 발송 (플랫폼 처리, 크레딧 불차감)',     active: true },
              { trigger: '배송 시작',         desc: '자동 발송 (플랫폼 처리, 크레딧 불차감)', active: true },
              { trigger: '배송 완료',         desc: '배송 완료 알림 (준비 중)',               active: false },
              { trigger: '라이브 10분 전',    desc: '라이브 시작 전 팔로워에게 브랜드메시지 발송',        active: false },
              { trigger: '주문 취소',         desc: '자동 발송 (플랫폼 처리, 크레딧 불차감)',               active: true },
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
            <p className="text-xs text-gray-400 mb-4">건당 25원 · 카카오 친구톡(브랜드메시지)</p>

            <div className="space-y-2 mb-5">
              {packages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">패키지를 불러오는 중...</p>
              ) : packages.map(pkg => {
                const unitPrice = pkg.credits > 0 ? (pkg.price / pkg.credits).toFixed(1) : '0'
                const isSelected = selectedPkgId === pkg.id
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkgId(pkg.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Package className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <p className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>{pkg.label}</p>
                        <p className="text-xs text-gray-400">건당 {unitPrice}원</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      {pkg.price.toLocaleString()}원
                    </p>
                  </button>
                )
              })}
            </div>

            {(() => {
              const selectedPkg = packages.find(p => p.id === selectedPkgId)
              return (
                <div className="flex gap-3">
                  <button onClick={() => setChargeModal(false)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                    취소
                  </button>
                  <button
                    onClick={handleCharge}
                    disabled={paying || !selectedPkg}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {selectedPkg ? `${selectedPkg.price.toLocaleString()}원 결제` : '패키지 선택'}
                  </button>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </SellerLayout>
  )
}
