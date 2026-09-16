/**
 * 🖼️ 서버가 그린 첫 화면을 **React 마운트 너머로** 이어 준다 (2026-09-16, 대표 판정 후속).
 *
 * ## 왜 — 어제 고친 것의 나머지 절반
 * 2026-09-15 에 워커가 `/group-buy/:id` 의 `#root` 에 [빵부스러기 + 히어로]를 직접 그리게 했다
 * (`worker/utils/detail-ssr-body.ts`). 라이브 판정에서 사진은 실제로 **1.4초 먼저** 떴고 마운트
 * 때 한 픽셀도 안 움직였다. 그런데 그 사이에 **사진이 한 번 사라졌다**:
 *
 *     4,070ms  사진 보임 (서버가 그린 것)
 *     4,926ms  사진 사라짐 + 풀스크린 로더            ← ❌ 이 파일이 고치는 것
 *     5,463ms  사진 다시 보임 (React 가 그린 것)
 *
 * 원인은 히어로가 아니라 **그 다음 단계**다. React 는 `createRoot`(비-hydrate)라 마운트 시
 * `#root` 를 통째로 비우는데, 그 순간 상세 페이지 청크는 아직 오는 중이라 `App.tsx` 의
 * `<Suspense fallback>` 이 먼저 그려진다. 그 폴백이 `BrandLoader fullScreen` =
 * **`fixed inset-0` 불투명 오버레이**라 방금 도착한 사진을 덮어 버린다(2026-07-18 에
 * *"로딩 순간 유어딜 로더 말고도 보임"* 을 고치며 일부러 불투명하게 만든 그 오버레이다).
 * 대표가 2026-07-01 에 금지한 **"로딩 화면 2~3개"** 가 정확히 이 모양이다.
 *
 * ## 무엇을 하나 — 같은 HTML 을 다시 만들지 않는다. **같은 노드를 들고 있는다**
 * 부팅 시점(`main.tsx`, `createRoot` 직전)에 서버가 그린 `#ur-first-screen` **DOM 노드 자체**를
 * 참조로 잡아 둔다. React 가 컨테이너를 비워도 그 노드는 메모리에 살아 있고, 폴백이 같은 노드를
 * `appendChild` 로 도로 붙인다 ⇒ **재파싱 0 · 재다운로드 0 · 픽셀 차이 구조적으로 0**
 * (문자열을 다시 조립하면 두 벌이 갈릴 수 있다 — 이 레포가 반복해 당한 클래스).
 *
 * ⚠️ **노드를 미리 떼어내지(remove) 않는다.** 떼면 [떼어냄 → React 커밋] 사이에 페인트가 끼어
 * 사진이 한 프레임 사라질 수 있다(`root.render()` 는 즉시 커밋을 보장하지 않는다). React 의
 * 컨테이너 비우기와 폴백 삽입은 **같은 커밋**이라 그 사이엔 페인트가 없다.
 *
 * ## 이 파일이 **못** 하는 것
 * - 서버가 첫 화면을 안 그린 경로(교환권 상세·목록·PC 콜드) → `null` → 종전 로더(무회귀).
 * - SPA 내부 이동으로 들어온 상세 → 부팅 경로와 pathname 이 달라 `null`(그 화면엔 애초에
 *   서버 마크업이 없다).
 */

/** 워커(`detail-ssr-body.ts`)가 첫 화면을 감싸는 id. **양쪽 리터럴이 갈리면 조용히 no-op** 이라 테스트가 대조한다. */
export const BOOT_FIRST_SCREEN_ID = 'ur-first-screen'

let bootNode: HTMLElement | null = null
let bootPath: string | null = null

/** `createRoot` **직전에 1회**. 서버가 그린 첫 화면 노드를 참조로 잡아 둔다(떼어내지 않는다). */
export function captureBootFirstScreen(): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(BOOT_FIRST_SCREEN_ID)
  if (!el) return
  bootNode = el
  bootPath = window.location.pathname
}

/** 지금 그리려는 경로가 부팅 경로와 같을 때만 그 노드를 돌려준다. 아니면 `null`(종전 로더). */
export function takeBootFirstScreen(pathname: string): HTMLElement | null {
  return bootNode && bootPath === pathname ? bootNode : null
}
