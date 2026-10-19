// 🗂️ 2026-10-19 — AI 비서용 이용권 목록이 거짓을 말하거나 사라지는 방향.
const T = 'src/tests/unit/llms-catalog-2026-10-19.test.ts'
export default [
  {
    name: '[llms-catalog] 리뷰 0건에도 별점을 쓴다',
    file: 'src/shared/seo/llms-catalog.ts',
    find: '  if (rc > 0 && rv > 0) parts.push(',
    replace: '  if (true) parts.push(',
    test: T,
    why: 'AI 가 "별점 0.0" 을 그대로 인용한다 — 리뷰 없는 가게가 최하점 가게가 된다.',
  },
  {
    name: '[llms-catalog] 교환권(noindex 상세)을 싣는다',
    file: 'src/shared/seo/llms-catalog.ts',
    find: '  if (row.id == null || Number(row.deal_only) === 1) return null',
    replace: '  if (row.id == null) return null',
    test: T,
    why: '색인하지 말라고 한 상세를 AI 에게 "여기서 사라" 고 권한다 — 서로 반대 신호.',
  },
  {
    name: '[llms-catalog] 빈 목록을 200 으로 낸다',
    file: 'src/shared/seo/llms-catalog.ts',
    find: '  if (total === 0) return null',
    replace: '  if (total === -1) return null',
    test: T,
    why: '요약이 없는 날 AI 가 "유어딜은 파는 게 없다" 고 읽는다.',
  },
  {
    name: '[llms-catalog] 정본 대신 쇼핑 상세로 링크한다',
    file: 'src/shared/seo/llms-catalog.ts',
    find: '  const path = canonicalDetailPath({ id: row.id, deal_only: row.deal_only, category: row.category }) ?? detailHref({ id: row.id })',
    replace: '  const path = detailHref({ id: row.id })',
    test: T,
    why: '/products/:id 는 이용권을 /pass 로 다시 보낸다 — 같은 상품을 두 URL 로 권한다.',
  },
  {
    name: '[llms-catalog] llms.txt 가 목록을 안 가리킨다',
    file: 'src/shared/seo/llms-txt.ts',
    find: "    `- ${LLMS_CATALOG_LINK_LABEL}: ${base}${LLMS_CATALOG_PATH}`,\n",
    replace: '',
    test: T,
    why: 'AI 가 처음 찾는 입구에서 목록으로 가는 길이 끊긴다.',
  },
  {
    name: '[llms-catalog] 요약이 없을 때 200',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: '      status: 503,',
    replace: '      status: 200,',
    test: T,
    why: '갱신 중 안내문이 정상 문서로 캐시돼 크롤러가 그걸 목록으로 읽는다.',
  },
]
