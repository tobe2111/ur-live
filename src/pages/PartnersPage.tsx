/**
 * 🏪 입점(파트너) 랜딩 — /partners
 *
 * ■ 무엇인가
 *   매장 사장님이 유어딜에 들어오는 **첫 화면**이다. PC 상단 네비의 "유어딜에서 판매하세요" 와
 *   마이·푸터·소개 페이지가 전부 여기로 온다(`utils/seller-entry.ts` SSOT).
 *
 * ■ 2026-09-16 전면 재작성 (대표: *"전혀 메리트가 없어 · PC 버전은 따로 없어 · 프레임에 갇혀있고"*)
 *   실측한 문제 넷:
 *   ① **PC 가 없었다.** 이 경로가 `MobileAppLayout` 의 `HIDE_SIDEBAR_PREFIXES` 에 없어 430px 소비자
 *      액자에 갇혔고, 빈 거터를 `ConsumerFrameRails`(홈·교환권·이용권·유어샵 바로가기 + 앱 QR)가 채웠다.
 *      ⇒ **입점을 검토하러 온 사장님 화면의 좌우가 전부 소비자 앱 광고였다.**
 *   ② **신뢰 숫자가 사장님 것이 아니었다.** "19조 글로벌 동일 모델 시장 규모" 는 투자자 언어다.
 *   ③ **덱의 심장이 빠져 있었다.** 대표 승인 소개서(`urdeal-store-owner-deck`)가 "이 문서의 심장" 이라
 *      주석한 체험단·배달앱 비교표가 랜딩엔 없었다.
 *   ④ **계산기가 빼기만 했다.** 정가 → 할인 → 수수료 → 입금. 사장님이 얻는 것은 화면에 없었다.
 *   ⑤ **길이 하나뿐이었다.** 폰으로 가게를 등록해 본 적 없는 사장님에게는 문이 없었다.
 *
 * ■ 문구의 출처 (추측 금지)
 *   전부 대표 승인 덱 `docs/business/proposals/urdeal-store-owner-deck.build.mjs` 와
 *   기획 `three-decks-plan-2026-09.md` §0(사실) · §2(구성). 숫자는 `shared/partners-facts.ts` 한 곳에서만
 *   읽고, `partners-facts.test.ts` 가 덱의 `FACTS` 와 대조한다 — 카톡으로 받은 PDF 와 사이트가
 *   다른 말을 하는 것이 §0-5 가 실측한 사고다.
 *
 * ■ 여기 적지 않는 것
 *   성과 수치("매출 N% 증가") · 수익 사례 · "업계 최저" · 자동 승인 · 자동 송금 · 트래픽 약속.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PartnerHero from './partners/PartnerHero'
import PartnerBenefits from './partners/PartnerBenefits'
import PartnerCompare from './partners/PartnerCompare'
import PartnerMath from './partners/PartnerMath'
import PartnerFlow from './partners/PartnerFlow'
import PartnerTools from './partners/PartnerTools'
import PartnerPaths from './partners/PartnerPaths'
import PartnerFaq from './partners/PartnerFaq'

export default function PartnersPage() {
  return (
    <div className="min-h-[100dvh] bg-warm">
      {/* 🔎 문구 SSOT = shared/seo/consumer-surfaces (워커가 주입하는 서버 메타와 같은 값) */}
      <SEO title={CONSUMER_SURFACE_SEO['/partners'].title} description={CONSUMER_SURFACE_SEO['/partners'].description} url="/partners" />

      <header className="sticky top-0 z-20 ur-panel-ink">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between">
          <Link to="/" aria-label="유어딜 홈" className="flex items-center gap-2.5">
            <UrDealLogo size={19} forceDark />
            <span className="hidden sm:inline text-[12.5px] font-bold text-white/55">입점 안내</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-3">
            <Link to="/about" className="hidden sm:inline text-[12.5px] font-semibold text-white/70 px-2">서비스 소개</Link>
            <Link to="/store/new"
              className="h-9 lg:h-10 px-3.5 lg:px-5 rounded-full bg-brand text-white inline-flex items-center gap-1.5 text-[12.5px] lg:text-[13.5px] font-extrabold">
              내 가게 등록 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-24 lg:pb-0">
        <PartnerHero />
        <PartnerBenefits />
        <PartnerCompare />
        <PartnerMath />
        <PartnerFlow />
        <PartnerTools />
        <PartnerPaths />
        <PartnerFaq />

        <section className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 text-center">
            <h2 className="text-[24px] lg:text-[42px] font-extrabold tracking-[-0.02em] leading-[1.3]">
              안 팔리면 0원입니다.<br />잃을 것이 없습니다.
            </h2>
            <p className="mt-5 text-[14px] lg:text-[17px] leading-relaxed text-white/70 max-w-[34em] mx-auto">
              첫 이용권 초안은 유어딜이 만들어 드립니다. 사장님은 확인하고 승인만 하시면 됩니다.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center max-w-[30rem] mx-auto">
              <Link to="/store/new"
                className="flex-1 h-[52px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] font-extrabold active:scale-[0.98] transition-transform">
                내 가게 등록하기 <ArrowRight className="w-4 h-4" />
              </Link>
              <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
                className="flex-1 h-[52px] rounded-2xl border border-white/25 flex items-center justify-center gap-2 text-[15px] font-bold text-white/90">
                <MessageCircle className="w-4 h-4" /> 카카오로 물어보기
              </a>
            </div>
            <p className="mt-10 text-[12px] leading-relaxed text-white/45">
              {F.biz}
              <br />
              문의 {F.contactEmail}
            </p>
          </div>
        </section>
      </main>

      {/* 📱 모바일 고정 CTA. PC 는 상단 헤더 버튼과 각 섹션 CTA 가 담당한다(lg 에서 숨김) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-rule px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto flex gap-2.5">
          <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
            className="flex-1 h-12 rounded-2xl border border-rule-strong flex items-center justify-center gap-1.5 text-[14px] font-extrabold text-ink">
            <MessageCircle className="w-4 h-4" /> 카카오 문의
          </a>
          <Link to="/store/new"
            className="flex-[1.4] h-12 rounded-2xl bg-brand text-white flex items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
            내 가게 등록하기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
