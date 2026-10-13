/**
 * 🛍️ sitemap 이 사업자 아닌 유저의 유어샵도 제출한다 (2026-10-11, 대표 "또 개선할 부분은?") — 주입 매니페스트.
 * 가드: src/tests/unit/sitemap-urshop-users-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/sitemap-urshop-users-2026-10-11.test.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'

export default [
  {
    name: '🛍️ sitemap 이 유저 유어샵 쿼리를 아예 안 돈다(사업자 아닌 유어샵이 색인 요청에서 빠진다)',
    file: SITEMAP,
    find: '      for (const u of shopUsers.results || []) {',
    replace: '      for (const u of [] as Array<{ handle: string }>) {',
    test: TEST,
    why: '라이브 실측: 핀 있는 유어샵 4곳 중 3곳이 이렇게 빠져 있었다(그중 하나가 핀 6개). 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🛍️ 콘텐츠 기준(핀 EXISTS)이 빠진다(핀 0 유어샵을 제출 → 크롤러가 로더만 받아 soft-404)',
    file: SITEMAP,
    // 🔁 2026-10-12 재조준 — 기준이 "핀 **행** 존재" → "**보이는** 핀 존재"(활성 + 소비자 노출)로
    //    좁혀졌다. 불변식은 그대로다: 제출 기준이 빠지면 본문 없는 유어샵이 색인 요청된다.
    find: `            AND EXISTS (SELECT 1 FROM product_pins pp JOIN products pq ON pq.id = pp.product_id
                         WHERE pp.user_id = u.id AND pq.is_active = 1
                           AND \${consumerVisibleProductSql('pq')})`,
    replace: '            AND 1 = 1',
    test: TEST,
    why: '`buildCuratorFirstScreen` 은 `pins.length === 0` 이면 `\'\'` 를 돌려준다 — 제출 기준과 **짝**이다.',
  },
  {
    name: '🛍️ 중복 확인이 사라진다(승인 셀러가 연결된 유어샵이 같은 URL 로 두 번 나간다)',
    file: SITEMAP,
    find: '        if (emittedShopLocs.has(loc)) continue;',
    replace: '        if (false) continue;',
    test: TEST,
    why: '같은 `<loc>` 이 두 번이면 sitemap 자체가 무효 취급될 수 있다 — 고치려던 것이 더 큰 결함이 된다.',
  },
  {
    name: '🛍️ 셀러 블록이 내보낸 URL 을 기록하지 않는다(중복 확인이 아무것도 못 본다)',
    file: SITEMAP,
    find: '        emittedShopLocs.add(loc);\n        urls.push({ loc, priority: 0.7, changefreq: \'weekly\' });\n      }\n\n      // 🛍️ 2026-10-11 (대표 "또 개선할 부분은?"',
    replace: '        urls.push({ loc, priority: 0.7, changefreq: \'weekly\' });\n      }\n\n      // 🛍️ 2026-10-11 (대표 "또 개선할 부분은?"',
    test: TEST,
    why: '기록하는 쪽과 확인하는 쪽은 **쌍이다** — 한쪽만 있으면 Set 이 늘 비어 중복이 그대로 나간다.',
  },
  {
    name: '🛍️ 빈 핸들도 제출한다(`/u/` 로 끝나는 URL = 존재하지 않는 페이지)',
    file: SITEMAP,
    find: "          WHERE u.handle IS NOT NULL AND TRIM(u.handle) <> ''",
    replace: '          WHERE 1 = 1',
    test: TEST,
    why: '핸들이 없으면 제출할 URL 자체가 없다 — 빈 문자열을 이어 붙이면 `/u/` 가 나가고 그건 404 다.',
  },
  {
    name: '🛍️ 첫 화면 빌더가 빈 유어샵도 그린다(제출 기준의 짝이 깨진다)',
    file: 'src/worker/utils/curator-ssr-body.ts',
    find: "    if (pins.length === 0) return ''",
    replace: "    if (pins.length < 0) return ''",
    test: TEST,
    why: '이 가드는 sitemap 의 콘텐츠 기준과 **같은 사실**을 양쪽에서 잡는다 — 둘이 갈리면 제출한 URL 에 본문이 없다.',
  },
]
