// 🏠 생활 업체 소개 서버 메타·sitemap (2026-10-26) — `src/tests/unit/life-biz-seo-2026-10-26.test.ts` 가 잡아야 하는 결함.
const TEST = 'src/tests/unit/life-biz-seo-2026-10-26.test.ts'
export default [
  {
    name: '🏠 업체 페이지 — 얇은 업체도 색인한다',
    file: 'src/shared/life-biz-seo.ts',
    find: "return (v.intro || '').trim().length >= LIFE_BIZ_MIN_INTRO || Number(v.reviews?.count || 0) > 0",
    replace: "return true",
    test: TEST,
    why: '이름만 있는 업체 수백 개를 색인 요청하면 구글이 thin content 로 본다.',
  },
  {
    name: '🏠 업체 페이지 — 후기 0건에도 별점을 낸다',
    file: 'src/shared/life-biz-seo.ts',
    find: "return rc > 0 && v.reviews?.avg != null ? `★${Number(v.reviews.avg).toFixed(1)}` : null",
    replace: "return `★${Number(v.reviews?.avg ?? 0).toFixed(1)}`",
    test: TEST,
    why: '0건에 별점을 내면 "0점 업체" 라고 말하는 것이다.',
  },
  {
    name: '🏠 업체 페이지 — sitemap 이 숨김 후기도 센다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "r.seller_id = p.seller_id AND r.hidden = 0)",
    replace: "r.seller_id = p.seller_id)",
    test: TEST,
    why: 'sitemap 이 화면 noindex 조건과 갈리면 "색인 요청 ↔ noindex" 모순이 생긴다.',
  },
  {
    name: '🏠 업체 페이지 — 크롤러 본문이 후기를 탈출하지 않는다',
    file: 'src/worker/utils/life-biz-ssr.ts',
    find: "`<li>★${Number(r.rating)} ${esc(r.reviewer)}: ${esc(r.body)}</li>`",
    replace: "`<li>★${Number(r.rating)} ${esc(r.reviewer)}: ${r.body}</li>`",
    test: TEST,
    why: '후기 본문은 손님이 쓴 글이다 — 탈출하지 않으면 마크업 주입.',
  },
  {
    name: '🏠 업체 페이지 — 없는 업체가 200 + index',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "  'LIFEBIZ',\n",
    replace: "",
    test: TEST,
    why: '추측한 id 가 색인 후보가 된다(soft-404).',
  },
]
