/**
 * 👥 2026-06-09 유통사 직원(서브계정) 로그인.
 *   /api/wholesale/sub-login 호출 → PARENT(회사) seller_id 토큰 발급. 일반 셀러 로그인과
 *   동일 shape 으로 localStorage 저장 → /wholesale 진입. (회사 owner 로그인과 분리된 입구.)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, ArrowRight } from 'lucide-react'
import { WholesaleWordmark } from '../wholesale-catalog/WholesaleLogo'

export default function WholesaleStaffLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const alreadyIn = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  useEffect(() => { if (alreadyIn) navigate('/wholesale/dashboard', { replace: true }) }, [alreadyIn, navigate])
  if (alreadyIn) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!email.trim() || !password) { toast.error('이메일과 비밀번호를 입력해주세요'); return }
    setLoading(true)
    try {
      const r = await api.post('/api/wholesale/sub-login', { email: email.trim(), password })
      const d = r.data?.data
      if (!r.data?.success || !d?.accessToken) throw new Error(r.data?.error || '로그인 실패')
      const s = d.seller
      // ⚠️ 일반 셀러 로그인과 byte-identical 저장 — 토큰의 seller_id 는 회사(parent) id.
      localStorage.setItem('seller_token', d.accessToken)
      localStorage.setItem('access_token', d.accessToken)
      localStorage.setItem('seller_refresh_token', d.refreshToken || '')
      localStorage.setItem('user_type', 'seller')
      localStorage.setItem('active_role', 'seller')
      localStorage.setItem('seller_id', String(s.id))
      localStorage.setItem('seller_name', s.name || '')
      localStorage.setItem('seller_email', s.email || '')
      localStorage.setItem('seller_username', s.username || '')
      localStorage.setItem('seller_type', s.seller_type || 'influencer')
      localStorage.setItem('is_distributor', '1')
      window.location.assign('/wholesale/dashboard')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '로그인 중 오류가 발생했어요')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-[#ECEEF1] text-[15px] text-[#17181C] outline-none focus:border-[#17181C] transition-colors'

  return (
    <div className="min-h-screen bg-white text-[#17181C]">
      <SEO title="직원 로그인 — 유통사 도매몰" description="유통사 직원 로그인 — 회사 계정으로 사입을 도와드립니다." url="/wholesale/staff-login" noindex />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2">
            <WholesaleWordmark height={28} />
          </button>
          <button onClick={() => navigate('/wholesale/login')} className="text-sm text-[#4E5560] hover:text-[#17181C] font-medium">대표자 로그인</button>
        </div>
      </header>

      <main className="ur-content-narrow mx-auto px-4 lg:px-8 py-12 lg:py-16 max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">직원 로그인</h1>
          <p className="text-[#4E5560] text-[15px]">회사에서 발급받은 직원 계정으로 로그인하세요.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className={inputCls} placeholder="staff@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">비밀번호</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} className={inputCls} placeholder="비밀번호" autoComplete="current-password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FF0033] text-white font-bold text-[15px] hover:bg-[#e0002e] transition-colors disabled:opacity-60 mt-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>로그인 <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[#8A929E]">
          대표자(회사 owner)이신가요?{' '}
          <button onClick={() => navigate('/wholesale/login')} className="text-[#FF0033] font-semibold">대표자 로그인 →</button>
        </div>
      </main>
    </div>
  )
}
