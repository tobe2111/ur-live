/**
 * 🏷️ 취급품목 탐침 (2026-10-24) — 주입 매니페스트.
 *
 * 이 조가 막는 것은 **"업종 분류가 왜 비어 있는지" 를 다시 모르게 되는 것**이다. 라이브 실측으로
 * 412,428건이 전부 `'통신판매'` 인데, 그 원인(취급품목이 `detail` 에만 오고 값이 숫자 코드)을
 * 알아낸 유일한 길이 엔드포인트별 샘플이었다.
 *
 * 가드: src/tests/unit/commerce-goods-probe-2026-10-24.test.ts
 */
const TEST = 'src/tests/unit/commerce-goods-probe-2026-10-24.test.ts'
const PROBE = 'src/features/marketing/api/commerce-goods-probe.ts'
const COLLECT = 'src/features/marketing/api/commerce-notify-collect.ts'
const ROUTES = 'src/features/marketing/api/partner-pool.routes.ts'

export default [
  {
    name: '취급품목탐침 🧷 옛 스냅샷(by_service 없음)에서 탐침이 조용히 포기한다',
    file: PROBE,
    find: "  for (const [name, slot] of Object.entries(bySvc || { shared: { sample } })) {",
    replace: "  for (const [name, slot] of Object.entries(bySvc || {})) {",
    test: TEST,
    why: "by_service 는 2026-10-24 배포 뒤 회차부터 생긴다. 폴백이 없으면 그 전 스냅샷에서 `goods` 가 통째로 비어 **'아직 안 돌았다'와 '그 필드가 없다'가 구분되지 않는다** — 그 혼동이 애초에 코드표를 찾아 나서게 만든 원인이다.",
  },
  {
    name: '취급품목탐침 🔭 엔드포인트별 저장이 사라진다(detail 응답을 또 한 번도 못 보게 된다)',
    file: COLLECT,
    find: '        const slot = (byService[svc.name] ??= {})',
    replace: '        const slot: { sample?: unknown; coverage?: unknown } = {} // (서비스별 칸 제거)',
    test: TEST,
    why: '이게 없으면 `sample` 은 "이메일 든 쪽 우선" 이라 status 가 늘 이기고 `coverage` 는 마지막 페이지가 덮는다 — 라이브에서 저장된 18필드가 전부 status 것이었고, 그래서 취급품목이 어디서 오는지조차 몰랐다.',
  },
  {
    name: '취급품목탐침 🧩 별칭 목록이 수집 코드와 갈린다(화면이 저장과 다른 답을 말한다)',
    file: PROBE,
    // 🔁 2026-10-25 재조준: 한글(`ntslPrdlstCn`)을 코드 앞으로 옮겨 앵커가 낡았다. 불변식은 그대로다.
    find: "export const GOODS_FIELD_ALIASES = ['ntslPrdlstCn', 'trtmntPrdlstNm', 'upteNm', 'dclsfNm', 'idustyNm', 'taskNm'] as const",
    replace: "export const GOODS_FIELD_ALIASES = ['trtmntPrdlstNm', 'upteNm'] as const",
    test: TEST,
    why: '탐침이 `ntslPrdlstCn` 을 안 보면 업종 분류의 **유일한 한글 출처**가 탐침 화면에서 사라진다 — 2026-10-25 에 그 필드가 `\'종합몰 교육/도서/완구/오락\'` 으로 온다는 것을 실측해 코드표 없이 93% 를 풀었다. 그리고 순서가 수집 코드와 갈리면 탐침이 "어느 필드가 쓰이는지" 를 틀리게 말해, 다음 세션이 그 화면을 믿고 오판한다.',
  },
  {
    name: '취급품목탐침 🔢 숫자 코드를 글자로 읽는다(코드표가 필요 없다고 거짓 보고)',
    file: PROBE,
    find: "  const kind = /^[0-9\\s]+$/.test(value) ? 'code' : 'text'",
    replace: "  const kind = 'text' as const",
    test: TEST,
    why: '`code` 와 `text` 의 구분이 곧 "코드표가 필요한가" 다. 늘 text 면 화면이 "그 필드를 쓰면 된다" 고 말하는데 실제 값은 `12` 라 업종이 숫자로 뜬다.',
  },
  {
    name: "취급품목탐침 🕳️ 'N/A' 를 값으로 읽는다(값 없음이 품목으로 분류된다)",
    file: PROBE,
    find: "  return !s || s === 'N/A' || s === '-' || s.toLowerCase() === 'null' || s === '해당없음'",
    replace: '  return !s',
    test: TEST,
    why: "포털은 '값 없음'을 `\"N/A\"` 문자열로 준다(truthy). 이 레포는 같은 함정으로 통신판매 주소 31.7% 를 잃은 적이 있다 — 그걸 품목으로 읽으면 업종이 `N/A` 로 분류된다.",
  },
  {
    name: '취급품목탐침 🚪 어드민 배선이 끊긴다(답을 재 놓고 화면에 안 띄운다)',
    file: ROUTES,
    find: "  const commerceProbe = buildCommerceProbe(commerceRun?.diag)",
    replace: "  const commerceProbe = undefined // (탐침 미배선)",
    test: TEST,
    why: '탐침이 돌아도 화면에 안 실리면 대표도 다음 세션도 그 답을 못 본다 — 이 레포가 반복해 만난 "계산만 하고 안 쓰는" 클래스(2026-08-02 goneStatus).',
  },
]
