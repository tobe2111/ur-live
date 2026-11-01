/**
 * 🏪 손님이 겪는 4단계 + 사고가 나면 + 정산 — 대표 승인 덱 03·08·09장.
 *
 * ■ 2026-09-16 2차: 4단계를 **가로 타임라인**으로 세웠다(PC 에서 선 하나가 네 칸을 관통한다).
 *   1차의 4열 균등 카드는 위아래 섹션과 그림이 겹쳐 "넓어진 모바일" 로 읽혔다.
 *   '사고가 나면' 밴드에는 손님이 실제로 보는 **사용 안내·환불 조건 화면**을 건다 —
 *   환불 약속은 글보다 화면이 믿긴다.
 *
 * ■ 2026-09-16 3차 (대표 *"AI 가 만든 디자인, 말투가 아니면"*)
 *   ① 단계마다 붙인 파란 `01~04` 를 지웠다. 스킬이 "generic step labels" 로 금지한 그림이고,
 *      **단계 이름 자체가 라벨**이다("찾는다" 위에 "01" 을 붙이는 건 아무것도 안 알려 준다).
 *      진행은 점과 선이 이미 말한다.
 *   ② '사고가 나면' 밴드를 색면에서 **밝은 면으로** 되돌렸다. 다크 → 라이트 → 다크 → 라이트로
 *      페이지가 줄무늬가 됐기 때문이다(스킬 §4.11 Page Theme Lock). 색면은 히어로와 마지막 CTA,
 *      **양 끝 둘만** 쓴다.
 *   ③ 제목을 짧게: "손님은 이렇게 옵니다" → "손님이 오는 길" · "사고가 나면 어떻게 되나요" → "안 오면요? 안 쓰면요?"
 *
 * ⚠️ "자동 승인" 과 "자동 송금" 은 쓰지 않는다(기획 §0-2: 등록증은 사람이 확인하고,
 *   정산 승인·송금도 사람이 누른다). 코드가 그렇게 동작하지 않는 말을 랜딩에 적으면
 *   사장님이 첫 정산에서 그 차이를 발견한다.
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'
import { SHOT } from './PartnerPhone'
import { Reveal } from '../landing/motion'
import StickyStory, { type StoryStep } from '../landing/StickyStory'
import { ToneScroll } from '../landing/premium'

// 💎 2026-11-01 고급화 ④: 단계를 지날 때마다 바탕이 밝음 → 옅은 파랑 → 어둠으로 바뀌고, 마지막 어둠이
//   바로 아래 '안 오면요?' 잉크 띠로 끊김 없이 이어진다.
const STEPS: StoryStep[] = [
  { t: '찾는다', d: '지도와 유어샵, 유어쇼츠에서 동네 이용권을 봅니다', shot: 'home', alt: '손님이 보는 동네 이용권 목록', tone: 'paper' },
  { t: '결제한다', d: '가게에 오기 전에 온라인에서 먼저 값을 치릅니다', shot: 'detail', alt: '이용권 상세와 결제 버튼', tone: 'paper' },
  { t: '받는다', d: '이용권이 손님 폰으로 바로 발급됩니다', shot: 'use', alt: '손님 폰에 발급된 이용권과 사용 안내', tone: 'tint' },
  { t: '가게에서 쓴다', d: 'QR을 찍거나 매장 확인코드 6자리를 넣습니다', shot: 'seller-scan', alt: '매장 폰으로 손님 QR 을 찍는 화면', tone: 'ink' },
]

const SAFETY = [
  {
    t: '안 온 손님 때문에 손해 볼 일이 없습니다',
    d: '정산은 실제로 쓴 이용권만 합니다. 아무도 안 오면 사장님 부담은 0원입니다.',
  },
  {
    t: '안 쓴 이용권은 유어딜이 알아서 환불합니다',
    d: '유효기간은 사장님이 정합니다. 지나면 유어딜이 100% 자동 환불하고 응대까지 합니다.',
  },
]

export default function PartnerFlow() {
  return (
    <>
      <ToneScroll initial="paper"><section>
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
          <Reveal><h2 className="text-[28px] lg:text-[40px] xl:text-[48px] font-extrabold tracking-[-0.03em] ur-tone-fg leading-[1.2]">
            손님이 오는 길
          </h2></Reveal>
          <Reveal as="p" delay={80} className="mt-4 text-[15px] lg:text-[17px] ur-tone-mu max-w-[34em]">
            택배도 반품도 재고도 없습니다.
          </Reveal>

          {/* 🎬 2026-10-31 고정 화면 스토리 — PC 에서 폰은 멈춰 있고 글이 지나간다. 지금 화면 가운데를 지나는
              단계의 화면으로 폰이 바뀐다(점 네 개짜리 가로 타임라인을 대체 — 가장 흔한 AI 랜딩 그림이었다).
              폰에서는 단계마다 작은 화면을 옆에 둔다(고정하면 화면 절반을 폰이 먹는다). */}
          <div className="mt-12 lg:mt-20">
            <StickyStory steps={STEPS} shotUrl={SHOT} />
          </div>
        </div>
      </section></ToneScroll>

      {/* 🌙 2026-10-31: 흰·회색만 이어지던 리듬을 끊는 어두운 띠. 같은 [제목 + 문단 세로 나열] 을 반복하지 않게
          두 칸 나란히 + 아래 넓은 줄로 나눈다. 사용 안내 화면은 위 스토리로 옮겼다. */}
      <section className="ur-panel-ink text-white">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
          <Reveal><h2 className="text-[28px] lg:text-[48px] xl:text-[60px] font-extrabold tracking-[-0.03em] leading-[1.2]">
            안 오면요? 안 쓰면요?
          </h2></Reveal>

          <div className="mt-10 lg:mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16">
            {SAFETY.map(({ t, d }, i) => (
              <Reveal key={t} delay={i * 120} className="pt-8 border-t border-white/15">
                <p className="text-[17px] lg:text-[28px] font-bold tracking-[-0.02em] leading-snug">{t}</p>
                <p className="mt-3 text-[13px] lg:text-[17px] leading-[1.8] text-white/65 max-w-[36em]">{d}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12 lg:mt-20 rounded-2xl bg-white/[0.06] p-6 lg:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12">
            <p className="text-[24px] lg:text-[34px] font-bold tracking-[-0.02em] leading-snug shrink-0">돈은 매주 들어옵니다</p>
            <p className="mt-3 lg:mt-0 text-[13px] lg:text-[17px] leading-[1.8] text-white/65 max-w-[36em]">
              사용된 이용권을 주 단위로 모아 등록하신 계좌로 보냅니다. 최소 지급액은 {F.minPayout}입니다.
              보내기 전에 담당자가 내역을 눈으로 확인합니다. 기계가 알아서 쏘는 구조가 아닙니다.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
