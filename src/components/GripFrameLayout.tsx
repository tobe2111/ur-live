import { ReactNode } from 'react'

interface GripFrameLayoutProps {
  children: ReactNode
}

export default function GripFrameLayout({ children }: GripFrameLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
      {/* Desktop Background Branding Area */}
      <div className="hidden lg:flex fixed inset-0 items-center justify-start px-20">
        <div className="max-w-xl space-y-8 pl-8">
          {/* Logo & Branding */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                  UR Live
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  by 리스터코퍼레이션
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                라이브 커머스의<br />
                새로운 기준
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                셀러와 인플루언서가 만드는<br />
                프리미엄 영상 쇼핑 경험
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-gray-700">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">실시간 라이브 쇼핑</p>
                <p className="text-sm text-gray-500">소통하며 구매하는 재미</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-700">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">숏폼 영상 커머스</p>
                <p className="text-sm text-gray-500">스와이프로 간편하게</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-gray-700">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">안전한 결제 시스템</p>
                <p className="text-sm text-gray-500">토스페이먼츠 연동</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold text-blue-600">1,000+</p>
              <p className="text-sm text-gray-600">셀러 파트너</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-600">10,000+</p>
              <p className="text-sm text-gray-600">누적 거래</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">99%</p>
              <p className="text-sm text-gray-600">고객 만족도</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Frame Container */}
      <div className="relative flex items-center justify-center lg:justify-end min-h-screen lg:pr-20">
        <div className="w-full lg:w-[450px] h-screen lg:h-[calc(100vh-80px)] lg:max-h-[900px] bg-white lg:rounded-3xl lg:shadow-2xl overflow-hidden relative">
          {/* Decorative elements for desktop */}
          <div className="hidden lg:block absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full opacity-20 blur-2xl"></div>
          <div className="hidden lg:block absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full opacity-20 blur-2xl"></div>
          
          {/* Content */}
          <div className="w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
            {children}
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
