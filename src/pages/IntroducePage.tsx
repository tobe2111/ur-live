import { useState, useEffect } from 'react'
import { GiftBoxIcon, PinIcon, BagIcon, TicketStubIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Search, ShieldCheck, Utensils, Zap } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import UrDealLogo from '@/components/brand/UrDealLogo'
import api from '@/lib/api'
import { cfImage, cfImageOnError } from '@/utils/cf-image'

// 📱 2026-09-28 (대표 확정 *"아직 앱은 하나도 없어"*): App Store·Google Play 배지를 **전부 삭제**했다.
//   여기 있던 링크는 실재하지 않는 앱의 스토어 주소(`id6745051422` · `com.urdeal.app`)라, 누르면
//   스토어의 **'앱을 찾을 수 없음'** 화면으로 떨어졌다 — 에러가 안 나니 아무도 신고하지 않는 종류다.
//   2026-09-24 에 지운 지어낸 실적 수치(`240만+ 누적 사용자`)와 같은 클래스: **없는 것을 있다고 말하지 않는다.**
//   유어딜은 지금 폰 브라우저에서 그대로 돌아가므로 각 자리는 웹 CTA 가 대신한다.
//   ⚠️ 앱이 실제로 나오면 되살리되, 그때 **스토어 URL 이 200 인지 먼저 확인**할 것(그게 이번에 빠진 단계다).

interface GbItem {
  id: number
  name: string
  restaurant_name?: string
  image_url?: string
  price?: number
  original_price?: number
}

export default function IntroducePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [deals, setDeals] = useState<GbItem[]>([])
  const [faqOpen, setFaqOpen] = useState<number | null>(0)

  useEffect(() => {
    api.get('/api/group-buy/products?status=active&limit=4')
      .then(r => { if (r.data.success) setDeals((r.data.data || []).slice(0, 4)) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const faqs = [
    { q: t('introduce.faq1Q', { defaultValue: '꼭 앱을 설치해야 하나요?' }), a: t('introduce.faq1A', { defaultValue: '웹에서도 둘러보기와 구매 모두 가능합니다. 단, 공구 오픈 알림·쿠폰 등은 앱에서 더 편하게 이용하실 수 있어요.' }) },
    { q: t('introduce.faq2Q', { defaultValue: '교환권을 샀는데 환불 되나요?' }), a: t('introduce.faq2A', { defaultValue: '구매일로부터 7일 이내·미사용 교환권은 100% 환불 가능합니다. 유효기간 내에만 사용하시면 되고, 양도도 자유롭게 하실 수 있어요.' }) },
    { q: t('introduce.faq3Q', { defaultValue: '목표 인원이 안 모이면 어떻게 되나요?' }), a: t('introduce.faq3A', { defaultValue: '동네 공구는 즉시 구매·확정 발급이에요. 목표 인원과 관계없이 지금 바로 그룹 특가로 결제되고 교환권이 곧장 발급됩니다. 인원은 함께 사는 분들을 보여주는 소셜 표시일 뿐이에요.' }) },
    { q: t('introduce.faq4Q', { defaultValue: '동네 공구는 어디서 찾나요?' }), a: t('introduce.faq4A', { defaultValue: '홈 또는 "동네 공구" 탭에서 지역·카테고리(맛집·뷰티·숙소 등)별로 진행 중인 공구를 확인할 수 있어요.' }) },
    { q: t('introduce.faq5Q', { defaultValue: '셀러 입점 조건은?' }), a: t('introduce.faq5A', { defaultValue: '사업자 등록이 된 식당·브랜드라면 누구나 신청 가능합니다. 입점 수수료는 없고 판매 수수료만 부담합니다.' }) },
    { q: t('introduce.faq6Q', { defaultValue: '결제는 어떤 방법이 가능한가요?' }), a: t('introduce.faq6A', { defaultValue: '신용카드·체크카드·계좌이체·간편결제(카카오페이/토스) 모두 지원합니다.' }) },
  ]

  const features = [
    { icon: BagIcon, color: '#EF4444', title: '동네 공구 단일 특가', desc: '대량 단가를 미리 떼와 처음부터 모두에게 같은 그룹 특가. 인원에 따라 가격이 오르내리지 않아요.' },
    { icon: TicketStubIcon, color: '#6b7280', title: '교환권 즉시 발급', desc: '결제하면 교환권이 바로 발급돼요. 목표 인원과 무관하게 즉시 확정되니 매장에서 바로 사용하세요.' },
    { icon: PinIcon, color: '#9ca3af', title: '우리 동네 기반', desc: '맛집·뷰티·숙소·헬스까지. 내 지역에서 진행 중인 공구를 카테고리·지역별로 골라보세요.' },
    { icon: GiftBoxIcon, color: '#6b7280', title: '친구 초대 보너스', desc: '친구를 초대해 함께 구매하면 두 분 모두에게 보너스 딜이 적립돼요.' },
  ]

  return (
    <div className="bg-[#11141C] text-white min-h-screen">
      <SEO title={t('introduce.seoTitle', { defaultValue: CONSUMER_SURFACE_SEO['/introduce'].title })} description={t('introduce.seoDesc', { defaultValue: CONSUMER_SURFACE_SEO['/introduce'].description })} url="/introduce" />

      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-50 bg-[#11141C]/90 backdrop-blur-md border-b border-[#2C2F35]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between px-6 h-16">
          <button onClick={() => navigate('/')} className="flex items-center">
            <UrDealLogo size={20} forceDark />
          </button>
          <nav className="hidden md:flex items-center gap-1">
            <a href="#features" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">기능</a>
            <a href="#deals" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">동네 공구</a>
            <a href="#for-sellers" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">셀러 입점</a>
            <a href="#faq" className="px-3 py-2 text-[13px] font-semibold text-gray-400 hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#2D0A14] via-[#11141C] to-[#11141C] pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-red-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] rounded-full bg-brand/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-[1280px] mx-auto px-6 pt-20 pb-24 flex flex-col md:flex-row gap-16 items-center">
          {/* left: copy */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-extrabold text-red-400">우리 동네 공동구매</span>
            </div>
            <h1
              className="text-[clamp(40px,5.5vw,72px)] font-black leading-[1.02] text-white"
              style={{ letterSpacing: '-0.04em' }}
            >
              우리 동네<br />
              맛집·뷰티·숙소,<br />
              <span className="text-transparent bg-clip-text bg-gray-800 italic">함께 사서 특가.</span>
            </h1>
            <p className="text-[17px] text-gray-400 mt-6 max-w-[480px] leading-relaxed">
              대량 단가를 미리 떼와 처음부터 모두에게 같은 그룹 특가.<br />
              결제하면 교환권이 바로 발급돼요.
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-8">
              <button
                onClick={() => navigate('/group-buy')}
                className="flex items-center gap-2 px-6 py-4 rounded-2xl text-gray-900 text-[15px] font-extrabold bg-white hover:bg-gray-100 transition-colors"
              >
                <BagIcon className="w-4 h-4" /> 동네 공구 둘러보기
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-1 text-[15px] font-semibold text-gray-400 hover:text-white transition-colors"
              >
                웹에서 바로 시작 <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 🔴 2026-09-24 (대표 지적 "숫자로 박아놓는게 직관적이다" 후속 실측): 여기 있던
                `240만+ 누적 사용자` · `4.8 App Store 평점` 을 **삭제**했다. 같은 날 어드민 실측은
                **유저 23명 · 셀러 11곳 · 주문 최근 id 89** 였다 — 지어낸 수치였고, 대외 랜딩의
                거짓 실적은 표시광고법 문제다. ⚠️ **실적 수치를 다시 하드코딩하지 말 것.**
                숫자를 쓰려면 서버가 세어 준 값이거나, 아래처럼 **코드로 보증되는 약속**이어야 한다. */}
            <div className="flex flex-wrap items-center gap-5 mt-8 text-[12px] text-gray-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-gray-600" />
                <span><b className="text-white">미사용 시 100%</b> 자동환불</span>
              </div>
              <span className="text-gray-800">|</span>
              <div className="flex items-center gap-1">
                <TicketStubIcon className="w-3.5 h-3.5 text-gray-600" />
                <span><b className="text-white">가입·이용료 0원</b></span>
              </div>
            </div>
          </div>

          {/* right: phone mockup */}
          <div className="hidden md:flex justify-center shrink-0">
            <div className="relative">
              {/* glow */}
              <div className="absolute inset-0 bg-gray-800/30 blur-[60px] rounded-full scale-110" />
              {/* phone */}
              <div className="relative w-[260px] h-[520px] bg-[#111] rounded-[44px] p-[10px] shadow-2xl border border-white/10">
                <div className="w-full h-full rounded-[34px] bg-[#11141C] relative overflow-hidden">
                  {/* notch */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[80px] h-[22px] bg-black rounded-2xl z-20" />
                  {/* 공구 badge */}
                  <div className="absolute top-12 left-4 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500 z-10">
                    <span className="text-[12px] font-extrabold text-white">🔥 동네 공구</span>
                  </div>
                  {/* fake bg */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#2A0A0A] via-[#1A0808] to-black" />
                  {/* bottom product card */}
                  <div className="absolute bottom-4 left-3 right-3 rounded-2xl p-4 bg-black/80 backdrop-blur-md border border-white/10 z-10">
                    <p className="text-[12px] font-bold text-white truncate">수제 돈카츠 3팩 세트</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-[12px] font-extrabold text-red-400">30%</span>
                      <span className="text-[15px] font-extrabold text-white">18,900원</span>
                      <span className="text-[12px] text-gray-500 line-through">26,900원</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1 py-2 rounded-lg bg-gray-800 text-center text-[12px] font-extrabold text-white">바로 구매</div>
                      <div className="flex-1 py-2 rounded-lg bg-white/10 text-center text-[12px] font-bold text-white">교환권 발급</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="border-y border-[#2C2F35] bg-[#11141C]">
        <div className="max-w-[1280px] mx-auto px-6 py-10 grid grid-cols-3 gap-8">
          {/* 🔒 **여기 들어갈 수 있는 숫자는 두 가지뿐이다** — ⓐ 서버가 실제로 세어 준 값
              ⓑ 코드가 보증하는 약속. 아래 셋은 ⓑ다: 만료 미사용분 자동환불은
              `daily-lane.ts` 의 `handleExpiredVoucherRefunds` 가 매일 돌리고, 가입·이용료는
              실제로 0원이며(판매 시 수수료만), 결제는 토스 간편결제다.
              ⚠️ 누적 사용자·거래·입점 수는 **지금 규모로는 쓸 값이 없다**(2026-09-24 실측
              유저 23 · 셀러 11). 커지면 그때 서버 집계를 붙일 것 — 손으로 적지 말 것. */}
          {[
            { n: '100%', l: '미사용 시 자동환불' },
            { n: '0원', l: '가입·이용료' },
            { n: '3초', l: '토스 간편결제' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <p className="text-[32px] md:text-[40px] font-black text-white leading-none">{s.n}</p>
              <p className="text-[12px] font-semibold text-gray-500 mt-2">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="mb-12 text-center">
          <p className="text-[12px] font-extrabold text-red-400 tracking-[0.15em] mb-3">WHY URDEAL</p>
          <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            동네 공구, 이렇게 다릅니다
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(f => {
            const Icon = f.icon
            return (
              <div key={f.title} className="p-6 rounded-2xl bg-[#0D0D0D] border border-[#2C2F35] hover:border-[#2C2F35] transition-colors">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: f.color + '20' }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-[17px] font-extrabold text-white mb-2">{f.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── 인기 동네 공구 ─── */}
      <section id="deals" className="max-w-[1280px] mx-auto px-6 py-16">
        <div className="mb-8">
          <p className="text-[12px] font-extrabold text-red-400 tracking-[0.15em] mb-3">● 동네 공구</p>
          <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            지금 인기 동네 공구
          </h2>
          <p className="text-[15px] text-gray-500 mt-3">우리 동네 맛집·뷰티·숙소를 그룹 특가로. 결제 즉시 교환권이 발급돼요.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(deals.length > 0 ? deals : [
            { id: 0, name: '동네 맛집 이용권', restaurant_name: '곧 오픈' },
            { id: 0, name: '뷰티 시술 공구', restaurant_name: '곧 오픈' },
            { id: 0, name: '펜션·호텔 숙박', restaurant_name: '곧 오픈' },
            { id: 0, name: '헬스 PT 공구', restaurant_name: '곧 오픈' },
          ] as GbItem[]).map((d, idx) => (
            <button
              key={`${d.id}-${idx}`}
              onClick={() => d.id ? navigate(`/pass/${d.id}`) : navigate('/group-buy')}
              className="block rounded-2xl overflow-hidden border border-[#2C2F35] hover:border-[#2C2F35] transition-all hover:scale-[1.02]"
            >
              <div className="aspect-[3/4] relative bg-gradient-to-br from-[#1A0808] to-[#11141C]">
                {d.image_url && (
                  <img
                    src={cfImage(d.image_url, { width: 320, format: 'auto' })}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => cfImageOnError(e.currentTarget, d.image_url)}
                  />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.4), transparent 35%, rgba(0,0,0,0.85))' }} />
                {d.original_price && d.price && d.original_price > d.price && (
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-md bg-red-500">
                    <span className="text-[12px] font-extrabold text-white">{Math.round((1 - d.price / d.original_price) * 100)}%</span>
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="text-[12px] font-bold text-white line-clamp-2 leading-tight">{d.name}</p>
                  <p className="text-[12px] text-white/60 mt-1">
                    {d.restaurant_name}{d.price ? ` · ${d.price.toLocaleString('ko-KR')}원` : ''}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/group-buy')}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#2C2F35] text-[13px] font-bold text-gray-300 hover:border-[#444] hover:text-white transition-colors"
          >
            전체 동네 공구 보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="bg-[#11141C] border-y border-[#2C2F35]">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="mb-12 text-center">
            <p className="text-[12px] font-extrabold text-red-400 tracking-[0.15em] mb-3">HOW IT WORKS</p>
            <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
              고르고, 함께 사고, 매장에서 쓰기.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '01', Icon: Search, title: '동네 공구 고르기', desc: '홈 또는 동네 공구 탭에서 지역·카테고리(맛집·뷰티·숙소 등)별로 진행 중인 공구를 골라보세요.' },
              { n: '02', Icon: BagIcon, title: '그룹 특가로 구매', desc: '인원과 무관하게 처음부터 같은 그룹 특가. 결제하면 교환권이 즉시 발급돼요.' },
              { n: '03', Icon: Utensils, title: '매장 방문·사용', desc: '발급된 교환권을 매장에서 제시하고 사용하세요. 숙소·배송 상품은 안내에 따라 이용하시면 돼요.' },
            ].map(s => (
              <div key={s.n} className="relative p-8 rounded-3xl bg-[#111] border border-[#2C2F35] overflow-hidden">
                <div className="absolute -top-4 -right-2 text-[100px] font-black opacity-[0.04] text-white select-none">{s.n}</div>
                <s.Icon className="w-9 h-9 mx-auto mb-5 text-gray-400" aria-hidden="true" />
                <h3 className="text-[24px] font-extrabold text-white mb-3">{s.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── APP DOWNLOAD CTA ─── */}
      <section className="max-w-[1280px] mx-auto px-6 py-20">
        <div className="rounded-[32px] p-10 md:p-16 relative overflow-hidden bg-gradient-to-br from-[#EF4444] to-[#6b7280]">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-1/4 w-[200px] h-[200px] rounded-full bg-white/5 translate-y-1/2" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/20 mb-5">
              <Zap className="w-3.5 h-3.5 text-white" />
              <span className="text-[12px] font-extrabold text-white">설치 없이 바로 시작</span>
            </div>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white leading-tight mb-3" style={{ letterSpacing: '-0.03em' }}>
              지금 시작하고<br />우리 동네<br /><span className="opacity-90">그룹 특가</span> 받기 🎁
            </h2>
            <p className="text-[15px] text-white/80 mb-8">전화번호만 있으면 3초 만에 시작할 수 있어요.</p>
            {/* 📱 앱 배지가 있던 자리 — 앱이 없으므로 원래 보조였던 웹 진입을 주 CTA 로 올린다. */}
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl text-[15px] font-extrabold text-gray-900 bg-white hover:bg-gray-100 transition-colors"
            >
              바로 시작하기 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOR SELLERS ─── */}
      <section id="for-sellers" className="bg-[#11141C] border-t border-[#2C2F35]">
        <div className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="max-w-[680px]">
            <p className="text-[12px] font-extrabold text-red-400 tracking-[0.15em] mb-3">FOR SELLERS</p>
            <h2 className="text-[clamp(28px,4vw,48px)] font-black text-white mb-8" style={{ letterSpacing: '-0.03em' }}>
              우리 가게, 오늘부터<br />동네 공구 맛집.
            </h2>
            <div className="space-y-5 mb-10">
              {[
                { title: '입점 수수료 0원, 판매 수수료만', desc: '판매되는 만큼만 부담해요. 가입비·월 고정비 없습니다.' },
                { title: '에이전시 매칭으로 공구 운영까지', desc: '직접 운영이 어렵다면 검증된 에이전시가 공구 등록·관리를 도와줘요.' },
                { title: '정산·셀러 대시보드 제공', desc: '주문 모니터링 · 정산 · 리뷰 관리까지 한 곳에서.' },
              ].map(b => (
                <div key={b.title} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4 text-red-400" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-[17px] font-extrabold text-white">{b.title}</p>
                    <p className="text-[13px] text-gray-500 mt-1">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/store/new')}
                className="px-6 py-4 rounded-2xl text-white text-[15px] font-extrabold bg-gray-800 hover:opacity-90 transition-opacity"
              >
                입점 신청하기 →
              </button>
              <button
                onClick={() => navigate('/seller/login')}
                className="px-6 py-4 rounded-2xl text-[15px] font-extrabold text-white bg-[#1D1F29] hover:bg-[#222] transition-colors border border-[#2C2F35]"
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
          <p className="text-[12px] font-extrabold text-red-400 tracking-[0.15em] mb-3">FAQ</p>
          <h2 className="text-[clamp(24px,3.5vw,44px)] font-black text-white" style={{ letterSpacing: '-0.03em' }}>
            궁금한 거 다 풀어드려요.
          </h2>
        </div>
        <div className="space-y-1">
          {faqs.map((f, i) => (
            <div key={i} className="border border-[#2C2F35] rounded-2xl overflow-hidden">
              <button
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full flex items-center justify-between text-left px-5 py-[18px] hover:bg-[#0D0D0D] transition-colors"
                style={{ padding: '18px 20px' }}
              >
                <span className="text-[15px] font-bold text-white">{f.q}</span>
                <span
                  className="text-[24px] text-gray-500 shrink-0 ml-4 transition-transform duration-200"
                  style={{ transform: faqOpen === i ? 'rotate(45deg)' : 'none' }}
                >
                  ＋
                </span>
              </button>
              {faqOpen === i && (
                <div className="px-5 pb-5 text-[15px] text-gray-400 leading-relaxed">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-[#2C2F35] bg-[#11141C]">
        <div className="max-w-[1280px] mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 mb-10">
            <div>
              <div className="mb-4">
                <UrDealLogo size={22} forceDark />
              </div>
              <p className="text-[13px] text-gray-500 leading-relaxed max-w-[320px]">
                우리 동네 맛집·뷰티·숙소를 그룹 특가로.<br />함께 사서 더 좋은 가격, 교환권은 결제 즉시 발급.
              </p>
            </div>
          </div>

          <div className="pt-8 border-t border-[#2C2F35] text-[12px] text-gray-600 leading-relaxed">
            <p className="mb-2"><b className="text-gray-400">리스터코퍼레이션</b> · 대표: 정지원 · 사업자등록번호: 479-09-02930</p>
            <p className="mb-5">서울특별시 강남구 남부순환로359길 14, 3층(도곡동) · 고객센터 평일 09:00~18:00</p>
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
