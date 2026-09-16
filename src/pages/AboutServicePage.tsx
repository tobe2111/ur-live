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
import { Store, Users, Megaphone, QrCode, BadgePercent, MapPin, ArrowRight, FileText } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PhoneShot, { SHOT } from './landing/PhoneShot'

const BENEFITS = [
  { icon: BadgePercent, t: '동네 할인', d: '내 주변 맛집과 뷰티, 숙소를 정가보다 싸게' },
  { icon: QrCode, t: 'QR 간편 사용', d: '결제는 미리, 매장에선 QR 한 번이면 끝' },
  { icon: MapPin, t: '지도로 발견', d: '지금 내 위치 주변의 딜을 지도에서 바로' },
]

/** 3자 구조 — 각자가 내는 것과 받는 것. 셋이 한 문장으로 이어지도록 순서 고정. */
const TRIANGLE = [
  { icon: Store, t: '매장', gives: '팔린 만큼만 내는 판매 수수료', gets: '선불 광고비 없이 새 손님' },
  { icon: Megaphone, t: '소개하는 사람', gives: '내 유어샵에 담아 링크 하나로 소개', gets: '팔릴 때마다 쌓이는 몫' },
  { icon: Users, t: '소비자', gives: '앱에서 미리 결제', gets: '검증된 동네 가게를 할인가로' },
]

const STEPS = [
  ['매장 등록', '카카오맵에서 내 가게를 검색해 등록하면 사업자번호 확인으로 바로 활성화됩니다.'],
  ['이용권 등록', '메뉴와 가격, 할인을 설정하면 판매 1건당 실수령가를 그 자리에서 확인할 수 있어요.'],
  ['소개 제안', '유어딜 소개 파트너 목록에서 골라 커미션 조건으로 협업을 제안합니다. 발송은 유어딜이 대신해요.'],
  ['판매와 정산', '고객이 앱에서 결제하고 매장에서 QR 로 사용합니다. 사용 확정분이 자동 정산돼요.'],
]

export default function AboutServicePage() {
  return (
    <div className="min-h-[100dvh] bg-warm">
      <SEO title="서비스 소개 - 유어딜" description="유어딜은 동네 가게의 할인 이용권을 앱에서 사고 매장에서 QR 로 쓰는 로컬 딜 플랫폼입니다." url="/about" />

      <header className="sticky top-0 z-20 ur-panel-ink">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 h-14 lg:h-16 flex items-center justify-between">
          <Link to="/" aria-label="유어딜 홈" className="flex items-center gap-2.5">
            <UrDealLogo size={19} forceDark />
            <span className="hidden sm:inline text-[12.5px] font-bold text-white/55">서비스 소개</span>
          </Link>
          <div className="flex items-center gap-2 lg:gap-3">
            <Link to="/partners" className="hidden sm:inline text-[12.5px] font-semibold text-white/70 px-2">입점 안내</Link>
            <Link to="/creators" className="hidden sm:inline text-[12.5px] font-semibold text-white/70 px-2">소개하기</Link>
            <Link to="/"
              className="h-9 lg:h-10 px-3.5 lg:px-5 rounded-full bg-brand text-white inline-flex items-center gap-1.5 text-[12.5px] lg:text-[13.5px] font-extrabold">
              딜 보러가기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-24 lg:pb-0">
        {/* ① 히어로 — 잉크 색면 위 분할. 왼쪽은 타이포만, 오른쪽에 손님이 실제로 보는 두 화면.
            줄바꿈은 어절이 끊기지 않는 자리에만(예전엔 "…QR 로 / 쓰는" 으로 '쓰는' 이 홀로 남았다). */}
        <section className="ur-panel-ink text-white overflow-hidden">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 pt-10 pb-14 lg:pt-16 lg:pb-24 grid gap-14 lg:grid-cols-[1fr_0.72fr] lg:gap-16 xl:gap-24 lg:items-center">
            <div>
              <h1 className="text-[30px] sm:text-[38px] lg:text-[46px] xl:text-[52px] leading-[1.22] font-extrabold tracking-[-0.035em]">
                동네 가게의 할인 이용권을<br />
                <span className="text-brand-text">앱에서 사고, 매장에서 QR 로</span><br />
                쓰는 로컬 딜 플랫폼
              </h1>
              <p className="mt-6 lg:mt-8 text-[15px] lg:text-[19px] leading-[1.7] text-white/70 max-w-[26em]">
                서울 서초구 상권 활성화 사업을 수행하고 있어요.
              </p>
              <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
                <Link to="/"
                  className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-extrabold active:scale-[0.98] transition-transform">
                  내 주변 딜 보러가기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                </Link>
                <Link to="/partners"
                  className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-white/[0.10] border border-white/20 flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-bold text-white">
                  매장 입점 안내
                </Link>
              </div>
            </div>

            <div className="flex items-end justify-center gap-4 lg:gap-5">
              <PhoneShot src={SHOT('home')} alt="유어딜 홈에 뜬 내 주변 이용권 목록" priority
                className="w-[46%] max-w-[15rem] lg:w-[54%] lg:max-w-none" />
              {/* 밑단을 한 단 올려 나란히 서지 않게 한다. 같은 선에 놓이면 카탈로그처럼 보인다 */}
              <PhoneShot src={SHOT('use')} alt="매장에서 QR 로 이용권을 쓰는 화면"
                className="w-[38%] max-w-[12.5rem] lg:w-[44%] lg:mb-12" />
            </div>
          </div>
        </section>

        {/* ② 소비자 혜택 — 카드가 아니라 **헤어라인 목록**. PC 에서는 제목을 왼쪽 열에 고정하고
            목록만 오른쪽에서 커진다(제목이 목록 위에 또 한 줄 쌓이면 폰을 늘린 그림이 된다). */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
            <h2 className="text-[26px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2] lg:self-start lg:sticky lg:top-24">
              소비자에게는
            </h2>
            <div className="border-t border-rule">
              {BENEFITS.map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex items-baseline gap-3 lg:gap-6 py-3.5 lg:py-8 border-b border-rule">
                  <Icon className="w-4 h-4 lg:w-[22px] lg:h-[22px] shrink-0 translate-y-0.5 text-brand" strokeWidth={1.9} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14.5px] lg:text-[26px] font-extrabold text-ink tracking-[-0.02em]">{t}</p>
                    <p className="text-[12.5px] lg:text-[16px] text-gray-500 dark:text-gray-400 leading-snug lg:leading-relaxed mt-0.5 lg:mt-2 max-w-[34em]">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ③ 3자 구조 — 모바일은 세로 레일, PC 는 3열. 셋이 실제로 세 주체라 3열이 맞는 유일한 자리다.
            ⚠️ 카드로 감싸지 않는다(테두리 셋이 나란히 서면 곧바로 "3열 균등 카드" 가 된다). */}
        <section className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
            <h2 className="text-[26px] lg:text-[40px] font-extrabold tracking-[-0.03em] leading-[1.2]">셋이 함께 커지는 구조</h2>
            <p className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] text-white/60">누구도 먼저 돈을 내지 않습니다.</p>

            <ol className="mt-8 lg:mt-16 relative pl-5 lg:pl-0 lg:grid lg:grid-cols-3 lg:gap-12 xl:gap-20">
              <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-white/25 lg:hidden" />
              {TRIANGLE.map(({ icon: Icon, t, gives, gets }) => (
                <li key={t} className="relative pb-5 last:pb-0 lg:pb-0 lg:border-t lg:border-white/20 lg:pt-7">
                  <span aria-hidden className="absolute -left-5 top-1.5 w-[11px] h-[11px] rounded-full bg-[var(--home-field)] ring-2 ring-brand lg:hidden" />
                  <p className="flex items-center gap-1.5 lg:gap-2.5 text-[14.5px] lg:text-[28px] font-extrabold tracking-[-0.02em]">
                    <Icon className="w-[15px] h-[15px] lg:w-6 lg:h-6 text-brand-text" strokeWidth={1.9} aria-hidden />{t}
                  </p>
                  <p className="text-[12.5px] lg:text-[15px] text-white/60 leading-snug lg:leading-relaxed mt-1 lg:mt-6">
                    <span className="text-white/40">내는 것</span> {gives}
                  </p>
                  <p className="text-[12.5px] lg:text-[15px] leading-snug lg:leading-relaxed mt-0.5 lg:mt-3">
                    <span className="text-white/40 font-normal">받는 것</span> <b className="font-semibold">{gets}</b>
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-10 lg:mt-16 flex flex-wrap gap-2 lg:gap-3">
              <Link to="/partners" className="h-11 lg:h-[54px] px-4 lg:px-7 rounded-full border border-white/25 inline-flex items-center gap-1.5 text-[13px] lg:text-[15px] font-bold text-white">매장 입점 안내 <ArrowRight className="w-3.5 h-3.5" /></Link>
              <Link to="/creators" className="h-11 lg:h-[54px] px-4 lg:px-7 rounded-full border border-white/25 inline-flex items-center gap-1.5 text-[13px] lg:text-[15px] font-bold text-white">소개 파트너 모집 <ArrowRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>
        </section>

        {/* ④ 사장님 진행 — 모바일은 세로 레일, PC 는 **가로 타임라인**(가로선 하나에 네 점).
            숫자 배지(01/02/03/04)는 쓰지 않는다. 순서는 선이 이미 말한다(taste-skill: 섹션번호 금지). */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">
            <h2 className="text-[26px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">사장님은 이렇게 진행해요</h2>
            <p className="mt-3 lg:mt-5 text-[13px] lg:text-[17px] text-gray-500 dark:text-gray-400">가입부터 정산까지, 전부 셀러 대시보드 하나에서.</p>

            <ol className="mt-8 lg:mt-16 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-10">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-3 lg:block">
                  <span aria-hidden className="shrink-0 mt-[3px] w-5 text-[11px] font-extrabold tabular-nums text-gray-400 dark:text-gray-500 lg:hidden">{i + 1}</span>
                  <span aria-hidden className="hidden lg:flex items-center gap-3 mb-7">
                    <i className="w-[13px] h-[13px] rounded-full bg-brand not-italic" />
                    <i className="flex-1 h-px bg-rule not-italic" />
                  </span>
                  <div className="min-w-0 border-b border-rule pb-4 flex-1 last:border-0 lg:border-0 lg:pb-0">
                    <p className="text-[14.5px] lg:text-[22px] font-extrabold text-ink tracking-[-0.02em] leading-[1.3]">{t}</p>
                    <p className="text-[12.5px] lg:text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1 lg:mt-4">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ⑤ 숫자 — 3열 균등(예전)은 "준비 중" 을 확정 사실과 같은 크기로 세웠다.
            확정된 것 하나를 크게 두고 나머지는 옆(PC)·아래(모바일)로 내린다. */}
        <section className="bg-warm">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 pb-16 lg:pb-32 grid gap-8 lg:grid-cols-2 lg:gap-24 lg:items-end">
            <div>
              <h2 className="text-[26px] lg:text-[40px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2] mb-6 lg:mb-10">숫자와 이야기</h2>
              <p className="text-[34px] lg:text-[80px] xl:text-[96px] leading-none font-extrabold tracking-[-0.045em] text-ink">19조 원</p>
              <p className="text-[13px] lg:text-[17px] text-gray-500 dark:text-gray-400 mt-2 lg:mt-5">글로벌 동일 모델 시장 규모</p>
            </div>
            <div>
              <dl className="text-[12.5px] lg:text-[15px] leading-relaxed border-t border-rule pt-4 lg:pt-6">
                <div className="flex gap-3 lg:gap-6 py-1 lg:py-3 border-b border-rule">
                  <dt className="w-24 lg:w-36 shrink-0 text-gray-400 dark:text-gray-500">수행 사업</dt>
                  <dd className="text-ink">서초구 상권 활성화 사업</dd>
                </div>
                <div className="flex gap-3 lg:gap-6 py-1 lg:py-3">
                  <dt className="w-24 lg:w-36 shrink-0 text-gray-400 dark:text-gray-500">방배 파일럿</dt>
                  <dd className="text-gray-500 dark:text-gray-400">10월 실측 예정. 결과는 이 자리에 올립니다.</dd>
                </div>
              </dl>
              <Link to="/about/print" className="mt-6 lg:mt-8 inline-flex items-center gap-1.5 text-[13px] lg:text-[15px] font-bold text-ink underline underline-offset-4 decoration-rule-strong">
                <FileText className="w-4 h-4" /> 상세 소개서 보기 (PDF 저장 가능)
              </Link>
            </div>
          </div>
        </section>

        {/* ⑥ 마무리 — 색면 한 장. PC 에서 마지막 화면이 흰 여백으로 끝나면 페이지가 잘린 것처럼 보인다. */}
        <section className="ur-panel-ink text-white">
          <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-36 text-center">
            <h2 className="text-[26px] lg:text-[52px] xl:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.22]">
              지금 내 주변부터 열어 보세요
            </h2>
            <p className="mt-6 lg:mt-8 text-[14px] lg:text-[19px] leading-relaxed text-white/70 max-w-[32em] mx-auto">
              가입하면 내 유어샵이 함께 생깁니다. 좋았던 가게를 담아 두면 그대로 소개가 됩니다.
            </p>
            <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 justify-center max-w-[32rem] mx-auto">
              <Link to="/"
                className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-extrabold active:scale-[0.98] transition-transform">
                내 주변 딜 보러가기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
              </Link>
              <Link to="/creators"
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
          <Link to="/" className="flex h-12 rounded-2xl bg-brand text-white items-center justify-center gap-1.5 text-[14px] font-extrabold active:scale-[0.98] transition-transform">
            내 주변 딜 보러가기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
