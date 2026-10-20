/**
 * 🛏️ 숙소 편의시설 아이콘 — `amenity-meta.tsx` 가 **lazy 로만** 부른다(2026-10-18).
 *
 * 1차(#1920): lucide 열두 개를 lazy 로 떼어 숙소 상세 첫 화면을 230.2 → 205.8KB 로 줄였다.
 * 2차(이 파일): 라이브 E4 에서 그 lazy 청크가 **교환권·홈 화면 봉투**(lucide · lz-vouchers ·
 *   lz-home-homePc-vouchers …, 압축 ~28KB)를 의존으로 달고 있었다 — lucide 아이콘 파일은 그걸 쓰는
 *   다른 화면 봉투에 들어가기 때문이다. 첫 화면에서 빠졌을 뿐 **뒤로 미뤄진** 것이었다.
 *   🩸 버린 길: 아이콘 일곱을 작은 고정 묶음으로 빼 봤더니 교환권 화면이 그 묶음을 정적으로 끌어오고
 *   묶음은 다시 홈 봉투(Flame)를 끌어왔다 — 남이 쓰는 모듈을 옮기면 남이 따라온다.
 *   ⇒ 그림을 **이 파일 안에서** 그린다(외부 import 0). lazy 청크가 이 파일 하나가 된다.
 *
 * 그리기 규칙은 유어딜 아이콘 세트(`components/icons/urdeal-icons.tsx`)와 같다 — 24 그리드 · 획 1.6 ·
 * 둥근 끝 · `currentColor`. 시설 낱말 옆 16px 장식이라 낱말이 뜻을 말하고 그림은 거든다.
 * 가드: stay-detail-first-screen-2026-10-18.test.ts
 */
import type { ReactNode } from 'react'
import type { AmenityKind } from './amenity-meta'

function Svg({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden
    >
      {children}
    </svg>
  )
}

/* 종류마다 JSX 로 그린다 — 판정(키워드 → 종류)은 amenity-meta 가 하고 여기는 그림만. */
export default function AmenityIcon({ kind, className }: { kind: AmenityKind; className: string }) {
  switch (kind) {
    case 'parking':
      return <Svg className={className}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M10 16.5v-9h2.75a2.75 2.75 0 0 1 0 5.5H10" /></Svg>
    case 'wifi':
      return <Svg className={className}><path d="M3.5 9.5a12 12 0 0 1 17 0" /><path d="M6.5 12.75a7.75 7.75 0 0 1 11 0" /><path d="M9.5 16a3.5 3.5 0 0 1 5 0" /><circle cx="12" cy="19" r="0.6" /></Svg>
    case 'breakfast':
      return <Svg className={className}><path d="M5 10h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 14.5z" /><path d="M16 11.5h1.25a2.25 2.25 0 0 1 0 4.5H16" /><path d="M8.5 3.5v3M12 3.5v3" /></Svg>
    case 'pool':
      return <Svg className={className}><path d="M3 8c1.5 0 1.5-1.25 3-1.25S7.5 8 9 8s1.5-1.25 3-1.25S13.5 8 15 8s1.5-1.25 3-1.25S19.5 8 21 8" /><path d="M3 12.5c1.5 0 1.5-1.25 3-1.25s1.5 1.25 3 1.25 1.5-1.25 3-1.25 1.5 1.25 3 1.25 1.5-1.25 3-1.25 1.5 1.25 3 1.25" /><path d="M3 17c1.5 0 1.5-1.25 3-1.25S7.5 17 9 17s1.5-1.25 3-1.25S13.5 17 15 17s1.5-1.25 3-1.25S19.5 17 21 17" /></Svg>
    case 'spa':
      return <Svg className={className}><path d="M3.5 12h17v1.5a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5z" /><path d="M7 18.5 6 20.5M17 18.5l1 2" /><path d="M6.5 12V6.25a2.25 2.25 0 0 1 4.25-1" /></Svg>
    case 'fire':
      return <Svg className={className}><path d="M12 20.5c3.6 0 6-2.4 6-5.75 0-3.75-3-5.75-4-9.25-2 1.5-3 3.5-3 5.5-1-.5-1.75-1.5-2-2.75C7.5 10 6 12 6 14.75c0 3.35 2.4 5.75 6 5.75z" /></Svg>
    case 'kitchen':
      return <Svg className={className}><path d="M6 3.5v6a2 2 0 0 0 4 0v-6M8 3.5v17" /><path d="M17.5 20.5v-17c-2 1.5-3 4-3 7v3h3" /></Svg>
    case 'air':
      return <Svg className={className}><path d="M3.5 9h11a2.5 2.5 0 1 0-2.5-2.5" /><path d="M3.5 13h15a2.5 2.5 0 1 1-2.5 2.5" /><path d="M3.5 17h7" /></Svg>
    case 'gym':
      return <Svg className={className}><path d="M8 12h8" /><rect x="5" y="7.5" width="3" height="9" rx="1" /><rect x="16" y="7.5" width="3" height="9" rx="1" /><path d="M3 10.5v3M21 10.5v3" /></Svg>
    case 'pet':
      return <Svg className={className}><circle cx="7" cy="10" r="1.6" /><circle cx="10.5" cy="6.5" r="1.6" /><circle cx="14.5" cy="6.5" r="1.6" /><circle cx="18" cy="10" r="1.6" /><path d="M12.5 12c2.5 0 5 3.25 5 5.25 0 1.75-1.5 2.75-3 2.25-1-.35-1.5-.5-2-.5s-1 .15-2 .5c-1.5.5-3-.5-3-2.25 0-2 2.5-5.25 5-5.25z" /></Svg>
    case 'nosmoke':
      return <Svg className={className}><rect x="3.5" y="12" width="13" height="3.5" rx="0.75" /><path d="M19 12v3.5M19 4.5c0 2 1.5 2.25 1.5 4" /><path d="M4 4l16 16" /></Svg>
    default:
      return <Svg className={className}><path d="M5 12.5 10 17.5 19.5 7" /></Svg>
  }
}
