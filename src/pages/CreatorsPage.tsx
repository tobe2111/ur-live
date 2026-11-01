/**
 * ✨ 소개 파트너 모집 랜딩 — `/influencer` (2026-07-19 대표 "웹페이지 3종" ③ · 2026-10-31 주소 이전)
 *   📣 2026-10-31 대표 *"인플루언서용은 하나로 통일하자. /influencer 이걸로"* — 원래 `/creators` 에 있었고,
 *   같은 말을 하던 짧은 판 `InfluencerLandingPage` 는 지웠다. 옛 주소는 301(`consumer-redirects.ts`).
 *   히어로 → 수익 구조(판매당 promo%) → 시작 3단계 → 실제 화면 → 시드 모집 폼.
 *
 * ■ 2026-09-16 PC 판 (대표 *"PC를 같은 수준으로 만들어주고"*)
 *   `/partners` 를 PC 로 세운 직후의 지시다. 이 페이지도 같은 문제 셋을 그대로 갖고 있었다:
 *   ① `MobileAppLayout` 의 `HIDE_SIDEBAR_PREFIXES` 에 없어 **430px 소비자 액자**에 갇혔다.
 *      소개로 돈을 벌러 온 사람 화면의 좌우가 전부 소비자 앱 설치 안내였다.
 *   ② 본문 `max-w-xl`(576px) 고정 — 폭을 풀어도 **넓어진 모바일**이 된다.
 *   ③ 성과 화면 자리가 **"(화면 준비 중)" 플레이스홀더 두 칸**이었다. 모집 랜딩의 한복판이
 *      공사중 팻말이면 아무도 신청하지 않는다.
 *
 *   ⇒ `/partners` 와 같은 규약(잉크 헤더 · `ur-content-wide` · PC 타이포 단계 · 섹션마다 다른
 *      레이아웃 계열 · 모바일 전용 고정 CTA)으로 맞추고, 플레이스홀더는 **실제 화면 캡처**로 바꿨다.
 *
 * ■ 캡처와 정직 고지
 *   `docs/business/proposals/shots/*` — 대표 승인 인플루언서 덱(`urdeal-influencer-deck.build.mjs`)이
 *   쓰는 **같은 파일**이고, 캡션도 덱이 쓰는 문구를 그대로 옮겼다(라이브 / 예시 데이터를 구분해 적는다).
 *   ⚠️ 없앤 것: *"실시간 적립 알림"* 칸. 그 장치는 아직 없다(이전 판 주석이 "잔존 장치 2종 완성 후
 *      교체" 라고 적어 둔 것이 그것이다). 없는 기능을 그림으로 약속하지 않는다.
 */
import { Link } from 'react-router-dom'
import { Link2, MousePointerClick, Share2, UserPlus, ArrowRight } from 'lucide-react'
import SEO from '@/components/SEO'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PhoneShot, { SHOT } from './landing/PhoneShot'
import { Line, Reveal, ScrollProgress, loadDelay } from './landing/motion'
import { DeviceStage, GiantNumber, PhotoHero, ToneScroll, useLandingFont } from './landing/premium'
import FaqItem from './landing/FaqItem'
// ❓ 2026-10-31 — 질문은 `shared/landing-faq` SSOT. 워커가 같은 배열로 서버 본문과 `FAQPage` 를 만든다.
import { REFERRAL_FAQ } from '@/shared/landing-faq'

/** 📋 시드 모집 폼 — 기본은 유어딜 네이티브 신청 폼(/creators/apply, 사전동의·풀 자동적재).
 *  대표가 별도 구글폼 URL 을 전달하면 여기에 넣어 iframe 임베드로 대체(없으면 네이티브 폼 사용). */
const GOOGLE_FORM_URL = ''

const STEPS = [
  { icon: UserPlus, t: '가입', d: '카카오 로그인 1분이면 내 유어샵이 자동으로 생겨요' },
  { icon: MousePointerClick, t: '딜 선택', d: '동네 맛집·뷰티 딜 중 소개하고 싶은 걸 내 유어샵에 담아요' },
  { icon: Share2, t: '링크 공유', d: '인스타·블로그·카톡에 내 링크 하나만 올리면 끝' },
]

/** 계단 — PC 에서 단계마다 오른쪽으로 한 칸씩 들어간다(폰은 그대로 세로 목록). 클래스는 정적으로 적는다(tailwind 가 줍는다). */
const STAIR = ['', 'lg:ml-[14%]', 'lg:ml-[28%]']

const TERMS = [
  '소개비율은 딜마다 표시되니 고르기 전에 미리 확인하세요',
  '손님이 환불하면 적립도 자동 회수됩니다 (원장 기준)',
  '적립금은 정산 계좌로 출금 (사업소득 원천징수 후 지급)',
]

export default function CreatorsPage() {
  const applyHref = GOOGLE_FORM_URL || '/creators/apply'
  // 💎 2026-11-01 고급화 ⑥ — 제목 전용 글꼴(명조)을 이 페이지에서만 받는다
  useLandingFont()

  return (
    <div className="min-h-[100dvh] bg-warm ur-landing-type overflow-x-clip">
      {/* 🔎 2026-07-29: 문구 SSOT = shared/seo/consumer-surfaces (워커 메타와 같은 값). */}
      <SEO title={CONSUMER_SURFACE_SEO['/influencer'].title} description={CONSUMER_SURFACE_SEO['/influencer'].description} url="/influencer" />

      <header className="sticky top-0 z-20 ur-panel-ink">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between">
          <Link to="/" aria-label="유어딜 홈" className="flex items-center gap-2">
            <UrDealLogo size={19} forceDark />
            <span className="hidden sm:inline text-[12px] font-medium text-white/55">소개하기</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-3">
            <Link to="/about" className="hidden sm:inline text-[12px] font-medium text-white/70 px-2">서비스 소개</Link>
            <ApplyLink href={applyHref}
              className="h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-brand text-white inline-flex items-center gap-2 text-[12px] lg:text-[13px] font-medium">
              소개 파트너 지원 <ArrowRight className="w-3.5 h-3.5" />
            </ApplyLink>
          </div>
        </div>
        <ScrollProgress />
      </header>

      <main className="pb-24 lg:pb-0">
        {/* ① 히어로 — 💎 2026-11-01 고급화 ①②: 실사진을 꽉 채운 첫 화면. 숫자 셋과 유어샵 폰은 바로 아래
            거대한 숫자 · 실기기 무대로 옮겼다(첫 화면에는 제목 · 한 줄 · 버튼만). */}
        <PhotoHero photo="influencer">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 min-h-[calc(100svh-56px)] lg:min-h-[calc(100svh-64px)] flex flex-col justify-end pt-40 pb-28">
            <h1 className="text-[40px] sm:text-[48px] lg:text-[76px] xl:text-[96px] leading-[1.12] font-extrabold tracking-[-0.035em]">
              {/* 🎬 한 줄씩 마스크 안에서 밀려 올라온다 */}
              <Line i={0}><span className="text-brand-text">링크 하나</span>로</Line>
              <Line i={1}>동네 맛집을 소개하세요</Line>
            </h1>
            <p style={loadDelay(320)} className="ur-load mt-6 lg:mt-8 text-[15px] lg:text-[17px] leading-[1.7] text-white/80 max-w-[26em]">
              내 링크로 팔리면 소개비가 쌓입니다. 팔로워 수는 상관없어요.
            </p>

            <div style={loadDelay(460)} className="ur-load mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
              <ApplyLink href={applyHref}
                className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold active:scale-[0.98] transition-transform">
                소개 파트너 지원 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </ApplyLink>
              <Link to="/about"
                className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-white/[0.12] border border-white/25 backdrop-blur-sm flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
                서비스 먼저 보기
              </Link>
            </div>
          </div>
        </PhotoHero>

        {/* 💎 고급화 ③④⑤ — 바탕이 어둠 → 밝음으로 넘어가는 한 묶음: 거대한 0원 · 실기기 폰 두 대 */}
        <ToneScroll initial="ink">
          <section data-tone="ink">
            <div className="ur-content-wide mx-auto px-5 lg:px-10 py-24 lg:py-40 overflow-hidden">
              <GiantNumber value="0" unit="원" label="시작에 드는 돈 0원" />
              <div className="mt-10 lg:mt-14 grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-20">
                <Reveal><h2 className="ur-tone-fg text-[28px] lg:text-[48px] font-extrabold leading-[1.22]">
                  시작에 드는 돈은<br />없습니다
                </h2></Reveal>
                <Reveal delay={120} as="p" className="text-[15px] lg:text-[17px] leading-[1.7] ur-tone-mu max-w-[26em]">
                  소개비는 매장이 딜마다 정합니다. 정산은 {F.minPayout}부터 받을 수 있어요.
                </Reveal>
              </div>
            </div>
          </section>

          <section data-tone="paper">
            <div className="ur-content-wide mx-auto px-5 lg:px-10 py-20 lg:py-36 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
              <Reveal><h2 className="ur-tone-fg text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold leading-[1.18]">
                담으면 내 가게,<br />팔리면 내 소개비
              </h2></Reveal>
              <DeviceStage
                back={{ shot: SHOT('ushop'), alt: '담은 딜이 진열된 내 유어샵 화면', tag: '내 유어샵' }}
                front={{ shot: SHOT('influencer-settlement'), alt: '내 소개 적립과 정산 화면', tag: '정산 화면' }}
                toast={{ title: '소개비가 적립됐어요', sub: '내 링크로 이용권이 팔렸어요' }}
              />
            </div>
          </section>
        </ToneScroll>

        {/* ② 수익 구조 — 한 문장을 크게 두고 조건은 아래 헤어라인으로. PC 는 제목 고정 + 본문 분리. */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
            <Reveal className="lg:self-start lg:sticky lg:top-24"><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
              수익 구조는 단순합니다
            </h2></Reveal>
            <div>
              <Reveal as="p" className="flex items-start gap-2 lg:gap-4 text-[17px] lg:text-[34px] font-bold text-ink leading-[1.35] tracking-[-0.025em]">
                <Link2 className="w-5 h-5 lg:w-8 lg:h-8 mt-1 lg:mt-2 text-brand shrink-0" strokeWidth={1.9} aria-hidden />
                <span>내 링크로 팔리면 <span className="text-brand-text">판매액의 소개비</span> 적립</span>
              </Reveal>
              <ul className="mt-8 lg:mt-12 border-t border-rule">
                {TERMS.map((t, i) => (
                  <Reveal as="li" key={t} delay={i * 90} className="py-4 lg:py-6 border-b border-rule text-[13px] lg:text-[17px] leading-relaxed text-gray-500 dark:text-gray-400">
                    {t}
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ③ 시작 3단계 — 🎬 2026-10-31: 점 세 개짜리 가로 타임라인(가장 흔한 AI 랜딩 그림)을 **계단**으로 바꿨다.
            PC 에서 한 단계마다 오른쪽으로 한 칸씩 내려앉으며 차례로 들어온다. 큰 단어가 주인공이고 설명은 그 옆. */}
        <section className="ur-panel-ink text-white overflow-hidden">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
            <Reveal><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] leading-[1.2]">시작은 3단계</h2></Reveal>

            <ol className="mt-8 lg:mt-16 space-y-2 lg:space-y-0">
              {STEPS.map(({ icon: Icon, t, d }, i) => (
                <Reveal as="li" key={t} kind="left" delay={i * 160}
                  className={`flex items-start gap-4 rounded-2xl bg-white/[0.06] p-4 lg:bg-transparent lg:p-0 lg:rounded-none lg:items-baseline lg:gap-10 lg:py-8 lg:border-t lg:border-white/15 ${STAIR[i]}`}>
                  <span aria-hidden className="w-9 h-9 rounded-xl bg-white/[0.10] flex items-center justify-center shrink-0 lg:hidden">
                    <Icon className="w-[18px] h-[18px] text-brand-text" />
                  </span>
                  <p className="text-[15px] lg:text-[76px] font-bold lg:font-extrabold tracking-[-0.02em] lg:tracking-[-0.04em] leading-[1.3] lg:leading-none lg:shrink-0">
                    <span className="text-brand-text mr-1 lg:hidden">{i + 1}.</span>{t}
                  </p>
                  <p className="text-[12px] lg:text-[17px] text-white/60 mt-1 lg:mt-0 leading-snug lg:leading-relaxed lg:max-w-[22em]">{d}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ④ 실제 화면 — 폰 갤러리. 캡션은 덱과 같은 문구로, 라이브인지 예시 데이터인지 밝힌다. */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
            <Reveal><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">제안을 받고, 정산까지 앱에서</h2></Reveal>
            <Reveal as="p" delay={80} className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] text-gray-500 dark:text-gray-400 max-w-[34em] leading-relaxed">
              매장에 돈을 달라고 할 일이 없습니다. 제안 수락도 적립 확인도 같은 앱 안에서 끝납니다.
            </Reveal>
            {/* 🎬 폰 세 대가 엇박으로 올라오고 PC 에서는 서로 다른 높이에서 떠 있다 */}
            <div className="mt-10 lg:mt-16 flex flex-wrap justify-center gap-8 lg:gap-16">
              <Reveal kind="scale" className="w-[42%] max-w-[13rem] lg:w-[17rem] lg:max-w-none">
                <PhoneShot src={SHOT('influencer-offer')} alt="매장이 보낸 소개 제안 화면"
                  caption="매장이 보낸 제안 (예시 데이터로 렌더한 실제 화면)" className="ur-float" />
              </Reveal>
              <Reveal kind="scale" delay={140} className="w-[42%] max-w-[13rem] lg:w-[17rem] lg:max-w-none lg:mt-16">
                <PhoneShot src={SHOT('influencer-settlement')} alt="내 소개 적립과 정산 화면"
                  caption="내 정산 화면 (예시 데이터)" className="ur-float-late" />
              </Reveal>
              <Reveal kind="scale" delay={280} className="hidden lg:block lg:w-[17rem]">
                <PhoneShot src={SHOT('creators-apply')} alt="소개 파트너 신청 폼 화면"
                  caption="신청 폼 (라이브 화면)" className="ur-float" />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ❓ 자주 묻는 것 — 화면 · 크롤러 본문 · FAQPage 가 같은 배열(landing-faq). 답은 접혀도 DOM 에 있다. */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 grid gap-10 lg:grid-cols-[0.62fr_1.38fr] lg:gap-16">
            <Reveal><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">자주 묻는 것</h2></Reveal>
            <div>
              {REFERRAL_FAQ.map(f => <FaqItem key={f.question} q={f.question} a={f.answer} />)}
            </div>
          </div>
        </section>

        {/* ⑤ 모집 — 색면 마무리. 구글폼 URL 이 들어오면 그 자리에 임베드한다. */}
        <section id="apply" className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
            <div className="max-w-[46rem] mx-auto text-center">
              <Reveal kind="scale"><h2 className="text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.22]">
                1기 소개 파트너 모집
              </h2></Reveal>
              <p className="mt-6 lg:mt-8 text-[15px] lg:text-[17px] leading-relaxed text-white/70">
                지금 지원하시면 온보딩 안내를 보내드립니다.
              </p>
            </div>

            {GOOGLE_FORM_URL ? (
              <div className="mt-10 lg:mt-14 max-w-[46rem] mx-auto rounded-2xl overflow-hidden bg-surface">
                <iframe src={GOOGLE_FORM_URL} title="1기 소개 파트너 지원 폼" className="w-full h-[640px] border-0" loading="lazy" />
              </div>
            ) : (
              <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-[32rem] mx-auto">
                <ApplyLink href={applyHref}
                  className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold active:scale-[0.98] transition-transform">
                  소개 파트너 지원 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                </ApplyLink>
                <Link to="/partners"
                  className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-white/[0.10] border border-white/20 flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
                  내 가게를 올리고 싶어요
                </Link>
              </div>
            )}

            <p className="mt-12 lg:mt-16 text-center text-[12px] lg:text-[13px] leading-relaxed text-white/45">
              {F.biz}
              <br />
              문의 {F.contactEmail}
            </p>
          </div>
        </section>
      </main>

      {/* 📱 모바일 고정 CTA. PC 는 상단 헤더 버튼과 각 섹션 CTA 가 담당한다(lg 에서 숨김) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#1D1F29]/95 backdrop-blur-md border-t border-rule px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto">
          <ApplyLink href={applyHref}
            className="flex h-12 rounded-2xl bg-brand text-white items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-transform">
            소개 파트너 지원 <ArrowRight className="w-4 h-4" />
          </ApplyLink>
        </div>
      </div>
    </div>
  )
}

/**
 * 지원 링크 — 구글폼이 오면 외부 새 탭, 아니면 앱 안 네이티브 폼.
 * ⚠️ 분기를 호출부마다 쓰면(예전 판이 그랬다) 네 자리에서 조건이 갈린다. 여기 한 곳에서만 판정한다.
 */
function ApplyLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith('http')) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  }
  return <Link to={href} className={className}>{children}</Link>
}

