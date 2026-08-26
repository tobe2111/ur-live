// 🏅 2026-07-20 (유어샵 전수조사 — 인증씰 단일화): 파란 U 인증씰이 CuratorHeader(18px·13px "U" 변형)·
//   SellerPublicPage 신뢰배지·LinkshopVisitorRails(체크마크 변형)에 **4곳 인라인 복붙**돼 있어 하나로 추출.
//   브랜드 "U" 씰(인스타 인증딱지 스타일 — U=urdeal)로 통일. fill 은 트위터 인증 블루(#1d9bf0) 고정 —
//   "공인/신뢰" 관습색이라 브랜드 로즈로 바꾸지 않음(대표 "파란 U 씰" 지시 유지). viewBox 24 고정이라 size 로 자동 스케일.
export default function VerifiedSeal({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" fill="#1d9bf0" />
      <text x="12" y="12" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" fill="#ffffff" fontFamily="-apple-system, system-ui, sans-serif">U</text>
    </svg>
  )
}
