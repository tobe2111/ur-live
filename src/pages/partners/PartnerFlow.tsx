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
import PartnerPhone, { SHOT } from './PartnerPhone'

const STEPS = [
  { t: '찾는다', d: '지도와 유어샵, 유어쇼츠에서 동네 이용권을 봅니다' },
  { t: '결제한다', d: '가게에 오기 전에 온라인에서 먼저 값을 치릅니다' },
  { t: '받는다', d: '이용권이 손님 폰으로 바로 발급됩니다' },
  { t: '가게에서 쓴다', d: 'QR을 찍거나 매장 확인코드 6자리를 넣습니다' },
]

const SAFETY = [
  {
    t: '안 온 손님 때문에 손해 볼 일이 없습니다',
    d: '정산은 손님이 실제로 사용한 이용권만 대상입니다. 팔렸는데 아무도 안 오면 사장님이 부담하는 돈은 0원입니다.',
  },
  {
    t: '안 쓴 이용권은 유어딜이 알아서 환불합니다',
    d: '유효기간은 사장님이 정합니다. 기간이 지나면 미사용분은 100% 자동으로 환불되고, 그 처리도 유어딜이 합니다. 사장님이 환불 응대를 할 일이 없습니다.',
  },
]

export default function PartnerFlow() {
  return (
    <>
      <section className="bg-surface">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-32">
          <h2 className="text-[26px] lg:text-[40px] xl:text-[46px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
            손님이 오는 길
          </h2>
          <p className="mt-4 text-[14px] lg:text-[17px] text-gray-500 dark:text-gray-400 max-w-[34em]">
            택배도 반품도 재고도 없습니다. 사장님이 만나는 건 결제를 마친 손님 한 명입니다.
          </p>

          {/* 가로 타임라인 — 선 하나가 네 칸을 관통한다(PC). 모바일은 세로 스택 */}
          <ol className="mt-12 lg:mt-20 relative grid gap-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            <span aria-hidden className="hidden lg:block absolute left-0 right-0 top-[7px] h-px bg-rule-strong opacity-40" />
            {STEPS.map(({ t, d }) => (
              <li key={t} className="relative lg:pt-12">
                <span aria-hidden className="hidden lg:block absolute left-0 top-0 w-[15px] h-[15px] rounded-full bg-brand ring-4 ring-surface" />
                <p className="text-[20px] lg:text-[30px] xl:text-[34px] font-extrabold text-ink tracking-[-0.025em] leading-tight">{t}</p>
                <p className="mt-3 lg:mt-4 text-[13px] lg:text-[15.5px] leading-[1.75] text-gray-500 dark:text-gray-400">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-warm">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28 grid gap-12 lg:grid-cols-[1.4fr_0.6fr] lg:gap-20">
          <div>
            <h2 className="text-[26px] lg:text-[40px] xl:text-[46px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2]">
              안 오면요? 안 쓰면요?
            </h2>

            <div className="mt-10 lg:mt-16 space-y-9 lg:space-y-12">
              {SAFETY.map(({ t, d }) => (
                <div key={t}>
                  <p className="text-[18px] lg:text-[26px] font-extrabold tracking-[-0.02em] text-ink leading-snug">{t}</p>
                  <p className="mt-3 text-[13.5px] lg:text-[16px] leading-[1.8] text-gray-500 dark:text-gray-400 max-w-[36em]">{d}</p>
                </div>
              ))}
              <div className="pt-9 border-t border-rule">
                <p className="text-[18px] lg:text-[26px] font-extrabold tracking-[-0.02em] text-ink leading-snug">돈은 매주 들어옵니다</p>
                <p className="mt-3 text-[13.5px] lg:text-[16px] leading-[1.8] text-gray-500 dark:text-gray-400 max-w-[36em]">
                  사용된 이용권을 주 단위로 모아 등록하신 계좌로 보냅니다. 최소 지급액은 {F.minPayout}입니다.
                  보내기 전에 담당자가 내역을 눈으로 확인합니다. 기계가 알아서 쏘는 구조가 아닙니다.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-[15rem] mx-auto lg:mx-0 lg:max-w-none lg:pt-4">
            <PartnerPhone src={SHOT('use')} alt="손님이 보는 사용 안내와 환불 조건 화면" />
            <p className="mt-4 text-[12.5px] lg:text-[13.5px] text-gray-500 dark:text-gray-400">손님이 보는 사용 안내와 환불 조건</p>
          </div>
        </div>
      </section>
    </>
  )
}
