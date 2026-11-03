/**
 * 🎨 2026-06-29 (대표 — 공통 페이지 로딩 애니메이션): UrDeal 브랜드 로더 (SSOT).
 *
 * 소비자(유어딜) 페이지 청크 로딩(Suspense fallback) 순간에 표시하는 공통 로더.
 *   - 2026-11-02 부터: 위쪽 얇은 막대(끝까지 한 번 차오름) + 화면 모양(카드 줄) 미리 보여 주기 — 아래 ⏳ 머리말.
 *
 * ⚠️ 잠긴 로딩 최적화 불변: SSR 주입/스켈레톤 첫페인트는 이 로더를 쓰지 않음(스피너-온리 첫화면 금지 규칙).
 *   이 로더는 *라우트 전환/청크 다운로드* 순간 전용. (도매몰은 별도 WholesaleLoader — 서비스 분리)
 */
import { takeBootFirstScreen } from '@/lib/boot-first-screen'
import { brandLoaderMarkup, loaderPhaseVars } from '@/shared/brand-loader-markup'

/*
 * ⏳ 2026-11-02 대표 확정 — **유달이·로고·왕복 막대를 걷고, 위쪽 얇은 막대 + 화면 모양 미리 보여 주기.**
 *   대표 *"유달이 뜨는게 별로인 것 같아 로딩 중에. 그래서 A처럼 위쪽 얇은 막대를 넣으면서 화면 모양 미리 보여주기로"*.
 *   그림은 `shared/brand-loader-markup.ts` 한 벌 — 워커 정적 로더와 **같은 문자열**을 그려 교체 순간이 안 보인다.
 *   위상은 종전처럼 첫 페인트 기준 음수 delay(`loaderPhaseVars`) — 재마운트해도 막대가 처음부터 다시 차지 않는다.
 */

interface BrandLoaderProps {
  /** 전체화면(라우트 Suspense fallback). false 면 섹션 인라인 로더. */
  fullScreen?: boolean
  /** (종전 로고 크기 — 지금은 쓰지 않는다. 부르는 쪽 호환을 위해 남긴다.) */
  size?: number
  /** 화면 모양 아래 상황 문구(예: "결제 승인 중"). */
  label?: string
  /** 라이트 고정 표면(대시보드 #F4F5F7 등) — 전역 다크 토글과 무관하게 라이트 바탕. */
  forceLight?: boolean
  /** 다크 고정 표면 — 항상 다크 바탕. */
  forceDark?: boolean
  /** 🫥 서버 첫 화면 아래 인라인 로더(BootFirstScreenLoader)도 0.5초 숨긴다. */
  quiet?: boolean
}

function sinceFirstPaintS(): number {
  try {
    if (typeof performance === 'undefined') return 0
    const paints = performance.getEntriesByType('paint')
    const fp = paints.find((e) => e.name === 'first-contentful-paint') || paints.find((e) => e.name === 'first-paint')
    return Math.max(0, performance.now() - (fp ? fp.startTime : 0)) / 1000
  } catch { return 0 }
}

export default function BrandLoader({ fullScreen = false, label, forceLight = false, forceDark = false, quiet = false }: BrandLoaderProps) {
  /**
   * 🫥 2026-11-02 대표 *"섞기"* — 첫 진입·전체 화면 로더는 0.5초 안에 끝나면 **아예 안 보이고**, 늦을 때만 막대+화면 모양이
   *   스르르 나타난다(#2122 "아예 안 보이게" + 이 세션 "위쪽 얇은 막대 + 화면 모양"). 바로 보여야 하는 셋은 그대로:
   *   ① 문구 있는 로더("결제 승인 중") ② 대시보드(forceLight) ③ 섹션 안 인라인 로더.
   */
  const shy = quiet || (fullScreen && !forceLight && !label)
  const phase = loaderPhaseVars(sinceFirstPaintS())
  const fsBg = forceLight ? 'bg-[#F4F5F7]' : forceDark ? 'bg-[#11141C]' : 'bg-white dark:bg-[#11141C]'
  return (
    <div
      className={fullScreen ? `fixed inset-0 z-[10000] overflow-hidden ${fsBg}` : undefined}
      style={phase as React.CSSProperties}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* 줄 수는 늘 4 — 서버가 첫 화면 아래 붙이는 로더(`min-height:34dvh` + 같은 문자열)와 글자까지 같아야 교체 순간이 안 보인다. */}
      <div dangerouslySetInnerHTML={{ __html: brandLoaderMarkup(4, shy) }} />
      {label ? (
        <p className={`text-center text-[13px] font-medium ${forceLight ? 'text-gray-500' : forceDark ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
      ) : null}
      <span className="sr-only">{label || '페이지 로딩 중…'}</span>
    </div>
  )
}

/**
 * 🖼️ 청크 로딩 폴백 — 서버가 이미 첫 화면을 그려 놨으면 **그 사진을 덮지 않는다** (2026-09-16).
 *
 * 2026-09-15 에 워커가 `/group-buy/:id`(당시 주소) 의 `#root` 에 [빵부스러기 + 히어로]를 그리게 했는데,
 * 라이브 판정에서 그 사진이 **중간에 한 번 사라졌다**:
 *
 *     4,070ms  사진 보임(서버)  →  4,926ms  풀스크린 로더가 덮음  →  5,463ms  사진 다시(React)
 *
 * 범인은 히어로가 아니라 이 폴백이다. React 가 `#root` 를 비우는 순간 상세 청크는 아직 오는
 * 중이라 `fullScreen` 로더(=`fixed inset-0` **불투명** 오버레이, 2026-07-18 에 일부러 그렇게
 * 만든 것)가 먼저 그려져 사진을 덮었다. 대표가 2026-07-01 에 금지한 "로딩 화면 2~3개".
 *
 * ⇒ 서버 노드가 있으면 **같은 노드를 도로 붙이고**(재파싱·재다운로드 0, 픽셀 차이 0) 그 아래에만
 * 인라인 로더를 둔다 — 서버가 그린 34dvh 로더 자리와 같은 높이·같은 위상(FCP 기준 음수 delay).
 * 없으면(교환권 상세·목록·SPA 내부 이동) 종전 `fullScreen` 로더 그대로 — **무회귀**.
 *
 * ⚠️ `ref` 콜백으로 붙인다(커밋 중 = 페인트 전). `useEffect` 면 한 프레임 빈 채로 그려질 수 있다.
 */
export function BootFirstScreenLoader({ forceDark = false }: { forceDark?: boolean }) {
  const node = typeof window !== 'undefined' ? takeBootFirstScreen(window.location.pathname) : null
  // 🌑 2026-09-16 (대표 — *"로딩도 좀 문제 있어보이고"*): 도착 화면이 **다크 고정**인 표면은
  //   이 로더도 다크여야 한다. 안 그러면 라이트 사용자가 [흰 로더 → 검은 로더] 색 점프를 본다
  //   (실측 `/videos` 531ms — 청크 로더는 테마 추종인데 VideosPage 자체 로더가 forceDark 라서).
  //   대시보드의 `DashboardLoader`(forceLight)와 같은 처방을 반대 방향으로 — "로더는 도착 화면의 색을 미리 입는다".
  if (!node) return <BrandLoader fullScreen forceDark={forceDark} />
  return (
    <>
      <div ref={(el) => { if (el && node.parentNode !== el) el.appendChild(node) }} />
      <div style={{ minHeight: '34dvh' }}>
        <BrandLoader quiet />
      </div>
    </>
  )
}
