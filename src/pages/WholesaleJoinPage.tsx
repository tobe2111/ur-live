/**
 * 🏭 2026-06-04 유통스타트 도매몰 — 유통회원(유통사) 경량 전용 가입.
 *   라이브커머스 셀러 온보딩과 분리 — 담당자·상호·이메일·비번(+선택: 연락처/사업자번호)만.
 *   POST /api/wholesale/register → seller 계정(distributor_grade='C', is_distributor=1) 생성 +
 *   즉시 로그인(seller_token) → /wholesale 완결. /seller 대시보드는 안 거침.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Store, ArrowRight, CheckCircle2, Boxes, Loader2, Factory } from 'lucide-react'
import BusinessCertUpload from '@/components/BusinessCertUpload'

export default function WholesaleJoinPage() {
  const navigate = useNavigate()
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  // 카카오로 로그인된 유저(아직 유통회원 아님) — 이메일/비번 없이 사업자 정보만 입력.
  const kakaoUser = !hasSeller && typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  const [form, setForm] = useState({
    name: (typeof window !== 'undefined' && localStorage.getItem('user_name')) || '',
    business_name: '', representative: '',
    email: (typeof window !== 'undefined' && localStorage.getItem('user_email')) || '',
    password: '', phone: '', business_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [licenseUrl, setLicenseUrl] = useState('')
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  // 이미 유통사(셀러) 로그인 상태면 카탈로그로 바로.
  useEffect(() => { if (hasSeller) navigate('/wholesale', { replace: true }) }, [hasSeller, navigate])
  if (hasSeller) return null // 리다이렉트 중 가입폼 깜빡임 방지

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!form.business_name.trim()) { toast.error('상호(회사명)를 입력해주세요'); return }
    if (!/^\d{3}-\d{2}-\d{5}$/.test(form.business_number.trim())) { toast.error('사업자등록번호를 정확히 입력해주세요 (000-00-00000)'); return }
    if (!licenseUrl) { toast.error('사업자등록증 이미지를 업로드해주세요'); return }
    if (!kakaoUser && (!form.name.trim() || !form.email.trim() || !form.password)) { toast.error('담당자명·이메일·비밀번호를 입력해주세요'); return }
    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(), business_name: form.business_name.trim(), business_number: form.business_number.trim(),
        representative: form.representative.trim(), phone: form.phone.trim(), business_license_url: licenseUrl,
      }
      // 카카오 유저 → become-distributor(세션 인증), 그 외 → register(이메일/비번).
      const res = kakaoUser
        ? await api.post('/api/wholesale/become-distributor', payload)
        : await api.post('/api/wholesale/register', { ...payload, email: form.email.trim(), password: form.password })
      const data = res.data
      if (!data?.success) throw new Error(data?.error || '신청에 실패했어요')
      // 이미 승인된 셀러(겸업)가 카카오로 유통회원 승급한 경우 → 즉시 로그인.
      if (data.status === 'approved' && data.data?.accessToken) {
        const s = data.data.seller
        localStorage.setItem('seller_token', data.data.accessToken)
        localStorage.setItem('access_token', data.data.accessToken)
        localStorage.setItem('seller_refresh_token', data.data.refreshToken || '')
        localStorage.setItem('seller_id', String(s.id))
        localStorage.setItem('seller_name', s.name || '')
        localStorage.setItem('seller_username', s.username || '')
        localStorage.setItem('seller_type', s.seller_type || 'influencer')
        localStorage.setItem('is_distributor', '1')
        toast.success('유통회원으로 시작합니다')
        window.location.assign('/wholesale')
        return
      }
      // 신규 신청 → 승인 대기 화면.
      setSubmitted(true)
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '신청 중 오류가 발생했어요')
    } finally { setLoading(false) }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-[#17181C] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#11875A]/10 flex items-center justify-center mx-auto mb-5"><CheckCircle2 className="w-7 h-7 text-[#11875A]" /></div>
          <h1 className="text-xl font-extrabold mb-2">유통회원 신청이 완료됐어요</h1>
          <p className="text-[#4E5560] text-[14px] leading-relaxed">제출하신 <b>사업자 정보</b>를 확인한 뒤 관리자 승인되면 도매몰을 이용할 수 있어요. (영업일 기준 1~2일)<br/>승인되면 등급 공급가가 열립니다.</p>
          <button onClick={() => navigate('/wholesale')} className="mt-6 px-5 h-11 rounded-xl font-bold text-white" style={{ background: '#17181C' }}>도매몰 둘러보기</button>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-[#ECEEF1] text-[15px] text-[#17181C] outline-none focus:border-[#17181C] transition-colors'

  return (
    <div className="min-h-screen bg-white text-[#17181C]">
      <SEO title="유통사 가입 — 유통스타트 B2B 도매몰" description="유통사로 가입하고 검증된 제조사 상품을 등급 공급가로 사입하세요. 가입 즉시 C등급, 가입비·월 고정비 0원." url="/wholesale/join" />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#FF0033]" /><span className="text-lg font-extrabold">유통스타트</span>
          </button>
          <button onClick={() => navigate('/wholesale/login')} className="text-sm text-[#4E5560] hover:text-[#17181C] font-medium">이미 가입했어요</button>
        </div>
      </header>

      <main className="ur-content-narrow mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#FF0033]/10 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-[#FF0033]" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">유통사로 가입하기</h1>
          <p className="text-[#4E5560] text-[15px]">검증된 제조사 상품을 등급 공급가로 사입하세요.</p>
        </div>

        <div className="rounded-2xl border border-[#ECEEF1] p-5 mb-6 bg-[#F8F9FB]">
          <ul className="space-y-2.5 text-[13px] text-[#4E5560]">
            {[
              '사업자 정보 확인 후 승인 — 승인 즉시 C등급 공급가(실적 쌓이면 A·B)',
              '제조사 신원·원가 비공개, 등급 공급가만 열람',
              '엑셀 대량 주문 · 단가표 다운 · OEM/ODM 신청',
              '가입비·월 고정비 0원',
            ].map((t, i) => (
              <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>

        {kakaoUser && (
          <div className="rounded-xl px-4 py-3 mb-4 text-[13px]" style={{ background: '#FEF6D9', color: '#7A5C00' }}>
            카카오 계정으로 진행 중이에요. <b>사업자 정보</b>만 입력하면 승인 심사로 넘어갑니다.
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">담당자명 <span className="text-[#FF0033]">*</span></label>
            <input value={form.name} onChange={set('name')} disabled={loading} className={inputCls} placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">상호(회사명) <span className="text-[#FF0033]">*</span></label>
            <input value={form.business_name} onChange={set('business_name')} disabled={loading} className={inputCls} placeholder="예: (주)유통상사" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">사업자등록번호 <span className="text-[#FF0033]">*</span></label>
              <input value={form.business_number} onChange={set('business_number')} disabled={loading} className={inputCls} placeholder="000-00-00000" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">대표자명 <span className="text-[#B6BCC4] font-normal">(선택)</span></label>
              <input value={form.representative} onChange={set('representative')} disabled={loading} className={inputCls} placeholder="예: 홍길동" />
            </div>
          </div>
          {!kakaoUser && (
            <>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">이메일 <span className="text-[#FF0033]">*</span></label>
                <input type="email" value={form.email} onChange={set('email')} disabled={loading} className={inputCls} placeholder="login@email.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">비밀번호 <span className="text-[#FF0033]">*</span></label>
                <input type="password" value={form.password} onChange={set('password')} disabled={loading} className={inputCls} placeholder="10자 이상, 대/소문자+숫자" autoComplete="new-password" />
              </div>
            </>
          )}
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">연락처 <span className="text-[#B6BCC4] font-normal">(선택)</span></label>
            <input value={form.phone} onChange={set('phone')} disabled={loading} className={inputCls} placeholder="010-0000-0000" />
          </div>
          <BusinessCertUpload value={licenseUrl} onChange={setLicenseUrl} required />
          <p className="text-[12px] text-[#8A929E]">제출하신 사업자 정보(사업자등록증 포함)를 관리자가 확인 후 승인합니다. 승인되면 도매 공급가가 열려요.</p>

          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FF0033] text-white font-bold text-[15px] hover:bg-[#e0002e] transition-colors disabled:opacity-60 mt-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>유통회원 가입 신청 <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        {/* 🏭 2026-06-04 카카오로 간편 가입 — 비-카카오 사용자에게만 노출 (사업자 정보는 동일하게 입력). */}
        {!kakaoUser && (
          <>
            <div className="relative my-4 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
              <span className="text-[12px]" style={{ color: '#8A929E' }}>또는</span>
              <div className="flex-1 h-px" style={{ background: '#ECEEF1' }} />
            </div>
            <button type="button" onClick={() => { window.location.href = '/auth/kakao/start?redirect=/wholesale&intent=user' }}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-[15px]" style={{ background: '#FEE500', color: '#3C1E1E' }}>
              카카오로 시작하기
            </button>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-[#ECEEF1] text-center text-sm text-[#8A929E]">
          제조사(공급사)이신가요?{' '}
          <button onClick={() => navigate('/supplier/register')} className="text-[#FF0033] font-semibold inline-flex items-center gap-1"><Factory className="w-4 h-4" /> 제조사 입점 →</button>
        </div>
      </main>
    </div>
  )
}
