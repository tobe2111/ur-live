/**
 * 🔖 2026-10-14 — 첫 화면이 없는 유어샵의 제목·링크(`buildCuratorNoscript` 의 🔖 절).
 *
 * 라이브 실측에서 sitemap 표본 48표면 중 `h1` 0 · 링크 0 인 표면이 **정확히 하나**였다
 * (`/u/user40` — linked_seller 유어샵이라 첫 화면이 `''`). 아래 주입은 그 결함을 되살린다.
 */
export default [
  {
    name: '🔖 유어샵폴백 — 폴백 유어샵이 제목을 다시 <p> 로 (라이브에서 h1 0 이던 그 모양)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: 'const body = (standalone ? h1Of(name && `${name} 유어샵`) : \'\')',
    replace: 'const body = (standalone ? (name ? `<p>${name} 유어샵</p>` : \'\') : \'\')',
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '색인 대상 유어샵의 크롤러 문서에 heading 이 0 이 된다 — 48표면 중 유일한 그 결함이다.',
  },
  {
    name: '🔗 유어샵폴백 — 폴백 유어샵 행의 링크를 없앤다 (내부 링크 0 으로 환원)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '    standalone ? rowHref({',
    replace: '    false ? rowHref({',
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '그 핀이 가리키는 /products/2917 은 sitemap 의 유일한 /products/ URL 이고, 이것이 그 한 건의 유일한 내부 링크 기회다.',
  },
  {
    name: '🔗 유어샵폴백 — 주소를 SSOT 대신 손으로 조립한다 (세 벌이 갈리는 길)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '    standalone ? rowHref({ id: id as number | string | null, category: category as string | null, deal_only: dealOnly as number | null }) : null',
    replace: '    standalone && id != null ? `/products/${id}` : null',
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '숙소·이용권이 /products/ 로 링크된다 — ItemList·sitemap 이 말하는 정본과 갈리고, 교환권 noindex 규율도 함께 사라진다.',
  },
  {
    name: '🎟️ 유어샵폴백 — 교환권에도 링크를 단다 (noindex URL 로 크롤 예산이 빠진다)',
    file: 'src/worker/utils/crawler-noscript-rows.ts',
    find: "export function rowHref(p: RegionSeedRow): string | null {\n  if (p?.deal_only === 1) return null",
    replace: "export function rowHref(p: RegionSeedRow): string | null {",
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '교환권 2,260건은 2026-07-07 결정으로 noindex 다 — 색인하지 말라고 한 URL 에 크롤 경로를 열면 예산이 그쪽으로 빠진다.',
  },
  {
    name: '🪞 유어샵폴백 — 첫 화면이 있는 경로에도 제목을 낸다 (같은 페이지에 h1 둘)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '  const standalone = !!opts.withName',
    replace: '  const standalone = true',
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '첫 화면의 #root 에 이미 h1 과 핀 링크가 있다 — 여기서 또 내면 h1 이 둘이고 같은 URL 로 가는 링크가 두 벌이 된다.',
  },
  {
    name: '🧾 유어샵폴백 — 시드 타입에서 링크 재료 선언을 뺀다 (값은 오는데 못 쓰던 그 상태)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '    product_id?: number | string | null; category?: string | null; deal_only?: number | null',
    replace: '    product_id?: never',
    test: 'src/tests/unit/curator-fallback-head-link-2026-10-14.test.ts',
    why: '2026-10-14 avg_rating 과 같은 클래스 — 값은 시드에 도착해 있는데 타입이 안 받아서 쓰지 못한다.',
  },
]
