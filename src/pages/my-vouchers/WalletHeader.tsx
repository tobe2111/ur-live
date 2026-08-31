// 🎨 2026-07-20 (대표 "내 지갑 타이틀 + 이용권/교환권 탭 나뉜 게 투박해 — 더 이상적으로"):
//   [32px 큰 타이틀 + 회색 트랙 세그먼트] → 모던 지갑 헤더(타이틀 26px + 총 보유 장수 칩).
// 🎟️ 2026-08-31 (대표 "교환권은 교환권 페이지에서"): 이용권/교환권 언더라인 탭 제거 —
//   두 지갑이 각자 페이지를 갖게 되어 한 헤더 안에서 오갈 이유가 없어졌다(탭 자리를 다시 만들지 말 것).
//   대신 교환권 지갑처럼 상위 화면에서 들어오는 페이지를 위해 뒤로가기를 옵션으로 받는다.
import { ArrowLeft } from 'lucide-react'

export default function WalletHeader({ title, subline, onBack, backLabel }: {
  title: string
  /**
   * 제목 아래 한 줄 요약(예 "사용 가능 2장 · 전체 4장").
   * 🎨 2026-08-31 (대표 "윗 부분이 밋밋하고 투박하다"): 우측 로즈 칩("총 N장")을 이 서브라인으로 대체했다.
   *   ① 칩은 색만 크고 정보는 한 개였다(그 아래 히어로가 이미 "사용 가능 N장"을 말해 중복이었다)
   *   ② 브랜드 로즈는 '행동'에 쓰는 색인데 단순 카운트가 화면에서 제일 튀었다
   *   ③ 제목 한 줄만 덩그러니 있던 상단이 제목+요약 두 줄이 되어 히어로 카드와 자연스럽게 이어진다.
   */
  subline?: string | null
  /** 있으면 타이틀 좌측에 뒤로가기(하단 탭이 아닌 페이지 — 교환권 지갑). */
  onBack?: () => void
  backLabel?: string
}) {
  return (
    <div className="ur-content-narrow px-4 lg:px-8 pt-2">
      <div className="flex items-start gap-1.5 min-w-0">
        {onBack && (
          <button type="button" onClick={onBack} aria-label={backLabel || '뒤로가기'}
            className="-ml-2 w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-gray-900 dark:text-white active:bg-gray-100 dark:active:bg-white/10">
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white leading-none truncate">{title}</h1>
          {subline && <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400 truncate">{subline}</p>}
        </div>
      </div>
      <div className="mt-4" />
    </div>
  )
}
