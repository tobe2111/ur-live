import { useNavigate } from 'react-router-dom'
import { Play, ShoppingBag, Utensils, Users, Zap, Bell, Gift, MapPin, Star, Heart, Trophy, Gavel, Timer, Share2, ArrowRight, ChevronDown } from 'lucide-react'

const FEATURES = [
  {
    icon: Play, color: 'from-red-500 to-pink-500',
    title: '라이브 커머스',
    desc: '인플루언서 라이브 방송에서 실시간 소통하며 구매. 채팅으로 질문하고 바로 결제.',
  },
  {
    icon: Utensils, color: 'from-orange-500 to-red-500',
    title: '맛집 공동구매',
    desc: '인플루언서 추천 맛집 식사권을 최대 70% 할인. 바우처 코드로 간편 사용.',
  },
  {
    icon: Gavel, color: 'from-amber-500 to-orange-500',
    title: '라이브 경매',
    desc: '라이브 방송 중 실시간 입찰. 다른 시청자와 경쟁하며 최저가 낙찰.',
  },
  {
    icon: Zap, color: 'from-pink-500 to-red-500',
    title: '타임딜',
    desc: '방송 중 불시에 등장하는 한정 수량 초특가. 10초 안에 잡아야 내 것.',
  },
  {
    icon: Users, color: 'from-blue-500 to-purple-500',
    title: '친구 초대 할인',
    desc: '카카오로 친구를 초대하면 함께 할인! 3명 모이면 10% 추가 할인.',
  },
  {
    icon: MapPin, color: 'from-green-500 to-emerald-500',
    title: '맛집 지도',
    desc: '바우처 사용 가능 맛집을 카카오맵에서 탐색. 내 주변 맛집 한눈에.',
  },
  {
    icon: Heart, color: 'from-pink-400 to-rose-500',
    title: '후원 & 서포터',
    desc: '좋아하는 셀러에게 딜 포인트로 후원. Top 서포터 👑💎⭐ 뱃지 획득.',
  },
  {
    icon: Gift, color: 'from-violet-500 to-purple-500',
    title: '리뷰 리워드',
    desc: '리뷰 작성하면 딜 포인트 지급. 텍스트 50딜, 사진 100딜, 영상 200딜.',
  },
  {
    icon: Bell, color: 'from-cyan-500 to-blue-500',
    title: '방송 알림',
    desc: '관심 셀러 방송 시작 시 즉시 알림. 카카오 알림톡 + 인앱 알림.',
  },
]

const SELLER_FEATURES = [
  { icon: '📺', title: 'YouTube 연동', desc: 'YouTube 계정만 있으면 바로 라이브 방송 시작' },
  { icon: '🏪', title: '내 스토어', desc: '/profile/내이름 으로 자기만의 브랜드 페이지' },
  { icon: '📊', title: '대시보드', desc: '매출/주문/재고 실시간 통계 + 정산 관리' },
  { icon: '🎯', title: '경매 & 타임딜', desc: '라이브 중 경매/타임딜로 시청자 참여 극대화' },
  { icon: '📱', title: '알림톡', desc: '팬들에게 직접 카카오 알림톡 마케팅' },
  { icon: '🌍', title: '6개국 언어', desc: '한국어/영어/일본어/중국어/스페인어/프랑스어' },
]

export default function IntroducePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#020202] text-white overflow-x-hidden">
      {/* ═══ Hero ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center">
        {/* 배경 그라데이션 */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-pink-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-32 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* 로고 */}
          <div className="mb-8">
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 bg-clip-text text-transparent">유어딜</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-400 mt-3 font-medium">YOUR DEAL — Live Commerce</p>
          </div>

          {/* 메인 카피 */}
          <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight mb-6">
            인플루언서 라이브 방송으로<br/>
            <span className="text-pink-500">최저가 맛집 · 특가 상품</span>을<br/>
            공동구매하세요
          </h2>

          <p className="text-gray-400 text-base sm:text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            실시간 소통 · 라이브 경매 · 타임딜 · 친구 초대 할인<br/>
            지금까지 없던 쇼핑 경험
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-pink-500/25 active:scale-[0.97] transition-transform"
            >
              지금 시작하기
            </button>
            <button
              onClick={() => navigate('/seller/register')}
              className="px-8 py-4 bg-white/10 backdrop-blur border border-white/20 text-white rounded-2xl font-bold text-lg active:scale-[0.97] transition-transform"
            >
              셀러로 입점하기
            </button>
          </div>

          {/* 플랫폼 뱃지 */}
          <div className="flex items-center justify-center gap-4 mt-8 text-xs text-gray-500">
            <span className="flex items-center gap-1">🌐 웹</span>
            <span className="flex items-center gap-1">📱 iOS</span>
            <span className="flex items-center gap-1">🤖 Android</span>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-500" />
        </div>
      </section>

      {/* ═══ 핵심 가치 ═══ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-pink-500 font-bold text-sm mb-2">WHY 유어딜?</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">쇼핑의 새로운 기준</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 서비스 흐름 ═══ */}
      <section className="py-20 px-6 bg-gradient-to-b from-transparent via-pink-500/5 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-pink-500 font-bold text-sm mb-2">HOW IT WORKS</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">이렇게 쇼핑해요</h2>
          </div>

          <div className="space-y-8">
            {[
              { step: '01', title: '라이브 방송 시청', desc: '좋아하는 인플루언서의 라이브 방송에 입장. 실시간 채팅으로 상품 질문.', emoji: '📺' },
              { step: '02', title: '경매 · 타임딜 참여', desc: '방송 중 등장하는 실시간 경매와 한정 타임딜에 참여. 최저가 도전!', emoji: '⚡' },
              { step: '03', title: '친구와 함께 할인', desc: '카카오로 친구를 초대하면 3명 달성 시 10% 추가 할인 적용.', emoji: '👫' },
              { step: '04', title: '간편 결제 & 배송', desc: '토스페이먼츠로 원클릭 결제. 맛집 바우처는 코드로 즉시 사용.', emoji: '💳' },
            ].map((item, i) => (
              <div key={i} className="flex gap-5 items-start">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/20">
                  {item.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-pink-500">STEP {item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 셀러 섹션 ═══ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold text-sm mb-2">FOR SELLERS</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">셀러라면, 유어딜</h2>
            <p className="text-gray-400 mt-3">YouTube 계정 하나로 바로 판매 시작</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {SELLER_FEATURES.map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                <span className="text-3xl block mb-3">{f.icon}</span>
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => navigate('/seller/register')}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/25 active:scale-[0.97] transition-transform"
            >
              무료로 셀러 등록 <ArrowRight className="w-5 h-5 inline ml-1" />
            </button>
            <p className="text-xs text-gray-500 mt-3">가입 즉시 판매 시작 · 기본 수수료 15%</p>
          </div>
        </div>
      </section>

      {/* ═══ 수수료 ═══ */}
      <section className="py-20 px-6 bg-white/[0.02]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-green-500 font-bold text-sm mb-2">PRICING</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">투명한 수수료</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <ShoppingBag className="w-8 h-8 text-pink-500 mx-auto mb-3" />
              <p className="text-3xl font-black text-white">15%</p>
              <p className="text-sm text-gray-400 mt-1">상품 판매</p>
              <p className="text-xs text-gray-600 mt-2">등급별 8%까지 인하</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <Utensils className="w-8 h-8 text-orange-500 mx-auto mb-3" />
              <p className="text-3xl font-black text-white">5%</p>
              <p className="text-sm text-gray-400 mt-1">맛집 바우처</p>
              <p className="text-xs text-gray-600 mt-2">소상공인 우대</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <Heart className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-3xl font-black text-white">15%</p>
              <p className="text-sm text-gray-400 mt-1">후원</p>
              <p className="text-xs text-gray-600 mt-2">1딜 = 1원</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-6">
            라이브 쇼핑의 미래,<br/>
            <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">지금 시작하세요</span>
          </h2>
          <p className="text-gray-400 mb-10">소비자도, 셀러도, 맛집도 모두 환영합니다</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-10 py-4 bg-white text-gray-900 rounded-2xl font-bold text-lg active:scale-[0.97] transition-transform"
            >
              쇼핑하러 가기
            </button>
            <button
              onClick={() => navigate('/seller/register')}
              className="px-10 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-lg active:scale-[0.97] transition-transform"
            >
              셀러 입점 신청
            </button>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xl font-black bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">유어딜</p>
              <p className="text-xs text-gray-600 mt-1">리스터코퍼레이션 | 대표: 이준의</p>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="/terms" className="hover:text-white transition-colors">이용약관</a>
              <a href="/privacy" className="hover:text-white transition-colors">개인정보처리방침</a>
              <a href="/shipping-policy" className="hover:text-white transition-colors">배송정책</a>
              <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-gray-600">
            © 2026 유어딜 (UR-Deal). All rights reserved. Powered by 리스터코퍼레이션
          </div>
        </div>
      </footer>
    </div>
  )
}
