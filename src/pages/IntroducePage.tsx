import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function IntroducePage() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // 모바일 기기에서는 메인 페이지로 리다이렉트
    const isMobile = window.innerWidth < 1024 // lg breakpoint
    if (isMobile) {
      navigate('/', { replace: true })
    }
  }, [navigate])
  
  // PC용 브랜딩 페이지
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            UR-Live
          </h1>
          <p className="text-2xl text-gray-700 mb-4">
            라이브 커머스의 새로운 기준
          </p>
          <p className="text-lg text-gray-600 mb-12">
            실시간 소통과 쇼핑을 하나로, UR-Live에서 경험하세요
          </p>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              지금 시작하기
            </button>
            <button 
              onClick={() => navigate('/seller/register')}
              className="px-8 py-4 bg-white text-purple-600 border-2 border-purple-600 rounded-full font-semibold text-lg hover:bg-purple-50 transition-all"
            >
              셀러 등록
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="text-3xl">🎥</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-center">실시간 라이브</h3>
            <p className="text-gray-600 text-center">
              판매자와 실시간으로 소통하며 상품을 구매하는 새로운 쇼핑 경험
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="text-3xl">💰</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-center">특가 혜택</h3>
            <p className="text-gray-600 text-center">
              라이브 방송 중에만 제공되는 독점 할인과 특별 프로모션
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-xl font-bold mb-4 text-center">간편한 결제</h3>
            <p className="text-gray-600 text-center">
              토스페이먼츠 연동으로 안전하고 빠른 결제 프로세스
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">100+</div>
              <div className="text-gray-600">활동 셀러</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">1,000+</div>
              <div className="text-gray-600">등록 상품</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">10,000+</div>
              <div className="text-gray-600">총 구매자</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">99%</div>
              <div className="text-gray-600">만족도</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-center text-white max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">
            지금 바로 시작하세요
          </h2>
          <p className="text-xl mb-8 opacity-90">
            UR-Live와 함께 새로운 쇼핑 경험을 만들어보세요
          </p>
          <button 
            onClick={() => navigate('/')}
            className="px-10 py-4 bg-white text-purple-600 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all transform hover:-translate-y-1 shadow-xl"
          >
            무료로 시작하기 →
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-4">
            <span className="text-2xl font-bold text-white">UR-Live</span>
          </div>
          <div className="space-x-6 mb-4">
            <a href="/terms" className="hover:text-white transition-colors">이용약관</a>
            <a href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</a>
            <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="text-sm">
            © 2026 UR-Live. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
