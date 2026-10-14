/**
 * 🍞 2026-10-14 — 빵부스러기 체인 주입.
 *
 * 근거·실측·버린 길은 `src/shared/seo/breadcrumb.ts` 머리말,
 * 못 보는 것은 `src/tests/unit/breadcrumb-chain-2026-10-14.test.ts` 머리말.
 *
 * 🔴 **절반이 반대 방향이다.** 이 처방은 "더 접는" 쪽으로 틀리면 피해가 훨씬 크다 —
 *    중복 한 줄을 없애는 이득은 작은데, 접기가 과하면 `/stays`·`/browse` 단계가 사라져
 *    359건의 SERP trail 에서 카테고리가 통째로 빠지고 복구는 색인 수주다.
 *
 * ⚠️ 이름에 **공통 토큰**(`빵부스러기 체인`)을 둔다 — `--only` 는 정규식이 아니라 부분일치라,
 *    이름이 갈리면 한 번에 고를 수 없고 무엇이 돌았는지도 모른다(그리고 0건 매칭은 조용히 초록이다).
 */
const SSOT = 'src/shared/seo/breadcrumb.ts'
const DETAIL = 'src/worker/utils/detail-ssr-meta.ts'
const LIST = 'src/worker/utils/surface-list-jsonld.ts'
const TEST = 'src/tests/unit/breadcrumb-chain-2026-10-14.test.ts'
const T = '🍞 빵부스러기 체인 — '

export default [
  {
    name: `${T}접기를 없앤다 (사슬이 안 나아간다)`,
    file: SSOT,
    find: '    if (out[out.length - 1]!.url === url) continue',
    replace: '    // 접기 제거',
    test: TEST,
    why:
      '라이브 실측: `/pass/{N}` 310건이 `홈(/) > 동네딜(/) > 상품` 으로 **연속한 두 항목이 같은 URL** 이었다. ' +
      '빵부스러기는 서로 다른 페이지의 사슬이고, 그러면 같은 페이지가 한 목록 안에서 두 이름을 갖는다.',
  },
  {
    name: `${T}접기가 **뒤 이름**을 남긴다 (루트가 개명된다)`,
    file: SSOT,
    find: '    if (out[out.length - 1]!.url === url) continue\n    out.push({ name, url })',
    replace: '    if (out[out.length - 1]!.url === url) out.pop()\n    out.push({ name, url })',
    test: TEST,
    why:
      '접을 때 살아남아야 하는 것은 **앞 항목**이다. 뒤를 남기면 310개 페이지가 사이트 루트를 ' +
      '`동네딜` 이라고 부른다 — 고치려던 것보다 나쁘다(그 방향을 ①-2 가 단언한다).',
  },
  {
    name: `${T}루트 이름을 손으로 적는다 (상세 ↔ 목록이 되돌아온다)`,
    file: SSOT,
    find: 'const out: CrumbStep[] = [{ name: CONSUMER_SITE_NAME,',
    replace: "const out: CrumbStep[] = [{ name: '홈',",
    test: TEST,
    why:
      '같은 URL 이 상세 359건에선 `홈`, 목록·지역·블로그 90여 표면에선 `유어딜` 이었다. 구글은 SERP 의 ' +
      'URL 줄을 이 `name` 들로 바꿔 그리므로 사이트가 자기 루트를 두 가지로 부르게 된다.',
  },
  {
    name: `${T}position 을 접기 전 순번으로 매긴다 (구멍이 생긴다)`,
    file: SSOT,
    find: "position: i + 1, name: t.name, item: t.url",
    replace: "position: i + 2, name: t.name, item: t.url",
    test: TEST,
    why: 'position 이 1 에서 시작하지 않거나 중간이 비면 리치결과가 깨진다(2026-10-11 E4 가 1..N 연속을 판정 기준으로 썼다).',
  },
  {
    name: `${T}빈 단계를 그대로 싣는다 (이름 없는 항목)`,
    file: SSOT,
    find: '    if (!name || !url) continue',
    replace: '    if (false) continue',
    test: TEST,
    why: '값이 없는데 사슬을 늘리면 이름 없는 항목이 생긴다 — 데이터가 비는 경우(가게명 없음)가 라이브에 실제로 있다.',
  },
  {
    name: `${T}반대 방향 — 숙소 상세가 /stays 단계를 잃는다`,
    file: DETAIL,
    find: "{ name: '숙소', url: `${origin}/stays` },",
    replace: '',
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다.** `/pass` 의 중간 단계를 접은 근거는 *그 URL 이 이미 사슬에 있다* 뿐이고, ' +
      '`/stays`·`/browse` 는 **자기 목록 URL 이 따로 있다**(실측: 49건·1건 모두 정상). 그걸 같이 접으면 ' +
      '카테고리가 SERP trail 에서 사라진다.',
  },
  {
    name: `${T}반대 방향 — 쇼핑 상세가 /browse 단계를 잃는다`,
    file: DETAIL,
    find: '{ name: shopCrumb, url: `${origin}/browse` },',
    replace: '',
    test: TEST,
    why: '같은 함정의 형제 — 2026-10-12 가 이 단계를 만들었고(그 전엔 빵부스러기가 0건이었다) 접기가 그걸 되돌리면 안 된다.',
  },
  {
    name: `${T}이용권 상세가 동네딜에 301 별칭 URL 을 준다`,
    file: DETAIL,
    find: "{ name: '동네딜', url: `${origin}/` },",
    replace: "{ name: '동네딜', url: `${origin}/group-buy` },",
    test: TEST,
    why:
      '`/group-buy` 는 홈으로 **301 되는 별칭**이라 sitemap 에서도 빠졌다(2026-07-29 죽은 URL 정리). ' +
      '빵부스러기가 그걸 가리키면 색인 신호가 한 홉 낭비되고, 2026-09-16 이 바로 그것을 고쳤다.',
  },
  {
    name: `${T}목록 빌더가 루트를 다시 손으로 붙인다 (조립처가 둘이 된다)`,
    file: LIST,
    find: '  return withCrumbRoot(origin, trail)',
    replace: '  return withCrumbRoot(origin, [{ name: CONSUMER_SITE_NAME, url: `${origin}/` }, ...trail])',
    test: TEST,
    why:
      '종전엔 `crumbTrail` 이 루트를 직접 쌓았다. 그걸 남긴 채 SSOT 를 씌우면 같은 URL 이 두 번 들어가고, ' +
      '접기가 그걸 삼켜 **문제가 안 보이는 채로** 조립처가 둘이 된다(다음에 둘이 갈린다).',
  },
  {
    name: `${T}필터 잎 게이트가 루트만 있는 체인에도 단계를 붙인다`,
    file: LIST,
    find: '  if (entry?.canonicalParams?.length && trail.length > 0) {',
    replace: '  if (entry?.canonicalParams?.length) {',
    test: TEST,
    why:
      '종전 조건은 `trail.length > 1`(= 루트 말고 한 단계라도 쌓였나)이었다. 루트를 SSOT 로 옮기며 ' +
      '`> 0` 이 **같은 뜻**이 됐는데, 숫자만 지우면 표에 없는 경로에서도 필터 잎이 붙어 ' +
      '`유어딜 › 편의점` 처럼 상위 단계가 없는 체인이 생긴다.',
  },
  {
    name: `${T}반대 방향 — 상세 빌더가 SSOT 를 안 쓰고 손으로 조립한다`,
    file: DETAIL,
    find: 'itemListElement: crumbItems(withCrumbRoot(origin, [\n        { name: shopCrumb,',
    replace: "itemListElement: [{ '@type': 'ListItem', position: 1, name: '홈', item: `${origin}/` }].concat(crumbItems(withCrumbRoot(origin, [\n        { name: shopCrumb,",
    test: TEST,
    why:
      '조립처가 넷이었던 것이 이 결함 둘의 **공통 뿌리**다. 한 곳이라도 손으로 돌아가면 그 표면만 ' +
      '조용히 갈린다(에러 0 · 빌드 0 — 파싱해서 센 사람만 안다).',
  },
]
