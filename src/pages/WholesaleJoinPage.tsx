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

export default function WholesaleJoinPage() {
  const navigate = useNavigate()
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  const [form, setForm] = useState({ name: '', business_name: '', email: '', password: '', phone: '', business_number: '' })
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  // 이미 유통사(셀러) 로그인 상태면 카탈로그로 바로.
  useEffect(() => { if (hasSeller) navigate('/wholesale', { replace: true }) }, [hasSeller, navigate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!form.name.trim() || !form.business_name.trim() || !form.email.trim() || !form.password) {
      toast.error('담당자명·상호·이메일·비밀번호를 입력해주세요'); return
    }
    setLoading(true)
    try {
      const r = await api.post('/api/wholesale/register', {
        name: form.name.trim(), business_name: form.business_name.trim(), email: form.email.trim(),
        password: form.password, phone: form.phone.trim(), business_number: form.business_number.trim(),
      })
      const d = r.data?.data
      if (!r.data?.success || !d?.accessToken) throw new Error(r.data?.error || '가입 실패')
      // 셀러 세션 저장(SellerLoginPage 와 동일 키) + 유통사 표시.
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
      localStorage.setItem('is_distributor', '1')
      toast.success('가입 완료! 도매 카탈로그로 이동해요')
      window.location.assign('/wholesale') // full reload — 토큰 반영 + 카탈로그 진입
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '가입 중 오류가 발생했어요')
    } finally { setLoading(false) }
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
          <button onClick={() => navigate('/seller/login?returnUrl=/wholesale')} className="text-sm text-[#4E5560] hover:text-[#17181C] font-medium">이미 가입했어요</button>
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
              '가입 즉시 C등급 공급가 — 실적 쌓이면 A·B 상향',
              '제조사 신원·원가 비공개, 등급 공급가만 열람',
              '엑셀 대량 주문 · 단가표 다운 · OEM/ODM 신청',
              '가입비·월 고정비 0원',
            ].map((t, i) => (
              <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#FF0033] shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">담당자명 <span className="text-[#FF0033]">*</span></label>
            <input value={form.name} onChange={set('name')} disabled={loading} className={inputCls} placeholder="예: 홍길동" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">상호(회사명) <span className="text-[#FF0033]">*</span></label>
            <input value={form.business_name} onChange={set('business_name')} disabled={loading} className={inputCls} placeholder="예: (주)유통상사" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">이메일 <span className="text-[#FF0033]">*</span></label>
            <input type="email" value={form.email} onChange={set('email')} disabled={loading} className={inputCls} placeholder="login@email.com" autoComplete="email" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">비밀번호 <span className="text-[#FF0033]">*</span></label>
            <input type="password" value={form.password} onChange={set('password')} disabled={loading} className={inputCls} placeholder="10자 이상, 대/소문자+숫자" autoComplete="new-password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">연락처 <span className="text-[#B6BCC4] font-normal">(선택)</span></label>
              <input value={form.phone} onChange={set('phone')} disabled={loading} className={inputCls} placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold mb-1.5">사업자번호 <span className="text-[#B6BCC4] font-normal">(선택)</span></label>
              <input value={form.business_number} onChange={set('business_number')} disabled={loading} className={inputCls} placeholder="000-00-00000" />
            </div>
          </div>
          <p className="text-[12px] text-[#8A929E]">사업자번호는 세금계산서 발행용 — 나중에 입력해도 됩니다.</p>

          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FF0033] text-white font-bold text-[15px] hover:bg-[#e0002e] transition-colors disabled:opacity-60 mt-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>유통사 가입 완료 <ArrowRight className="w-5 h-5" /></>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[#ECEEF1] text-center text-sm text-[#8A929E]">
          제조사(공급사)이신가요?{' '}
          <button onClick={() => navigate('/supplier/register')} className="text-[#FF0033] font-semibold inline-flex items-center gap-1"><Factory className="w-4 h-4" /> 제조사 입점 →</button>
        </div>
      </main>
    </div>
  )
}
