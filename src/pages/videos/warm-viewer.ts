/**
 * 🐢 2026-11-02 대표 *"유어쇼츠도 느리더라"* — 뷰어(`/videos`)를 **누르기 직전에** 데운다.
 *
 * 영상을 누르면 ① 뷰어 화면 코드(청크) ② 유튜브 IFrame Player API 스크립트를 그때서야 받기 시작했다.
 * 손가락이 카드에 닿는 순간(`pointerdown`)부터 누름이 끝나는 순간까지 보통 100~200ms 가 있다 — 그 사이에 출발시킨다.
 *
 * ⚠️ `import('../VideosPage')` 를 **여기서 직접 쓰지 않는다** — 홈 묶음이 재생 화면 모듈을 가리키면 묶음기가 봉투를
 *   다시 짜서 모든 화면의 첫 화면 무게가 늘었다(2026-11-02 CI `surface-budgets` 12화면 +1.5KB · `lib/route-preload` 머리말과
 *   같은 함정). App.tsx 가 등록한 로더를 **이름으로** 부른다. 유튜브 재생기는 그 화면 모듈이 로드되는 순간 스스로 출발한다
 *   (`VideosPage.tsx` 최상단).
 * 데이터 절약 모드면 안 받는다. 실패해도 아무 일도 없다(뷰어가 평소처럼 받는다).
 */
import { preloadRoute } from '@/lib/route-preload'

export function warmShortsViewer(): void {
  const c = (navigator as { connection?: { saveData?: boolean } }).connection
  if (c?.saveData) return
  preloadRoute('videos')
}
