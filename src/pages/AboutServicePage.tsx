/**
 * 🧭 서비스 소개 랜딩 — `/about` (2026-07-19 대표 "웹페이지 3종" ②, 소비자·제휴처 겸용 1페이지)
 *   한 줄 정의 → 소비자 혜택 → 3자 구조 → 사장님 진행 → 숫자 → 앱 진입 CTA.
 *   상세 소개서(구 AboutPage, 인쇄/PDF)는 `/about/print` 로 보존, 하단 링크.
 *
 * ■ 2026-09-01 재작성 — 대표 *"AI 스럽지 않은 디자인으로 마무리"*
 *   `.claude/skills/taste-skill` 기준 다섯 항목 위반(eyebrow · 섹션번호 · em-dash · 가운뎃점 ·
 *   같은 레이아웃 계열 반복)을 걷어내고 섹션마다 다른 형태를 썼다. 그 결정은 이번에도 그대로다.
 *
 * ■ 2026-09-16 PC 판 (대표 *"PC를 같은 수준으로 만들어주고"*)
 *   같은 날 `/partners` 를 PC 로 세운 직후의 지시다. 재 보니 이 페이지는 `/partners` 가 안고 있던
 *   문제를 **똑같이** 갖고 있었다:
 *   ① `MobileAppLayout` 의 `HIDE_SIDEBAR_PREFIXES` 에 없어 **430px 소비자 액자**에 갇혔고,
 *      그 빈 거터를 `ConsumerFrameRails`(소비자 앱 바로가기 + 설치 QR)가 채웠다. 제휴처가
 *      서비스를 알아보러 온 화면의 좌우가 전부 앱 광고였다.
 *   ② 본문이 `max-w-xl`(576px) 고정이라 폭을 풀어도 **넓어진 모바일**이 된다.
 *   ③ 사진이 한 장도 없었다(`main img` 0개). "앱에서 사고 매장에서 QR 로 쓴다" 를 글로만 말했다.
 *
 *   ⇒ `/partners` 와 **같은 규약**으로 맞춘다: 잉크 헤더 + `ur-content-wide` + PC 타이포 단계
 *      (h1 lg 52 / xl 60, h2 lg 40) + 섹션마다 다른 레이아웃 계열 + 모바일 전용 고정 CTA(lg 숨김).
 *      캡처는 입점 랜딩·덱이 쓰는 **같은 파일**을 쓴다(`pages/landing/PhoneShot`).
 *
 * ■ 문구
 *   2026-09-01 승인분을 그대로 옮겼다. 이번 변경은 **배치와 크기**이고 새 주장은 넣지 않는다.
 *   연락·사업자 정보는 `shared/partners-facts`(덱과 대조되는 SSOT) 한 곳에서만 읽는다.
 */
import { Link } from 'react-router-dom'
import { StoreIcon, PeopleIcon, PinIcon } from '@/components/icons/urdeal-icons'
import { Megaphone, QrCode, BadgePercent, ArrowRight, FileText } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { SHOT } from './landing/PhoneShot'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { Line, Reveal, ScrollProgress, loadDelay } from './landing/motion'
import StickyStory, { type StoryStep } from './landing/StickyStory'
import { DeviceStage, GiantNumber, PhotoHero, ToneScroll, useLandingFont } from './landing/premium'

const BENEFITS = [
  { icon: BadgePercent, t: '동네 할인', d: '내 주변 맛집과 뷰티, 숙소를 정가보다 싸게' },
  { icon: QrCode, t: 'QR 간편 사용', d: '결제는 미리, 매장에선 QR 한 번이면 끝' },
  { icon: PinIcon, t: '지도로 발견', d: '지금 내 위치 주변의 딜을 지도에서 바로' },
]

/** 3자 구조 — 각자가 내는 것과 받는 것. 셋이 한 문장으로 이어지도록 순서 고정. */
const TRIANGLE = [
  { icon: StoreIcon, t: '매장', gives: '팔린 만큼만 내는 판매 수수료', gets: '선불 광고비 없이 새 손님' },
  { icon: Megaphone, t: '소개하는 사람', gives: '내 유어샵에 담아 링크 하나로 소개', gets: '매장이 건 소개 몫' },
  { icon: PeopleIcon, t: '소비자', gives: '앱에서 미리 결제', gets: '검증된 동네 가게를 할인가로' },
]

// 💎 2026-11-01 고급화 ④: 단계를 지날 때마다 바탕이 밝음 → 옅은 파랑 → 어둠으로 바뀌고, 어둠이 아래 숫자로 이어진다.
const STEPS: StoryStep[] = [
  { t: '매장 등록', d: '카카오맵에서 내 가게를 찾아 등록합니다.', shot: 'store-new', alt: '카카오맵에서 내 가게를 찾는 등록 화면', tone: 'paper' },
  { t: '이용권 등록', d: '메뉴와 할인을 정하면 실수령가가 바로 보여요.', shot: 'detail', alt: '등록한 이용권이 손님에게 보이는 화면', tone: 'paper' },
  { t: '소개 제안', d: '팔아 줄 소개 파트너를 골라 제안합니다.', shot: 'seller-influencers', alt: '내 이용권을 팔아 줄 소개 파트너를 찾는 화면', tone: 'tint' },
  { t: '판매와 정산', d: '손님이 QR로 쓴 만큼 정산됩니다.', shot: 'seller-settlements', alt: '정산 화면 (예시 데이터)', tone: 'ink' },
]

export default function AboutServicePage() {
  // 💎 2026-11-01 고급화 ⑥ — 제목 전용 글꼴(명조)을 이 페이지에서만 받는다
  useLandingFont()
  return (
    <div className="min-h-[100dvh] bg-warm ur-landing-type overflow-x-clip">
      <SEO title={CONSUMER_SURFACE_SEO['/about'].title} description={CONSUMER_SURFACE_SEO['/about'].description} url="/about" />

      <header className="sticky top-0 z-20 ur-panel-ink">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between">
          <Link to="/" aria-label="유어딜 홈" className="flex items-center gap-2">
            <UrDealLogo size={19} forceDark />
            <span className="hidden sm:inline text-[12px] font-medium text-white/55">서비스 소개</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-3">
            <Link to="/partners" className="hidden sm:inline text-[12px] font-medium text-white/70 px-2">입점 안내</Link>
            <Link to="/influencer" className="hidden sm:inline text-[12px] font-medium text-white/70 px-2">소개하기</Link>
            <Link to="/"
              className="h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-brand text-white inline-flex items-center gap-2 text-[12px] lg:text-[13px] font-medium">
              딜 보러가기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        <ScrollProgress />
      </header>

      <main className="pb-24 lg:pb-0">
        {/* ① 히어로 — 💎 2026-11-01 고급화 ①②: 실사진을 꽉 채운 첫 화면. 폰 두 대는 바로 아래 실기기 무대로. */}
        <PhotoHero photo="about">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 min-h-[calc(100svh-56px)] lg:min-h-[calc(100svh-64px)] flex flex-col justify-end pt-40 pb-28">
            <h1 className="text-[40px] sm:text-[48px] lg:text-[76px] leading-[1.14] font-extrabold tracking-[-0.035em]">
              {/* 🎬 한 줄씩 마스크 안에서 밀려 올라온다 */}
              <Line i={0}>동네 가게 할인 이용권을</Line>
              <Line i={1}><span className="text-brand-text">앱에서 사고, 매장에서 QR</span>로</Line>
            </h1>
            <p style={loadDelay(320)} className="ur-load mt-6 lg:mt-8 text-[15px] lg:text-[17px] leading-[1.7] text-white/80 max-w-[26em]">
              서울 서초구 상권 활성화 사업을 수행하고 있어요.
            </p>
            <div style={loadDelay(460)} className="ur-load mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
              <Link to="/"
                className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold active:scale-[0.98] transition-transform">
                내 주변 딜 보러가기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </Link>
              <Link to="/partners"
                className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-white/[0.12] border border-white/25 backdrop-blur-sm flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
                매장 입점 안내
              </Link>
            </div>
          </div>
        </PhotoHero>

        {/* 💎 고급화 ③ — 실기기 폰 두 대. 손님 쪽은 라이브 앱을 녹화한 영상이다. */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-20 lg:py-36 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
            <div>
              <Reveal><h2 className="text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold tracking-[-0.03em] text-ink leading-[1.18]">
                고르고, 사고,<br />QR 한 번
              </h2></Reveal>
              <Reveal as="p" delay={80} className="mt-5 lg:mt-7 text-[15px] lg:text-[17px] leading-[1.7] text-gray-500 dark:text-gray-400 max-w-[24em]">
                손님 화면은 실제 앱을 녹화한 영상입니다.
              </Reveal>
            </div>
            <DeviceStage
              back={{ shot: SHOT('customer-home-poster'), video: '/static/partners/customer-home.mp4', alt: '내 주변 이용권 목록을 넘겨 보는 실제 앱 화면', tag: '홈 화면', live: true }}
              front={{ shot: SHOT('use'), alt: '매장에서 QR 로 이용권을 쓰는 화면', tag: '사용 화면' }}
              toast={{ title: '이용권 사용 완료', sub: '매장에서 QR 한 번이면 끝' }}
            />
          </div>
        </section>

        {/* ② 소비자 혜택 — 카드가 아니라 **헤어라인 목록**. PC 에서는 제목을 왼쪽 열에 고정하고
            목록만 오른쪽에서 커진다(제목이 목록 위에 또 한 줄 쌓이면 폰을 늘린 그림이 된다). */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
            <Reveal className="lg:self-start lg:sticky lg:top-24"><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
              소비자에게는
            </h2></Reveal>
            <div className="border-t border-rule">
              {BENEFITS.map(({ icon: Icon, t, d }, i) => (
                <Reveal key={t} delay={i * 90} className="flex items-baseline gap-3 lg:gap-6 py-4 lg:py-8 border-b border-rule">
                  <Icon className="w-4 h-4 lg:w-[22px] lg:h-[22px] shrink-0 translate-y-0.5 text-brand" strokeWidth={1.9} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[15px] lg:text-[28px] font-bold text-ink tracking-[-0.02em]">{t}</p>
                    <p className="text-[12px] lg:text-[17px] text-gray-500 dark:text-gray-400 leading-snug lg:leading-relaxed mt-1 lg:mt-2 max-w-[34em]">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ③ 3자 구조 — 모바일은 세로 레일, PC 는 3열. 셋이 실제로 세 주체라 3열이 맞는 유일한 자리다.
            ⚠️ 카드로 감싸지 않는다(테두리 셋이 나란히 서면 곧바로 "3열 균등 카드" 가 된다). */}
        <section className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
            <Reveal><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] leading-[1.2]">셋이 함께 커지는 구조</h2></Reveal>
            <p className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] text-white/60">누구도 먼저 돈을 내지 않습니다.</p>

            <ol className="mt-8 lg:mt-16 relative pl-5 lg:pl-0 lg:grid lg:grid-cols-3 lg:gap-12 xl:gap-20">
              <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-white/25 lg:hidden" />
              {TRIANGLE.map(({ icon: Icon, t, gives, gets }, i) => (
                <Reveal as="li" key={t} delay={i * 140} className="relative pb-5 last:pb-0 lg:pb-0 lg:border-t lg:border-white/20 lg:pt-7">
                  <span aria-hidden className="absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full bg-[var(--home-field)] ring-2 ring-brand lg:hidden" />
                  <p className="flex items-center gap-2 lg:gap-2 text-[15px] lg:text-[28px] font-bold tracking-[-0.02em]">
                    <Icon className="w-[15px] h-[15px] lg:w-6 lg:h-6 text-brand-text" strokeWidth={1.9} aria-hidden />{t}
                  </p>
                  <p className="text-[12px] lg:text-[15px] text-white/60 leading-snug lg:leading-relaxed mt-1 lg:mt-6">
                    <span className="text-white/40">내는 것</span> {gives}
                  </p>
                  <p className="text-[12px] lg:text-[15px] leading-snug lg:leading-relaxed mt-1 lg:mt-3">
                    <span className="text-white/40 font-normal">받는 것</span> <b className="font-medium">{gets}</b>
                  </p>
                </Reveal>
              ))}
            </ol>

            <div className="mt-10 lg:mt-16 flex flex-wrap gap-2 lg:gap-3">
              <Link to="/partners" className="h-11 lg:h-[54px] px-4 lg:px-7 rounded-full border border-white/25 inline-flex items-center gap-2 text-[13px] lg:text-[15px] font-medium text-white">매장 입점 안내 <ArrowRight className="w-3.5 h-3.5" /></Link>
              <Link to="/influencer" className="h-11 lg:h-[54px] px-4 lg:px-7 rounded-full border border-white/25 inline-flex items-center gap-2 text-[13px] lg:text-[15px] font-medium text-white">소개 파트너 모집 <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>
        </section>

        {/* ④ 사장님 진행 — 🎬 2026-10-31: 점 네 개짜리 가로 타임라인(AI 랜딩의 가장 흔한 그림)을 **고정 화면 스토리**로.
            PC 에서 폰이 멈춰 있고 단계가 지나갈 때마다 그 단계의 실제 화면으로 바뀐다(`landing/StickyStory`). */}
        <ToneScroll initial="paper">
        <section>
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
            <Reveal><h2 className="text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] ur-tone-fg leading-[1.2]">사장님은 이렇게 진행해요</h2></Reveal>
            <Reveal as="p" delay={80} className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] ur-tone-mu">가입부터 정산까지 한 곳에서.</Reveal>
            <div className="mt-8 lg:mt-16">
              <StickyStory steps={STEPS} shotUrl={SHOT} />
            </div>
          </div>
        </section>

        {/* ⑤ 숫자 — 💎 2026-11-01 고급화 ⑤: 확정된 숫자 하나를 화면을 채우는 그래픽으로. 앞 스토리의 어둠이 이어진다. */}
        <section data-tone="ink">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 pt-8 pb-20 lg:pb-36 overflow-hidden">
            <h2 className="ur-tone-fg text-[28px] lg:text-[40px] font-extrabold tracking-[-0.03em] leading-[1.2] mb-6 lg:mb-10">숫자와 이야기</h2>
            <GiantNumber value="19" unit="조 원" label="글로벌 동일 모델 시장 규모 19조 원" />
            <div className="mt-8 lg:mt-12 grid gap-8 lg:grid-cols-2 lg:gap-24 lg:items-end">
              <p className="text-[15px] lg:text-[17px] ur-tone-mu">글로벌 동일 모델 시장 규모</p>
              <div>
                <dl className="text-[12px] lg:text-[15px] leading-relaxed border-t border-white/15 pt-4 lg:pt-6">
                  <div className="flex gap-3 lg:gap-6 py-1 lg:py-3 border-b border-white/15">
                    <dt className="w-24 lg:w-36 shrink-0 ur-tone-mu">수행 사업</dt>
                    <dd className="ur-tone-fg">서초구 상권 활성화 사업</dd>
                  </div>
                  <div className="flex gap-3 lg:gap-6 py-1 lg:py-3">
                    <dt className="w-24 lg:w-36 shrink-0 ur-tone-mu">방배 파일럿</dt>
                    <dd className="ur-tone-mu">10월 실측 예정. 결과는 이 자리에 올립니다.</dd>
                  </div>
                </dl>
                <Link to="/about/print" className="mt-6 lg:mt-8 inline-flex items-center gap-2 text-[13px] lg:text-[15px] font-medium ur-tone-fg underline underline-offset-4 decoration-white/30">
                  <FileText className="w-4 h-4" /> 상세 소개서 보기 (PDF 저장 가능)
                </Link>
              </div>
            </div>
          </div>
        </section>
        </ToneScroll>

        {/* ⑥ 마무리 — 색면 한 장. PC 에서 마지막 화면이 흰 여백으로 끝나면 페이지가 잘린 것처럼 보인다. */}
        <section className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-36 text-center">
            <Reveal kind="scale"><h2 className="text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.22]">
              지금 내 주변부터 열어 보세요
            </h2></Reveal>
            <p className="mt-6 lg:mt-8 text-[15px] lg:text-[17px] leading-relaxed text-white/70 max-w-[32em] mx-auto">
              가입하면 내 유어샵이 함께 생깁니다. 좋았던 가게를 담아 두면 그대로 소개가 됩니다.
            </p>
            <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-[32rem] mx-auto">
              <Link to="/"
                className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold active:scale-[0.98] transition-transform">
                내 주변 딜 보러가기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </Link>
              <Link to="/influencer"
                className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-white/[0.10] border border-white/20 flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
                소개하고 커미션 받기
              </Link>
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
        <div className="max-w-xl mx-auto">
          <Link to="/" className="flex h-12 rounded-2xl bg-brand text-white items-center justify-center gap-2 text-[15px] font-bold active:scale-[0.98] transition-transform">
            내 주변 딜 보러가기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
