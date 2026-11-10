/**
 * 🔎 2026-09-03 (대표 — 검색 QA): **아무것도 안 거르던 칩 5개를 제거**했다.
 *
 * `카테고리 · 3만원 이하 · 무료배송 · 브랜드 · 평점 4★↑` 는 눌리면 색만 바뀌고 "필터 2개 적용"
 * 이라고 **말까지 했지만**, 목록은 한 줄도 안 바뀌었다(로컬 state 토글이 전부 — 상위로 전달 자체가
 * 없었다). 작동하지 않는 컨트롤은 없느니만 못하다 — 사용자는 "필터가 고장났다"가 아니라
 * **"이 서비스엔 그 조건에 맞는 게 없다"** 고 읽는다.
 *
 * 게다가 절반은 여기 있을 수도 없는 것이었다: `/search` 는 **이용권만** 보여주는데
 * `무료배송`·`브랜드`·`3만원 이하` 는 배송 상품의 개념이다.
 *
 * 실제로 동작하는 정렬(관련도·가격·최신)은 그대로 둔다. 진짜 필터가 필요해지면 그때
 * **상위 상태로 올려서** 붙일 것 — 다시 로컬 토글로 만들지 말 것.
 */
import { useTranslation } from '@/lib/i18n-lite'
import { useRef } from 'react'
import { Select } from '@/components/ui/select'
import { SR_CLS, SR_COPY } from '@/shared/search-page'
// 🎬 2026-11-02 시안 8차 "검색 결과 개수" — 개수가 바뀌면 새 숫자가 아래에서 올라온다(처음엔 안 움직인다).
//   ⚖️ 공용 `RollingNumber` 를 쓰지 않는다 — 그걸 import 하면 검색 화면이 상세 묶음을 끌고 와 +2.8KB 였다(화면별 무게 실측).
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-cnt', `@keyframes ur-cnt-in { from { opacity: 0; transform: translateY(60%); } to { opacity: 1; transform: none; } }.ur-cnt-in { display: inline-block; animation: ur-cnt-in .28s cubic-bezier(.2,1,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-cnt-in{animation:none!important}}`)

interface SortFilterBarProps {
  totalResults: number
  sortBy: 'relevance' | 'price_low' | 'price_high' | 'newest'
  onSortChange: (value: 'relevance' | 'price_low' | 'price_high' | 'newest') => void
}

export default function SortFilterBar({ totalResults, sortBy, onSortChange }: SortFilterBarProps) {
  const { t } = useTranslation()
  const firstCount = useRef(totalResults) // 처음 받은 개수 — 그것과 다를 때만 움직인다

  return (
    <div className={SR_CLS.bar}>
      {/* Result count + Sort */}
      <div className={SR_CLS.barRow}>
        <div className={SR_CLS.countWrap}>
          <span className={SR_CLS.countText}>{t('browse.totalResultsPrefix', { defaultValue: SR_COPY.prefix })}</span>
          {/* 🎨 2026-09-04: `text-red-500` → 잉크. 빨강은 이 레포에서 **기능 신호**(오류·위험)로 예약돼 있다 —
              검색 결과 개수는 그냥 숫자다. 강조는 굵기로 충분하다. */}
          <span key={totalResults} className={`${SR_CLS.countNum}${firstCount.current !== totalResults ? ' ur-cnt-in' : ''}`}>{totalResults}</span>
          <span className={SR_CLS.countText}>{t('browse.totalResultsSuffix', { defaultValue: SR_COPY.suffix })}</span>
        </div>
        <div className={SR_CLS.sortWrap}>
          <Select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as typeof sortBy)}
            className={SR_CLS.sortBtn}
          >
            <option value="relevance">{t('browse.sortRelevance', { defaultValue: SR_COPY.sortRelevance })}</option>
            <option value="price_low">{t('browse.sortPriceLow', { defaultValue: '낮은가격' })}</option>
            <option value="price_high">{t('browse.sortPriceHigh', { defaultValue: '높은가격' })}</option>
            <option value="newest">{t('browse.sortNewest', { defaultValue: '최신순' })}</option>
          </Select>
        </div>
      </div>
    </div>
  )
}
