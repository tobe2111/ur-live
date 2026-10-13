/**
 * 🧾 목록 네 표면의 크롤러 요약 + `/stays` ItemList (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/list-surface-noscript-2026-10-12.test.ts
 *
 * 술어 넷이 각자 다른 표면을 가른다. 한 글자 틀리면 **다른 표면의 상품을 그 목록의 내용이라고
 * 말하게 되는데**(식당이 숙소 목록에) 빌드도 화면도 안 깨진다.
 */
const TEST = 'src/tests/unit/list-surface-noscript-2026-10-12.test.ts'
const NS = 'src/worker/utils/crawler-noscript.ts'
const LD = 'src/worker/utils/surface-list-jsonld.ts'
const WORKER = 'src/worker/index.ts'

export default [
  {
    name: '🧾 숙소 목록이 식당까지 자기 내용이라고 말한다',
    file: NS,
    find: "  '/stays': (p) => p?.category === 'stay_voucher',",
    replace: "  '/stays': (p) => p?.deal_only !== 1,",
    test: TEST,
    why: '`/stays` 는 홈 시드를 공유하므로 걸러내지 않으면 식당 이용권이 숙소 목록의 내용이 된다.',
  },
  {
    name: '🧾 교환권 목록에 매장 이용권이 섞인다',
    file: NS,
    find: "  '/vouchers': (p) => p?.deal_only === 1,",
    replace: "  '/vouchers': (p) => true,",
    test: TEST,
    why: '교환권 목록이 매장 이용권을 자기 내용이라고 말한다 — 두 상품 종류가 섞여 질의 적합도가 떨어진다.',
  },
  {
    name: '🧾 지도·쇼핑 요약에 교환권이 섞인다',
    file: NS,
    find: "  '/map': (p) => p?.deal_only !== 1,",
    replace: "  '/map': (p) => true,",
    test: TEST,
    why: '동네딜 지도가 기프티콘을 "내 주변 매장" 이라고 말한다 — 매장이 없는 상품이다.',
  },
  {
    name: '🧾 요약 라벨을 손으로 적어 빵부스러기와 갈린다',
    file: NS,
    // 2026-10-12: 같은 글자가 `<p>` → `<h1>` 이 되며 조립이 `h1Of(...)` 로 옮겨갔다 —
    // 불변식(라벨이 crumb SSOT 에서 온다)은 그대로이고 앵커만 따라간다.
    find: "    const head = h1Of(CONSUMER_SURFACE_SEO[path]?.crumb)",
    replace: "    const head = h1Of('목록')",
    test: TEST,
    why: '라벨이 두 벌이 되면 빵부스러기와 본문 요약이 다른 말을 한다.',
  },
  {
    name: '🧾 요약 상한이 풀려 전량을 덤프한다',
    file: NS,
    find: '      if (rows.length >= 8) break',
    replace: '',
    test: TEST,
    why: '`<noscript>` 도 사람이 받는 응답에 그대로 실린다 — 요약이지 전량 덤프가 아니다.',
  },
  {
    name: '🧾 요약이 시드 값을 탈출 없이 마크업에 넣는다',
    file: NS,
    // 🔗 2026-10-12 재조준 — 행 조립이 `liOf` 로 옮겨갔다. 불변식은 그대로이고, 여기선
    //   그 시험의 탐침 시드는 **링크가 붙는 행**(id 가 있다)이므로 *링크 안쪽* 글자를 본다
    //   — 링크 없는 분기(`: esc(r.text)}`)는 그 시드가 안 지나가서 주입이 헛돈다(확인했다).
    find: '${esc(r.text)}</a>',
    replace: '${r.text}</a>',
    test: TEST,
    why: '가게명·상품명은 판매자가 넣은 값이다 — 상수만 싸면 탈출 여부를 판정할 수 없어 탐침 값으로 잰다.',
  },
  {
    name: '🧾 /stays ItemList 가 숙소 필터를 잃는다',
    file: LD,
    find: "    if (path === '/stays') return (p as { category?: string | null }).category === 'stay_voucher'",
    replace: '',
    test: TEST,
    why: '식당 상세 URL 이 "숙소 목록의 항목" 으로 구글에 제출된다 — 에러 0.',
  },
  {
    name: '🧾 /stays 시드 배선이 사라진다',
    file: WORKER,
    find: "(REGION_PATH_RE.test(url.pathname) || url.pathname === '/stays')",
    replace: 'REGION_PATH_RE.test(url.pathname)',
    test: TEST,
    why: '그 표면만 시드가 없어 요약·ItemList 가 통째로 비는데, 다른 표면은 멀쩡해서 안 보인다.',
  },
  {
    name: '🧾 /stays 가 전용 캐시 키를 새로 만든다',
    file: WORKER,
    // ⚠️ 앵커는 **고유해야** 한다 — 첫 판이 `ssrTarget = { slot: 'MAIN', path: MAIN_SEED_PATH };`
    //   를 썼는데 그 줄이 홈 분기에도 있어 러너가 홈을 바꿨고, 홈에선 조건이 거짓이라 행동이
    //   안 변해 **주입이 통과했다**(가드가 지키는 척). 분기 머리로 앵커를 옮겼다.
    find: "url.pathname === '/stays')) {",
    replace: "url.pathname === '/stays')) {\n      if (url.pathname === '/stays') { ssrTarget = { slot: 'MAIN', path: '/api/group-buy/products?status=active&category=stay_voucher' }; }",
    test: TEST,
    why: 'cron 예열에 없는 키라 매 요청이 콜드 D1 을 치고, 서브리퀘스트 예산(무료 50, 실측 ~41)을 한 칸 더 먹는다.',
  },
]
