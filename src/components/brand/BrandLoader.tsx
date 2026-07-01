/**
 * 🎨 2026-06-29 (대표 — 공통 페이지 로딩 애니메이션): UrDeal 브랜드 로더 (SSOT).
 *
 * 소비자(유어딜) 페이지 청크 로딩(Suspense fallback) 순간에 표시하는 공통 로더.
 *   - 로고: UrDealLogo 워드마크가 은은하게 '호흡'(scale+opacity, ur-loader-breathe)
 *   - 하단: 인디터미넌트 진행 바 스윕(ur-loader-sweep) — 200ms 지연으로 짧은 로딩 깜빡임 방지
 *   - 테마 자동: 로고는 dark: 로 흑↔백 토글, 바/트랙도 dark: 대응 → 다크/라이트 표면 모두 자연스러움
 *
 * ⚠️ 잠긴 로딩 최적화 불변: SSR 주입/스켈레톤 첫페인트는 이 로더를 쓰지 않음(스피너-온리 첫화면 금지 규칙).
 *   이 로더는 *라우트 전환/청크 다운로드* 순간 전용. (도매몰은 별도 WholesaleLoader — 서비스 분리)
 */
import UrDealLogo from './UrDealLogo'

interface BrandLoaderProps {
  /** 전체화면 중앙(라우트 Suspense fallback). false 면 섹션 인라인 로더. */
  fullScreen?: boolean
  /** 로고 크기(px). 기본 34. */
  size?: number
  /** 진행 바 아래 상황 문구(예: "결제 승인 중"). 없으면 로고+바만. */
  label?: string
}

export default function BrandLoader({ fullScreen = false, size = 34, label }: BrandLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${fullScreen ? 'min-h-[100dvh]' : 'py-16'}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* 로고 — 은은한 호흡 */}
      <div className="ur-loader-breathe">
        <UrDealLogo size={size} />
      </div>

      {/* 인디터미넌트 진행 바 — 트랙 위 바가 좌→우 스윕. 200ms 지연(짧은 로딩엔 정적) */}
      <div
        className="relative overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/10"
        style={{ width: 96, height: 3 }}
        aria-hidden
      >
        <div
          className="ur-loader-sweep absolute inset-y-0 left-0 rounded-full bg-gray-900 dark:bg-white"
          style={{ width: '38%', animationDelay: '200ms' }}
        />
      </div>

      {label ? (
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      ) : null}
      <span className="sr-only">{label || '페이지 로딩 중…'}</span>
    </div>
  )
}
