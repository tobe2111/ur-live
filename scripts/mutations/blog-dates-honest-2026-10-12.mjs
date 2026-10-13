/**
 * 🗓️ 2026-10-12 — 블로그 날짜 정직성 주입.
 *
 * 시험: src/tests/unit/blog-dates-honest-2026-10-12.test.ts
 * 라이브 실측(그 시험 머리말)에 근거: 21편의 `published_at` 이 전부 마지막 재시드 한 순간에서
 * 3일 간격으로 흩뿌려져 있었고, `datePublished === dateModified` 였다.
 */
const BLOG = 'src/features/blog/api/blog.routes.ts'
const META = 'src/features/blog/api/blog-ssr-meta.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const TEST = 'src/tests/unit/blog-dates-honest-2026-10-12.test.ts'

export default [
  {
    name: '🗓️ 재시드가 발행일을 다시 쓴다 — 배포마다 글 21편이 앞으로 점프',
    why: '`BLOG_SEED_VERSION` bump 은 서비스 사실이 바뀔 때마다 돌라고 룰이 요구한다 ⇒ 자주 돈다. '
       + '그때마다 구글이 보는 발행일이 "지금 − 3i일" 로 재작성돼 오래된 글이 나이를 못 쌓는다. '
       + '에러 0 · 화면 불변(목록은 여전히 3일 간격) — 재 본 사람만 안다.',
    file: BLOG,
    find: 'SET title=?, summary=?, content=?, tags=?, is_seed=1, is_published=1, seed_version=?',
    replace: "SET title=?, summary=?, content=?, tags=?, is_seed=1, is_published=1, published_at=datetime('now', ?), seed_version=?",
    test: TEST,
  },
  {
    name: '🗓️ 재시드가 updated_at 을 안 건드린다 — 수정 신호가 사라진다',
    why: '`dateModified` 와 sitemap `lastmod` 가 이 값을 쓴다. 안 갱신하면 본문이 바뀌어도 '
       + '"다시 읽어라" 신호가 0 이 된다(발행일 동결의 **짝**이라 둘 중 하나만 깨져도 반쪽이다).',
    file: BLOG,
    find: 'seed_version=?, updated_at=CURRENT_TIMESTAMP',
    replace: 'seed_version=?',
    test: TEST,
  },
  {
    name: '↩️ 새 글 INSERT 에서 발행일을 뺀다 — 반대 방향',
    why: '발행일 동결을 "아예 안 쓴다"로 과하게 밀면 새 글이 NULL 로 들어가 목록 정렬'
       + '(`ORDER BY published_at DESC`)이 통째로 깨진다. 동결은 **재작성**만 금지한다.',
    file: BLOG,
    find: "is_seed, manually_edited, seed_version)\n        VALUES (?, ?, ?, ?, ?, '유어딜 팀', 1, datetime('now', ?), 1, 0, ?)",
    replace: "is_seed, manually_edited, seed_version)\n        VALUES (?, ?, ?, ?, ?, '유어딜 팀', 1, NULL, 1, 0, ?)",
    test: TEST,
  },
  {
    name: '🗓️ dateModified 를 다시 발행일로 — "고쳤다" 신호가 구조적으로 불가능해진다',
    why: '종전 상태가 정확히 이것이었다(라이브 실측 두 값 동일). 되돌리면 글을 고쳐도 구글이 모른다.',
    file: META,
    find: 'dateModified: mod || pub',
    replace: 'dateModified: pub',
    test: TEST,
  },
  {
    name: '🗓️ 수정일이 발행일보다 앞서도 그대로 내보낸다 — 모순 신호',
    why: '수정이 발행보다 먼저일 수는 없다. 그런 쌍을 내면 구글이 둘 다 신뢰하지 않는다.',
    file: META,
    find: 'upRaw && pub && upRaw >= pub ? upRaw : pub',
    replace: 'upRaw || pub',
    test: TEST,
  },
  {
    name: '🗓️ sitemap 블로그가 updated_at 을 안 받아 온다 — lastmod 재료가 없다',
    why: '상품 359건은 이미 lastmod 를 내는데 블로그 22건만 빠져 있었다. SELECT 에서 빠지면 '
       + '`b.updated_at` 이 undefined 라 **조용히** lastmod 가 사라진다(쿼리 에러 0).',
    file: SITEMAP,
    find: 'SELECT slug, updated_at FROM blog_posts',
    replace: 'SELECT slug FROM blog_posts',
    test: TEST,
  },
  {
    name: '🗓️ sitemap 블로그 항목에서 lastmod 를 뺀다',
    why: '본문이 바뀌어도 "다시 읽어라"가 0 이다.',
    file: SITEMAP,
    find: "changefreq: 'monthly', lastmod: b.updated_at",
    replace: "changefreq: 'monthly'",
    test: TEST,
  },
  // 🚫 **주입이 없는 단언이 하나 있다** — 시험 ④(*"카카오가 SVG 를 못 읽는다"는 과장이
  //   되살아나지 않는다*). 그 대상은 **주석**이라 러너가 거부한다(*"주입 대상이 주석에만 있다 —
  //   낡은 지도"*). 그게 러너의 옳은 동작이다: 주석만 바꾸는 주입은 **행동을 바꾸지 않으므로**
  //   가드가 실패할 수 있는지를 증명하지 못한다. ④ 는 행동 가드가 아니라 **근거 정확성** 가드이고,
  //   그래서 여기 주입이 없다. 다시 시도하지 말 것.
]
