/**
 * 🎟️ 2026-10-12 — 교환권 facet 크롤러 본문 주입.
 *
 * 시험: src/tests/unit/voucher-facet-body-2026-10-12.test.ts
 * 라이브 실측(그 시험 머리말): sitemap 이 제출하는 facet 3건의 본문이 **8자**(로더 워드마크뿐).
 */
const FACET = 'src/shared/seo/voucher-facet.ts'
const WORKER = 'src/worker/index.ts'
const TEST = 'src/tests/unit/voucher-facet-body-2026-10-12.test.ts'

export default [
  {
    name: '🎟️ facet 이 다시 시드를 못 받는다 — 쿼리가 붙으면 슬롯에서 떨어진다',
    why: '워커 VOUCHERS 조건이 `!url.search` 로 돌아가면 sitemap 이 제출한 facet 3건은 '
       + '다시 본문 8자가 된다 — 그게 원래 증상이었다.',
    file: WORKER,
    find: "url.pathname === '/vouchers' && (!url.search || voucherFacetSeedPath(url.search))",
    replace: "url.pathname === '/vouchers' && !url.search",
    test: TEST,
  },
  {
    name: '🎟️ 시드 경로를 손으로 적은 리터럴로 되돌린다 — 예열 키와 갈린다',
    why: 'SSOT 를 안 쓰면 예열 목록(HOT_PATHS)과 byte-불일치가 조용히 생긴다. 2026-10-11 에 '
       + '칩 4종이 정확히 그 방식으로 몇 달간 헛돌았다(캐시 키가 곧 주소다).',
    file: WORKER,
    find: 'path: voucherFacetSeedPath(url.search) || VOUCHERS_SEED_PATH',
    replace: "path: '/api/products?page=1&limit=20&deal_only=1&sort=price_low'",
    test: TEST,
  },
  {
    name: '🎟️ facet 시드를 사람 응답에 주입한다 — 반대 방향',
    why: '화면의 소비 조건은 `!category` 라 그 시드를 안 먹는다. 실으면 사람이 쓰지도 않는 '
       + 'JSON 을 내려받는다(2026-10-12 지역 요약에서 변수를 분리한 그 규율).',
    file: WORKER,
    find: "    if (url.pathname === '/vouchers' && url.search) ssrPayload = null;",
    replace: '',
    test: TEST,
  },
  {
    name: '🎟️ 허용목록 검사가 빠진다 — 아무 카테고리나 본문을 받는다',
    why: '`?category=테스트123` 같은 임의 값이 자기 canonical 과 본문까지 받으면 무한 thin URL 이 '
       + '된다(#1746 이 최상위 경로에서, 2026-10-12 가 canonical 에서 닫은 그 클래스).',
    file: FACET,
    find: "  if (!cat || !VOUCHER_FILTER_CATEGORIES.includes(cat)) return null",
    replace: '  if (!cat) return null',
    test: TEST,
  },
  {
    name: '🎟️ 파라미터 개수 검사가 빠진다 — 화면과 다른 목록을 크롤러에게 준다',
    why: '`&sort=price_high` 가 붙으면 화면은 비싼 순인데 시드는 `sort=price_low` 다. '
       + '크롤러가 화면에 없는 목록을 읽게 되는 건 클로킹 쪽으로 기운다.',
    file: FACET,
    find: '  if (n !== 1) return null',
    replace: '  if (n < 1) return null',
    test: TEST,
  },
  {
    name: '🎟️ 카테고리를 인코딩 없이 붙인다 — 예열 키와 byte-불일치',
    why: '`커피/음료` 의 `/` 가 그대로 들어가면 예열해 둔 `%2F` 키와 다른 주소가 되어 '
       + '그 카테고리만 매번 콜드 self-fetch 가 된다(에러는 안 난다).',
    file: FACET,
    find: '  return `${VOUCHERS_SEED_PATH}&category=${encodeURIComponent(cat)}`',
    replace: '  return `${VOUCHERS_SEED_PATH}&category=${cat}`',
    test: TEST,
  },
  {
    name: '🎟️ 허용목록을 자체 사본으로 둔다 — canonical 과 두 벌이 된다',
    why: 'canonical 은 `VOUCHER_FILTER_CATEGORIES` 로 통합을 판정한다. 목록이 두 벌이면 '
       + 'canonical 은 통합하는데 본문은 내보내는(또는 그 반대) 모순이 조용히 생긴다.',
    file: FACET,
    find: "import { VOUCHER_FILTER_CATEGORIES } from './consumer-surfaces'",
    replace: "const VOUCHER_FILTER_CATEGORIES: readonly string[] = ['편의점', '커피/음료', '베이커리/도넛']",
    test: TEST,
  },
]
