/**
 * 🏪 입점 랜딩 히어로
 *
 * ■ 2026-09-16 3차 (대표 *"AI 가 만든 디자인, 말투가 아니면 좋겠는데"*)
 *   제목을 소리 내어 읽어 보면 티가 난다. 2차 판의 제목 아홉 개가 **전부 완결문**이었고
 *   **전부 "-습니다/-입니다"** 로 끝났다. 사람이 쓴 랜딩은 그렇게 안 된다 — 명사구로 끊고,
 *   묻고, 숫자를 그냥 던진다. 여기 h1 도 *"…부르는 방법입니다"* 의 뒤 네 글자가 군더더기였다.
 *   ⇒ **"체험단 말고, 계산하는 손님"** 에서 끊는다. 설명은 아래 두 줄이 한다.
 *
 * ■ 히어로에 글 덩어리를 넷까지만 둔다(anti-slop 프리플라이트).
 *   2차엔 여섯이었다: eyebrow + 제목 + 본문 + 숫자 + 버튼 + 잔글씨.
 *   **eyebrow 제거** — 바로 위 헤더가 이미 "입점 안내" 라고 말하고 있어 같은 말을 두 번 했다.
 *   잔글씨(중개 5%)는 수수료 숫자 옆으로 흡수.
 *
 * ⚠️ 폰을 섹션 밖으로 흘리지 않는다. 처음엔 작은 폰을 `absolute bottom-[-2.5rem]` 로 내려
 *    걸치게 했는데 `overflow-hidden` 이 아랫부분을 잘라 **고장처럼** 읽혔다(1440 렌더 실측).
 */
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import PartnerPhone, { SHOT } from './PartnerPhone'

export default function PartnerHero() {
  return (
    <section className="ur-panel-ink text-white overflow-hidden">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 pt-10 pb-14 lg:pt-14 lg:pb-24 grid gap-14 lg:grid-cols-[1fr_0.86fr] lg:gap-16 xl:gap-24 lg:items-center">
        <div>
          <h1 className="text-[34px] sm:text-[44px] lg:text-[58px] xl:text-[66px] leading-[1.14] font-extrabold tracking-[-0.035em]">
            체험단 말고,<br />
            <span className="text-brand-text">계산하는 손님</span>
          </h1>
          <p className="mt-6 lg:mt-8 text-[15.5px] lg:text-[19px] leading-[1.7] text-white/70 max-w-[26em]">
            손님이 온라인에서 먼저 결제하고, 이용권을 들고 가게로 옵니다.
            사장님이 내는 건 팔린 이용권의 수수료 {F.feeDirect}, 그게 전부입니다.
          </p>

          {/* 숫자는 카드에 담지 않는다. 담는 순간 "3열 균등 카드" 가 된다 */}
          <dl className="mt-10 lg:mt-12 flex flex-wrap gap-x-10 gap-y-6 lg:gap-x-14">
            <Stat n="0원" d="미리 내는 돈" />
            <Stat n={F.feeDirect} d={`팔린 뒤에만 (대행사 통하면 ${F.feeBrokered})`} />
            <Stat n={F.storeShareDirect} d="사장님 몫" />
          </dl>

          <div className="mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
            <Link to="/store/new"
              className="flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-extrabold active:scale-[0.98] transition-transform">
              내 가게 등록하기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
            </Link>
            <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
              className="flex-1 h-[52px] lg:h-[58px] rounded-2xl border border-white/25 flex items-center justify-center gap-2 text-[15px] lg:text-[16.5px] font-bold text-white/90">
              <MessageCircle className="w-4 h-4 lg:w-[18px] lg:h-[18px]" /> 카카오로 물어보기
            </a>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-center gap-4 lg:gap-5">
            <PartnerPhone src={SHOT('home')} alt="유어딜 홈에 뜬 동네 이용권 목록" priority
              className="w-[46%] max-w-[15rem] lg:w-[54%] lg:max-w-none" />
            {/* 밑단을 한 단 올려 나란히 서지 않게 한다. 같은 선에 놓이면 카탈로그처럼 보인다 */}
            <PartnerPhone src={SHOT('detail')} alt="손님이 보는 이용권 상세 화면"
              className="w-[38%] max-w-[12.5rem] lg:w-[44%] lg:mb-12" />
          </div>
          <p className="mt-7 lg:mt-10 text-center text-[12.5px] lg:text-[13.5px] text-white/50">
            손님이 보는 화면입니다.
          </p>
        </div>
      </div>
    </section>
  )
}

function Stat({ n, d }: { n: string; d: string }) {
  return (
    <div>
      <dt className="sr-only">{d}</dt>
      <dd>
        <span className="block text-[30px] lg:text-[48px] xl:text-[56px] font-extrabold tracking-[-0.045em] tabular-nums leading-none">{n}</span>
        <span className="block text-[11.5px] lg:text-[13px] text-white/55 mt-2 lg:mt-3 whitespace-nowrap">{d}</span>
      </dd>
    </div>
  )
}
