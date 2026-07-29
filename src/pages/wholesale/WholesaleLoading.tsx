// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-29 (대표 요청 — 도매몰 로딩 톤 통일): 인-페이지 데이터 로딩 표시.
//   브랜드 오렌지(WT.brand) 스피너 — 라이트 도매 surface 전용. 풀스크린 라우트 로더
//   (App.tsx WholesaleLoader, 로고+스피너)와 동일 톤. 페이지 본문의 ad-hoc 회색 Loader2 대체용.
// ──────────────────────────────────────────────────────────────
import { WT } from './wholesale-theme'

/** 도매 본문 데이터 로딩 스피너. label 주면 캡션 표시. className 으로 세로 여백 조절(기본 py-20). */
export default function WholesaleLoading({
  label,
  className = 'py-20',
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-7 h-7">
        {/* 트랙(연한 보더) */}
        <div className="absolute inset-0 rounded-full" style={{ border: `2.5px solid ${WT.line2}` }} />
        {/* 회전 아크(오렌지) — 200ms 후 회전 시작(짧은 로딩 깜빡임 방지) */}
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{ border: '2.5px solid transparent', borderTopColor: WT.brand, animationDelay: '200ms' }}
        />
      </div>
      {label && (
        <span className="text-[12.5px]" style={{ color: WT.ink3 }}>
          {label}
        </span>
      )}
      <span className="sr-only">{label || '불러오는 중…'}</span>
    </div>
  )
}
