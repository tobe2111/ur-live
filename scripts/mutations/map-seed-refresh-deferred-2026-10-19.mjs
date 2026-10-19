/**
 * 🧬 주입 — 지도 시드 새로고침을 첫 화면 뒤로 (2026-10-19 대표 "지도랑 블로그도 상세히")
 */
const T = 'src/tests/unit/map-seed-refresh-deferred-2026-10-19.test.ts'
const F = 'src/hooks/queries/useMapProducts.ts'
export default [
  {
    name: '지도시드 — 시드가 있어도 바로 다시 받는다',
    file: F,
    find: 'if (!seeded) { void refresh(); return () => { cancelled = true } }',
    replace: 'if (true) { void refresh(); return () => { cancelled = true } }',
    test: T,
    why: '시드로 그린 직후 같은 page1 을 다시 받아 지도 타일과 회선을 나눠 쓴다.',
  },
  {
    name: '지도시드 — 타일 신호와 백스톱이 겹쳐 두 번 받는다',
    file: F,
    find: '      if (cancelled || started) return',
    replace: '      if (cancelled) return',
    test: T,
    why: '타일 신호 뒤 백스톱이 또 갱신해 같은 요청이 두 번 나간다.',
  },
  {
    name: '지도시드 — 백스톱을 지운다',
    file: F,
    find: '      fallback = setTimeout(go, 8000)',
    replace: '      fallback = undefined',
    test: T,
    why: '지도 SDK 가 실패하면 목록이 영영 갱신되지 않는다.',
  },
]
