import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { getUserType } from '@/utils/auth'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Play, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function SellerLoginPage() {
  const navigate = useNavigate()
  const { isLoggedIn, isAuthReady } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
    businessNumber: '',
    phoneNumber: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ✅ 이미 로그인되어 있고 판매자면 리다이렉트
  useEffect(() => {
    if (isAuthReady && isLoggedIn) {
      const userType = getUserType()
      if (userType === 'seller') {
        console.log('[SellerLoginPage] 이미 판매자 로그인됨 - /seller로 리다이렉트')
        navigate('/seller', { replace: true })
      } else {
        console.log('[SellerLoginPage] 다른 사용자 타입으로 로그인됨:', userType)
        // 판매자가 아닌 경우 로그아웃 필요
        setError('판매자 계정으로 로그인해주세요.')
      }
    }
  }, [isAuthReady, isLoggedIn, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      if (isLogin) {
        // Login logic
        const response = await api.post('/api/auth/login', {
          username: formData.email,
          password: formData.password,
          userType: 'seller'
        })

        if (response.data.success) {
          // ✅ JWT 토큰 저장
          const { accessToken, refreshToken } = response.data.data
          const sellerId = response.data.data.user.id
          
          console.log('[SellerLogin] 🚀 JWT Login successful')
          console.log('[SellerLogin] Access token:', accessToken?.substring(0, 20) + '...')
          console.log('[SellerLogin] Refresh token:', refreshToken?.substring(0, 20) + '...')
          console.log('[SellerLogin] Seller ID:', sellerId)
          console.log('[SellerLogin] User data:', response.data.data.user)
          
          // ✅ JWT 토큰 저장
          console.log('[SellerLogin] Step 1: Setting user_type to seller...')
          localStorage.setItem('user_type', 'seller')
          
          console.log('[SellerLogin] Step 2: Setting JWT tokens...')
          localStorage.setItem('access_token', accessToken)
          localStorage.setItem('refresh_token', refreshToken)
          
          console.log('[SellerLogin] Step 3: Setting seller ID...')
          localStorage.setItem('seller_id', sellerId.toString())
          
          console.log('[SellerLogin] Step 4: Setting seller name...')
          localStorage.setItem('seller_name', response.data.data.user.name || '')
          
          console.log('[SellerLogin] Step 5: Setting seller email...')
          localStorage.setItem('seller_email', response.data.data.user.email || '')
          
          // 🔍 디버깅: localStorage 확인
          console.log('[SellerLogin] ✅ All localStorage set successfully:')
          console.log('  - user_type:', localStorage.getItem('user_type'))
          console.log('  - access_token:', localStorage.getItem('access_token')?.substring(0, 20) + '...')
          console.log('  - seller_id:', localStorage.getItem('seller_id'))
          console.log('  - seller_name:', localStorage.getItem('seller_name'))
          console.log('  - seller_email:', localStorage.getItem('seller_email'))
          console.log('  - All keys:', Object.keys(localStorage))
          
          // ✅ localStorage 설정 확인 후 이동
          const verifyUserType = localStorage.getItem('user_type')
          const verifyAccessToken = localStorage.getItem('access_token')
          
          if (verifyUserType === 'seller' && verifyAccessToken === accessToken) {
            console.log('[SellerLogin] ✅ JWT verification passed! Navigating to /seller...')
            alert('로그인 성공!')
            
            // replace: true로 히스토리에서 로그인 페이지 제거
            navigate('/seller', { replace: true })
          } else {
            console.error('[SellerLogin] ❌ JWT verification failed!')
            console.error('Expected user_type: seller, got:', verifyUserType)
            console.error('Access token match:', verifyAccessToken === accessToken)
            alert('로그인 성공했으나 데이터 저장에 실패했습니다. 다시 시도해주세요.')
          }
        } else {
          setError(response.data.error || '로그인 실패')
        }
      } else {
        // 회원가입: 약관 동의 확인
        if (!agreedToTerms) {
          setError('서비스 이용약관 및 개인정보처리방침에 동의해주세요.')
          return
        }
        
        // Redirect to registration page
        navigate('/seller/register')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </button>
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2">
              <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#007aff] to-[#0051d5]">
                <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white fill-white" />
              </div>
              <span className="text-[17px] sm:text-[21px] font-semibold tracking-tight text-[#1d1d1f]">
                유어 라이브
              </span>
            </Link>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[480px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 className="text-[32px] sm:text-[40px] font-bold text-[#1d1d1f] mb-3">
            {isLogin ? '판매자 로그인' : '판매자 가입'}
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#6e6e73]">
            {isLogin 
              ? '라이브 커머스로 매출을 올려보세요' 
              : '무료로 시작하고 성공적인 판매를 경험하세요'
            }
          </p>
        </div>

        {/* Benefits - Show only on signup */}
        {!isLogin && (
          <div className="apple-card p-6 mb-6">
            <h3 className="text-[17px] font-semibold text-[#1d1d1f] mb-4">
              셀러로 가입하면
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[15px] font-medium text-[#1d1d1f]">무료 라이브 방송</p>
                  <p className="text-[13px] text-[#6e6e73]">추가 비용 없이 무제한 라이브</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[15px] font-medium text-[#1d1d1f]">실시간 매출 분석</p>
                  <p className="text-[13px] text-[#6e6e73]">매출 현황을 한눈에</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#34c759] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[15px] font-medium text-[#1d1d1f]">간편한 상품 관리</p>
                  <p className="text-[13px] text-[#6e6e73]">재고부터 배송까지 통합 관리</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login/Signup Form */}
        <div className="apple-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-[14px]">
                {error}
              </div>
            )}

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
                  placeholder="seller@example.com"
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

            {/* Additional fields for signup */}
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                    사업자명 *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="상호명 또는 개인 이름"
                    required={!isLogin}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                    사업자등록번호
                  </label>
                  <input
                    type="text"
                    value={formData.businessNumber}
                    onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                    placeholder="123-45-67890 (선택사항)"
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="010-1234-5678"
                    required={!isLogin}
                    className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="apple-button w-full py-4 mt-6"
            >
              {isLogin ? '로그인' : '가입하기'}
            </button>

            {/* Forgot Password - Login only */}
            {isLogin && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-[14px] text-[#007aff] hover:opacity-60 transition-opacity"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Toggle Login/Signup */}
        <div className="text-center mt-6">
          <p className="text-[15px] text-[#6e6e73]">
            아직 계정이 없으신가요?
            {' '}
            <button
              onClick={() => navigate('/seller/register')}
              className="text-[#007aff] font-medium hover:opacity-60 transition-opacity"
            >
              가입하기
            </button>
          </p>
        </div>

        {/* Terms - Signup only */}
        {!isLogin && (
          <div className="mt-6 space-y-4">
            {/* 약관 동의 체크박스 */}
            <label className="flex items-start gap-3 px-4 cursor-pointer group">
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
            
            {/* 약관 미동의 시 경고 */}
            {!agreedToTerms && (
              <p className="text-[11px] text-red-500 px-4">
                ⚠️ 회원가입을 위해서는 약관에 동의해야 합니다.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
