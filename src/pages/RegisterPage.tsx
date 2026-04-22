import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { toast } from '@/hooks/useToast'
import { Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()

  const isKR = isKorea()
  const krUser = useAuthKR(state => state.user)
  const krIsAuthReady = useAuthKR(state => state.isAuthReady)
  const krSignupWithEmail = useAuthKR(state => state.signupWithEmail)
  const worldUser = useAuthWorld(state => state.user)
  const worldIsAuthReady = useAuthWorld(state => state.isAuthReady)

  const user = isKR ? krUser : worldUser
  const isAuthReady = isKR ? krIsAuthReady : worldIsAuthReady
  const signupWithEmailAction = krSignupWithEmail

  const isLoggedIn = !!user || (localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id'))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  // 법적 동의 분리 (PIPA): 이용약관 / 개인정보처리방침은 필수, 마케팅은 선택
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [marketingAgreed, setMarketingAgreed] = useState(false)
  // 만 14세 이상 자기신고 (미성년 차단 기본선)
  const [ageConfirmed, setAgeConfirmed] = useState(false)

  useEffect(() => {
    if (isAuthReady && isLoggedIn) {
      navigate('/', { replace: true })
    }
  }, [isAuthReady, isLoggedIn, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    if (!termsAgreed || !privacyAgreed) {
      setError('이용약관과 개인정보처리방침에 동의해주세요.')
      return
    }

    if (!ageConfirmed) {
      setError('만 14세 이상만 가입 가능합니다.')
      return
    }

    setLoading(true)

    try {
      await signupWithEmailAction(formData.email, formData.password, formData.name, {
        terms_agreed: true,
        privacy_agreed: true,
        marketing_agreed: marketingAgreed,
        age_confirmed: true,
      })
      toast.success('회원가입이 완료되었습니다! 로그인해주세요.')
      navigate('/login')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      let errorMessage = '회원가입에 실패했습니다.'
      if (errMsg.includes('email-already-in-use')) {
        errorMessage = '이미 사용 중인 이메일입니다.'
      } else if (errMsg.includes('invalid-email')) {
        errorMessage = '유효하지 않은 이메일 형식입니다.'
      } else if (errMsg.includes('weak-password')) {
        errorMessage = '비밀번호가 너무 약합니다. 8자 이상 입력해주세요.'
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#111] mx-auto"></div>
          <p className="mt-4 text-[13px] text-[#999]">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 py-12">
      <SEO title="회원가입 - 유어딜" description="유어딜에 가입하고 라이브 쇼핑을 시작하세요" url="/register" />
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-[32px] font-bold tracking-[0.08em] text-[#111]">
            UR LIVE
          </h1>
          <p className="text-[14px] text-[#999] mt-3 font-light">
            회원가입
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">
              이름
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="홍길동"
              required
              className="w-full h-[48px] px-4 border border-[#E0E0E0] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">
              이메일
            </label>
            <input
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="example@email.com"
              required
              className="w-full h-[48px] px-4 border border-[#E0E0E0] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">
              비밀번호
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="8자 이상 입력해주세요"
                required
                minLength={8}
                className="w-full h-[48px] px-4 pr-12 border border-[#E0E0E0] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#bbb] hover:text-[#555]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[12px] font-medium text-[#555] mb-1.5">
              비밀번호 확인
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="비밀번호를 다시 입력해주세요"
                required
                minLength={8}
                className="w-full h-[48px] px-4 pr-12 border border-[#E0E0E0] rounded-xl text-[14px] text-gray-900 focus:outline-none focus:border-[#111] focus:ring-1 focus:ring-[#111] transition-all placeholder:text-[#bbb]"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#bbb] hover:text-[#555]"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Legal Agreements (PIPA: 필수 동의 분리 + 만 14세 이상) */}
          <div className="pt-1 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E0E0E0] text-[#111] focus:ring-[#111] cursor-pointer accent-[#111]"
              />
              <span className="text-[12px] text-[#888] leading-relaxed group-hover:text-[#555] transition-colors">
                <span className="font-medium text-[#555]">[필수]</span>{' '}
                <Link
                  to="/terms"
                  className="text-[#111] underline underline-offset-4 decoration-1 hover:text-[#555]"
                  target="_blank"
                >
                  서비스 이용약관
                </Link>
                에 동의합니다.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E0E0E0] text-[#111] focus:ring-[#111] cursor-pointer accent-[#111]"
              />
              <span className="text-[12px] text-[#888] leading-relaxed group-hover:text-[#555] transition-colors">
                <span className="font-medium text-[#555]">[필수]</span>{' '}
                <Link
                  to="/privacy"
                  className="text-[#111] underline underline-offset-4 decoration-1 hover:text-[#555]"
                  target="_blank"
                >
                  개인정보처리방침
                </Link>
                에 동의합니다.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E0E0E0] text-[#111] focus:ring-[#111] cursor-pointer accent-[#111]"
              />
              <span className="text-[12px] text-[#888] leading-relaxed group-hover:text-[#555] transition-colors">
                <span className="font-medium text-[#555]">[필수]</span>{' '}
                본인은 만 14세 이상입니다.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={marketingAgreed}
                onChange={(e) => setMarketingAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#E0E0E0] text-[#111] focus:ring-[#111] cursor-pointer accent-[#111]"
              />
              <span className="text-[12px] text-[#888] leading-relaxed group-hover:text-[#555] transition-colors">
                <span className="text-[#aaa]">[선택]</span>{' '}
                마케팅 정보 수신에 동의합니다.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[48px] bg-[#111] hover:bg-black text-white rounded-xl text-[14px] font-semibold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center text-[13px] text-[#aaa] mt-8 font-light">
          이미 계정이 있으신가요?{' '}
          <Link
            to="/login"
            className="text-[#111] font-medium hover:underline underline-offset-4 decoration-1"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  )
}
