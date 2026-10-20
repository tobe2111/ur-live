/**
 * 🎞️ 유어쇼츠 뷰어 넘김 전환 (2026-10-20) — 밀어 올린 뒤 넘어가기 · 손가락 따라가기 · 덮개.
 * 가드: src/tests/unit/urshorts-slide-2026-10-20.test.tsx
 */
const TEST = 'src/tests/unit/urshorts-slide-2026-10-20.test.tsx'
const H = 'src/pages/videos/useSlideTransition.ts'
const V = 'src/pages/VideosPage.tsx'

export default [
  {
    name: '🎞️ 넘김이 밀기 없이 즉시 바뀐다',
    file: H,
    find: '    if (prefersReducedMotion()) { set(next); return }\n',
    replace: '    { set(next); return }\n',
    test: TEST,
    why: '전환 효과가 통째로 사라져 종전처럼 화면이 툭 바뀐다(에러 0).',
  },
  {
    name: '🎞️ 전환 중 두 번째 넘김을 막지 않는다',
    file: H,
    find: '    if (busy.current) return\n    const next = i + d',
    replace: '    const next = i + d',
    test: TEST,
    why: '빠르게 두 번 쓸면 한 번에 두 칸 넘어가 영상 하나를 건너뛴다.',
  },
  {
    name: '🎞️ 끝에서도 손가락을 그대로 따라간다',
    file: H,
    find: 'setShift(atEdge ? dy / 3 : dy)',
    replace: 'setShift(dy)',
    test: TEST,
    why: '첫·마지막 영상에서 끌어도 더 없다는 느낌이 안 난다.',
  },
  {
    name: '🎞️ 덮개 백스톱이 없다',
    file: H,
    find: '    const t = window.setTimeout(() => setCoverId(null), COVER_MAX_MS)\n',
    replace: '    const t = 0\n',
    test: TEST,
    why: '자동재생이 막힌 브라우저에서 썸네일 덮개가 영영 안 걷혀 영상이 안 보인다.',
  },
  {
    name: '🎞️ 구매 바가 무대와 따로 논다',
    file: V,
    find: '<div style={slideStyle} className="absolute inset-x-2.5 bottom-2.5 z-20',
    replace: '<div className="absolute inset-x-2.5 bottom-2.5 z-20',
    test: TEST,
    why: '영상은 밀려 올라가는데 구매 바만 제자리에 남아 다음 영상 위에 이전 가게 가격이 떠 있다.',
  },
]
