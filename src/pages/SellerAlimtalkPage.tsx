import { useTranslation } from 'react-i18next'
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
import { formatKST } from '@/utils/date'
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
    TossPayments?: (clientKey: string) => { requestPayment: (method: string, opts: Record<string, unknown>) => Promise<void> }
  }
}

export default function SellerAlimtalkPage() {
  const { t } = useTranslation()
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
        if (pkgs.length > 0 && selectedPkgId === null) {
          setSelectedPkgId(pkgs[Math.floor(pkgs.length / 2)]?.id ?? pkgs[0].id)
        }
      }
    } catch {
      // Silently handle when table doesn't exist
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

  function loadTossPaymentsSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.TossPayments) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://js.tosspayments.com/v1/payment'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('TossPayments SDK load failed'))
      document.head.appendChild(script)
    })
  }

  async function handleCharge() {
    if (!selectedPkgId) { toast.error(t('seller.selectPackageError')); return }
    setPaying(true)
    try {
      const res = await api.post('/api/seller/alimtalk/credits/charge',
        { package_id: selectedPkgId },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
      if (!res.data.success) { toast.error(res.data.error); return }

      const { orderId, amount, orderName, clientKey } = res.data.data

      if (!clientKey) {
        toast.error(t('seller.paymentSettingError'))
        return
      }

      await loadTossPaymentsSDK()
      const toss = window.TossPayments!(clientKey)
      await toss.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        successUrl: `${window.location.origin}/seller/brandmessage?charge=success&orderId=${orderId}`,
        failUrl: `${window.location.origin}/seller/brandmessage?charge=fail`,
      })
    } catch (err: unknown) {
      const err_ = err as { message?: string; code?: string }
      if (err_.code !== 'USER_CANCEL') {
        toast.error(err_.message || t('seller.paymentError'))
      }
    } finally { setPaying(false) }
  }

  // Handle redirect after payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const charge = params.get('charge')
    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = params.get('amount')

    if (charge === 'success' && paymentKey && orderId && amount) {
      window.history.replaceState({}, '', '/seller/brandmessage')
      api.post('/api/seller/alimtalk/credits/confirm',
        { paymentKey, orderId, amount: Number(amount) },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      ).then(res => {
        if (res.data.success) {
          toast.success(res.data.message || t('seller.chargeComplete'))
          loadCredits()
        } else {
          toast.error(res.data.error || t('seller.chargeFailed'))
        }
      }).catch(() => toast.error(t('seller.chargeFailed')))
    } else if (charge === 'fail') {
      window.history.replaceState({}, '', '/seller/brandmessage')
      toast.error(t('seller.paymentCancelled'))
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
      <span className="text-xs text-gray-400">{t('seller.remainingCredits')}</span>
      <span className={`text-sm font-bold ${balance > 0 ? 'text-blue-600' : 'text-red-500'}`}>
        {balance.toLocaleString()}{t('seller.creditsUnit')}
      </span>
      <button
        onClick={() => setChargeModal(true)}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
      >
        <CreditCard className="w-3.5 h-3.5" /> {t('seller.chargeBtn')}
      </button>
    </div>
  )

  return (
    <SellerLayout title={t('seller.brandMessage')} headerRight={headerRight}>
      <div className="max-w-2xl mx-auto">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 text-white mb-5 shadow">
          <p className="text-xs text-blue-100 mb-1">{t('seller.brandMessageCredits')}</p>
          <p className="text-3xl font-bold">{balance.toLocaleString()}<span className="text-lg font-normal ml-1">{t('seller.creditsUnit')}</span></p>
          <p className="text-xs text-blue-100 mt-2">
            {t('seller.brandMessageDesc')}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-gray-200">
          {([
            { id: 'overview', label: t('seller.autoSendList'), icon: Zap },
            { id: 'history', label: t('seller.chargeHistory'), icon: CreditCard },
            { id: 'logs', label: t('seller.sendHistory'), icon: History },
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

        {/* Auto Send List Tab */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-50">
            {[
              { trigger: t('seller.orderReceivedTrigger'),   desc: t('seller.orderReceivedDesc'),     active: true },
              { trigger: t('seller.deliveryStartedTrigger'),  desc: t('seller.deliveryStartedDesc'),   active: true },
              { trigger: t('seller.deliveryCompletedTrigger'), desc: t('seller.deliveryCompletedDesc'), active: false },
              { trigger: t('seller.liveBefore10min'),         desc: t('seller.liveBefore10minDesc'),   active: false },
              { trigger: t('seller.orderCancelledTrigger'),   desc: t('seller.orderCancelledDesc'),    active: true },
            ].map(item => (
              <div key={item.trigger} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.trigger}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {item.active ? t('seller.activeStatus') : t('seller.preparingStatus')}
                </span>
              </div>
            ))}
            <div className="p-4 bg-yellow-50">
              <p className="text-xs text-yellow-700">
                {t('seller.kakaoTemplateNote')}
              </p>
            </div>
          </div>
        )}

        {/* Charge History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm">
            {creditHistory.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t('seller.noChargeHistory')}</p>
                <button onClick={() => setChargeModal(true)} className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
                  {t('seller.firstCharge')}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {creditHistory.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-800">{tx.description ?? (tx.type === 'charge' ? t('seller.creditChargeLabel') : t('seller.creditDeductLabel'))}</p>
                      <p className="text-xs text-gray-400">{formatKST(tx.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}{t('seller.creditsUnit')}
                      </p>
                      {tx.price_paid && (
                        <p className="text-xs text-gray-400">{tx.price_paid.toLocaleString()}{t('common.won')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send History Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm">
            {logsLoading ? (
              <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center">
                <History className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">{t('seller.noSendHistory')}</p>
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
                        {log.order_id && <span className="text-xs text-gray-400 ml-2">{t('seller.orderLabelPrefix')} {log.order_id}</span>}
                      </p>
                      {log.error_msg && <p className="text-xs text-red-400">{log.error_msg}</p>}
                      <p className="text-xs text-gray-400">{formatKST(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charge Modal */}
      {chargeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setChargeModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('seller.creditChargeTitle')}</h3>
            <p className="text-xs text-gray-400 mb-4">{t('seller.creditChargeDesc')}</p>

            <div className="space-y-2 mb-5">
              {packages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">{t('seller.loadingPackages')}</p>
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
                        <p className="text-xs text-gray-400">{t('seller.perUnit', { price: unitPrice })}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      {pkg.price.toLocaleString()}{t('common.won')}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handleCharge}
                    disabled={paying || !selectedPkg}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {selectedPkg ? t('seller.payAmount', { amount: selectedPkg.price.toLocaleString() }) : t('seller.selectPackage')}
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
