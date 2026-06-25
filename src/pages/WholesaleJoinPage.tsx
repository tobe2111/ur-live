/**
 * 🏭 2026-06-04 유통스타트 도매몰 — 유통회원(판매사) 경량 전용 가입.
 *   라이브커머스 셀러 온보딩과 분리 — 담당자·상호·이메일·비번(+선택: 연락처/사업자번호)만.
 *   POST /api/wholesale/register → seller 계정(distributor_grade='C', is_distributor=1) 생성 +
 *   즉시 로그인(seller_token) → /wholesale 완결. /seller 대시보드는 안 거침.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO, { wholesaleStoreJsonLd, breadcrumbJsonLd } from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Store, ArrowRight, CheckCircle2, Loader2, Factory } from 'lucide-react'
import BusinessCertUpload from '@/components/BusinessCertUpload'
import { formatBizNo, formatPhoneKr } from '@/utils/format-kr'
import { useWholesaleMall } from '@/hooks/queries/useWholesale'
import { WholesaleWordmark } from './wholesale-catalog/WholesaleLogo'

export default function WholesaleJoinPage() {
  const navigate = useNavigate()
  // 🏬 멀티-몰 브랜딩 — host → mall (기본 몰 → 유통스타트/#FC5424 → byte-identical).
  const { displayName: mallName, logoUrl: mallLogo } = useWholesaleMall()
  const hasSeller = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
  // 카카오로 로그인된 유저(아직 유통회원 아님) — 이메일/비번 없이 사업자 정보만 입력.
  const kakaoUser = !hasSeller && typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  // 🧭 2026-06-10 (생애주기 감사 갭#3): 신청 후 재방문 시 '승인 대기 중' 상태 화면 — 폼 재노출 대신 현황 안내.
  //   빈 body 프로브: 기존 신청자(pending)면 status='pending', 미신청이면 needs_registration(폼 유지).
  const [pendingStatus, setPendingStatus] = useState(false)
  useEffect(() => {
    if (!kakaoUser) return
    api.post('/api/wholesale/become-distributor', {})
      .then((r) => {
        const d = r.data || {}
        if (d.status === 'pending') setPendingStatus(true)
        else if (d.status === 'approved' && d.data?.accessToken) {
          localStorage.setItem('seller_token', d.data.accessToken)
          localStorage.setItem('is_distributor', '1')
          window.location.href = '/wholesale'
        }
      })
      .catch(() => { /* 프로브 실패 — 폼 유지 */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loginEmail = (typeof window !== 'undefined' && localStorage.getItem('user_email')) || ''
  const [form, setForm] = useState({
    name: (typeof window !== 'undefined' && localStorage.getItem('user_name')) || '',
    business_name: '', representative: '',
    email: loginEmail,
    password: '', phone: '', business_number: '',
    // 🏭 2026-06-09 대표자/담당자 분리 — 대표자 연락처 + 담당자 정보(성명/연락처/이메일).
    representative_phone: '',
    manager_name: (typeof window !== 'undefined' && localStorage.getItem('user_name')) || '',
    manager_phone: '',
    manager_email: loginEmail,
  })
  const [loading, setLoading] = useState(false)
  const [passwordConfirm, setPasswordConfirm] = useState('')
  // 🏭 2026-06-10: 이용약관 동의 (필수) — /wholesale/terms
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [licenseUrl, setLicenseUrl] = useState('')
  // 담당자가 대표자와 동일 — 체크 시 대표자(성명/연락처)를 담당자에 즉시 복사.
  const [sameAsRep, setSameAsRep] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  // 🔢 2026-06-23 하이픈 자동 삽입 — 사업자번호/휴대폰(직접 안 쳐도 정규화).
  const setBiz = (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, business_number: formatBizNo(e.target.value) }))
  const setPhone = (k: 'manager_phone') => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: formatPhoneKr(e.target.value) }))
  // 대표자 → 담당자 복사(성명+연락처). 토글 ON 이면 대표자 입력이 담당자에 실시간 반영.
  const setRep = (k: 'representative' | 'representative_phone') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === 'representative_phone' ? formatPhoneKr(e.target.value) : e.target.value
    setForm(f => {
      const next = { ...f, [k]: v }
      if (sameAsRep) {
        if (k === 'representative') next.manager_name = v
        if (k === 'representative_phone') next.manager_phone = v
      }
      return next
    })
  }
  const toggleSame = (on: boolean) => {
    setSameAsRep(on)
    if (on) setForm(f => ({ ...f, manager_name: f.representative, manager_phone: f.representative_phone }))
  }

  // 이미 판매사(셀러) 로그인 상태면 카탈로그로 바로.
  useEffect(() => { if (hasSeller) navigate('/wholesale', { replace: true }) }, [hasSeller, navigate])
  if (hasSeller) return null // 리다이렉트 중 가입폼 깜빡임 방지

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!form.business_name.trim()) { toast.error('상호(회사명)를 입력해주세요'); return }
    if (!/^\d{10}$/.test(form.business_number.replace(/[^0-9]/g, ''))) { toast.error('사업자등록번호 10자리를 정확히 입력해주세요'); return }
    if (!licenseUrl) { toast.error('사업자등록증 이미지를 업로드해주세요'); return }
    if (!form.representative.trim() || !form.representative_phone.trim()) { toast.error('대표자 성명·연락처를 입력해주세요'); return }
    if (!form.manager_name.trim() || !form.manager_phone.trim()) { toast.error('담당자 성명·연락처를 입력해주세요'); return }
    if (!kakaoUser && (!form.email.trim() || !form.password)) { toast.error('로그인 이메일·비밀번호를 입력해주세요'); return }
    if (!kakaoUser && form.password.length < 8) { toast.error('비밀번호는 8자 이상이어야 합니다'); return }
    // 🛡️ 2026-06-25: 서버(relaxed)와 동일 — 영문·숫자·특수 중 2종 이상. (옛 클라는 길이만 검사 → "12345678" 통과 후 서버 400 혼선)
    if (!kakaoUser && [/[a-zA-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(form.password)).length < 2) {
      toast.error('비밀번호는 영문·숫자·특수문자 중 2종류 이상을 포함해야 합니다'); return
    }
    // 🛡️ 2026-06-25: 서버(relaxed)의 '같은 문자 4회 반복 금지'와 일치 — 옛 클라는 미검사라 "aaaa1234" 통과 후 서버 400 혼선.
    if (!kakaoUser && /(.)\1{3,}/.test(form.password)) { toast.error('비밀번호에 같은 문자를 4번 이상 연속 사용할 수 없습니다'); return }
    if (!kakaoUser && form.password !== passwordConfirm) { toast.error('비밀번호가 일치하지 않습니다'); return }
    setLoading(true)
    try {
      // 담당자 이메일 — 미입력 시 로그인 이메일을 비즈니스 연락 이메일로 사용.
      const managerEmail = (form.manager_email.trim() || form.email.trim())
      const payload = {
        // name(담당자명) 은 기존 백엔드 호환 — 담당자 성명으로 채움.
        name: form.manager_name.trim(), business_name: form.business_name.trim(), business_number: form.business_number.trim(),
        representative: form.representative.trim(), phone: form.representative_phone.trim() || form.manager_phone.trim(),
        representative_phone: form.representative_phone.trim(),
        manager_name: form.manager_name.trim(), manager_phone: form.manager_phone.trim(), manager_email: managerEmail,
        business_license_url: licenseUrl,
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
        toast.success('판매사로 시작합니다')
        window.location.assign('/wholesale')
        return
      }
      // 신규 신청 → 승인 대기 화면.
      setSubmitted(true)
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || (err as Error)?.message || '신청 중 오류가 발생했어요')
    } finally { setLoading(false) }
  }

  if (pendingStatus) {
    return (
      <div className="force-light-theme min-h-screen bg-white text-[#0C2454] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5"><span className="text-2xl">⏳</span></div>
          <h1 className="text-xl font-extrabold mb-2">승인 심사 중이에요</h1>
          <p className="text-[#4E5560] text-[14px] leading-relaxed">제출하신 <b>사업자 정보</b>를 확인하고 있어요. (영업일 기준 1~2일)<br/>승인되면 카카오 로그인만으로 바로 등급 공급가가 열립니다.</p>
          {/* 👥 2026-06-12 (감사 부채): 대기 중 데드엔드 완화 — 문의 채널 제공 (SiteFooter 공식 메일과 동일). */}
          <p className="text-[#8A929E] text-[12.5px] mt-3">
            급하신가요? <a href="mailto:utongstart@naver.com?subject=%5B%EC%9C%A0%ED%86%B5%ED%9A%8C%EC%9B%90%20%EC%8A%B9%EC%9D%B8%20%EB%AC%B8%EC%9D%98%5D" className="underline font-semibold text-[#4E5560]">utongstart@naver.com</a> 으로 상호·사업자번호와 함께 문의해주세요.
          </p>
          <div className="mt-6 flex gap-2 justify-center">
            <button onClick={() => window.location.reload()} className="px-5 h-11 rounded-xl font-bold border border-[#ECEEF1] text-[#0C2454]">승인 다시 확인</button>
            <button onClick={() => navigate('/wholesale')} className="px-5 h-11 rounded-xl font-bold text-white" style={{ background: '#0C2454' }}>도매몰 둘러보기</button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white text-[#0C2454] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#11875A]/10 flex items-center justify-center mx-auto mb-5"><CheckCircle2 className="w-7 h-7 text-[#11875A]" /></div>
          <h1 className="text-xl font-extrabold mb-2">판매사 신청이 완료됐어요</h1>
          <p className="text-[#4E5560] text-[14px] leading-relaxed">제출하신 <b>사업자 정보</b>를 확인한 뒤 관리자 승인되면 도매몰을 이용할 수 있어요. (영업일 기준 1~2일)<br/>승인되면 등급 공급가가 열립니다.</p>
          <p className="text-[#8A929E] text-[12.5px] mt-3">
            급하신가요? <a href="mailto:utongstart@naver.com?subject=%5B%EC%9C%A0%ED%86%B5%ED%9A%8C%EC%9B%90%20%EC%8A%B9%EC%9D%B8%20%EB%AC%B8%EC%9D%98%5D" className="underline font-semibold text-[#4E5560]">utongstart@naver.com</a> 으로 상호·사업자번호와 함께 문의해주세요.
          </p>
          <button onClick={() => navigate('/wholesale')} className="mt-6 px-5 h-11 rounded-xl font-bold text-white" style={{ background: '#0C2454' }}>도매몰 둘러보기</button>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full h-12 px-3.5 rounded-xl border border-[#ECEEF1] text-[15px] text-[#0C2454] outline-none focus:border-[#0C2454] transition-colors'

  return (
    <div className="min-h-screen bg-white text-[#0C2454]">
      <SEO domain="wholesale" title="판매사 입점·도매 회원가입 — 유통스타트 B2B 도매몰" description="판매사로 도매 회원가입하고 검증된 제조사 상품을 등급별 도매가(공급가)로 사입하세요. 가입 즉시 C등급, 가입비·월 고정비 0원 — 무재고 위탁판매·대량 사입까지." url="/wholesale/join" jsonLd={[wholesaleStoreJsonLd, breadcrumbJsonLd([{ name: '유통스타트', url: 'https://utongstart.com/wholesale' }, { name: '판매사 도매 회원가입', url: 'https://utongstart.com/wholesale/join' }])]} />
      <header className="border-b border-[#ECEEF1]">
        <div className="ur-content-narrow mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2">
            {mallLogo ? (
              <><img src={mallLogo} alt={mallName} className="w-6 h-6 rounded object-cover" /><span className="text-lg font-extrabold">{mallName}</span></>
            ) : (
              <WholesaleWordmark height={28} />
            )}
          </button>
          <button onClick={() => navigate('/wholesale/login')} className="text-sm text-[#4E5560] hover:text-[#0C2454] font-medium">이미 가입했어요</button>
        </div>
      </header>

      <main className="ur-content-narrow mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#FC5424]/10 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-[#FC5424]" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold mb-2">판매사로 가입하기</h1>
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
              <li key={i} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#FC5424] shrink-0 mt-0.5" />{t}</li>
            ))}
          </ul>
        </div>

        {kakaoUser && (
          <div className="rounded-xl px-4 py-3 mb-4 text-[13px]" style={{ background: '#FEF6D9', color: '#7A5C00' }}>
            카카오 계정으로 진행 중이에요. <b>사업자 정보</b>만 입력하면 승인 심사로 넘어갑니다.
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          {/* 사업자 정보 */}
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">상호(회사명) <span className="text-[#FC5424]">*</span></label>
            <input value={form.business_name} onChange={set('business_name')} disabled={loading} className={inputCls} placeholder="예: (주)유통상사" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">사업자등록번호 <span className="text-[#FC5424]">*</span></label>
            <input value={form.business_number} onChange={setBiz} disabled={loading} inputMode="numeric" className={inputCls} placeholder="000-00-00000 (숫자만 입력해도 자동 하이픈)" />
          </div>

          {/* 대표자 정보 */}
          <div className="pt-3 mt-3 border-t border-[#ECEEF1]">
            <p className="text-[13px] font-bold text-[#0C2454] mb-2.5">대표자 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">대표자 성명 <span className="text-[#FC5424]">*</span></label>
                <input value={form.representative} onChange={setRep('representative')} disabled={loading} className={inputCls} placeholder="예: 홍길동" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">대표자 연락처 <span className="text-[#FC5424]">*</span></label>
                <input value={form.representative_phone} onChange={setRep('representative_phone')} disabled={loading} className={inputCls} placeholder="010-0000-0000" />
              </div>
            </div>
          </div>

          {/* 담당자 정보 */}
          <div className="pt-3 mt-3 border-t border-[#ECEEF1]">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[13px] font-bold text-[#0C2454]">담당자 정보</p>
              <label className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4E5560] cursor-pointer select-none">
                <input type="checkbox" checked={sameAsRep} onChange={(e) => toggleSame(e.target.checked)} disabled={loading} className="w-4 h-4 rounded accent-[#FC5424]" />
                대표자와 동일
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">담당자 성명 <span className="text-[#FC5424]">*</span></label>
                <input value={form.manager_name} onChange={set('manager_name')} disabled={loading || sameAsRep} className={`${inputCls} ${sameAsRep ? 'bg-[#F4F5F7] text-[#8A929E]' : ''}`} placeholder="예: 김담당" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">담당자 연락처 <span className="text-[#FC5424]">*</span></label>
                <input value={form.manager_phone} onChange={setPhone('manager_phone')} disabled={loading || sameAsRep} inputMode="numeric" className={`${inputCls} ${sameAsRep ? 'bg-[#F4F5F7] text-[#8A929E]' : ''}`} placeholder="010-0000-0000" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-[13px] font-semibold mb-1.5">담당자 이메일 <span className="text-[#B6BCC4] font-normal">(선택)</span></label>
              <input type="email" value={form.manager_email} onChange={set('manager_email')} disabled={loading} className={inputCls} placeholder={kakaoUser ? '연락용 이메일' : '미입력 시 로그인 이메일'} autoComplete="off" />
            </div>
          </div>

          {!kakaoUser && (
            <div className="pt-3 mt-3 border-t border-[#ECEEF1] space-y-3">
              <p className="text-[13px] font-bold text-[#0C2454]">로그인 계정</p>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">이메일 <span className="text-[#FC5424]">*</span></label>
                <input type="email" value={form.email} onChange={set('email')} disabled={loading} className={inputCls} placeholder="login@email.com" autoComplete="email" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">비밀번호 <span className="text-[#FC5424]">*</span></label>
                <input type="password" value={form.password} onChange={set('password')} disabled={loading} className={inputCls} placeholder="8자 이상 (영문+숫자)" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">비밀번호 확인 <span className="text-[#FC5424]">*</span></label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} disabled={loading} className={inputCls} placeholder="비밀번호 재입력" autoComplete="new-password" />
                {passwordConfirm && form.password !== passwordConfirm && <p className="text-[12px] text-[#FC5424] mt-1">비밀번호가 일치하지 않습니다</p>}
              </div>
            </div>
          )}
          <BusinessCertUpload value={licenseUrl} onChange={setLicenseUrl} required />
          <p className="text-[12px] text-[#8A929E]">제출하신 사업자 정보(사업자등록증 포함)를 관리자가 확인 후 승인합니다. 승인되면 도매 공급가가 열려요.</p>

          {/* 🏭 2026-06-10 (사용자 요청 — 약관): 가입 = 도매몰 이용약관 동의 (필수 체크) */}
          <label className="flex items-start gap-2.5 rounded-xl p-3.5 cursor-pointer" style={{ background: '#F8F9FB', border: '1px solid #ECEEF1' }}>
            <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-[12.5px] leading-relaxed text-[#4E5560]">
              <a href="/wholesale/terms" target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#0C2454]">도매몰 이용약관</a>
              에 동의합니다. (가격 정책·최저가 준수, 예치금 결제, 상품 자료 사용 조건 포함) <span className="text-[#FC5424]">*</span>
            </span>
          </label>

          <button type="submit" disabled={loading || !agreeTerms}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#FC5424] text-white font-bold text-[15px] hover:bg-[#E0461C] transition-colors disabled:opacity-60 mt-1">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>판매사 가입 신청 <ArrowRight className="w-5 h-5" /></>}
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
            <button type="button" onClick={() => { window.location.href = '/auth/kakao/start?redirect=/wholesale/join&intent=user' }}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl font-bold text-[15px]" style={{ background: '#FEE500', color: '#3C1E1E' }}>
              카카오로 시작하기
            </button>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-[#ECEEF1] text-center text-sm text-[#8A929E]">
          제조사이신가요?{' '}
          <button onClick={() => navigate('/supplier/register')} className="text-[#FC5424] font-semibold inline-flex items-center gap-1"><Factory className="w-4 h-4" /> 제조사 입점 →</button>
        </div>
      </main>
    </div>
  )
}
