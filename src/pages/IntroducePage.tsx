import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Play, ChevronRight, Check, Star, Users, Zap, ShoppingBag, MessageCircle, Bell } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import api from '@/lib/api'
import { onYoutubeThumbError } from '@/utils/youtube-thumb'

const APP_STORE_URL = 'https://apps.apple.com/kr/app/%EC%9C%A0%EC%96%B4%EB%94%9C/id6745051422'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.urdeal.app'

interface LiveStream {
  id: number
  title: string
  seller_name?: string
  viewer_count?: number
  thumbnail_url?: string
  image_url?: string
  youtube_video_id?: string
}

function AppBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black text-white font-bold text-[14px] hover:bg-gray-900 transition-colors border border-white/10"
      >
        {/* Apple logo */}
        <svg className="w-5 h-5 fill-white shrink-0" viewBox="0 0 24 24">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        <div className="text-left">
          <p className="text-[9px] text-white/70 leading-none">Download on the</p>
          <p className="text-[14px] font-extrabold leading-tight">App Store</p>
        </div>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-black text-white font-bold text-[14px] hover:bg-gray-900 transition-colors border border-white/10"
      >
        {/* Play Store icon */}
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
          <path fill="#34A853" d="M1.22 0C.8 0 .5.3.5.73v22.54c0 .43.3.73.72.73l.08-.01 12.63-12.63v-.3L1.30.08 1.22 0z"/>
          <path fill="#FBBC04" d="M17.55 16.65l-4.21-4.21v-.3l4.21-4.21.1.05 4.99 2.83c1.42.81 1.42 2.12 0 2.93l-4.99 2.83-.1.08z"/>
          <path fill="#EA4335" d="M17.65 16.60L13.43 12.4 1.22 24.6c.47.5 1.24.56 2.12.06l14.31-8.06"/>
          <path fill="#4285F4" d="M17.65 7.40L3.34 -0.66C2.46-1.16 1.69-1.1 1.22-.6L13.43 11.6l4.22-4.2z"/>
        </svg>
        <div className="text-left">
          <p className="text-[9px] text-white/70 leading-none">GET IT ON</p>
          <p className="text-[14px] font-extrabold leading-tight">Google Play</p>
        </div>
      </a>
    </div>
  )
}

export default function IntroducePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    api.get('/api/streams?status=live')
      .then(r => { if (r.data.success) setLiveStreams(r.data.data?.slice(0, 4) || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const faqs = [
    { q: t('introduce.faq1Q', { defaultValue: '꼭 앱을 설치해야 하나요?' }), a: t('introduce.faq1A', { defaultValue: '웹에서도 라이브 시청과 구매 모두 가능합니다. 단, 라이브 알림·쿠폰 등 기능은 앱에서 더 편하게 이용하실 수 있어요.' }) },
    { q: t('introduce.faq2Q', { defaultValue: '식사권을 샀는데 환불 되나요?' }), a: t('introduce.faq2A', { defaultValue: '구매일로부터 7일 이내·미사용 쿠폰은 100% 환불 가능합니다. 유효기간 내에만 사용하시면 되고, 양도도 자유롭게 하실 수 있어요.' }) },
    { q: t('introduce.faq3Q', { defaultValue: '공구 목표 인원이 안 모이면?' }), a: t('introduce.faq3A', { defaultValue: '공구가 성사되지 않으면 자동으로 결제가 취소되고 전액 환불됩니다.' }) },
    { q: t('introduce.faq4Q', { defaultValue: '라이브는 언제 볼 수 있나요?' }), a: t('introduce.faq4A', { defaultValue: '홈 상단의 "지금 라이브"에서 바로 시청 가능하고, 예정된 라이브는 편성표에서 확인할 수 있어요.' }) },
    { q: t('introduce.faq5Q', { defaultValue: '셀러 입점 조건은?' }), a: t('introduce.faq5A', { defaultValue: '사업자 등록이 된 식당·브랜드라면 누구나 신청 가능합니다. 입점 수수료는 없고 판매 수수료만 부담합니다.' }) },
    { q: t('introduce.faq6Q', { defaultValue: '결제는 어떤 방법이 가능한가요?' }), a: t('introduce.faq6A', { defaultValue: '신용카드·체크카드·계좌이체·간편결제(카카오페이/토스) 모두 지원합니다.' }) },
  ]

  const features = [
    { icon: Play, color: '#EF4444', title: '실시간 라이브', desc: '사장님이 직접 켜는 라이브커머스. 셰프의 요리 과정부터 산지 직송까지 눈으로 확인하세요.' },
    { icon: ShoppingBag, color: '#EC4899', title: '공동구매 특가', desc: '많이 모일수록 할인이 커지는 공구. 최대 50% 할인가로 동네 맛집과 인기 브랜드를 만나보세요.' },
    { icon: MessageCircle, color: '#F59E0B', title: '실시간 소통', desc: '방송 중 채팅으로 사장님께 직접 질문하고 메뉴 추천도 받으세요. 쿠폰 증정 이벤트도 진행돼요.' },
    { icon: Bell, color: '#10B981', title: '알림 · 편성표', desc: '좋아하는 셀러가 라이브를 시작하면 앱으로 즉시 알림. 예정 방송 편성표도 미리 확인하세요.' },
  ]

  return (
    <div className="bg-[#020202] text-white min-h-screen">
      <SEO title={t('introduce.seoTitle', { defaultValue: '유어딜 - 라이브 커머스 맛집 공동구매' })} description={t('introduce.seoDesc', { defaultValue: '사장님이 직접 켜는 라이브커머스. 우리 동네 맛집을 특가로 만나는 가장 빠른 방법.' })} url="/introduce" />

      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur-md border-b border-[#1A1A1A]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-16">
          <button onClick={() => navigate('/')} className="flex items-center">
            <UrDealLogo size={20} forceDark />
          </button>
          <nav className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">기능</a>
            <a href="#live-now" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">라이브</a>
            <a href="#for-sellers" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">셀러 입점</a>
            <a href="#faq" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-extrabold text-white border border-[#2A2A2A] hover:border-[#444] transition-colors"
            >
              앱 다운로드
            </a>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-full text-[13px] font-extrabold text-gray-900 bg-white hover:bg-gray-100 transition-colors"
            >
              시작하기
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        {/* gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D0A14] via-[#020202] to-[#020202] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-red-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] rounded-full bg-pink-600/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-[1280px] mx-auto px-6 pt-20 pb-24 flex flex-col md:flex-row gap-16 items-center">
          {/* left: copy */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-extrabold text-red-400">라이브 커머스 · 공동구매</span>
            </div>
            <h1
              className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.02] text-white"
              style={{ letterSpacing: '-0.04em' }}
            >
              지금 <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500">라이브</span>로<br />
              맛집 만나고,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-pink-500 italic">특가</span>로 먹자.
            </h1>
            <p className="text-[16px] text-gray-400 mt-6 max-w-[480px] leading-relaxed">
              우리 동네 사장님이 직접 라이브 방송을 켭니다.<br />
              실시간 소통하며 식사권·밀키트를 최대 50% 할인가로.
            </p>

            {/* App download buttons */}
            <div className="mt-8">
              <p className="text-[11px] font-bold text-gray-500 tracking-widest mb-3">앱 다운로드</p>
              <AppBadges />
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-gray-900 text-[14px] font-extrabold bg-white hover:bg-gray-100 transition-colors"
              >
                <Play className="w-4 h-4 fill-gray-900" /> 웹에서 바로 시작
              </button>
              <button
                onClick={() => navigate('/browse')}
                className="flex items-center gap-1 text-[14px] font-semibold text-gray-400 hover:text-white transition-colors"
              >
                둘러보기 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 mt-8 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <span><b className="text-white">240만+</b> 누적 사용자</span>
              </div>
              <span className="text-gray-800">|</span>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span><b className="text-white">4.8</b> App Store 평점</span>
              </div>
            </div>
          </div>

          {/* right: phone mockup */}
          <div className="hidden md:flex justify-center shrink-0">
            <div className="relative">
              {/* glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/30 to-pink-500/30 blur-[60px] rounded-full scale-110" />
              {/* phone */}
              <div className="relative w-[260px] h-[520px] bg-[#111] rounded-[44px] p-[10px] shadow-2xl border border-white/10">
                <div className="w-full h-full rounded-[34px] bg-[#0A0A0A] relative overflow-hidden">
                  {/* notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-black rounded-2xl z-20" />
                  {/* live badge */}
                  <div className="absolute top-12 left-4 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-extrabold text-white">LIVE · 1.2K</span>
                  </div>
                  {/* fake video bg */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#2A0A0A] via-[#1A0808] to-black" />
                  {/* bottom product card */}
                  <div className="absolute bottom-4 left-3 right-3 rounded-2xl p-3.5 bg-black/80 backdrop-blur-md border border-white/10 z-10">
                    <p className="text-[11px] font-bold text-white truncate">수제 돈카츠 3팩 세트</p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-[11px] font-extrabold text-red-400">30%</span>
                      <span className="text-[15px] font-extrabold text-white">18,900원</span>
                      <span className="text-[10px] text-gray-500 line-through">26,900원</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-center text-[10px] font-extrabold text-white">바로구매</div>
                      <div className="flex-1 py-1.5 rounded-lg bg-white/10 text-center text-[10px] font-bold text-white">장바구니</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-[#1A1A1A] bg-[#0A0A0A]">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { n: '240만+', l: '누적 사용자' },
            { n: '38만+', l: '누적 거래 건수' },
            { n: '4,200+', l: '입점 셀러' },
            { n: '4.8★', l: 'App Store 평점' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <p className="text-[32px] md:text-[40px] font-black text-white leading-none">{s.n}</p>
              <p className="text-[12px] font-semibold text-gray-500 mt-1.5">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-[11px] font-extrabold text-red-400 tracking-[0.15em] mb-3">WHY URDEAL</p>
          <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            라이브 커머스, 이렇게 다릅니다
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#1A1A1A] hover:border-[#2A2A2A] transition-colors">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: f.color + '20' }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-[16px] font-extrabold text-white mb-2">{f.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── LIVE PREVIEW ─── */}
      <section id="live-now" className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="mb-8">
          <p className="text-[11px] font-extrabold text-red-400 tracking-[0.15em] mb-3">● LIVE NOW</p>
          <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            지금 켜져 있는 라이브
          </h2>
          <p className="text-[15px] text-gray-500 mt-3">사장님이 지금 방송 중이에요. 바로 시청하고 실시간으로 소통해보세요.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(liveStreams.length > 0 ? liveStreams : [
            { id: 0, title: '곧 라이브가 시작됩니다', seller_name: '유어딜' },
            { id: 0, title: '신선한 해산물 특가', seller_name: '수협마켓' },
            { id: 0, title: '수제 디저트 공구', seller_name: '베이커리카페' },
            { id: 0, title: '수제 맥주 라이브', seller_name: '크래프트비어' },
          ] as LiveStream[]).map((s, idx) => (
            <button
              key={`${s.id}-${idx}`}
              onClick={() => s.id ? navigate(`/live/${s.id}`) : undefined}
              className="block rounded-2xl overflow-hidden border border-[#1A1A1A] hover:border-[#2A2A2A] transition-all hover:scale-[1.02]"
            >
              <div className="aspect-[3/4] relative bg-gradient-to-br from-[#1A0808] to-[#0A0A0A]">
                {(s.thumbnail_url || s.youtube_video_id) && (
                  <img
                    src={s.thumbnail_url || `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={onYoutubeThumbError}
                  />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.4), transparent 35%, rgba(0,0,0,0.85))' }} />
                {s.viewer_count != null && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500">
                    <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    <span className="text-[9px] font-bold text-white">LIVE</span>
                  </div>
                )}
                {!s.id && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-600">
                    <span className="text-[9px] font-bold text-white">예정</span>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="text-[12px] font-bold text-white line-clamp-2 leading-tight">{s.title}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{s.seller_name}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/live')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-[#2A2A2A] text-[13px] font-bold text-gray-300 hover:border-[#444] hover:text-white transition-colors"
          >
            전체 라이브 보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="bg-[#0A0A0A] border-y border-[#1A1A1A]">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-[11px] font-extrabold text-red-400 tracking-[0.15em] mb-3">HOW IT WORKS</p>
            <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              라이브 켜고, 보고, 사고, 먹기.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', emoji: '👀', title: '라이브 시청', desc: '홈에서 지금 방송 중인 사장님 라이브를 바로 시청하세요. 실시간 채팅으로 질문도 하고, 메뉴 추천도 받을 수 있어요.' },
              { n: '02', emoji: '🛒', title: '식사권 공구', desc: '라이브 중 소개된 식사권·밀키트를 최대 50% 할인가로. 공구 인원이 모일수록 할인폭이 커져요.' },
              { n: '03', emoji: '🍽️', title: '매장 방문·사용', desc: '구매한 쿠폰을 매장에서 제시하고 맛있게 드세요. 배송 상품은 집에서 바로 받아볼 수 있어요.' },
            ].map(s => (
              <div key={s.n} className="relative p-8 rounded-3xl bg-[#111] border border-[#1A1A1A] overflow-hidden">
                <div className="absolute -top-4 -right-2 text-[100px] font-black opacity-[0.04] text-white select-none">{s.n}</div>
                <p className="text-[36px] mb-5">{s.emoji}</p>
                <h3 className="text-[20px] font-extrabold text-white mb-3">{s.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── APP DOWNLOAD CTA ─── */}
      <section className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="rounded-[32px] p-10 md:p-16 relative overflow-hidden bg-gradient-to-br from-[#EF4444] to-[#EC4899]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/4 w-[200px] h-[200px] rounded-full bg-white/5 translate-y-1/2" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 mb-5">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span className="text-[12px] font-extrabold text-white">앱에서 진짜 시작돼요</span>
            </div>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white leading-tight mb-3" style={{ letterSpacing: '-0.03em' }}>
              지금 시작하면<br />첫 라이브 시청 시<br /><span className="opacity-90">5,000원 쿠폰</span> 🎁
            </h2>
            <p className="text-[15px] text-white/80 mb-8">전화번호만 있으면 3초 만에 시작할 수 있어요.</p>
            <AppBadges />
            <button
              onClick={() => navigate('/')}
              className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-white/70 hover:text-white transition-colors"
            >
              웹에서 바로 시작하기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOR SELLERS ─── */}
      <section id="for-sellers" className="bg-[#0A0A0A] border-t border-[#1A1A1A]">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="max-w-[680px]">
            <p className="text-[11px] font-extrabold text-red-400 tracking-[0.15em] mb-3">FOR SELLERS</p>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>
              우리 가게, 오늘부터<br />라이브커머스 맛집.
            </h2>
            <div className="space-y-5 mb-10">
              {[
                { title: '입점 수수료 0원, 판매 수수료만', desc: '판매되는 만큼만 부담해요. 가입비·월 고정비 없습니다.' },
                { title: '에이전시 매칭으로 방송 대행까지', desc: '직접 방송하기 어렵다면 검증된 에이전시가 도와줘요.' },
                { title: '당일 정산, 셀러 대시보드 제공', desc: '실시간 KPI · 주문 모니터링 · 리뷰 관리까지 한 곳에서.' },
              ].map(b => (
                <div key={b.title} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-red-400" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-[16px] font-extrabold text-white">{b.title}</p>
                    <p className="text-[13px] text-gray-500 mt-1">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/seller/register')}
                className="px-6 py-3.5 rounded-2xl text-white text-[14px] font-extrabold bg-gradient-to-r from-red-500 to-pink-500 hover:opacity-90 transition-opacity"
              >
                입점 신청하기 →
              </button>
              <button
                onClick={() => navigate('/seller/login')}
                className="px-6 py-3.5 rounded-2xl text-[14px] font-extrabold text-white bg-[#1A1A1A] hover:bg-[#222] transition-colors border border-[#2A2A2A]"
              >
                셀러 로그인
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="max-w-[820px] mx-auto px-6 py-20">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-extrabold text-red-400 tracking-[0.15em] mb-3">FAQ</p>
          <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            궁금한 거 다 풀어드려요.
          </h2>
        </div>
        <div className="space-y-1">
          {faqs.map((f, i) => (
            <div key={i} className="border border-[#1A1A1A] rounded-2xl overflow-hidden">
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full flex items-center justify-between text-left px-5 py-4.5 hover:bg-[#0D0D0D] transition-colors"
                style={{ padding: '18px 20px' }}
              >
                <span className="text-[15px] font-bold text-white">{f.q}</span>
                <span
                  className="text-[20px] text-gray-500 shrink-0 ml-4 transition-transform duration-200"
                  style={{ transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}
                >
                  ＋
                </span>
              </button>
              {faqOpen === i && (
                <div className="px-5 pb-5 text-[14px] text-gray-400 leading-relaxed">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#1A1A1A] bg-[#0A0A0A]">
        <div className="max-w-[1280px] mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 mb-10">
            <div>
              <div className="mb-4">
                <UrDealLogo size={22} forceDark />
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed max-w-[320px]">
                사장님이 직접 켜는 라이브커머스.<br />우리 동네 맛집을 특가로 만나는 가장 빠른 방법.
              </p>
            </div>
            <div>
              <p className="text-[12px] font-bold text-gray-400 mb-4">앱 다운로드</p>
              <AppBadges />
            </div>
          </div>

          <div className="pt-8 border-t border-[#1A1A1A] text-[11px] text-gray-600 leading-relaxed">
            <p className="mb-1.5"><b className="text-gray-400">리스터코퍼레이션</b> · 대표: 정지원 · 사업자등록번호: 479-09-02930</p>
            <p className="mb-5">부산광역시 금정구 놀이마당로26 1402 · 고객센터: 0507-0177-0432 (평일 09:00~18:00)</p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => navigate('/terms')} className="text-gray-600 hover:text-gray-300 transition-colors">이용약관</button>
              <button onClick={() => navigate('/privacy')} className="text-gray-600 hover:text-gray-300 font-bold transition-colors">개인정보처리방침</button>
              <button onClick={() => navigate('/refund')} className="text-gray-600 hover:text-gray-300 transition-colors">배송/환불</button>
            </div>
            <p className="mt-4 text-gray-700">© 2026 리스터코퍼레이션. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
