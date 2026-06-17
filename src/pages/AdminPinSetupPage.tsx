import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { normalizeAdminRole } from '@/shared/admin-roles'

// 🔐 2026-06-17 (대표 결정 "6자리 입력"): 관리자 로그인 보안 PIN 설정.
//   서버 POST /api/admin/set-login-pin (login_pin_hash 저장) → 이후 매 로그인 시 PIN 필수.
//   강제 대상(도매 파트너/슈퍼)은 must_set_pin 게이트로 이 페이지에 유도됨.
const SIMPLE = new Set(['123456', '654321', '012345', '111111', '000000', '121212'])

export default function AdminPinSetupPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const role = normalizeAdminRole(typeof window !== 'undefined' ? localStorage.getItem('admin_role') : null)

  const submit = async () => {
    if (!/^\d{6}$/.test(pin)) { toast.error('6자리 숫자 PIN을 입력하세요'); return }
    if (/^(\d)\1{5}$/.test(pin) || SIMPLE.has(pin)) { toast.error('너무 단순한 PIN입니다. 다른 6자리를 사용하세요'); return }
    if (pin !== confirm) { toast.error('PIN이 일치하지 않습니다'); return }
    setSaving(true)
    try {
      const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      const r = await api.post('/api/admin/set-login-pin', { pin }, h)
      if (r.data?.success) {
        localStorage.removeItem('admin_must_set_pin')
        toast.success('보안 PIN이 설정되었습니다. 다음 로그인부터 사용됩니다.')
        navigate(role === 'wholesale' ? '/admin/wholesale-overview' : '/admin', { replace: true })
      } else {
        toast.error(r.data?.error || 'PIN 설정 실패')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'PIN 설정 중 오류')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-lg tracking-[0.4em] font-mono text-gray-900 bg-white [color-scheme:light] focus:outline-none focus:ring-2 focus:ring-[#0C2454] focus:border-transparent'

  return (
    <AdminLayout title="로그인 보안 PIN">
      <div className="ur-content-narrow px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#0C2454]" />
            <h2 className="text-base font-bold text-gray-900">로그인 보안 PIN 설정</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">비밀번호에 더해, 로그인할 때마다 입력할 <b>6자리 PIN</b>을 설정하세요. 본인만 알고 있어야 하며 다른 사람과 공유하지 마세요.</p>

          <label className="block text-xs font-semibold text-gray-500 mb-1.5">6자리 PIN</label>
          <input type="password" inputMode="numeric" maxLength={6} value={pin} autoFocus
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••" className={input} />

          <label className="block text-xs font-semibold text-gray-500 mb-1.5 mt-4">PIN 확인</label>
          <input type="password" inputMode="numeric" maxLength={6} value={confirm}
            onChange={e => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••" className={input} />

          <button onClick={submit} disabled={saving}
            className="w-full mt-6 py-3 rounded-xl text-sm font-bold text-white bg-[#0C2454] hover:bg-[#0a1d44] disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중…</> : 'PIN 설정하기'}
          </button>
          <p className="text-[11px] text-gray-400 mt-3 text-center">⚠️ PIN을 잊으면 슈퍼관리자가 초기화해 줄 수 있습니다.</p>
        </div>
      </div>
    </AdminLayout>
  )
}
