/**
 * 🪜 유어샵 수익 사다리 — 소개자가 돈 버는 길을 **한 곳에 순서대로** (2026-08-27 대표 확정)
 *
 * ## 왜 만들었나
 * 소개자가 돈 버는 길이 여러 화면에 흩어져 있었다. 자주 오는 유어샵에는 "적립 ₩0" 만 보이고
 * **뭘 해야 0이 아니게 되는지**는 알 수 없었다. 그래서 위에서 아래로 읽으면 그대로 할 일이 되게 놓는다.
 *
 * ## 🛑 2026-09-16 — 1단("가게를 데려오면 매출의 2%")을 **삭제했다**
 *   대표 확정: *"매장 데려온 사람 2%는 이제 아예 없는거야."*
 *
 *   ⚠️ 그런데 이건 새 결정이 아니라 **화면이 코드보다 뒤처져 있던 것**이다. 적립 함수
 *   (`creditInfluencerStoreIntroCommission`)는 **호출부가 0** 이라 이미 죽어 있었고
 *   (`order-commissions.ts` 가 "적립만 없앴다" 고 적어 뒀다), 라이브 `influencer_attributions`
 *   도 **0건**이다. 즉 이 화면은 **아무도 받은 적 없는 돈을 약속하고 있었다.**
 *
 *   같은 파일이 다른 자리에서 이렇게 경고한다 — *"화면은 'N% 받는다'인데 정산은 0 이 된다.
 *   그건 버그가 아니라 **약속 위반**이고, 되돌리는 데 드는 비용(환급 + 신뢰)이 훨씬 크다."*
 *   (`influencer-deal.ts`). 정확히 그 상태였다.
 *
 *   가게를 데려오는 일 자체가 없어진 게 아니라 **그 자리가 중개사 계약으로 옮겨갔다**
 *   (중개사가 매장과 요율을 맺는다 — `docs/decisions/2026-09-16-broker-payout-and-fraud-guards.md`).
 *
 * ## 순서가 곧 설명이다
 * ①이 없으면 ②는 **0원**이다(어필리에이트는 2026-08-22 종료). 그래서 딜이 먼저다.
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

interface Props {
  /** 지금 딜이 붙어 있는 핀 수. 0 이면 1단이 아직 비어 있다는 뜻. */
  dealCount: number
  /** 담은 핀 총 수. 0 이면 2단이 비어 있다. */
  pinCount: number
}

export default function EarnLadder({ dealCount, pinCount }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="px-4 pt-3.5 pb-2">
          <p className="text-[14px] font-extrabold text-gray-900 dark:text-white">내 유어샵으로 버는 법</p>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">위에서부터 하면 아래가 쉬워져요.</p>
        </div>

        {/* 1단 — 조건. 여기가 비면 2단이 0원이라 그 사실을 그대로 적는다.
            브랜드색을 여기 한 곳에만 쓴다(무엇이 제일 중요한지 눈으로 보이게). */}
        <div className="mx-3 mb-2 rounded-xl border border-brand/25 bg-brand/[0.04] dark:bg-brand/[0.08] p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-brand text-white text-[11px] font-extrabold flex items-center justify-center">1</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">
                그 가게와 소개비를 정하세요
                {dealCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">계약 {dealCount}곳</span>}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                가게가 “이 이용권 팔아주면 몇 %” 를 정해 제안합니다. 수락하면 계약이 됩니다.
                {dealCount === 0 && (
                  <>
                    <br />
                    <span className="font-bold text-amber-700 dark:text-amber-400">계약이 없으면 아래 2단은 팔려도 0원입니다.</span>
                  </>
                )}
              </p>
              <Link
                to="/influencer/settlement"
                className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-[#2C2F35] px-3 py-1.5 text-[12px] font-bold text-gray-700 dark:text-gray-200 active:opacity-70"
              >
                내 계약·정산 보기 <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2단 — 이미 하고 있는 것. 위를 하면 여기가 돈이 된다는 연결을 적는다. */}
        <div className="mx-3 mb-3 rounded-xl border border-line p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-[#11141C] text-[11px] font-extrabold flex items-center justify-center">2</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-gray-900 dark:text-white">
                담아서 파세요
                {pinCount > 0 && <span className="ml-1.5 text-[11px] font-bold text-gray-400">{pinCount}개 담음</span>}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                담은 이용권은 내 유어샵에 <b className="text-gray-900 dark:text-white">계속 남습니다</b>. 내 샵으로 팔릴 때마다 소개비가 붙어요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
