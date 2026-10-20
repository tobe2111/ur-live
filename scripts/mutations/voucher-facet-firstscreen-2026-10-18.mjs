/**
 * 🎁 2026-10-18 — facet 링크가 **첫 화면 경로에서도** 나오는지.
 * 이 매니페스트는 **실패한 E4 뒤에** 생겼다: PR #1896 은 링크를 `buildListSurfaceNoscript` 에만
 * 넣었고, `/vouchers` 는 첫 화면이 성공하면 그 함수를 안 불러 **라이브 효과가 0** 이었다.
 */
const TEST = 'src/tests/unit/voucher-facet-firstscreen-2026-10-18.test.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
const WORKER = 'src/worker/index.ts'

// 🕳️ 2026-10-18 — `(반대 방향) 첫 화면 실패 폴백이 사라진다` 는 여기 두지 않는다:
//    `vouchers-first-screen-2026-10-14.mjs` 의 `🎟️ 교환권 첫 화면 폴백에서 크롤러 요약이 빠진다`
//    가 **같은 자리**를 이미 지킨다(이 PR 에서 앵커만 재조준했다). 둘 다 두면 중복 잠금이라
//    어느 쪽도 출력으로 판정할 수 없다.
export default [
  {
    name: '🎁🖥️ 워커가 첫 화면 경로에서 facet 링크를 안 낸다 — #1896 의 그 결함 그대로',
    why: '서버 첫 화면이 성공하면 `buildStaticSurfaceNoscript` 는 안 불린다. 첫 화면과 함께 내지 않으면 허브 링크가 라이브에서 0 이다(머지 8d40789e1 직후 실측).',
    file: WORKER,
    find: 'vouchersFirst ? vouchersFirst + voucherFacetNoscript(url.pathname) : (buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml)',
    replace: 'vouchersFirst || (buildStaticSurfaceNoscript(url.pathname, crawlerPayload) + urdealLoaderHtml)',
    test: TEST,
  },

  {
    name: '🎁🖥️ facet noscript 가 다른 표면에도 나온다',
    why: '`/browse`·`/map`·`/stays` 는 무접촉이어야 한다 — 교환권 카테고리를 남의 목록에 달면 그 표면의 주제가 흐려진다.',
    file: NS,
    find: "const l = path === '/vouchers' ? facetLinksHtml() : ''",
    replace: "const l = facetLinksHtml()",
    test: TEST,
  },
  {
    name: '🎁🖥️ noscript 로 안 감싼다 — 사람 화면에 카테고리 목록이 뜬다',
    why: '`<noscript>` 라서 사람 화면이 byte-동일이다. 벗기면 첫 화면 아래 링크 20개가 그대로 보인다(승인 범위 밖).',
    file: NS,
    find: "return l ? `<noscript>${l}</noscript>` : ''",
    replace: 'return l',
    test: TEST,
  },
]
