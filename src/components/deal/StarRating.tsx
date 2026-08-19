import { memo } from 'react'

/**
 * ⭐ 별 5개 평점 (2026-08-19 — 대표 "별 5개 형태도 나타나게 해줘").
 *
 * 그루폰 카드의 `★★★★☆ 4.3 (5,542)` 중 별 부분. 숫자·리뷰수는 호출부가 그린다.
 *
 * 구현 메모: 별 5개를 회색으로 깔고, 그 위에 **노란 별 5개를 같은 자리에 겹쳐** `width: N%` 로
 * 잘라 낸다. 반쪽 별을 따로 그리지 않아도 4.3 → 86% 처럼 **부분 채움이 정확**하다.
 * (아이콘 5개 × 두 겹이지만 전부 문자라 DOM 비용이 사실상 없다 — 카드 50개에서도 부담 0.)
 */
function StarRating({ value, size = 11 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span
      className="relative inline-block shrink-0 leading-none select-none align-middle"
      style={{ fontSize: size, letterSpacing: '0.5px' }}
      role="img"
      aria-label={`5점 만점에 ${value.toFixed(1)}점`}
    >
      <span className="text-gray-300 dark:text-gray-600" aria-hidden="true">★★★★★</span>
      <span
        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap text-yellow-400"
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      >
        ★★★★★
      </span>
    </span>
  )
}

export default memo(StarRating)
