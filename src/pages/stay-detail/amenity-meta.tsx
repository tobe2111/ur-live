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
import {
  Bath, Car, Check, CigaretteOff, Coffee, Dumbbell, Flame, PawPrint, Utensils, Waves, Wifi, Wind,
} from 'lucide-react'

const AMENITY_ICON_CLS = 'w-4 h-4 text-gray-500 dark:text-gray-400'

export function amenityMeta(a: string): { label: string; icon: React.ReactNode } {
  const s = String(a || '').toLowerCase()
  const has = (...keys: string[]) => keys.some((k) => s.includes(k))
  let icon: React.ReactNode = <Check className={AMENITY_ICON_CLS} />
  if (has('주차', 'parking')) icon = <Car className={AMENITY_ICON_CLS} />
  else if (has('와이파이', '와이', 'wifi', 'wi-fi', '인터넷')) icon = <Wifi className={AMENITY_ICON_CLS} />
  else if (has('조식', '아침', 'breakfast')) icon = <Coffee className={AMENITY_ICON_CLS} />
  else if (has('수영', '풀', 'pool')) icon = <Waves className={AMENITY_ICON_CLS} />
  else if (has('스파', '사우나', '온천', '온수풀', 'spa', 'sauna', '자쿠지', '욕조', 'bath')) icon = <Bath className={AMENITY_ICON_CLS} />
  else if (has('화로', '바비큐', 'bbq', '불멍', '캠프파이어', 'grill')) icon = <Flame className={AMENITY_ICON_CLS} />
  else if (has('취사', '주방', '조리', '키친', 'kitchen', '요리')) icon = <Utensils className={AMENITY_ICON_CLS} />
  else if (has('에어컨', '냉난방', '냉방', '난방', 'air')) icon = <Wind className={AMENITY_ICON_CLS} />
  else if (has('헬스', '피트니스', 'gym', 'fitness')) icon = <Dumbbell className={AMENITY_ICON_CLS} />
  else if (has('반려', '애견', '펫', 'pet')) icon = <PawPrint className={AMENITY_ICON_CLS} />
  else if (has('금연', 'non-smoking', 'no smoking')) icon = <CigaretteOff className={AMENITY_ICON_CLS} />
  return { label: a, icon }
}
