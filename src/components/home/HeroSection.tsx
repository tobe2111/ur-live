import { Link } from 'react-router-dom'
import { Play, Sparkles, Zap, ChevronRight, Circle, Users, ShoppingBag, Gift } from 'lucide-react'

interface HeroSectionProps {
  liveStreamCount: number
  onShopNowClick: () => void
}

export function HeroSection({ liveStreamCount, onShopNowClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-yellow-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(138,90,205,0.08),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(255,215,0,0.08),transparent_50%)]"></div>
      
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 md:py-28 lg:py-36">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="text-left space-y-8">
            {/* Eyebrow */}
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-[#6A5ACD]/10 to-[#FFD700]/10 px-4 py-2 rounded-full border border-[#6A5ACD]/20">
              <Sparkles className="h-4 w-4 text-[#6A5ACD]" />
              <span className="text-sm font-bold text-[#6A5ACD]">
                새로운 쇼핑 경험
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight">
              <span className="text-gray-900">누구나 쉽고</span>
              <br />
              <span className="text-gray-900">간편하게</span>
              <br />
              <span className="bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#6A5ACD] bg-clip-text text-transparent">
                라이브 커머스 시작
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl sm:text-2xl text-gray-600 font-medium leading-relaxed">
              YouTube & TikTok 영상으로<br className="sm:hidden" /> 보는 순간 바로 구매!
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button 
                onClick={onShopNowClick}
                className="group relative w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] hover:from-[#FFC700] hover:to-[#FF9500] text-gray-900 font-bold text-lg rounded-2xl shadow-2xl hover:shadow-[0_20px_50px_rgba(255,215,0,0.4)] transition-all duration-300 transform hover:scale-105"
              >
                <span className="flex items-center justify-center space-x-2">
                  <Play className="h-5 w-5 fill-current" />
                  <span>영상 쇼핑 시작하기</span>
                </span>
              </button>
              
              <Link 
                to="/seller/login"
                className="group w-full sm:w-auto px-8 py-4 bg-white hover:bg-gray-50 text-[#6A5ACD] font-bold text-lg rounded-2xl border-2 border-[#6A5ACD] transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <Zap className="h-5 w-5" />
                <span>판매자 시작하기</span>
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-8 pt-4">
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-red-500 to-pink-500 animate-pulse">
                  <Circle className="h-5 w-5 text-white fill-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{liveStreamCount}</div>
                  <div className="text-sm text-gray-600">라이브 진행 중</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500]">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">1,000+</div>
                  <div className="text-sm text-gray-600">활성 사용자</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-[#6A5ACD] to-[#9370DB]">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">5,000+</div>
                  <div className="text-sm text-gray-600">성공 거래</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: 3D Illustration Placeholder */}
          <div className="relative hidden lg:block">
            <div className="relative w-full aspect-square max-w-xl mx-auto">
              {/* 3D Style Background Elements */}
              <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-3xl transform rotate-12 opacity-20 blur-xl animate-pulse"></div>
              <div className="absolute bottom-10 left-10 w-40 h-40 bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] rounded-3xl transform -rotate-12 opacity-20 blur-xl animate-pulse delay-75"></div>
              
              {/* Main 3D Card */}
              <div className="relative z-10 w-full h-full bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 transform hover:scale-105 transition-all duration-300">
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  {/* Icon Cluster */}
                  <div className="relative">
                    <div className="flex items-center justify-center h-32 w-32 rounded-3xl bg-gradient-to-br from-[#FFD700] to-[#FFA500] shadow-2xl">
                      <Play className="h-16 w-16 text-white fill-white" />
                    </div>
                    <div className="absolute -top-4 -right-4 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-[#6A5ACD] to-[#9370DB] shadow-xl">
                      <ShoppingBag className="h-10 w-10 text-white" />
                    </div>
                    <div className="absolute -bottom-4 -left-4 flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 shadow-xl">
                      <Gift className="h-10 w-10 text-white" />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900">영상 쇼핑</h3>
                    <p className="text-gray-600">보는 순간 바로 구매</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
