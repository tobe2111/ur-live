/**
 * 🏭 2026-06-04 유통스타트 도매몰 — 판매사 전용 로그인.
 *   제조사(/supplier/login)·라이브셀러(/seller/login)와 대칭으로 분리된 도매몰 로그인.
 *   같은 /api/seller/login 백엔드 사용하되, 로그인 후 항상 /wholesale 로 완결.
 *   (셀러 로그인 페이지를 판매사에게 노출하지 않음 — 3주체 완전 분리.)
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Loader2, Factory, ArrowRight, Users } from 'lucide-react'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'
import { WholesaleWordmark } from './wholesale-catalog/WholesaleLogo'
import { consumeWholesaleLoginIntent, setWholesaleLoginIntent } from '@/utils/wholesale-session'

type SellerSessionData = {
  accessToken: string
  refreshToken?: string
  seller: { id: number; name?: string; email?: string; username?: string; seller_type?: string; is_distributor?: number | boolean }
}
// 셀러(판매사) 세션 localStorage 반영 — 일반 로그인 + 카카오 probe 공용(중복 제거).
function applySellerSession(d: SellerSessionData) {
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
}

export default function WholesaleLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // 🏭 2026-06-16 (사용자 요청): 로그인 진입 시 판매사/제조사 먼저 선택. 'choose' → 판매사 폼('distributor') 또는 /supplier/login.
  const [mode, setMode] = useState<'choose' | 'distributor'>('choose')
  // 🏬 멀티-몰 브랜딩 — host → mall (기본 몰 → 유통스타트/#FC5424 → byte-identical). 조기 return 전에 호출.
  const { displayName: mallName, logoUrl: mallLogo } = useWholesaleMall()
  const [rememberMe, setRememberMe] = useState(false)

  // 🛡️ 2026-06-17: 이메일 기억하기 — 저장된 이메일 자동 채움 (admin/seller 와 동형).
  useEffect(() => {
    const saved = localStorage.getItem('wholesale_remember_email')
    if (saved) { setEmail(saved); setRememberMe(true) }
  }, [])

  // ⚡ 2026-06-29 (로그인 속도): 로그인 성공 후 이동할 카탈로그 청크를 미리 워밍 → navigate 즉시 렌더(흰화면 0).
  useEffect(() => { import('./WholesaleCatalogPage').catch(() => { /* prefetch best-effort */ }) }, [])

  // 🛡️ 2026-06-19 (대표 결정 B): 판매사는 구매자 → 로그인 후 카탈로그(/wholesale)가 홈. 대시보드는 헤더 버튼으로 진입.
  const alreadyIn = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  useEffect(() => { if (alreadyIn) navigate('/wholesale', { replace: true }) }, [alreadyIn, navigate])

  // 🛡️ 2026-06-18 (인증 audit 대칭화): 카카오로 돌아온 기존 판매사면 become-distributor 빈-body probe 로
  //   seller_token 자동 교환 (SupplierLoginPage 의 /supplier/become 자동 probe 와 대칭 — 카카오 콜백 토큰
  //   누락 엣지 보강). 신규/미승인은 조용히 폼 유지. requireAuth 는 세션 쿠키(credentials:include)로 인증.
  useEffect(() => {
    // 🏭 2026-06-29 (교과서적 — off-by-default): 카카오 명시 로그인 직후 1회만 토큰교환 probe. 아니면 미발화.
    if (alreadyIn || typeof window === 'undefined' || !localStorage.getItem('user_id') || !consumeWholesaleLoginIntent()) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/wholesale/become-distributor', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        const data = await res.json().catch(() => ({})) as { success?: boolean; status?: string; message?: string; data?: SellerSessionData }
        if (cancelled) return
        if (data.success && data.status === 'approved' && data.data?.accessToken) {
          applySellerSession(data.data)
          toast.success('판매사로 로그인되었습니다')
          navigate('/wholesale', { replace: true }) // ⚡ SPA — 앱 재다운로드 없이 즉시(토큰 동기 set 후)
        } else if (data.success && (data.status === 'pending' || data.status === 'needs_business_info')) {
          toast.info(data.message || '판매사 승인 대기 중입니다 — 승인 후 이용할 수 있어요')
        }
        // needs_registration → 조용히(로그인 폼 유지; 가입은 사용자가 선택)
      } catch { /* silent — 로그인 폼 유지 */ }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      // 🛡️ 2026-06-17: 이메일 기억하기 저장/삭제.
      if (rememberMe) localStorage.setItem('wholesale_remember_email', email.trim())
      else localStorage.removeItem('wholesale_remember_email')
      applySellerSession(d)
      // 🛡️ 2026-06-19 (대표 결정 B): 판매사는 구매자 → 항상 카탈로그(/wholesale) 홈. 대시보드는 헤더 버튼.
      // ⚡ 2026-06-29 (로그인 속도): window.location.assign(full reload) → SPA navigate. applySellerSession 이
      //   seller_token 을 localStorage 에 *동기* set 후라, 카탈로그 마운트 시 토큰을 읽어 등급가(회원) 뷰로
      //   렌더(authSeg 'in' 캐시키 → 가격 fetch). 앱/HTML 재다운로드 제거. 제조사(SupplierLoginPage)와 대칭.
      navigate('/wholesale', { replace: true })
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '로그인 중 오류가 발생했어요')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-[#ECEEF1] text-[15px] text-[#0C2454] outline-none focus:border-[#0C2454] transition-colors'

  return (
    <div className="force-light-theme min-h-[100dvh] bg-white text-[#0C2454]">
      <SEO title="판매사 로그인 — 유통스타트 B2B 도매몰" description="판매사 로그인 — 등급 공급가로 사입하세요." url="/wholesale/login" noindex />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2">
            {mallLogo ? (
              <><img src={mallLogo} alt={mallName} className="w-6 h-6 rounded object-cover" /><span className="text-lg font-extrabold">{mallName}</span></>
            ) : (
              <WholesaleWordmark height={28} />
            )}
          </button>
          {/* 🧹 2026-06-17 (시안): 우상단 '판매사 가입' 버튼 삭제 */}
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
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#ECEEF1] hover:border-[#0C2454] transition-colors text-left">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: '#F4F5F7' }}><Users className="w-6 h-6" style={{ color: '#0C2454' }} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-extrabold text-[#0C2454]">판매사 로그인</span>
                  <span className="block text-[13px] text-[#8A929E] mt-0.5">등급 공급가로 사입하는 판매사</span>
                </span>
                <ArrowRight className="w-5 h-5 text-[#B6BCC4] shrink-0" />
              </button>
              <button onClick={() => navigate('/supplier/login')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-[#ECEEF1] hover:border-[#0C2454] transition-colors text-left">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0" style={{ background: '#F4F5F7' }}><Factory className="w-6 h-6" style={{ color: '#0C2454' }} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] font-extrabold text-[#0C2454]">제조사 로그인</span>
                  <span className="block text-[13px] text-[#8A929E] mt-0.5">상품을 공급하는 제조사</span>
                </span>
                <ArrowRight className="w-5 h-5 text-[#B6BCC4] shrink-0" />
              </button>
            </div>
            <div className="mt-8 text-center text-sm text-[#8A929E]">
              아직 회원이 아니신가요?{' '}
              <button onClick={() => navigate('/wholesale/start')} className="text-[#FC5424] font-semibold">회원가입 →</button>
            </div>
          </>
        ) : (
          <>
        <button onClick={() => setMode('choose')} className="mb-5 inline-flex items-center gap-1 text-sm text-[#8A929E] hover:text-[#0C2454] font-medium">
          <ArrowRight className="w-4 h-4 rotate-180" /> 로그인 유형 다시 선택
        </button>
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">판매사 로그인</h1>
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
          <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[#ECEEF1] text-[#FC5424] focus:ring-[#FC5424]/30" />
            <span className="text-[13px] text-[#4E5560]">이메일 기억하기</span>
          </label>
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FC5424] text-white font-bold text-[15px] hover:bg-[#E0461C] transition-colors disabled:opacity-60 mt-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>로그인 <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        {/* 🏭 2026-06-04 카카오 통합 로그인 — 카카오 계정으로 유통회원 로그인/시작.
            기존 판매사(이메일 연결)면 자동 로그인, 신규면 /wholesale 에서 1탭 전환. */}
        <div className="relative my-4 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
          <span className="text-[12px]" style={{ color: '#8A929E' }}>또는</span>
          <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
        </div>
        <button type="button" onClick={() => { setWholesaleLoginIntent(); window.location.href = '/auth/kakao/start?redirect=/wholesale&intent=user' }}
          className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-[15px]" style={{ background: '#FEE500', color: '#3C1E1E' }}>
          카카오로 계속하기
        </button>

        {/* 👥 직원(서브계정) 로그인 입구 — 회사 owner 와 분리. */}
        <div className="mt-4 text-center text-sm text-[#8A929E]">
          직원이신가요?{' '}
          <button onClick={() => navigate('/wholesale/staff-login')} className="text-[#FC5424] font-semibold inline-flex items-center gap-1"><Users className="w-4 h-4" /> 직원 로그인 →</button>
        </div>

        <div className="mt-6 text-center text-sm text-[#8A929E]">
          아직 판매사가 아니신가요?{' '}
          <button onClick={() => navigate('/wholesale/join')} className="text-[#FC5424] font-semibold">판매사 가입 →</button>
        </div>
        <div className="mt-3 pt-5 border-t border-[#ECEEF1] text-center text-sm text-[#8A929E]">
          제조사이신가요?{' '}
          <button onClick={() => navigate('/supplier/login')} className="text-[#FC5424] font-semibold inline-flex items-center gap-1"><Factory className="w-4 h-4" /> 제조사 로그인 →</button>
        </div>
          </>
        )}
      </main>
    </div>
  )
}
