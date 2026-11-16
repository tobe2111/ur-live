/** 🧬 주입 — 크롤러 본문 '다녀온 사람들' 제목 (2026-11-16) · 가드: src/tests/unit/crawler-creator-titles-2026-11-16.test.ts */
const T = 'src/tests/unit/crawler-creator-titles-2026-11-16.test.ts'
export default [
  { name: 'crawltitles: 크롤러 본문에서 후기 제목이 빠진다', file: 'src/worker/utils/crawler-noscript.ts',
    find: '    terms && esc(terms), creatorLine(d.creator_titles),', replace: '    terms && esc(terms),', test: T,
    why: '이용권 상세 크롤러 본문이 다시 173자(가격·주소뿐)로 돌아가 검색에 잡힐 고유 문구가 없다.' },
  { name: 'crawltitles: 숨긴 글까지 싣는다', file: 'src/features/group-buy/api/detail-meta-enrich.ts',
    find: "WHERE store_key = ? AND status = 'visible' AND title", replace: "WHERE store_key = ? AND title", test: T,
    why: '사장님이 숨긴 후기 제목이 검색 크롤러에 계속 노출된다.' },
  { name: 'crawltitles: 상세 라우트가 가게 정보를 안 넘긴다', file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: ", { name: (product as { restaurant_name?: string | null }).restaurant_name, address: (product as { restaurant_address?: string | null }).restaurant_address })",
    replace: ")", test: T, why: '제목 조회가 언제나 빈 배열이 되어 기능이 조용히 죽는다.' },
]
