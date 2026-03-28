import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  MessageSquare, CheckCircle2, Clock, AlertCircle,
  ExternalLink, Loader2, Settings, Zap, CreditCard
} from 'lucide-react'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

interface AlimtalkAccount {
  id: number
  kakao_channel_id: string
  channel_name: string
  phone_number: string
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  balance: number
  total_sent: number
  total_failed: number
  created_at: string
  updated_at: string
}

const STATUS_CONFIG = {
  pending:   { label: '검토 중',  color: 'text-amber-600',  bg: 'bg-amber-50',  icon: <Clock className="w-4 h-4" /> },
  active:    { label: '활성화됨', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4" /> },
  suspended: { label: '정지됨',  color: 'text-red-600',    bg: 'bg-red-50',    icon: <AlertCircle className="w-4 h-4" /> },
  rejected:  { label: '반려됨',  color: 'text-red-600',    bg: 'bg-red-50',    icon: <AlertCircle className="w-4 h-4" /> },
}

const CHARGE_OPTIONS = [
  { amount: 1000,  label: '1,000건',  price: 8000 },
  { amount: 5000,  label: '5,000건',  price: 35000 },
  { amount: 10000, label: '10,000건', price: 60000 },
  { amount: 50000, label: '50,000건', price: 250000 },
]

export default function SellerAlimtalkPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [charging, setCharging] = useState(false)
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [selectedCharge, setSelectedCharge] = useState(CHARGE_OPTIONS[0])
  const [account, setAccount] = useState<AlimtalkAccount | null>(null)
  const [form, setForm] = useState({
    kakao_channel_id: '',
    channel_name: '',
    sender_key: '',
    phone_number: '',
  })

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadAccount()
  }, [navigate])

  async function loadAccount() {
    setLoading(true)
    try {
      const resp = await api.get('/api/seller/alimtalk', {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (resp.data.success && resp.data.data.account) {
        const acc = resp.data.data.account as AlimtalkAccount
        setAccount(acc)
        setForm({
          kakao_channel_id: acc.kakao_channel_id,
          channel_name: acc.channel_name,
          sender_key: '',
          phone_number: acc.phone_number,
        })
      }
    } catch {
      // no account yet
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const resp = await api.post('/api/seller/alimtalk', form, {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (resp.data.success) {
        toast.success(resp.data.message || '알림톡 계정이 등록되었습니다.')
        loadAccount()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCharge() {
    setCharging(true)
    try {
      const resp = await api.post('/api/seller/alimtalk/charge', {
        amount: selectedCharge.amount,
      }, {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (resp.data.success) {
        toast.success(resp.data.message || '충전이 완료되었습니다.')
        setShowChargeModal(false)
        loadAccount()
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || '충전에 실패했습니다.')
    } finally {
      setCharging(false)
    }
  }

  if (loading) {
    return (
      <SellerLayout title="알림톡 설정">
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </SellerLayout>
    )
  }

  const sc = account ? STATUS_CONFIG[account.status] : null

  return (
    <SellerLayout title="알림톡 설정">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* 상태 카드 (계정이 있는 경우) */}
        {account && sc && (
          <div className={`${sc.bg} border border-current/10 rounded-xl p-4 flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <span className={sc.color}>{sc.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${sc.color}`}>{sc.label}</p>
                <p className="text-xs text-gray-500">
                  {account.status === 'pending' && '등록 정보를 검토 중입니다. 영업일 1~2일 소요됩니다.'}
                  {account.status === 'active' && `잔액 ${account.balance.toLocaleString()}건 · 총 발송 ${account.total_sent.toLocaleString()}건`}
                  {account.status === 'rejected' && '등록 정보를 다시 확인 후 재신청해 주세요.'}
                  {account.status === 'suspended' && '관리자에게 문의해 주세요.'}
                </p>
              </div>
            </div>
            {account.status === 'active' && (
              <button
                onClick={() => setShowChargeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                충전
              </button>
            )}
          </div>
        )}

        {/* 충전 모달 */}
        {showChargeModal && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowChargeModal(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">알림톡 크레딧 충전</h3>
                <p className="text-xs text-gray-500 mb-4">현재 잔액: {account?.balance.toLocaleString()}건</p>

                <div className="space-y-2 mb-6">
                  {CHARGE_OPTIONS.map(opt => (
                    <button
                      key={opt.amount}
                      onClick={() => setSelectedCharge(opt)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${
                        selectedCharge.amount === opt.amount
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
                      <span className="text-sm text-gray-600">{opt.price.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowChargeModal(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleCharge}
                    disabled={charging}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {charging ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {selectedCharge.price.toLocaleString()}원 충전
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 안내 박스 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex gap-3">
            <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">알림톡 사용 방법</p>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>카카오 비즈니스 채널 개설 (카카오톡 채널 관리자센터)</li>
                <li>채널 ID와 정보를 아래에 입력 후 신청</li>
                <li>관리자 승인 후 활성화 (영업일 1~2일)</li>
                <li>주문확인, 배송시작 알림톡이 자동 발송됩니다</li>
              </ol>
              <a
                href="https://center-pf.kakao.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium hover:underline"
              >
                카카오 채널 관리자센터 바로가기 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* 등록 폼 */}
        <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">채널 정보 등록</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              카카오 채널 ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.kakao_channel_id}
              onChange={e => setForm({ ...form, kakao_channel_id: e.target.value })}
              placeholder="@myshop (@ 포함)"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">카카오톡 채널 관리자센터에서 확인 가능</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              채널명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.channel_name}
              onChange={e => setForm({ ...form, channel_name: e.target.value })}
              placeholder="예: 나의쇼핑몰"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              발신번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
              placeholder="010-0000-0000"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              발신 프로필 키 (Sender Key)
              <span className="text-gray-400 font-normal"> — 발급 후 입력</span>
            </label>
            <input
              type="text"
              value={form.sender_key}
              onChange={e => setForm({ ...form, sender_key: e.target.value })}
              placeholder="알리고 또는 딜러사에서 발급받은 키"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">없는 경우 관리자가 안내 후 등록합니다</p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {account ? '정보 업데이트' : '알림톡 신청'}
          </button>
        </form>

        {/* 자동 발송 안내 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">자동 발송 알림톡 목록</h2>
          <div className="space-y-3">
            {[
              { trigger: '주문 접수',   template: '주문 확인 알림톡', active: true },
              { trigger: '배송 시작',   template: '배송 시작 알림톡 (송장번호 포함)', active: true },
              { trigger: '배송 완료',   template: '배송 완료 알림톡', active: true },
              { trigger: '라이브 10분 전', template: '라이브 시작 예고 알림톡', active: false },
              { trigger: '주문 취소',   template: '취소 처리 완료 알림톡', active: true },
            ].map(item => (
              <div key={item.trigger} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm text-gray-800">{item.template}</p>
                  <p className="text-xs text-gray-400">트리거: {item.trigger}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {item.active ? '활성' : '준비 중'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">* 계정 활성화 후 자동으로 발송됩니다. 템플릿 심사는 카카오 정책에 따라 2~5 영업일 소요됩니다.</p>
        </div>

      </div>
    </SellerLayout>
  )
}
