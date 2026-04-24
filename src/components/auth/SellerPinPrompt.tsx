/**
 * SellerPinPrompt — 민감 액션 수행 전 PIN 인증 모달.
 *
 * 사용법:
 *   const [pinPrompt, setPinPrompt] = useState(false)
 *   const handleSubmit = async () => {
 *     try { await api.post('/api/seller/settlements/request', ...) }
 *     catch (e) {
 *       if (e.response?.data?.code === 'PIN_REQUIRED') setPinPrompt(true)
 *       else if (e.response?.data?.code === 'PIN_NOT_SET') navigate('/seller/profile?setup_pin=1')
 *     }
 *   }
 *   ...
 *   {pinPrompt && <SellerPinPrompt onVerified={() => { setPinPrompt(false); handleSubmit() }} onCancel={() => setPinPrompt(false)} />}
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, X, ShieldCheck } from 'lucide-react'

interface Props {
  onVerified: () => void
  onCancel: () => void
}

export function SellerPinPrompt({ onVerified, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('PIN은 4~6자리 숫자여야 합니다')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/api/seller/verify-pin', { pin })
      if (res.data?.success) {
        toast.success('PIN 확인 완료. 15분간 민감 액션 사용 가능')
        onVerified()
      } else {
        toast.error(res.data?.error || 'PIN 확인 실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; code?: string } } }
      if (err.response?.data?.code === 'PIN_NOT_SET') {
        toast.error('PIN이 설정되지 않았어요. 먼저 프로필에서 설정해주세요.')
        onCancel()
        return
      }
      toast.error(err.response?.data?.error || 'PIN 확인 실패')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-bold text-gray-900">보안 PIN 확인</h3>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          민감 액션 수행 시 추가 확인이 필요해요.<br />
          PIN 입력 후 15분간 재확인 없이 진행 가능합니다.
        </p>
        <input
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="PIN 입력 (4~6자리)"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-lg text-center font-mono tracking-widest text-gray-900"
        />
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold">
            취소
          </button>
          <button onClick={submit} disabled={loading || !pin}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * SellerPinSetup — 셀러 프로필에서 PIN 최초 설정
 */
export function SellerPinSetup({ linkedToKakao }: { linkedToKakao: boolean }) {
  const [pinSet, setPinSet] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ current_password: '', pin: '', pin_confirm: '' })
  const [loading, setLoading] = useState(false)

  // PIN 설정 상태 조회
  useEffect(() => {
    api.get('/api/seller/pin-status').then(res => {
      if (res.data?.success) setPinSet(res.data.data.pin_set)
    }).catch(() => {})
  }, [])

  async function save() {
    if (form.pin !== form.pin_confirm) {
      toast.error('PIN이 일치하지 않습니다')
      return
    }
    if (!/^\d{4,6}$/.test(form.pin)) {
      toast.error('PIN은 4~6자리 숫자여야 합니다')
      return
    }
    setLoading(true)
    try {
      const body: Record<string, string> = { pin: form.pin }
      if (!linkedToKakao) body.current_password = form.current_password
      const res = await api.post('/api/seller/set-pin', body)
      if (res.data?.success) {
        toast.success('PIN이 설정되었습니다')
        setPinSet(true)
        setShowForm(false)
        setForm({ current_password: '', pin: '', pin_confirm: '' })
      } else {
        toast.error(res.data?.error || 'PIN 설정 실패')
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || 'PIN 설정 실패')
    } finally { setLoading(false) }
  }

  if (pinSet === null) return null

  if (pinSet && !showForm) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-green-800">보안 PIN 설정 완료</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="text-xs text-green-700 hover:text-green-900 font-medium">
          재설정
        </button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <button onClick={() => setShowForm(true)}
        className="w-full py-3 bg-white border border-gray-200 hover:border-blue-300 rounded-xl flex items-center gap-3 px-4 text-left">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">보안 PIN 설정하기</p>
          <p className="text-[11px] text-gray-500 mt-0.5">정산 요청, 계좌 변경 등 민감 액션 전 추가 확인</p>
        </div>
        <span className="text-xs text-blue-600 font-medium">설정 →</span>
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-gray-900">보안 PIN {pinSet ? '재설정' : '설정'}</p>

      {!linkedToKakao && (
        <div>
          <label className="block text-xs text-gray-600 mb-1">현재 비밀번호 확인</label>
          <input type="password" value={form.current_password}
            onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-600 mb-1">새 PIN (4~6자리 숫자)</label>
        <input type="password" inputMode="numeric" maxLength={6}
          value={form.pin}
          onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono tracking-widest" />
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">PIN 재입력</label>
        <input type="password" inputMode="numeric" maxLength={6}
          value={form.pin_confirm}
          onChange={e => setForm(f => ({ ...f, pin_confirm: e.target.value.replace(/\D/g, '') }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-mono tracking-widest" />
      </div>

      <div className="flex gap-2">
        <button onClick={() => setShowForm(false)}
          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold">
          취소
        </button>
        <button onClick={save} disabled={loading}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          {loading ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
