/**
 * 🏪 2026-10-14 — 가게 유어샵 정본 주입.
 *
 * 근거·실측은 `src/shared/seo/shop-canonical.ts` 머리말,
 * 못 보는 것은 `src/tests/unit/shop-canonical-2026-10-14.test.ts` 머리말.
 *
 * 🔴 **절반이 반대 방향이다.** 정본을 통합하는 이득은 중복 하나를 접는 것인데, 틀린 방향으로
 *    가면 **제출한 URL 이 404 를 정본으로 지목**한다 — 그러면 그 가게가 색인에서 통째로 빠지고
 *    복구는 수주다. 이득보다 손실이 훨씬 크다.
 */
const SSOT = 'src/shared/seo/shop-canonical.ts'
const META = 'src/worker/utils/surface-ssr-meta.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const TEST = 'src/tests/unit/shop-canonical-2026-10-14.test.ts'
const T = '🏪 가게 정본 — '

export default [
  {
    name: `${T}별칭을 그대로 정본이라 말한다 (종전 동작)`,
    file: META,
    find: 'canonical: `${origin}${shopPath ?? pathname}`,',
    replace: 'canonical: `${origin}${pathname}`,',
    test: TEST,
    why:
      '라이브 실측: `/s/store_muxlddtf74b` 와 `/profile/store_muxlddtf74b` 가 **둘 다 200 · 같은 제목**인데 ' +
      '각자 자기자신을 정본이라 말했다. 같은 컴포넌트를 렌더하는 두 별칭이라 같은 가게가 두 URL 로 색인 경쟁한다.',
  },
  {
    name: `${T}반대 방향 — 핸들이 없어도 /u/ 를 가리킨다 (죽은 정본)`,
    file: SSOT,
    find: '  const h = String(handle ?? \'\').trim()\n  if (h) return `/u/${h}`',
    replace: '  const h = String(handle ?? \'\').trim()\n  return `/u/${h}`',
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다.** 핸들 없는 가게에 `/u/` 를 주면 sitemap 이 제출한 URL 이 **404 를 ' +
      '정본으로 지목**한다. 라이브 가게 둘이 정확히 그 경우(핸들 없음)라 바로 터진다.',
  },
  {
    name: `${T}정본을 못 고를 때 빈 문자열을 쓴다`,
    file: SSOT,
    find: '  return i ? `/s/${i}` : null',
    replace: '  return `/s/${i}`',
    test: TEST,
    why:
      'id·username·handle 이 다 없으면 `/s/` 라는 **없는 URL** 이 정본이 된다. 모를 때는 ' +
      '지어내지 않고 `null` 을 주고 호출부가 자기 경로를 쓴다(이 레포의 *지어내지 않는다* 규율).',
  },
  {
    name: `${T}공백만 있는 핸들을 유효로 본다`,
    file: SSOT,
    find: "  const h = String(handle ?? '').trim()",
    replace: "  const h = String(handle ?? '')",
    test: TEST,
    why: 'DB 의 빈 문자열·공백 핸들이 `/u/%20` 같은 정본을 만든다 — sitemap 쿼리도 같은 이유로 `handle != \'\'` 를 본다.',
  },
  {
    name: `${T}sitemap 이 규칙을 다시 손으로 적는다 (조립처가 둘)`,
    file: SITEMAP,
    find: 'const loc = canonicalShopPath(s.handle, s.username, s.id) || `/s/${s.id}`;',
    replace: 'const loc = s.handle ? `/u/${s.handle}` : `/s/${s.username || s.id}`;',
    test: TEST,
    why:
      '두 곳이 **같은 함수**를 써야 *제출한 URL 과 그 페이지의 canonical* 이 갈릴 수 없다. ' +
      '손으로 돌아가면 오늘은 같은 결과를 내고 다음 변경에서 조용히 갈린다(이 레포가 반복해 당한 클래스).',
  },
  {
    name: `${T}반대 방향 — 제목·설명까지 바꾼다`,
    file: META,
    find: "  const title = `${shopName} 유어샵 - 유어딜`",
    replace: "  const title = `${shopName} - 유어딜`",
    test: TEST,
    why:
      '이 변경은 **canonical 한 줄**만 건드린다. 제목까지 흔들면 2026-10-14 `/s/` 본문 처방의 ' +
      'h1(`{가게} 유어샵`)과 서버 제목이 갈린다 — 그 짝을 ②-4 가 고정한다.',
  },
]
