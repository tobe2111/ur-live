import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { Button } from '@/components/ui/button'
import { Play, Mail, Lock, User, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  
  // ✅ Region 기반 Store 선택
  const isKR = isKorea()
  const krUser = useAuthKR(state => state.user)
  const krIsAuthReady = useAuthKR(state => state.isAuthReady)
  const krSignupWithEmail = useAuthKR(state => state.signupWithEmail)
  const worldUser = useAuthWorld(state => state.user)
  const worldIsAuthReady = useAuthWorld(state => state.isAuthReady)
  
  // ✅ Selector로 필요한 상태만 구독
  const user = isKR ? krUser : worldUser
  const isAuthReady = isKR ? krIsAuthReady : worldIsAuthReady
  
  // ✅ Action (함수 참조만)
  const signupWithEmailAction = krSignupWithEmail
  
  // ✅ 계산된 값
  const isLoggedIn = !!user
  
  // Local State
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
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // ✅ 이미 로그인되어 있으면 리다이렉트
  useEffect(() => {
    if (isAuthReady && isLoggedIn) {
      console.log('[RegisterPage] 이미 로그인됨 - 홈으로 리다이렉트')
      navigate('/', { replace: true })
    }
  }, [isAuthReady, isLoggedIn, navigate])

  /**
   * 이메일/비밀번호 회원가입 - Firebase Auth
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
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

    if (!agreedToTerms) {
      setError('서비스 이용약관 및 개인정보처리방침에 동의해주세요.')
      return
    }

    setLoading(true)

    try {
      console.log('[Register] 🔥 Firebase 회원가입 시도:', formData.email)
      
      // ✅ Zustand action 직접 호출
      await signupWithEmailAction(formData.email, formData.password, formData.name)
      
      console.log('[Register] ✅ Firebase 회원가입 성공')
      
      // 회원가입 성공 알림
      alert('회원가입이 완료되었습니다! 로그인해주세요.')
      
      // 로그인 페이지로 이동
      navigate('/login')
      
    } catch (err: any) {
      console.error('[Register] ❌ 오류:', err)
      
      // Firebase 오류 메시지 한국어 변환
      let errorMessage = '회원가입에 실패했습니다.'
      if (err.message.includes('email-already-in-use')) {
        errorMessage = '이미 사용 중인 이메일입니다.'
      } else if (err.message.includes('invalid-email')) {
        errorMessage = '유효하지 않은 이메일 형식입니다.'
      } else if (err.message.includes('weak-password')) {
        errorMessage = '비밀번호가 너무 약합니다. 8자 이상 입력해주세요.'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // ⏳ Auth 초기화 중이면 로딩 표시
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto"></div>
          <p className="mt-4 text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white fill-white" />
              </div>
              <span className="text-[17px] sm:text-[21px] font-semibold tracking-tight text-[#1d1d1f]">
                리스터코퍼레이션
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[480px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-[32px] sm:text-[40px] font-bold text-[#1d1d1f] mb-3">
            회원가입
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#6e6e73]">
            라이브 쇼핑의 새로운 경험을 시작하세요
          </p>
        </div>

        {/* Benefits */}
        <div className="apple-card p-6 mb-6">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-4">
            리스터코퍼레이션에 가입하면
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[15px] font-medium text-[#1d1d1f]">실시간 라이브 쇼핑</p>
                <p className="text-[13px] text-[#6e6e73]">생생한 라이브 방송으로 쇼핑하기</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[15px] font-medium text-[#1d1d1f]">빠른 주문 처리</p>
                <p className="text-[13px] text-[#6e6e73]">원클릭 주문으로 간편하게</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[15px] font-medium text-[#1d1d1f]">특별 할인 혜택</p>
                <p className="text-[13px] text-[#6e6e73]">회원 전용 특가 상품</p>
              </div>
            </div>
          </div>
        </div>

        {/* Register Form */}
        <div className="apple-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[14px]">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                이름 *
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="홍길동"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                이메일 *
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="your@email.com"
                  required
                  className="w-full pl-12 pr-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                비밀번호 *
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="8자 이상 입력해주세요"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                비밀번호 확인 *
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6e6e73]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="비밀번호를 다시 입력해주세요"
                  required
                  minLength={8}
                  className="w-full pl-12 pr-12 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6e6e73] hover:text-[#1d1d1f]"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-gray-300 text-[#007aff] focus:ring-[#007aff] cursor-pointer"
                  required
                />
                <span className="text-[13px] text-[#6e6e73] leading-relaxed group-hover:text-[#1d1d1f] transition-colors">
                  <span className="font-medium text-[#1d1d1f]">(필수)</span>{' '}
                  리스터코퍼레이션의{' '}
                  <Link 
                    to="/terms" 
                    className="text-[#007aff] hover:opacity-60 underline"
                    target="_blank"
                  >
                    서비스 이용약관
                  </Link>
                  {' '}및{' '}
                  <Link 
                    to="/privacy" 
                    className="text-[#007aff] hover:opacity-60 underline"
                    target="_blank"
                  >
                    개인정보처리방침
                  </Link>
                  에 동의합니다.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="apple-button w-full py-4 mt-6"
            >
              {loading ? '가입 중...' : '가입하기'}
            </button>
          </form>
        </div>

        {/* Login Link */}
        <div className="text-center mt-6">
          <p className="text-[15px] text-[#6e6e73]">
            이미 계정이 있으신가요?
            {' '}
            <Link
              to="/login"
              className="text-[#007aff] font-medium hover:opacity-60 transition-opacity"
            >
              로그인
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
