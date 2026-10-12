/**
 * 🗺️ 등록 안 된 경로는 404 + noindex (2026-10-12, 대표 "응 모두 해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/unknown-path-404-2026-10-12.test.ts
 *
 * 🔴 이 처방은 **방향이 뒤집히면 피해가 더 크다**(멀쩡한 페이지가 404 → 색인 손실, 복구 수주).
 *    그래서 주입의 절반이 반대 방향이다.
 */
const TEST = 'src/tests/unit/unknown-path-404-2026-10-12.test.ts'
const SSOT = 'src/shared/seo/known-routes.ts'
const WORKER = 'src/worker/index.ts'

export default [
  {
    name: '🗺️ isKnownAppPath 가 늘 true — 무한 soft-404 가 돌아온다',
    file: SSOT,
    find: '  const segs = pathname.split(\'/\').filter(Boolean)',
    replace: '  return true; const segs = pathname.split(\'/\').filter(Boolean)',
    test: TEST,
    why: '등록 안 된 아무 URL 이 다시 200 + index 가 된다 — 오타 링크·외부 스팸 링크가 전부 색인 후보다.',
  },
  {
    name: '🗺️ 1세그먼트를 정확 일치가 아니라 세그먼트 집합으로 판정 — `/products` 가 통과한다',
    file: SSOT,
    find: '  if (segs.length === 1) return KNOWN_SINGLE_ROUTES.has(segs[0])',
    replace: '  if (segs.length === 1) return KNOWN_TOP_SEGMENTS.has(segs[0])',
    test: TEST,
    why: '`products` 는 `/products/:id` 때문에 세그먼트 집합엔 있지만 **목록 라우트가 없다** — 정확 일치여야 그 클래스를 잡는다.',
  },
  {
    name: '🗺️ 반대 방향 — 깊은 경로까지 정확 일치를 요구한다(대시보드 전체가 404)',
    file: SSOT,
    find: '  return KNOWN_TOP_SEGMENTS.has(segs[0])',
    replace: '  return KNOWN_SINGLE_ROUTES.has(segs.join(\'/\'))',
    test: TEST,
    why: '라우트 표에 없는 하위 경로(`/seller/orders/xyz`)를 자르면 멀쩡한 화면이 404 가 된다 — 색인 손실은 복구가 수주다.',
  },
  {
    name: '🗺️ 반대 방향 — 세그먼트 목록에서 대시보드를 뺀다(App.tsx 만 읽던 첫 설계)',
    file: SSOT,
    find: "  '500', 'about', 'account', 'admin', 'ads', 'agency', 'area-report', 'auth',",
    replace: "  '500', 'about', 'account', 'area-report', 'auth',",
    test: TEST,
    why: '라우트는 네 파일에 있다 — App.tsx 하나만 읽으면 `/admin`·`/seller`·`/agency` ~180개를 404 로 만든다. ②가 네 파일을 다시 읽어 그걸 잡는다.',
  },
  {
    name: '🗺️ 몰 상품 귀속 경로를 막는다 — 소개비 클릭 경로가 404',
    file: SSOT,
    find: "  if (segs.length === 3 && segs[1] === 'p') return true",
    replace: "  if (false) return true",
    test: TEST,
    why: '`/:mallSlug/p/:id` 는 최상위가 파라미터인 유일한 다중 세그먼트 패턴이다 — 막으면 몰 손님의 상품 링크가 전부 404 다.',
  },
  {
    name: '🗺️ 워커가 noindex 만 붙이고 404 는 안 낸다 — 크롤 예산이 계속 샌다',
    file: WORKER,
    find: 'const goneStatus = retiredSurface ? 410 : ((entityGone || unknownPath) ? 404 : 0);',
    replace: 'const goneStatus = retiredSurface ? 410 : (entityGone ? 404 : 0);',
    test: TEST,
    why: '구글은 soft-404 를 "있다고 말하면서 아무것도 없는 페이지" 로 집계한다 — noindex 만으로는 크롤이 계속 온다.',
  },
  {
    name: '🗺️ 워커가 404 만 내고 noindex 는 안 붙인다',
    file: WORKER,
    find: 'if (entityGone || unknownPath || retiredSurface) {',
    replace: 'if (entityGone || retiredSurface) {',
    test: TEST,
    why: '404 와 noindex 는 짝이다 — 하나만이면 이미 색인된 URL 이 안 빠진다.',
  },
  {
    name: '🗺️ 판정이 계산만 되고 안 쓰인다 (`false &&`)',
    file: WORKER,
    find: "const unknownPath = ssrSlot !== 'MALL' && !isKnownAppPath(url.pathname);",
    replace: "const unknownPath = false && !isKnownAppPath(url.pathname);",
    test: TEST,
    why: '계산과 사용은 다른 자리다 — 값은 멀쩡히 남고 정책만 죽는다(이 레포가 `goneStatus` 에서 이미 밟은 함정).',
  },
  {
    name: '🗺️ 없는 몰이 다시 200 — MALL 을 엔티티 슬롯에서 뺀다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "'BLOGPOST', 'MALL'])",
    replace: "'BLOGPOST'])",
    test: TEST,
    why: '1세그먼트 미등록 경로는 몰 후보라 라우트 판정에서 제외된다 — MALL 슬롯이 받지 않으면 그 구멍이 다시 열린다.',
  },
]
