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
 *
 * ■ 2026-11-01 (대표 *"전부 세 페이지에 모두 적용해줘"* — 고급화 시안 ①②)
 *   첫 화면을 **실사진이 꽉 찬 화면**으로 바꿨다(`PhotoHero`). 폰 두 대는 바로 아래 `PartnerShowcase` 의
 *   실기기 무대로 옮기고, 숫자 셋은 그 위의 거대한 숫자(90%)가 대신 말한다. 글 덩어리는 넷 → 셋(제목·한 줄·버튼).
 */
import { Link } from 'react-router-dom'
import { MessageIcon } from '@/components/icons/urdeal-icons'
import { ArrowRight } from 'lucide-react'
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { Line, loadDelay } from '../landing/motion'
import { PhotoHero } from '../landing/premium'

export default function PartnerHero() {
  return (
    <PhotoHero photo="partners">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 min-h-[calc(100svh-56px)] lg:min-h-[calc(100svh-64px)] flex flex-col justify-end pt-40 pb-28">
        <h1 className="text-[40px] sm:text-[48px] lg:text-[76px] xl:text-[96px] leading-[1.12] font-extrabold tracking-[-0.035em]">
          {/* 🎬 한 줄씩 마스크 안에서 밀려 올라온다(로드 직후 한 번) */}
          <Line i={0}>체험단 말고,</Line>
          <Line i={1}><span className="text-brand-text">계산하는 손님</span></Line>
        </h1>
        <p style={loadDelay(320)} className="ur-load mt-6 lg:mt-8 text-[15px] lg:text-[17px] leading-[1.7] text-white/80 max-w-[26em]">
          손님이 먼저 결제하고 가게로 옵니다. 팔린 만큼만 수수료 {F.feeDirect}.
        </p>

        <div style={loadDelay(460)} className="ur-load mt-10 lg:mt-12 flex flex-col sm:flex-row gap-3 max-w-[32rem]">
          <Link to="/store/new"
            className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand text-white flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold active:scale-[0.98] transition-transform">
            내 가게 등록하기 <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
          </Link>
          <a href={F.kakaoChannel} target="_blank" rel="noopener noreferrer"
            className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-white/[0.12] border border-white/25 backdrop-blur-sm flex items-center justify-center gap-2 text-[15px] lg:text-[17px] font-bold text-white">
            <MessageIcon className="w-4 h-4 lg:w-[18px] lg:h-[18px]" /> 카카오로 물어보기
          </a>
        </div>
      </div>
    </PhotoHero>
  )
}
