/**
 * 🏪 입점 랜딩 히어로 — "체험단 말고, 계산하는 손님"
 *
 * 문구는 대표 승인 덱(`urdeal-store-owner-deck.build.mjs` 01 표지)과 **같은 문장**을 쓴다.
 *
 * ■ 2026-09-16 2차 (대표 *"PC 버전은 전혀 PC 버전 같지 않은데? 안 B로 하는데"*)
 *   1차 판을 1440px 로 실제 렌더해 재 보니 지적이 맞았다:
 *   ① **타이포가 모바일 치수였다** — h1 이 1440 에서도 48px. 오른쪽 3분의 1은 작은 카드 하나뿐이라
 *      까만 여백이 화면의 4분의 1을 먹었다.
 *   ② **사진이 0장이었다**(`main img` 실측 0). 글꼴과 여백만으로 서 있어 잘 정리된 문서였지 디자인이 아니었다.
 *   ⇒ 히어로를 **타이포 + 실물** 두 덩어리로 다시 세운다. 오른쪽은 손님이 실제로 보는 화면 두 장이다.
 *      "이용권이 뭔지" 를 설명하는 대신 **보여 준다**.
 *
 * ⚠️ **폰을 섹션 밖으로 흘리지 않는다.** 처음엔 작은 폰을 `absolute bottom-[-2.5rem]` 로 내려
 *    걸치게 했는데 `overflow-hidden` 이 아랫부분을 잘라 **고장처럼** 읽혔다(1440 렌더 실측).
 *    랜딩에서 잘린 스크린샷은 의도가 아니라 실수로 보인다 ⇒ 두 대 모두 온전히, 밑단만 어긋나게 둔다.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PartnerPhone, { SHOT } from './PartnerPhone'

const STATS = [
  { n: '0원', d: '미리 내는 돈' },
  { n: F.feeDirect, d: '팔린 뒤에만 내는 수수료' },
  { n: F.storeShareDirect, d: '사장님 몫' },
]

export default function PartnerHero() {
  return (
    <section className="ur-panel-ink text-white overflow-hidden">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24 xl:py-28 grid gap-14 lg:grid-cols-[1fr_0.86fr] lg:gap-16 xl:gap-24 lg:items-center">
        <div>
          <p className="text-[12px] lg:text-[13px] font-bold tracking-wide text-brand-text mb-4 lg:mb-6">유어딜 입점 안내</p>
          <h1 className="text-[31px] sm:text-[40px] lg:text-[54px] xl:text-[62px] leading-[1.16] font-extrabold tracking-[-0.03em]">
            체험단 말고,<br />
            <span className="text-brand-text">계산하는 손님</span>을<br className="hidden sm:block" /> 부르는 방법입니다
          </h1>
          <p className="mt-5 lg:mt-8 text-[14.5px] lg:text-[18px] xl:text-[19px] leading-[1.75] text-white/70 max-w-[30em]">
            후기 몇 개를 받으려고 무료 식사를 내드리고 대행비를 먼저 보내는 방식은 이제 안 하셔도 됩니다.
            유어딜은 가게 이용권을 온라인에서 미리 파는 곳입니다. 손님이 먼저 결제하고, 이용권을 들고 가게로 옵니다.
            사장님이 내는 건 팔린 이용권의 수수료 {F.feeDirect}, 그게 전부입니다.
          </p>

          <div className="mt-9 lg:mt-12 grid grid-cols-3 gap-3 lg:gap-8 max-w-[34rem]">
            {STATS.map(({ n, d }) => (
              <div key={d}>
                <p className="text-[28px] lg:text-[46px] xl:text-[54px] font-extrabold tracking-[-0.04em] tabular-nums leading-none">{n}</p>
                <p className="text-[11px] lg:text-[13px] leading-snug text-white/55 mt-2 lg:mt-3">{d}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
            <Link to="/store/new"
              className="flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-extrabold active:scale-[0.98] transition-transform">
              내 가게 등록하기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
            </Link>
            <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
              className="flex-1 h-[52px] lg:h-[58px] rounded-2xl border border-white/25 flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-bold text-white/90">
              <MessageCircle className="w-4 h-4 lg:w-[18px] lg:h-[18px]" /> 카카오로 물어보기
            </a>
          </div>
          <p className="mt-3.5 lg:mt-4 text-[12px] lg:text-[13px] text-white/50 max-w-[34em]">
            가입비와 월 이용료, 선불 광고비가 없습니다. 중개(대행사)를 통해 들어오시면 수수료는 {F.feeBrokered}입니다.
          </p>
        </div>

        {/* 손님이 보는 화면 — 말 대신 실물 */}
        <div>
          <div className="flex items-end justify-center gap-4 lg:gap-5">
            <PartnerPhone src={SHOT('home')} alt="유어딜 홈에 뜬 동네 이용권 목록" priority
              className="w-[46%] max-w-[15rem] lg:w-[54%] lg:max-w-none" />
            {/* 밑단을 한 단 올려 나란히 서지 않게 한다 — 두 장이 같은 선에 놓이면 카탈로그처럼 보인다 */}
            <PartnerPhone src={SHOT('detail')} alt="손님이 보는 이용권 상세 화면"
              className="w-[38%] max-w-[12.5rem] lg:w-[44%] lg:mb-12" />
          </div>
          <p className="mt-7 lg:mt-10 text-center text-[12px] lg:text-[13.5px] leading-relaxed text-white/50 max-w-[26em] mx-auto">
            손님이 실제로 보는 화면입니다. 사장님은 손님이 내미는 QR을 매장 폰으로 한 번 찍으면 됩니다.
          </p>
        </div>
      </div>
    </section>
  )
}
