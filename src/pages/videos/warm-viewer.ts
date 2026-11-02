/**
 * 🐢 2026-11-02 대표 *"유어쇼츠도 느리더라"* — 뷰어(`/videos`)를 **누르기 직전에** 데운다.
 *
 * 영상을 누르면 ① 뷰어 화면 코드(청크) ② 유튜브 IFrame Player API 스크립트를 그때서야 받기 시작했다.
 * 손가락이 카드에 닿는 순간(`pointerdown`)부터 누름이 끝나는 순간까지 보통 100~200ms 가 있다 — 그 사이에
 * 둘 다 출발시켜 둔다. 둘 다 같은 모듈 캐시를 쓰므로(`import()` · `loadYouTubePlayerApi` 의 `pending`)
 * 두 번 받지 않는다. 실패해도 아무 일도 없다(뷰어가 평소처럼 받는다).
 */
let warmed = false

export function warmShortsViewer(): void {
  if (warmed) return
  warmed = true
  void import('../VideosPage').catch(() => { warmed = false })
  void import('./youtube-player').then((m) => m.loadYouTubePlayerApi()).catch(() => { /* 뷰어가 다시 시도한다 */ })
}
