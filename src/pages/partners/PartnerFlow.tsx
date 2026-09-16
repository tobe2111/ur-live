/**
 * 🏪 손님이 겪는 4단계 + 사고가 나면 + 정산 — 대표 승인 덱 03·08·09장.
 *
 * ⚠️ "자동 승인" 과 "자동 송금" 은 쓰지 않는다(기획 §0-2: 등록증은 사람이 확인하고,
 *   정산 승인·송금도 사람이 누른다). 코드가 그렇게 동작하지 않는 말을 랜딩에 적으면
 *   사장님이 첫 정산에서 그 차이를 발견한다.
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

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
      <section className="bg-warm">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
          <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28]">
            손님은 이렇게 옵니다
          </h2>
          <p className="mt-3 text-[14px] lg:text-[17px] text-gray-500 dark:text-gray-400">
            택배도, 반품도, 재고도 없습니다. 사장님이 만나는 건 이미 결제를 마친 손님 한 명입니다.
          </p>

          <ol className="mt-10 lg:mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-9">
            {STEPS.map(({ t, d }, i) => (
              <li key={t} className="relative lg:pt-7">
                <span aria-hidden className="hidden lg:block absolute left-0 right-0 top-0 h-px bg-rule-strong opacity-40" />
                <p className="text-[12px] font-extrabold text-brand-text tabular-nums">0{i + 1}</p>
                <p className="mt-2 text-[17px] lg:text-[20px] font-extrabold text-ink tracking-[-0.01em]">{t}</p>
                <p className="mt-2 text-[13px] lg:text-[14px] leading-relaxed text-gray-500 dark:text-gray-400">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="ur-panel-ink text-white">
        <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] leading-[1.28]">
              사고가 나면<br className="hidden lg:block" /> 어떻게 되나요
            </h2>
            <div className="space-y-9 lg:space-y-11">
              {SAFETY.map(({ t, d }) => (
                <div key={t}>
                  <p className="text-[17px] lg:text-[22px] font-extrabold tracking-[-0.01em]">{t}</p>
                  <p className="mt-2.5 text-[13.5px] lg:text-[15.5px] leading-[1.75] text-white/70 max-w-[42em]">{d}</p>
                </div>
              ))}
              <div className="pt-8 border-t border-white/10">
                <p className="text-[17px] lg:text-[22px] font-extrabold tracking-[-0.01em]">돈은 매주 들어옵니다</p>
                <p className="mt-2.5 text-[13.5px] lg:text-[15.5px] leading-[1.75] text-white/70 max-w-[42em]">
                  사용된 이용권을 주 단위로 모아 등록하신 계좌로 보냅니다. 최소 지급액은 {F.minPayout}입니다.
                  보내기 전에 유어딜 담당자가 내역을 눈으로 확인합니다. 기계가 알아서 쏘는 구조가 아닙니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
