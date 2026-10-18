/**
 * 🛏️ 숙소 편의시설 아이콘 — `amenity-meta.tsx` 가 **lazy 로만** 부른다(2026-10-18).
 *
 * 이 열한 개는 lucide 아이콘 파일이 각자 다른 화면 봉투(교환권·홈·공용 lucide)에 들어 있어서,
 * 정적으로 부르면 숙소 상세 첫 화면이 그 봉투 셋(~22KB br)을 통째로 받았다(`check-surface-budgets` 실측).
 * 아이콘은 시설 낱말 옆 16px 장식이라 첫 그림 뒤에 와도 된다 — 자리는 fallback 이 같은 크기로 잡는다.
 * 가드: stay-detail-first-screen-2026-10-18.test.ts
 */
import {
  Bath, Car, Check, CigaretteOff, Coffee, Dumbbell, Flame, PawPrint, Utensils, Waves, Wifi, Wind,
} from 'lucide-react'
import type { AmenityKind } from './amenity-meta'

const ICONS: Record<AmenityKind, typeof Check> = {
  parking: Car, wifi: Wifi, breakfast: Coffee, pool: Waves, spa: Bath, fire: Flame,
  kitchen: Utensils, air: Wind, gym: Dumbbell, pet: PawPrint, nosmoke: CigaretteOff, default: Check,
}

export default function AmenityIcon({ kind, className }: { kind: AmenityKind; className: string }) {
  const Icon = ICONS[kind] ?? Check
  return <Icon className={className} />
}
