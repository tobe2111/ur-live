/**
 * 🎬 작은 움직임 키트의 CSS — **쓰는 부품이 불러올 때 한 번만** <style> 로 꽂는다 (2026-11-02).
 *
 * 왜 .css 파일이 아닌가(실측 두 번):
 *   ① index.css 에 두면 모든 화면의 첫 화면이 받는다(+1.2KB brotli — 화면별 무게 예산이 잡았다).
 *   ② 따로 .css 파일로 import 하면 묶음기가 그 CSS 를 따라 청크를 다시 묶어, 마이 첫 화면이
 *      상세 화면 청크(19KB)를 통째로 받았다. ⇒ CSS 를 **각 부품 파일 안**에 문자열로 둔다(공유 상수 모듈도 묶음기가 공용 청크로 옮긴다) —
 *      그 부품이 실린 청크에만 들어가고 묶음에 영향이 없다. 같은 id 는 한 번만 꽂힌다.
 * 규칙: transform·opacity(+배경색·선 그리기)만 · 한 번 돌고 멈춤 · 문자열마다 동작 줄이기 끔을 함께 넣는다.
 */
export function injectMotionCss(id: string, css: string): void {
  if (typeof document === 'undefined' || document.getElementById(id)) return
  const s = document.createElement('style')
  s.id = id
  s.textContent = css
  document.head.appendChild(s)
}
