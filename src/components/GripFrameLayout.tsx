import { ReactNode } from 'react'
import { Download, Mail } from 'lucide-react'
import { useLocation } from 'react-router-dom'

interface GripFrameLayoutProps {
  children: ReactNode
}

export default function GripFrameLayout({ children }: GripFrameLayoutProps) {
  const location = useLocation()
  const isIntroducePage = location.pathname === '/introduce'
  const isLivePage = location.pathname.startsWith('/live/')
  
  return (
    <>
      {/* Desktop Only: Grip Frame with Branding */}
      <div className="hidden lg:block">
        <div className="min-h-screen bg-black relative overflow-hidden">
          {/* Desktop Background Branding Area */}
          <div className="flex fixed inset-0 items-start justify-center pt-8 pb-8 overflow-y-auto">
            <div className="flex items-start justify-center gap-12 w-full max-w-7xl px-8 min-h-full">
              {/* Left Branding Column */}
              <div className="w-[500px] space-y-6 animate-fade-in-up flex-shrink-0">
                {/* Logo & Branding */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-4xl font-black text-white tracking-tight">
                        UR Live
                      </h1>
                      <p className="text-lg text-purple-300 font-medium">
                        by 리스터코퍼레이션
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-3xl font-bold text-white leading-tight">
                      라이브 커머스의<br />
                      새로운 기준
                    </h2>
                    <p className="text-lg text-purple-200 leading-relaxed">
                      셀러와 인플루언서가 만드는<br />
                      프리미엄 영상 쇼핑 경험
                    </p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-sm border border-purple-400/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">실시간 라이브 쇼핑</p>
                      <p className="text-sm text-purple-300">소통하며 구매하는 재미</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-sm border border-purple-400/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">숏폼 영상 커머스</p>
                      <p className="text-sm text-purple-300">스와이프로 간편하게</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 backdrop-blur-sm border border-purple-400/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">안전한 결제 시스템</p>
                      <p className="text-sm text-purple-300">토스페이먼츠 연동</p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-purple-400">1,000+</p>
                    <p className="text-xs text-purple-300">셀러 파트너</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-violet-400">10,000+</p>
                    <p className="text-xs text-purple-300">누적 거래</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-indigo-400">99%</p>
                    <p className="text-xs text-purple-300">고객 만족도</p>
                  </div>
                </div>

                {/* Company Profile Download */}
                <div className="pt-4 space-y-3">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      alert('회사소개서 다운로드 기능은 준비 중입니다.')
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-purple-500/50 transition-all duration-300 hover:scale-105"
                  >
                    <Download className="w-4 h-4" />
                    회사소개서 다운로드
                  </a>
                </div>

                {/* Contact */}
                <div className="pt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-purple-200">
                    <Mail className="w-3 h-3" />
                    <p style={{ fontSize: '9px', lineHeight: '1.2' }}>
                      <span className="text-purple-300 font-medium">제휴 | 입점 문의</span>
                      <span className="text-white"> : </span>
                      <a href="mailto:jiwon@ur-team.com" className="text-purple-400 hover:text-purple-300 underline">
                        jiwon@ur-team.com
                      </a>
                    </p>
                  </div>
                </div>

                {/* Footer Information */}
                <div className="pt-2 space-y-1.5 text-purple-300/80 border-t border-purple-500/30">
                  <div className="flex gap-2 flex-wrap" style={{ fontSize: '7px', lineHeight: '1.3' }}>
                    <a href="/terms" className="hover:text-purple-200 transition">서비스 이용약관</a>
                    <span>|</span>
                    <a href="/privacy" className="hover:text-purple-200 transition">개인정보처리방침</a>
                    <span>|</span>
                    <a href="/refund" className="hover:text-purple-200 transition">배송 및 환불 정책</a>
                  </div>
                  
                  <div className="space-y-0.5" style={{ fontSize: '7px', lineHeight: '1.3' }}>
                    <p>상호명: 리스터코퍼레이션 | 대표자: 정지원</p>
                    <p>사업자등록번호: 479-09-02930 | 통신판매업신고: 2025-부산금정-0540</p>
                    <p>사업장주소: 부산광역시 금정구 놀이마당로26 1402</p>
                    <p>대표전화: 0507-0177-0432 | 대표이메일: jiwon@ur-team.com</p>
                    <p>서비스 제공 기간: 상품 구매 후 평균 7일 이내 배송 완료</p>
                  </div>
                  
                  <p className="pt-1" style={{ fontSize: '7px', lineHeight: '1.3' }}>© 2026 리스터코퍼레이션. All rights reserved.</p>
                </div>
              </div>

              {/* Right - Mobile Frame */}
              <div className="w-[360px] h-[780px] relative">
                <div className={`w-full h-full ${isLivePage ? 'bg-black' : 'bg-white'} rounded-3xl shadow-2xl shadow-purple-900/50 overflow-hidden relative border-4 border-purple-900/30`}>
                  {/* Glow effect */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 rounded-3xl blur opacity-20"></div>
                  
                  {/* Content */}
                  <div className={`relative w-full h-full overflow-y-auto overflow-x-hidden scrollbar-hide ${isLivePage ? 'bg-black' : 'bg-white'} rounded-3xl`}>
                    {isIntroducePage ? (
                      // introduce 페이지일 때는 메인 페이지를 iframe으로 표시
                      <iframe
                        src="/"
                        title="UR Live Main"
                        className="w-full h-full border-0"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                      />
                    ) : (
                      // 다른 페이지는 children 렌더링
                      children
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Full Screen (No Frame) */}
      <div className="lg:hidden w-full min-h-screen">
        {children}
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out;
        }

        @keyframes animateStars {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-2000px);
          }
        }
      `}</style>
    </>
  )
}
