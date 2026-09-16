/**
 * 🧷 교환권 상단 두 블록의 **자리 예약** — 숫자가 아니라 같은 마크업으로 (2026-09-16)
 *
 * 카테고리 칩 줄과 브랜드 줄은 서버에서 온다. 도착 전에는 자리만 잡아 두는데, 그 높이를 종전엔
 * **손으로 박은 숫자**(`h-[50px]`·`h-[113px]`)로 뒀다. 그러면 블록 디자인이 바뀔 때마다 어긋나고,
 * 어긋남은 에러가 아니라 **첫 방문자 화면이 교체 순간 한 번 내려앉는 것**으로만 나타난다.
 *
 * 실측(응답을 2.5초 늦춰 프레임 캡처): 칩 `예약 50 vs 실제 56`(−6) · 브랜드 `113 vs 117`(−4)
 * → 첫 사진이 `348 → 358` 로 10px 내려갔다. 2026-09-02 에 칩이 흰 알약+그림자로 바뀌었는데
 * 숫자가 안 따라온 것이다(소스 주석은 *"border 를 더하면 1px 밀린다"* 고 경고까지 하고 있었다).
 *
 * ⇒ 여기서는 **진짜 블록과 같은 클래스**로 세우고 `invisible` 로 감춘다. 높이가 같은 CSS 에서
 *   나오므로 칩 크기를 바꿔도 예약이 저절로 따라온다. 시각적 스켈레톤은 여전히 두지 않는다
 *   (로더 통일 정책 — 보이는 건 아무것도 없고 자리만 있다).
 *
 * ⚠️ **재방문자는 원래 이 자리를 안 본다** — 카테고리는 localStorage 에 1시간 캐시돼 첫 렌더에
 *   진짜 블록이 바로 그려진다. 이 예약이 보이는 건 첫 방문(또는 캐시 만료) 때뿐이다.
 *
 * ## 이 파일이 **못** 하는 것
 * jsdom 은 레이아웃이 없어 "높이가 같은가" 를 단위시험으로 못 잰다 → 클래스가 진짜 블록과
 * 같은지만 시험이 대조하고, 실제 밀림 여부는 브라우저 프레임 캡처가 판정한다.
 */
import { ChevronDown } from 'lucide-react'
import { CategoryIcon } from './shared'

/**
 * 카테고리 칩 줄(`py-2.5` + `h-9` 알약) 과 같은 높이.
 * 바탕색은 안 준다 — 부모 reveal 그룹이 이미 그 색을 칠한다(같은 색을 두 벌 두지 않는다).
 */
export function ChipRowReserve() {
  return (
    <div aria-hidden="true">
      <div className="ur-content-wide px-4 lg:px-8 py-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide invisible">
          <span className="shrink-0 inline-flex items-center gap-1.5 h-9 pl-3 pr-3.5 rounded-full text-[13px] font-bold">&nbsp;</span>
        </div>
      </div>
    </div>
  )
}

/**
 * 브랜드 줄과 같은 높이. 헤더 한 줄 + (펼쳐져 있으면) 로고 한 줄.
 * `brandsOpen` 을 그대로 받는다 — 접힌 상태면 로고 줄이 없으므로 예약도 같이 줄어든다.
 * 숫자였다면 그 경우를 못 따라갔다(접기 토글은 2026-09-01 에 생겼다).
 */
export function BrandStripReserve({ open, category }: { open: boolean; category: string }) {
  return (
    <div className="ur-content-wide px-4 lg:px-8 pt-1.5 pb-3 invisible" aria-hidden="true">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-bold flex items-center gap-1.5">
          <CategoryIcon category={category} />
          브랜드로 찾기
          <ChevronDown className="w-3.5 h-3.5" />
        </span>
      </div>
      {open && (
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide py-1 -mx-1 px-1">
          {/* `BrandChip` 과 같은 치수: w-12 h-12 타일 + gap-1 + text-[10px] 라벨 */}
          <span className="flex flex-col items-center gap-1 shrink-0">
            <span className="w-12 h-12 rounded-2xl block" />
            <span className="text-[10px] max-w-[56px]">&nbsp;</span>
          </span>
        </div>
      )}
    </div>
  )
}
