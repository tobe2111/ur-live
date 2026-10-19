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

/* 종류마다 JSX 로 그린다(지도 객체로 모으면 `consumer-icon-system` 래칫이 이 아이콘들을 못 센다 — 세는 기준이 `<Icon` 이다). */
export default function AmenityIcon({ kind, className }: { kind: AmenityKind; className: string }) {
  switch (kind) {
    case 'parking': return <Car className={className} />
    case 'wifi': return <Wifi className={className} />
    case 'breakfast': return <Coffee className={className} />
    case 'pool': return <Waves className={className} />
    case 'spa': return <Bath className={className} />
    case 'fire': return <Flame className={className} />
    case 'kitchen': return <Utensils className={className} />
    case 'air': return <Wind className={className} />
    case 'gym': return <Dumbbell className={className} />
    case 'pet': return <PawPrint className={className} />
    case 'nosmoke': return <CigaretteOff className={className} />
    default: return <Check className={className} />
  }
}
