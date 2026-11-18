/** 되돌려-검증 주입 — IndexNow 가 상한에서 멈추지 않는다 (2026-11-18). */
const T = 'src/tests/unit/seo-mallproduct-crawler-img-indexnow-2026-10-14.test.ts'
const F = 'src/shared/seo/indexnow.ts'
export default [
  { name: 'indexnow1118: 상한에 잘리면 커서를 유지(옛 동작 — 영원히 멈춤)', file: F,
    find: '    cursor: take[take.length - 1].lastmod,', replace: '    cursor: prev,', test: T,
    why: '변경이 상한을 넘는 순간 매일 같은 건만 다시 보내고 나머지는 끝내 안 간다(11-11 라이브).' },
  { name: 'indexnow1118: 경계 시각을 반만 보낸다', file: F,
    find: '  if (changed[max] && changed[max].lastmod === edge) {', replace: '  if (false) {', test: T,
    why: '같은 시각의 나머지가 커서 뒤로 영구히 빠진다.' },
  { name: 'indexnow1118: 새 것부터 자른다', file: F,
    find: '  changed.sort((a, b) => (a.lastmod < b.lastmod ? -1 : a.lastmod > b.lastmod ? 1 : 0))\n  let take', replace: '  changed.sort((a, b) => (a.lastmod < b.lastmod ? 1 : a.lastmod > b.lastmod ? -1 : 0))\n  let take', test: T,
    why: '오래된 변경을 건너뛰고 커서가 그 위로 넘어간다.' },
]
