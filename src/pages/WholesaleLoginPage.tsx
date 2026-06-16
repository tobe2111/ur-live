/**
 * 🏭 2026-06-04 유통스타트 도매몰 — 유통사 전용 로그인.
 *   제조사(/supplier/login)·라이브셀러(/seller/login)와 대칭으로 분리된 도매몰 로그인.
 *   같은 /api/seller/login 백엔드 사용하되, 로그인 후 항상 /wholesale 로 완결.
 *   (셀러 로그인 페이지를 유통사에게 노출하지 않음 — 3주체 완전 분리.)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Boxes, Loader2, Factory, ArrowRight, Users } from 'lucide-react'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'

export default function WholesaleLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // 🏭 2026-06-16 (사용자 요청): 로그인 진입 시 유통사/제조사 먼저 선택. 'choose' → 유통사 폼('distributor') 또는 /supplier/login.
  const [mode, setMode] = useState<'choose' | 'distributor'>('choose')
  // 🏬 멀티-몰 브랜딩 — host → mall (기본 몰 → 유통스타트/#FF0033 → byte-identical). 조기 return 전에 호출.
  const { displayName: mallName, brandColor: mallBrand, logoUrl: mallLogo } = useWholesaleMall()

  // 이미 유통사 로그인 상태면 대시보드로(유통사 아닌 셀러면 카탈로그).
  const alreadyIn = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const isDistributor = typeof window !== 'undefined' && localStorage.getItem('is_distributor') === '1'
  useEffect(() => { if (alreadyIn) navigate(isDistributor ? '/wholesale/dashboard' : '/wholesale', { replace: true }) }, [alreadyIn, isDistributor, navigate])
  if (alreadyIn) return null // 리다이렉트 중 로그인폼 깜빡임 방지

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!email.trim() || !password) { toast.error('이메일과 비밀번호를 입력해주세요'); return }
    setLoading(true)
    try {
      const r = await api.post('/api/seller/login', { email: email.trim(), password })
      const d = r.data?.data
      if (!r.data?.success || !d?.accessToken) throw new Error(r.data?.error || '로그인 실패')
      const s = d.seller
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
      if (s.is_distributor) localStorage.setItem('is_distributor', '1')
      else localStorage.removeItem('is_distributor')
      // 유통사면 대시보드로, 아직 유통사 아닌 셀러면 카탈로그(전환 CTA)로. full reload → 토큰/세션 반영.
      window.location.assign(s.is_distributor ? '/wholesale/dashboard' : '/wholesale')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '로그인 중 오류가 발생했어요')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-[#ECEEF1] text-[15px] text-[#17181C] outline-none focus:border-[#17181C] transition-colors'

  return (
    <div className="min-h-screen bg-white text-[#17181C]">
      <SEO title="유통사 로그인 — 유통스타트 B2B 도매몰" description="유통사 로그인 — 등급 공급가로 사입하세요." url="/wholesale/login" noindex />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2">
            {mallLogo ? <img src={mallLogo} alt={mallName} className="w-6 h-6 rounded object-cover" /> : <Boxes className="w-6 h-6" style={{ color: mallBrand }} />}
            <span className="text-lg font-extrabold">{mallName}</span>
          </button>
          <button onClick={() => navigate('/wholesale/join')} className="text-sm text-[#4E5560] hover:text-[#17181C] font-medium">유통사 가입</button>
        </div>
      </header>

      <main className="ur-content-narrow mx-auto px-4 lg:px-8 py-12 lg:py-16 max-w-md">
        {mode === 'choose' ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">로그인</h1>
              <p className="text-[#4E5560] text-[15px]">어떤 회원으로 로그인하시나요?</p>
            </div>
            <div className="space-y-3">
              <button onClick={() => setMode('distributor')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#ECEEF1] hover:border-[#17181C] transition-colors text-left">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: '#F4F5F7' }}><Users className="w-6 h-6" style={{ color: '#17181C' }} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-extrabold text-[#17181C]">유통사(판매) 로그인</span>
                  <span className="block text-[13px] text-[#8A929E] mt-0.5">등급 공급가로 사입하는 유통회원</span>
                </span>
                <ArrowRight className="w-5 h-5 text-[#B6BCC4] shrink-0" />
              </button>
              <button onClick={() => navigate('/supplier/login')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#ECEEF1] hover:border-[#17181C] transition-colors text-left">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: '#F4F5F7' }}><Factory className="w-6 h-6" style={{ color: '#17181C' }} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-extrabold text-[#17181C]">제조사(브랜드사) 로그인</span>
                  <span className="block text-[13px] text-[#8A929E] mt-0.5">상품을 공급하는 제조(공급)회원</span>
                </span>
                <ArrowRight className="w-5 h-5 text-[#B6BCC4] shrink-0" />
              </button>
            </div>
            <div className="mt-8 text-center text-sm text-[#8A929E]">
              아직 회원이 아니신가요?{' '}
              <button onClick={() => navigate('/wholesale/start')} className="text-[#FF0033] font-semibold">회원가입 →</button>
            </div>
          </>
        ) : (
          <>
        <button onClick={() => setMode('choose')} className="mb-5 inline-flex items-center gap-1 text-sm text-[#8A929E] hover:text-[#17181C] font-medium">
          <ArrowRight className="w-4 h-4 rotate-180" /> 로그인 유형 다시 선택
        </button>
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">유통사 로그인</h1>
          <p className="text-[#4E5560] text-[15px]">검증된 제조사 상품을 등급 공급가로 사입하세요.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">이메일</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className={inputCls} placeholder="login@email.com" autoComplete="email" />
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

        {/* 🏭 2026-06-04 카카오 통합 로그인 — 카카오 계정으로 유통회원 로그인/시작.
            기존 유통사(이메일 연결)면 자동 로그인, 신규면 /wholesale 에서 1탭 전환. */}
        <div className="relative my-4 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
          <span className="text-[12px]" style={{ color: '#8A929E' }}>또는</span>
          <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
        </div>
        <button type="button" onClick={() => { window.location.href = '/auth/kakao/start?redirect=/wholesale&intent=user' }}
          className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-[15px]" style={{ background: '#FEE500', color: '#3C1E1E' }}>
          카카오로 계속하기
        </button>

        {/* 👥 직원(서브계정) 로그인 입구 — 회사 owner 와 분리. */}
        <div className="mt-4 text-center text-sm text-[#8A929E]">
          직원이신가요?{' '}
          <button onClick={() => navigate('/wholesale/staff-login')} className="text-[#FF0033] font-semibold inline-flex items-center gap-1"><Users className="w-4 h-4" /> 직원 로그인 →</button>
        </div>

        <div className="mt-6 text-center text-sm text-[#8A929E]">
          아직 유통사가 아니신가요?{' '}
          <button onClick={() => navigate('/wholesale/join')} className="text-[#FF0033] font-semibold">유통사 가입 →</button>
        </div>
        <div className="mt-3 pt-5 border-t border-[#ECEEF1] text-center text-sm text-[#8A929E]">
          제조사(공급사)이신가요?{' '}
          <button onClick={() => navigate('/supplier/login')} className="text-[#FF0033] font-semibold inline-flex items-center gap-1"><Factory className="w-4 h-4" /> 제조(브랜드)회원 로그인 →</button>
        </div>
          </>
        )}
      </main>
    </div>
  )
}
