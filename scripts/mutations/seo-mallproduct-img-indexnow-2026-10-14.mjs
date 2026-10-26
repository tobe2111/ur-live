// 🔁 2026-10-14 — 행·글자 조립이 `crawler-noscript-rows.ts` 로 **추출**됐다(685줄 → 래칫 600 초과).
//    아래 앵커들의 결함은 한 글자도 안 바꿨고 **파일 경로만** 따라갔다.
const NS_ROWS = 'src/worker/utils/crawler-noscript-rows.ts'
/**
 * 🧬 2026-10-14 — 몰 상품 thin URL · 크롤러 문서 사진 · IndexNow 의 주입.
 *
 * 근거·실측은 `src/tests/unit/seo-mallproduct-crawler-img-indexnow-2026-10-14.test.ts` 머리말.
 * 절반이 **반대 방향**이다 — 이 세 수리는 "더 막는" 쪽으로 틀리면 색인이 조용히 빠지고
 * 복구가 수주라서, 막는 방향도 함께 잠근다.
 */
const TEST = 'src/tests/unit/seo-mallproduct-crawler-img-indexnow-2026-10-14.test.ts'

export default [
  {
    name: '🏬 ENTITY_SLOTS 가 MALLPRODUCT 를 다시 뺀다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "  'MALLPRODUCT',\n])",
    replace: '])',
    test: TEST,
    why:
      '워커가 `MALLPRODUCT:self-fetch-404` 를 **받아 놓고** 200 + index 를 낸다(라이브에서 실제로 ' +
      '그랬다). `/group-buy/99999999`(2026-07-29)과 같은 클래스이고, 아무 슬러그·아무 id 가 ' +
      '무한 thin URL 이 된다.',
  },
  {
    name: '🏬 known-routes 가 /x/p/* 를 다시 무조건 통과시킨다',
    file: 'src/shared/seo/known-routes.ts',
    find: "  if (segs.length === 3 && segs[1] === 'p') return parseMallProductPath(pathname) != null",
    replace: "  if (segs.length === 3 && segs[1] === 'p') return true",
    test: TEST,
    why:
      'id 가 숫자가 아닌 `/zzqqxx/p/abc` 는 `parseMallProductPath` 가 거부해 **SSR 슬롯조차 안 ' +
      '잡히므로**(라이브 실측: `x-ssr-status` 헤더가 없다) 여기서 막지 않으면 **영원히 200 + index** 다.',
  },
  {
    name: '🏬 반대 방향 — 몰 상품 경로를 통째로 모르는 경로로 (실재 링크가 404)',
    file: 'src/shared/seo/known-routes.ts',
    find: "  if (segs.length === 3 && segs[1] === 'p') return parseMallProductPath(pathname) != null",
    replace: "  if (segs.length === 3 && segs[1] === 'p') return false",
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다** — 실재하는 몰 상품 경로(소개비 귀속 링크)가 전부 404 가 되고 ' +
      '색인 복구는 수주다. thin URL 을 막으려다 멀쩡한 URL 을 죽이는 것이 이 클래스의 큰 사고다.',
  },
  {
    name: '🏬 반대 방향 — 타임아웃도 부재로 읽는다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "  return ENTITY_SLOTS.has(slot) && ssrStatus === 'self-fetch-404'",
    replace: "  return ENTITY_SLOTS.has(slot) && (ssrStatus === 'self-fetch-404' || ssrStatus === 'self-fetch-timeout')",
    test: TEST,
    why:
      '`self-fetch-timeout` 은 *"없다"* 가 아니라 *"느리다"* 이고 콜드 콜로에서 흔하다 — 그걸로 ' +
      'noindex 를 내면 **멀쩡한 상품이 색인에서 빠진다**(이 파일 머리말이 적어 둔 그 규율).',
  },
  {
    name: '🖼️ 크롤러 문서 사진 상한을 없앤다 (전 행에 사진)',
    file: NS_ROWS,
    // ⚠️ `replace` 를 `'  return rows'` 로 쓰면 안 된다 — 실제 코드 `  return rows.map((r) => {` 의
    //    **부분문자열**이라 주입-잔재 검사가 늘 거짓 경보를 낸다(2026-10-14 pre-commit 이 실제로 막았다).
    find: '  return rows.map((r) => {',
    replace: '  return rows.slice(); ((r: Row) => {',
    test: TEST,
    why:
      '`<noscript>` 는 **사람이 받는 응답에도 그대로 실린다**(크롤러에게만 주는 것은 구글 가이드 ' +
      '위반). 요약이 아니라 전량 덤프가 되고 크롤러가 내려받는 바이트가 두 배가 된다.',
  },
  {
    name: '🖼️ 워커 프록시로 가는 사진을 다시 쓴다 (리사이즈 안 됨)',
    file: NS_ROWS,
    find: "  return u.startsWith('/cdn-cgi/image/') ? u : ''",
    replace: '  return u',
    test: TEST,
    why:
      '`/api/image/resize` 는 **리사이즈를 못 한다**(2026-06-11 실측 — 항상 원본 폴백). 크롤러가 ' +
      '원본 통째를 받아 가고 우리 워커 인보케이션도 늘어난다(2026-10-12 공유 카드에서 3MB ↔ 196KB 로 ' +
      '값을 치른 그 자리).',
  },
  {
    name: '🖼️ 사진 상한을 행 인덱스로 센다 (쓸 수 없는 행이 자리를 먹는다)',
    file: NS_ROWS,
    find: '    if (r.img && used < ROW_IMG_MAX) { used += 1; return r }',
    replace: '    if (used < ROW_IMG_MAX) { used += 1; return r }',
    test: TEST,
    why:
      '2026-10-14 에 실제로 이 모양이었고(`i < ROW_IMG_MAX`) **그 탓에 프록시 가드 주입이 초록** 이었다 — ' +
      '쓸 수 없는 행이 상한을 먹어 뒤 행의 사진이 아예 안 붙었고, 그래서 그 가드를 없애도 출력이 ' +
      '1바이트도 안 바뀌었다. 지키려는 것은 *"문서에 사진 N장"* 이다.',
  },
  {
    name: '🖼️ alt 에 가격을 섞는다',
    file: NS_ROWS,
    find: "  const alt = parts.filter(Boolean).join(' ')",
    replace: "  const alt = `${parts.filter(Boolean).join(' ')}${price}`",
    test: TEST,
    why: '`alt` 는 **그림을 설명하는 글**이다 — 가격은 그림이 아니라 그 옆 글의 몫이다.',
  },
  {
    name: '🖼️ 사진을 링크 밖으로 뺀다',
    file: NS_ROWS,
    find: '  return `<li>${r.href ? `<a href="${esc(r.href)}">${body}</a>` : body}</li>`',
    replace: '  return `<li>${img}${r.href ? `<a href="${esc(r.href)}">${esc(r.text)}</a>` : esc(r.text)}</li>`',
    test: TEST,
    why: '사진이 링크 밖에 있으면 **그 그림이 어느 페이지의 것인지** 크롤러가 알 수 없다.',
  },
  {
    name: '🔔 IndexNow 첫 회차가 전부 밀어 넣는다',
    file: 'src/shared/seo/indexnow.ts',
    find: "  if (!prev) return { urls: [], cursor: maxLastmod, note: `첫 회차: 커서만 세움(${entries.length}건 관측)` }",
    replace: "  if (!prev) return { urls: entries.map((e) => e.loc).slice(0, max), cursor: maxLastmod, note: '첫 회차 — 전부 제출' }",
    test: TEST,
    why:
      '첫 실행이 **380건을 한꺼번에** 밀어 넣는다. 전부 이미 알려진 URL 이라 우리에게 쓸모가 없고 ' +
      '받는 쪽(네이버·Bing)에는 스팸으로 보인다.',
  },
  {
    name: '🔔 상한에 잘렸는데 커서를 올린다',
    file: 'src/shared/seo/indexnow.ts',
    find: '    cursor: changed.length > max ? prev : (maxLastmod || prev),',
    replace: '    cursor: maxLastmod || prev,',
    test: TEST,
    why:
      '상한을 넘은 변경이 **영구히 제출되지 않는다** — 커서가 그 위로 넘어가 버리므로 다음 회차에 ' +
      '대상에서 빠진다(조용한 손실이고 에러가 없다).',
  },
  {
    name: '🔔 IndexNow 게이트를 없앤다 (기본으로 바깥에 쏜다)',
    file: 'src/worker/cron/indexnow-submit.ts',
    find: "  if (env.INDEXNOW_ENABLED !== 'true') return 'indexnow: 꺼짐 (INDEXNOW_ENABLED 미설정)'",
    replace: '  // 게이트 제거',
    test: TEST,
    why:
      '외부 서비스로 나가는 쓰기는 이 레포의 **2단 스위치** 대상이다(`SHOPPING_LEDGER_ENABLED` 류) — ' +
      '게이트를 켜는 것은 **대표의 일**이고(CLAUDE.md: 게이트 ON = 결재) 코드가 스스로 켜면 안 된다.',
  },
  {
    name: '🔔 제출 실패에도 커서를 올린다',
    file: 'src/worker/cron/indexnow-submit.ts',
    // 🔁 2026-10-25 재조준: 제출이 `submitUrls()` 로 모였다(전수 제출과 같은 함수) — 불변식 그대로.
    // 🔁 2026-10-26 재조준: 변경분 제출이 `submitChanges()` 로 빠졌다(전수 실패 시에도 부르려고) — 불변식 그대로.
    find: "    if (!ok.ok) return `제출 실패 (${ok.status}) · ${plan.urls.length}건, 커서 유지`",
    replace: "    // 실패를 무시하고 아래로 내려간다",
    test: TEST,
    why: '제출이 실패했는데 커서를 올리면 그 변경이 **영구히** 빠진다(다음 회차 대상에서 사라진다).',
  },
  {
    name: '🔔 cron 등재를 없앤다',
    file: 'src/worker/scheduled.ts',
    // 🔁 2026-10-14 재조준: 슬롯 안이라 `slotCron` 래퍼가 정본이다(`cron-slot-cadence`).
    find: "    ctx.waitUntil(slotCron('50 19 * * *')('indexnow-submit', async () => {",
    replace: "    ctx.waitUntil((async () => {",
    test: TEST,
    why:
      '`safeCron` 을 우회하면 그 작업이 **하트비트에 안 남는다** — 멎어도 아무 신호가 없다 ' +
      '(2026-07-28 에 유어애즈 정비가 그렇게 멈췄고 아무도 몰랐다).',
  },
  {
    name: '🔔 lastmod 없는 항목도 제출 대상에 넣는다',
    file: 'src/shared/seo/indexnow.ts',
    find: '    if (loc && lastmod) out.push({ loc, lastmod })',
    replace: "    if (loc) out.push({ loc, lastmod: lastmod || '' })",
    test: TEST,
    why:
      '`lastmod` 가 없는 URL 은 **언제 바뀌었는지 모른다**. 빈 문자열로 섞으면 커서 비교가 무의미해져 ' +
      '매 회차마다 같은 71건을 다시 제출한다(날짜를 지어내지 않기로 한 2026-10-12 결정과 같은 축).',
  },
]
