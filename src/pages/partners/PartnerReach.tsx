/**
 * 🏪 손님을 더 부르는 두 가지 — 대표 승인 덱 10장.
 *
 * ⚠️ 트래픽·노출을 **약속하지 않는다**(기획 §0-4 금지 목록). 여기 적는 것은 "무엇이 준비돼 있는가" 지
 *   "얼마나 올려 드린다" 가 아니다. 숫자는 §0-3 실측값(2026-09-13).
 * ⚠️ 소개비는 **매장이 정하고 매장이 낸다.** 유어딜이 대신 주는 돈이 아니다.
 */
import { PARTNER_FACTS as F } from '@/shared/partners-facts'

export default function PartnerReach() {
  return (
    <section className="bg-surface">
      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">
        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28]">
          손님을 더 부르고 싶으실 때
        </h2>

        <div className="mt-10 lg:mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <article className="rounded-2xl bg-warm p-6 lg:p-9">
            <p className="text-[12px] font-bold text-brand-text">소개해 줄 사람에게 직접 제안</p>
            <p className="mt-3 text-[19px] lg:text-[26px] font-extrabold text-ink leading-snug tracking-[-0.01em]">
              팔린 만큼만 드리는 조건으로<br />동네 채널에 제안할 수 있습니다
            </p>
            <p className="mt-4 text-[13.5px] lg:text-[15px] leading-[1.75] text-gray-500 dark:text-gray-400">
              소개비를 몇 %로 할지 사장님이 적어서 보냅니다. 팔렸을 때만 나가고, 그 돈은 사장님 몫에서 나갑니다.
              선불 대행비가 아니라 성과가 난 뒤에 나가는 돈이라는 점이 체험단과 다릅니다.
            </p>
            <dl className="mt-7 grid grid-cols-2 gap-4 pt-6 border-t border-rule">
              <div>
                <dt className="text-[11.5px] text-gray-400 dark:text-gray-500">유어딜이 모아 둔 채널</dt>
                <dd className="text-[22px] lg:text-[27px] font-extrabold text-ink tabular-nums tracking-[-0.02em] mt-0.5">{F.influencerDb}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-gray-400 dark:text-gray-500">그중 연락 가능</dt>
                <dd className="text-[22px] lg:text-[27px] font-extrabold text-ink tabular-nums tracking-[-0.02em] mt-0.5">{F.influencerReachable}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11.5px] text-gray-400 dark:text-gray-500">
              {F.liveMeasuredAt} 실측. 연결을 보장하는 숫자가 아니라 제안을 보낼 수 있는 모수입니다.
            </p>
          </article>

          <article className="rounded-2xl bg-warm p-6 lg:p-9 flex flex-col">
            <p className="text-[12px] font-bold text-brand-text">등록만 해도 놓이는 자리</p>
            <p className="mt-3 text-[19px] lg:text-[26px] font-extrabold text-ink leading-snug tracking-[-0.01em]">
              지도와 유어샵, 유어쇼츠에<br />따로 돈 내지 않고 올라갑니다
            </p>
            <p className="mt-4 text-[13.5px] lg:text-[15px] leading-[1.75] text-gray-500 dark:text-gray-400">
              이용권을 올리면 동네 지도에 가게가 뜨고, 손님들이 각자의 유어샵에 담아 갑니다.
              세로 영상(유어쇼츠) 아래에는 바로 살 수 있는 구매 바가 붙습니다. 상위 노출을 돈으로 사는 자리가 아닙니다.
            </p>
            <p className="mt-auto pt-7 text-[13px] lg:text-[14px] leading-relaxed text-gray-500 dark:text-gray-400 border-t border-rule">
              첫 카카오·네이버 후기를 남긴 손님에게는 {F.reviewBonus}을 드립니다.
              <b className="font-bold text-ink"> 이 비용은 지금 유어딜이 냅니다.</b>
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
