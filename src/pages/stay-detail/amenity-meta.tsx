/**
 * 🛏️ 숙소 편의시설 라벨 → 아이콘 매핑 (SSOT)
 *
 * 2026-09-14 `StayDetailPage.tsx` 에서 추출. 페이지가 파일크기 래칫(873줄)에 닿았고, 이 블록은
 * 상태도 훅도 없는 순수 매핑이라 가장 깨끗하게 떨어지는 조각이다. **로직 byte-불변** — 키워드
 * 목록·판정 순서·기본값(Check)·클래스 문자열 전부 그대로 옮겼다(순서가 바뀌면 '온수풀'이
 * 수영장으로 가는 식으로 결과가 달라진다).
 *
 * ⚠️ 한글 키워드가 계약이다 — 어드민 숙소 시드(`admin-stays.routes.ts`)가 이 목록을 보고
 * amenities 문자열을 만든다. 키워드를 지우려면 그쪽 시드도 함께 볼 것.
 */
import { lazy, Suspense } from 'react'

/**
 * ⚡ 2026-10-18: 아이콘 그림은 `AmenityIcon` 에서 **lazy 로** 받는다 — 정적으로 두면 lucide 아이콘 열한 개가
 *   든 봉투 셋(~22KB br)이 숙소 상세 첫 화면에 실렸다. 판정(키워드 → 종류)은 여기 그대로다(순서·기본값 불변).
 *   가드: stay-detail-first-screen-2026-10-18.test.ts
 */
const AmenityIcon = lazy(() => import('./AmenityIcon'))

export type AmenityKind =
  | 'parking' | 'wifi' | 'breakfast' | 'pool' | 'spa' | 'fire' | 'kitchen' | 'air' | 'gym' | 'pet' | 'nosmoke' | 'default'

const AMENITY_ICON_CLS = 'w-4 h-4 text-gray-500 dark:text-gray-400'

/** 시설 낱말 → 종류. 순서가 계약이다('온수풀' 이 수영장으로 가지 않게 스파보다 수영이 먼저 — 종전과 동일). */
export function amenityKind(a: string): AmenityKind {
  const s = String(a || '').toLowerCase()
  const has = (...keys: string[]) => keys.some((k) => s.includes(k))
  if (has('주차', 'parking')) return 'parking'
  if (has('와이파이', '와이', 'wifi', 'wi-fi', '인터넷')) return 'wifi'
  if (has('조식', '아침', 'breakfast')) return 'breakfast'
  if (has('수영', '풀', 'pool')) return 'pool'
  if (has('스파', '사우나', '온천', '온수풀', 'spa', 'sauna', '자쿠지', '욕조', 'bath')) return 'spa'
  if (has('화로', '바비큐', 'bbq', '불멍', '캠프파이어', 'grill')) return 'fire'
  if (has('취사', '주방', '조리', '키친', 'kitchen', '요리')) return 'kitchen'
  if (has('에어컨', '냉난방', '냉방', '난방', 'air')) return 'air'
  if (has('헬스', '피트니스', 'gym', 'fitness')) return 'gym'
  if (has('반려', '애견', '펫', 'pet')) return 'pet'
  if (has('금연', 'non-smoking', 'no smoking')) return 'nosmoke'
  return 'default'
}

export function amenityMeta(a: string): { label: string; icon: React.ReactNode } {
  const icon = (
    <Suspense fallback={<span className={`${AMENITY_ICON_CLS} inline-block shrink-0`} aria-hidden />}>
      <AmenityIcon kind={amenityKind(a)} className={AMENITY_ICON_CLS} />
    </Suspense>
  )
  return { label: a, icon }
}
