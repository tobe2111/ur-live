import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Play, ChevronRight, Check, Star, Users } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import api from '@/lib/api'

interface LiveStream { id: number; title: string; seller_name?: string; viewer_count?: number; thumbnail_url?: string; image_url?: string; youtube_video_id?: string }

export default function IntroducePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([])
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    api.get('/api/streams?status=live').then(r => { if (r.data.success) setLiveStreams(r.data.data?.slice(0, 4) || []) }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const faqs = [
    { q: t('introduce.faq1Q', { defaultValue: '꼭 앱을 설치해야 하나요?' }), a: t('introduce.faq1A', { defaultValue: '네, 웹에서도 라이브 시청과 구매 모두 가능합니다. 단, 라이브 알림·쿠폰 등 기능은 앱에서 더 편하게 이용하실 수 있어요.' }) },
    { q: t('introduce.faq2Q', { defaultValue: '식사권을 샀는데 환불 되나요?' }), a: t('introduce.faq2A', { defaultValue: '구매일로부터 7일 이내·미사용 쿠폰은 100% 환불 가능합니다. 유효기간 내에만 사용하시면 되고, 양도도 자유롭게 하실 수 있어요.' }) },
    { q: t('introduce.faq3Q', { defaultValue: '공구 목표 인원이 안 모이면?' }), a: t('introduce.faq3A', { defaultValue: '공구가 성사되지 않으면 자동으로 결제가 취소되고 전액 환불됩니다.' }) },
    { q: t('introduce.faq4Q', { defaultValue: '라이브는 언제 볼 수 있나요?' }), a: t('introduce.faq4A', { defaultValue: '홈 상단의 "지금 라이브"에서 바로 시청 가능하고, 예정된 라이브는 편성표에서 확인할 수 있어요.' }) },
    { q: t('introduce.faq5Q', { defaultValue: '셀러 입점 조건은?' }), a: t('introduce.faq5A', { defaultValue: '사업자 등록이 된 식당·브랜드라면 누구나 신청 가능합니다. 입점 수수료는 없고 판매 수수료만 부담합니다.' }) },
    { q: t('introduce.faq6Q', { defaultValue: '결제는 어떤 방법이 가능한가요?' }), a: t('introduce.faq6A', { defaultValue: '신용카드·체크카드·계좌이체·간편결제(카카오페이/토스) 모두 지원합니다.' }) },
  ]

  return (
    <div className="bg-white dark:bg-[#0A0A0A] min-h-screen">
      <SEO title="유어딜 - 라이브 커머스 맛집 공동구매" description="사장님이 직접 켜는 라이브커머스. 우리 동네 맛집을 특가로 만나는 가장 빠른 방법." url="/introduce" />

      {/* ═══ NAV ═══ */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#0A0A0A]/90 backdrop-blur-md border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-16">
          <button onClick={() => navigate('/')} className="flex items-center">
            <UrDealLogo size={20} />
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { key: t('introduce.navLiveNow', { defaultValue: '지금 라이브' }), href: '#지금 라이브' },
              { key: t('introduce.navHowTo', { defaultValue: '어떻게 쓰나요' }), href: '#어떻게 쓰나요' },
              { key: t('introduce.navSellerJoin', { defaultValue: '셀러 입점' }), href: '#셀러 입점' },
            ].map(item => (
              <a key={item.key} href={item.href} className="px-3 py-2 text-[14px] font-semibold text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white">{item.key}</a>
            ))}
          </nav>
          <button onClick={() => navigate('/login')} className="px-4 py-2 rounded-full text-[13px] font-extrabold text-white bg-gray-900 dark:bg-white dark:text-gray-900">{t('introduce.navStart', { defaultValue: '시작하기' })}</button>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white dark:from-[#0A0A0A] to-[#FFF5F7] dark:to-[#1A0A0E]">
        <div className="max-w-[1280px] mx-auto px-6 py-20 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-extrabold text-red-500">{t('introduce.heroLiveCount', { count: liveStreams.length || 0, defaultValue: '지금 {{count}}명이 라이브 시청 중' })}</span>
            </div>
            <h1 className="text-[clamp(36px,5vw,64px)] font-black leading-[1.05] text-gray-900 dark:text-white" style={{ letterSpacing: '-0.035em' }}>
              지금 <span className="text-red-500">라이브</span>로<br/>맛집 만나고,<br/><span className="italic text-red-500">특가</span>로 먹자.
            </h1>
            <p className="text-[16px] text-gray-500 dark:text-gray-400 mt-6 max-w-[480px] leading-relaxed">
              {t('introduce.heroDesc', { defaultValue: '우리 동네 맛집 사장님이 직접 라이브 방송을 켭니다. 실시간 소통하며 식사권·밀키트를 최대 50% 할인가로 공구하세요.' })}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white text-[15px] font-extrabold bg-gray-900 dark:bg-white dark:text-gray-900 shadow-lg">
                <Play className="w-4 h-4 fill-white dark:fill-gray-900" /> {t('introduce.heroCtaStart', { defaultValue: '지금 시작하기' })}
              </button>
              <button onClick={() => navigate('/browse')} className="px-5 py-3.5 text-[14px] font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                {t('introduce.heroBrowse', { defaultValue: '둘러보기' })} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-5 mt-8 text-[12px] text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span><b className="text-gray-900 dark:text-white">{t('introduce.usersCount', { defaultValue: '240만+' })}</b> {t('introduce.heroUsersDesc', { defaultValue: '명이 쓰고 있어요' })}</span>
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                <span><b className="text-gray-900 dark:text-white">4.8</b> App Store</span>
              </div>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="w-[280px] h-[560px] bg-gray-900 rounded-[40px] p-2 shadow-2xl">
              <div className="w-full h-full rounded-[32px] bg-gradient-to-br from-red-900/30 to-pink-900/30 relative overflow-hidden">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[90px] h-[24px] bg-black rounded-2xl z-20" />
                <div className="absolute top-14 left-4 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500 z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-bold text-white">LIVE · 1.2K</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 rounded-2xl p-3 bg-black/80 backdrop-blur-md border border-white/10 z-10">
                  <p className="text-[11px] font-bold text-white truncate">수제 돈카츠 3팩 · 30%</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[10px] font-extrabold text-red-400">30%</span>
                    <span className="text-[12px] font-extrabold text-white">18,900원</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ NUMBERS ═══ */}
      <section className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: t('introduce.usersCount', { defaultValue: '240만+' }), l: t('introduce.statUsers', { defaultValue: '누적 사용자' }) },
            { n: t('introduce.dealsCount', { defaultValue: '38만+' }), l: t('introduce.statDeals', { defaultValue: '누적 거래 건수' }) },
            { n: t('introduce.sellersCount', { defaultValue: '4,200+' }), l: t('introduce.statSellers', { defaultValue: '입점 식당·브랜드' }) },
            { n: t('introduce.ratingValue', { defaultValue: '4.8점' }), l: t('introduce.statRating', { defaultValue: 'App Store 평점 ★' }) },
          ].map(s => (
            <div key={s.l} className="p-6 rounded-2xl bg-gray-50 dark:bg-[#1C1C1E]">
              <p className="text-[28px] md:text-[36px] font-black text-gray-900 dark:text-white leading-none">{s.n}</p>
              <p className="text-[13px] font-bold text-gray-600 dark:text-gray-400 mt-2">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ LIVE PREVIEW ═══ */}
      <section id="지금 라이브" className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="mb-8">
          <p className="text-[12px] font-extrabold text-red-500 tracking-widest mb-2">● LIVE NOW</p>
          <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-gray-900 dark:text-white" style={{ letterSpacing: '-0.03em' }}>{t('introduce.liveNowLabel', { defaultValue: '지금 켜져 있는 라이브' })}</h2>
          <p className="text-[16px] text-gray-500 dark:text-gray-400 mt-3">{t('introduce.liveNowDesc', { defaultValue: '사장님이 지금 방송 중이에요. 바로 시청하고 실시간으로 소통해보세요.' })}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(liveStreams.length > 0 ? liveStreams : [{id:0,title:'곧 라이브가 시작됩니다',seller_name:'유어딜'} as LiveStream]).map(s => (
            <button key={s.id} onClick={() => s.id && navigate(`/live/${s.id}`)} className="block rounded-2xl overflow-hidden border border-gray-100 dark:border-[#2A2A2A] hover:shadow-lg transition-shadow">
              <div className="aspect-[4/5] relative bg-gradient-to-br from-gray-800 to-gray-900">
                {(s.thumbnail_url || s.youtube_video_id) && (
                  <img src={s.thumbnail_url || `https://img.youtube.com/vi/${s.youtube_video_id}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent 30%, rgba(0,0,0,0.9))' }} />
                {s.viewer_count != null && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span className="text-[10px] font-bold text-white">LIVE</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-[13px] font-bold text-white line-clamp-2">{s.title}</p>
                  <p className="text-[11px] text-white/70 mt-1">{s.seller_name || t('introduce.sellerDefault', { defaultValue: '셀러' })}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="어떻게 쓰나요" className="max-w-[1280px] mx-auto px-6 py-16">
        <p className="text-[12px] font-extrabold text-red-500 tracking-widest mb-2">{t('introduce.howLabel', { defaultValue: '어떻게 쓰나요' })}</p>
        <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-gray-900 dark:text-white mb-12" style={{ letterSpacing: '-0.03em' }}>{t('introduce.howTitle', { defaultValue: '라이브 켜고, 보고, 사고, 먹기.' })}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { step: '1', emoji: '👀', title: t('introduce.step1Title', { defaultValue: '라이브 시청' }), desc: t('introduce.step1Desc', { defaultValue: '홈에서 지금 방송 중인 사장님 라이브를 바로 시청하세요. 실시간 채팅으로 질문도 하고, 메뉴 추천도 받을 수 있어요.' }) },
            { step: '2', emoji: '🛒', title: t('introduce.step2Title', { defaultValue: '식사권 공구' }), desc: t('introduce.step2Desc', { defaultValue: '라이브 중 소개된 식사권·밀키트를 최대 50% 할인가로. 공구 인원이 모일수록 할인폭이 커져요.' }) },
            { step: '3', emoji: '🍽', title: t('introduce.step3Title', { defaultValue: '매장 방문·사용' }), desc: t('introduce.step3Desc', { defaultValue: '구매한 쿠폰을 매장에서 제시하고 맛있게 드세요. 배송 상품은 집에서 바로 받아볼 수 있어요.' }) },
          ].map(s => (
            <div key={s.step} className="p-8 rounded-3xl relative overflow-hidden bg-pink-50 dark:bg-pink-900/10">
              <div className="absolute -top-6 -right-6 text-[120px] font-black opacity-10 text-red-500">{s.step}</div>
              <p className="text-[32px] mb-4">{s.emoji}</p>
              <h3 className="text-[22px] font-black text-gray-900 dark:text-white mb-2">{s.title}</h3>
              <p className="text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SELLER ═══ */}
      <section id="셀러 입점" className="max-w-[1280px] mx-auto px-6 py-16">
        <p className="text-[12px] font-extrabold text-red-500 tracking-widest mb-2">{t('introduce.sellerLabel', { defaultValue: '📢 셀러 입점 안내' })}</p>
        <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-gray-900 dark:text-white mb-8" style={{ letterSpacing: '-0.03em' }}>{t('introduce.sellerTitle1', { defaultValue: '우리 가게, 오늘부터' })}<br/>{t('introduce.sellerTitle2', { defaultValue: '라이브커머스 맛집.' })}</h2>
        <div className="space-y-4 max-w-[600px]">
          {[
            { t: t('introduce.sellerBenefit1Title', { defaultValue: '입점 수수료 0원, 판매 수수료만' }), d: t('introduce.sellerBenefit1Desc', { defaultValue: '판매되는 만큼만 부담해요. 가입비·월 고정비 없습니다.' }) },
            { t: t('introduce.sellerBenefit2Title', { defaultValue: '에이전시 매칭으로 방송 대행까지' }), d: t('introduce.sellerBenefit2Desc', { defaultValue: '직접 방송하기 어렵다면 검증된 에이전시가 도와줘요.' }) },
            { t: t('introduce.sellerBenefit3Title', { defaultValue: '당일 정산, 셀러 대시보드 제공' }), d: t('introduce.sellerBenefit3Desc', { defaultValue: '실시간 KPI · 주문 모니터링 · 리뷰 관리까지 한 곳에서.' }) },
          ].map(b => (
            <div key={b.t} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-red-500" strokeWidth={3} />
              </div>
              <div>
                <p className="text-[16px] font-extrabold text-gray-900 dark:text-white">{b.t}</p>
                <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-1">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <button onClick={() => navigate('/seller/register')} className="px-6 py-3.5 rounded-2xl text-white text-[14px] font-extrabold bg-red-500">{t('introduce.sellerApply', { defaultValue: '입점 신청하기 →' })}</button>
          <button onClick={() => navigate('/seller/login')} className="px-6 py-3.5 rounded-2xl text-[14px] font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-[#1C1C1E]">{t('introduce.sellerLogin', { defaultValue: '셀러 로그인' })}</button>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="max-w-[820px] mx-auto px-6 py-16">
        <p className="text-[12px] font-extrabold text-red-500 tracking-widest mb-2">{t('introduce.faqLabel', { defaultValue: '자주 묻는 질문' })}</p>
        <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-gray-900 dark:text-white mb-8" style={{ letterSpacing: '-0.03em' }}>{t('introduce.faqTitle', { defaultValue: '궁금한 거 다 풀어드려요.' })}</h2>
        <div>
          {faqs.map((f, i) => (
            <div key={i} className="border-b border-gray-200 dark:border-[#2A2A2A] py-5">
              <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full flex items-center justify-between text-left">
                <span className="text-[16px] font-bold text-gray-900 dark:text-white">{f.q}</span>
                <span className="text-[20px] text-gray-400 dark:text-gray-500 transition-transform" style={{ transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}>＋</span>
              </button>
              {faqOpen === i && <p className="mt-3 text-[15px] text-gray-600 dark:text-gray-400 leading-relaxed">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="rounded-[32px] p-12 md:p-16 relative overflow-hidden bg-gray-900">
          <div className="relative max-w-[600px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-extrabold text-white">{t('introduce.ctaBadge', { defaultValue: '앱에서 진짜 시작돼요' })}</span>
            </div>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white leading-tight mb-4" style={{ letterSpacing: '-0.03em' }}>
              {t('introduce.ctaTitle1', { defaultValue: '지금 시작하면' })}<br/>{t('introduce.ctaTitle2', { defaultValue: '첫 라이브 시청 시' })}<br/><span className="text-red-500">{t('introduce.ctaTitle3', { defaultValue: '5,000원 쿠폰' })}</span> 🎁
            </h2>
            <p className="text-[16px] text-white/70 mb-8 leading-relaxed">{t('introduce.ctaDesc', { defaultValue: '전화번호만 있으면 3초 만에 시작할 수 있어요.' })}</p>
            <button onClick={() => navigate('/login')} className="px-8 py-4 rounded-2xl text-[15px] font-extrabold bg-white text-gray-900">
              {t('introduce.ctaStart', { defaultValue: '지금 시작하기 →' })}
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="max-w-[1280px] mx-auto px-6 py-16">
          <div className="flex items-center mb-5">
            <UrDealLogo size={22} forceDark />
          </div>
          <p className="text-[13px] text-white/50 leading-relaxed mb-8 max-w-[360px]">{t('introduce.footerTagline', { defaultValue: '사장님이 직접 켜는 라이브커머스. 우리 동네 맛집을 특가로 만나는 가장 빠른 방법.' })}</p>
          <div className="pt-8 text-[11px] text-white/40 leading-relaxed border-t border-white/10">
            <p className="mb-2"><b className="text-white/70">{t('introduce.footerCompany', { defaultValue: '리스터코퍼레이션' })}</b> · {t('introduce.footerInfo', { defaultValue: '대표: 정지원 · 사업자등록번호: 479-09-02930' })}</p>
            <p className="mb-4">{t('introduce.footerAddress', { defaultValue: '부산광역시 금정구 놀이마당로26 1402 · 고객센터: 0507-0177-0432 (평일 09:00~18:00)' })}</p>
            <div className="flex gap-4">
              <button onClick={() => navigate('/terms')} className="text-white/50 hover:text-white">{t('introduce.footerTerms', { defaultValue: '이용약관' })}</button>
              <button onClick={() => navigate('/privacy')} className="text-white/50 hover:text-white font-bold">{t('introduce.footerPrivacy', { defaultValue: '개인정보처리방침' })}</button>
              <button onClick={() => navigate('/refund')} className="text-white/50 hover:text-white">{t('introduce.footerRefund', { defaultValue: '배송/환불' })}</button>
            </div>
            <p className="mt-4 text-white/30">{t('introduce.footerCopyright', { defaultValue: '© 2026 리스터코퍼레이션. All rights reserved.' })}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
