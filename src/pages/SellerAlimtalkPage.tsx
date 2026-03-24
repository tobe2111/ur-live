import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  ArrowLeft, MessageSquare, CheckCircle2, Clock, AlertCircle,
  ExternalLink, Loader2, Settings, Zap
} from 'lucide-react'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'

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

export default function SellerAlimtalkPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  const sc = account ? STATUS_CONFIG[account.status] : null

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-3">
        <Link to="/seller" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h1 className="text-base font-semibold text-gray-900">알림톡 설정</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* 상태 카드 (계정이 있는 경우) */}
        {account && sc && (
          <div className={`${sc.bg} border border-current/10 rounded-xl p-4 flex items-center gap-3`}>
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

      </main>
    </div>
  )
}
