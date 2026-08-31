// 🎨 2026-07-20 (대표 "내 지갑 타이틀 + 이용권/교환권 탭 나뉜 게 투박해 — 더 이상적으로"):
//   [32px 큰 타이틀 + 회색 트랙 세그먼트] → 모던 지갑 헤더(타이틀 26px + 총 보유 장수 칩).
// 🎟️ 2026-08-31 (대표 "교환권은 교환권 페이지에서"): 이용권/교환권 언더라인 탭 제거 —
//   두 지갑이 각자 페이지를 갖게 되어 한 헤더 안에서 오갈 이유가 없어졌다(탭 자리를 다시 만들지 말 것).
//   대신 교환권 지갑처럼 상위 화면에서 들어오는 페이지를 위해 뒤로가기를 옵션으로 받는다.
import { ArrowLeft } from 'lucide-react'

export default function WalletHeader({ title, totalLabel, onBack, backLabel }: {
  title: string
  /** 우측 총 보유 칩 문구(예 "총 3장"). 없으면 미표시. */
  totalLabel?: string | null
  /** 있으면 타이틀 좌측에 뒤로가기(하단 탭이 아닌 페이지 — 교환권 지갑). */
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <div className="ur-content-narrow px-4 lg:px-8 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={backLabel || '뒤로가기'}
              className="-ml-2 w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-white/10">
              <ArrowLeft className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white leading-none truncate">{title}</h1>
        </div>
        {totalLabel && (
          <span className="shrink-0 rounded-full bg-brand-tint text-brand-text text-[12px] font-bold px-3 py-1">{totalLabel}</span>
        )}
      </div>
      <div className="mt-3" />
    </div>
  )
}
