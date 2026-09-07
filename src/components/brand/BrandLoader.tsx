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
  /** 🚑 2026-07-10 (로딩 전수조사): 라이트 고정 표면(대시보드 #F4F5F7 placeholder 등)용 — 전역 다크
   *  토글과 무관하게 항상 라이트 색(잉크 로고/바). 대시보드는 라이트 고정 규칙이라 다크 로고가 끼면
   *  [라이트 placeholder → 다크 로더 → 라이트 대시보드] 색 점프가 났음. */
  forceLight?: boolean
  /** 다크 고정 표면(bg-[#11141C] 페이지 등)용 — 항상 흰 로고/바 (라이트 토글 사용자도 보이게). */
  forceDark?: boolean
}

export default function BrandLoader({ fullScreen = false, size = 34, label, forceLight = false, forceDark = false }: BrandLoaderProps) {
  // 🎯 2026-07-01 (대표 "로딩이 2번 나뉘어" — 근본): 로더가 연달아 재마운트(Suspense 청크 로더 →
  //   페이지 데이터 로더)되면 CSS 애니메이션이 keyframe 0 부터 재시작 — breathe 는 opacity 0.5(로고 확
  //   어두워짐), sweep 바는 화면 밖(-120%)에서 시작(바 사라짐) → "떴다 안떴다 다시 뜨는" 블링크.
  //   → 페이지 로드 시계(performance.now()) 기반 **음수 animation-delay** 로 위상을 전역 동기화:
  //   어떤 시점에 마운트돼도 애니메이션이 같은 위상에서 이어져 여러 로더가 하나처럼 연속으로 보임.
  //   (주기 상수는 index.css 의 ur-loader-breathe 1.5s / ur-loader-sweep 1.15s 와 동기 유지.)
  // 🎯 후속(대표 "아직 조금 끊김"): 위상 기준을 t=0(timeOrigin)이 아니라 **첫 페인트(FCP)** 로 —
  //   worker 가 주입한 정적 로더의 CSS 애니메이션은 첫 페인트에 시작되므로, t=0 기준이면 첫
  //   페인트 지연(수백 ms)만큼 교체 순간 위상이 점프했음. FCP 기준이면 정적↔React 위상 일치.
  //   (paint 엔트리 미지원/부재 시 0 폴백 = 기존 동작. SPA 재마운트 간 연속성은 기준이 뭐든 동일.)
  let phaseBase = 0
  try {
    const paints = typeof performance !== 'undefined' ? performance.getEntriesByType('paint') : []
    const fp = paints.find((e) => e.name === 'first-contentful-paint') || paints.find((e) => e.name === 'first-paint')
    if (fp) phaseBase = fp.startTime
  } catch { /* 미지원 브라우저 — 0 폴백 */ }
  const nowSec = typeof performance !== 'undefined' ? Math.max(0, performance.now() - phaseBase) / 1000 : 0
  const breatheDelay = `-${(nowSec % 1.5).toFixed(3)}s`
  const sweepDelay = `-${(nowSec % 1.15).toFixed(3)}s`
  // 🎯 2026-07-18 (대표 신고 — "로딩 순간 유어딜 로더 말고도 보임"): fullScreen 로더가 배경 없는 in-flow
  //   박스(min-h-[100dvh])라, 뒤/주변의 이전 페이지(예: /map 분할)·body 배경이 비쳐 보였음(로더가
  //   화면을 '덮지' 못함). → 불투명 fixed inset-0 오버레이(z-[10000], 네비 9999 위·모달 10500 아래)로
  //   승격해 로딩 순간엔 오직 유어딜 로더만 보이게. 인라인(fullScreen=false) 로더는 기존 in-flow 유지.
  const fsBg = forceLight ? 'bg-[#F4F5F7]' : forceDark ? 'bg-[#11141C]' : 'bg-white dark:bg-[#11141C]'
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${fullScreen ? `fixed inset-0 z-[10000] ${fsBg}` : 'py-16'}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* 로고 — 은은한 호흡 (전역 위상 동기 — 재마운트에도 연속) */}
      <div className="ur-loader-breathe" style={{ animationDelay: breatheDelay }}>
        <UrDealLogo size={size} forceLight={forceLight} forceDark={forceDark} />
      </div>

      {/* 인디터미넌트 진행 바 — 전역 위상 동기 스윕 (이전 200ms 지연은 재마운트 시 바가 사라지는
          블링크의 원인이라 제거 — 연속성이 우선). */}
      <div
        className={`relative overflow-hidden rounded-full ${forceLight ? 'bg-gray-200/70' : forceDark ? 'bg-white/10' : 'bg-gray-200/70 dark:bg-white/10'}`}
        style={{ width: 96, height: 3 }}
        aria-hidden
      >
        <div
          className={`ur-loader-sweep absolute inset-y-0 left-0 rounded-full ${forceLight ? 'bg-gray-900' : forceDark ? 'bg-brand' : 'bg-brand dark:bg-brand'}`}
          style={{ width: '38%', animationDelay: sweepDelay }}
        />
      </div>

      {label ? (
        <p className={`text-[13px] font-medium ${forceLight ? 'text-gray-500' : forceDark ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
      ) : null}
      <span className="sr-only">{label || '페이지 로딩 중…'}</span>
    </div>
  )
}
