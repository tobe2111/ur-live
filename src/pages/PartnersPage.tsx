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
 * ■ 2026-09-16 2차 (대표 *"모바일은 오케이, 근데 PC 버전은 전혀 PC 버전 같지 않은데? 안 B로 하는데
 *   우리 유어딜 서비스의 차별점, 장점 그리고 기존 체험단 서비스와 비교하는 것 그런게 필요해"*)
 *   1440px 로 실제 렌더해 재 보니 지적이 맞았다 — **1차는 "넓어진 모바일"** 이었다:
 *   ⓐ 여백 리듬이 전 섹션 동일(`py-24`) · h2 가 1440 에서도 38px · 폰과 같은 한 줄 배치
 *   ⓑ `main img` **0개**(사진이 한 장도 없었다)
 *   ⇒ ① **안 B 채택** — 라이브 앱 캡처를 폰 프레임으로 넣는다(히어로 2장 · 사장님 화면 4장 ·
 *      환불 안내 1장 · 등록 1장). 소재는 대표 승인 덱이 쓰는 것과 **같은 캡처**다.
 *      ② PC 타이포 단계를 올리고(h1 62 · h2 48) ③ 섹션마다 **레이아웃 계열을 갈랐다**
 *      (분할 / 고정제목+스택 / 문장3+넓은 표 / 계산기 분할 / 가로 타임라인 / 폰 갤러리 / 절차 3열 /
 *      아코디언). 같은 그림이 두 번 이어지지 않는다(anti-slop §레이아웃 반복 금지).
 *      ④ 대표가 요구한 **차별점 3(vs 체험단 · vs 배달앱 · vs 예약솔루션)** 을 비교표 위에
 *      문장으로 먼저 놓았다 — 표는 훑는 사람에게 결론을 주지 않는다.
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
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-36 text-center">
            <h2 className="text-[26px] lg:text-[52px] xl:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.22]">
              안 팔리면 0원입니다
            </h2>
            <p className="mt-6 lg:mt-8 text-[14px] lg:text-[19px] leading-relaxed text-white/70 max-w-[32em] mx-auto">
              첫 이용권 초안은 저희가 만들어 드립니다. 확인하고 승인만 하시면 됩니다.
            </p>
            <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-[32rem] mx-auto">
              <Link to="/store/new"
                className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-extrabold active:scale-[0.98] transition-transform">
                내 가게 등록하기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </Link>
              <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
                className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-white/[0.10] border border-white/20 flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
                <MessageCircle className="w-4 h-4 lg:w-[18px] lg:h-[18px]" /> 카카오로 물어보기
              </a>
            </div>
            <p className="mt-12 lg:mt-16 text-[12px] lg:text-[13px] leading-relaxed text-white/45">
              {F.biz}
              <br />
              문의 {F.contactEmail}
            </p>
          </div>
        </section>
      </main>

      {/* 📱 모바일 고정 CTA. PC 는 상단 헤더 버튼과 각 섹션 CTA 가 담당한다(lg 에서 숨김) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#1D1F29]/95 backdrop-blur-md border-t border-rule px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
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
