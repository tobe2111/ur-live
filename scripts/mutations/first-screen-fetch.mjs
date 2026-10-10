/**
 * 🧬 주입 — **첫 화면이 같은 것을 두 번 받던 자리** (2026-10-06 대표 *"근본적인 문제를 모두 해결해줘"*)
 *
 * 여기 담은 결함은 전부 **에러 없이 조용히** 되돌아간다. 빌드도 테스트도 초록이고 화면도
 * 안 깨진다 — 요청이 몇 개 더 나갈 뿐이라, 재 본 사람만 안다.
 */
const API = 'src/lib/api.ts'
const CSRF = 'src/lib/csrf-token.ts'
const BANNERS = 'src/components/home/useHomeBanners.ts'
const VOUCHERS = 'src/pages/VouchersPage.tsx'
const HOOK = 'src/pages/user-profile/seller-section/useSellerWork.ts'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const HARNESS = 'scripts/visual-preview.mjs'
const GUARD = 'scripts/check-duplicate-fetch.mjs'

const T = 'src/tests/unit/first-screen-fetch-2026-10-06.test.ts'

export default [
  {
    name: '첫화면 — CSRF 공유 변수를 인터셉터 안으로 넣는다',
    file: CSRF,
    find: 'let csrfInFlight: Promise<string> | null = null;',
    replace: '/* moved */',
    test: T,
    why:
      '실제로 이렇게 틀렸었다. 선언이 인터셉터 콜백 안에 있으면 **요청마다 새로 만들어져** ' +
      '공유가 전혀 안 된다 — 그런데 소스만 보면 멀쩡해 보이고 들여쓰기도 0칸이었다. ' +
      '번들을 뜯어 보고서야 알았다. 그래서 시험이 **중괄호 깊이**를 센다.',
  },
  {
    name: '첫화면 — CSRF 를 인터셉터가 직접 받는다',
    file: API,
    find: '      const token = await ensureCsrfToken();',
    replace:
      "      let token = readCookie('csrf_token');\n"
      + "      if (!token) { try { const r = await fetch('/api/csrf-token', { credentials: 'include' });"
      + " const j = await r.json() as { token?: string }; token = j?.token || ''; } catch { /* */ } }",
    test: T,
    why:
      '종전 코드 그대로다. 쿠키를 세팅하는 건 **응답**이라, 변경 요청이 겹친 구간에는 아무도 ' +
      '쿠키를 못 본다 — 지도 첫 화면에서 토큰을 **6번** 받고 있었다.',
  },
  {
    name: '첫화면 — 배너를 자리마다 따로 받는다',
    file: BANNERS,
    find: "    ['banners', 'all'],\n    '/api/banners',\n    {\n      select:",
    replace: "    ['banners', slot],\n    '/api/banners',\n    {\n      params: { type: slot },\n      select:",
    test: T,
    why:
      '종전 코드다. 자리가 셋이라 요청이 셋이 되고, 게다가 `?type=` 이 붙어 **cron 예열 키** ' +
      '(`/api/banners`)와 달라져 예열을 한 번도 못 받는다. 예열은 실패해도 조용하므로 ' +
      '계속 초록불이었다.',
  },
  {
    name: '첫화면 — 교환권이 카테고리 도착 후 재요청한다',
    file: VOUCHERS,
    find: "        try { localStorage.setItem('vouchers_categories_v1', JSON.stringify({ ts: Date.now(), data: list })) } catch { /* quota */ }",
    replace:
      "        try { localStorage.setItem('vouchers_categories_v1', JSON.stringify({ ts: Date.now(), data: list })) } catch { /* quota */ }\n"
      + "        if (!embedded && !category && !brand && list.length > 0) {\n"
      + "          const next = new URLSearchParams(searchParams)\n"
      + "          next.set('category', list[0].category)\n"
      + "          setSearchParams(next, { replace: true })\n"
      + "        }",
    test: T,
    why:
      '종전 코드다. 이걸 되살리면 **서버가 미리 데워 둔 첫 응답을 받아 놓고 버리고** 안 데워진 ' +
      '키로 다시 묻는다(실측 212ms 지연). SSR 시드도 같이 버려진다 — 2026-06-04 에 홈에서 ' +
      '*"내용/URL 깜빡임"* 이라 부르며 이미 없앤 그 현상이다.',
  },
  {
    name: '첫화면 — 마이가 상품 목록을 늘 받는다',
    file: HOOK,
    find: '  withProducts = false,',
    replace: '  withProducts = true,',
    test: T,
    why:
      '기본값 한 글자로 첫 화면 요청이 하나 는다. 그 목록은 `판매 중 N개` **한 줄**에만 쓰이고, ' +
      '그 숫자는 이미 1단계 응답(`store.active_products`)이 준다.',
  },
  {
    // 🔁 2026-10-06 — `tool === 'vouchers'` 주입은 그 Tool 값이 철거돼 쓸 수 없다. 불변식은
    //   그대로라 **같은 결함을 다른 자리**(힌트 출처)로 심는다.
    name: '첫화면 — 판매 중 개수를 2단계 응답에서 읽는다',
    file: SECTION,
    find: "          {store?.active_products != null && (",
    replace: "          {work.products.length > 0 && (",
    test: T,
    why:
      '이 한 줄이 상품 목록 전체를 끌어온다. 게다가 그 요청은 좌석이 정해진 **뒤에** 나가므로 ' +
      '직렬 2단이 되어 `판매 중 N개` 가 화면에서 가장 늦게 뜬다(대표가 신고한 그 증상).',
  },
  {
    name: '첫화면 — 측정기가 기계 줄을 안 찍는다',
    file: HARNESS,
    find: '  console.log(`FETCH_RESULT ${JSON.stringify({ route: ROUTE, calls })}`)',
    replace: '  void 0',
    test: T,
    why:
      '이 줄이 없으면 `check-duplicate-fetch` 가 읽을 것이 없다. 그때 빈 배열을 "중복 0" 으로 ' +
      '읽으면 그 가드는 **영원히 통과만 한다** — 이 레포가 반복해 당한 헛도는 가드다.',
  },
  {
    name: '첫화면 — 예외를 사유 없이 올린다',
    file: 'scripts/duplicate-fetch-baseline.json',
    find: '  "_reasons": {',
    replace: '  "_unused": {',
    test: T,
    why:
      '예외 목록은 "괜찮은 것" 이 아니라 "지금은 못 고치는 것" 이다. 사유가 없으면 다음 사람이 ' +
      '그게 정상인 줄 알고 숫자를 올린다.',
  },
  // ── ⚡ 첫 화면 데이터가 다음 task 로 밀리는 회귀 (2026-10-06) ──────────────────
  {
    name: '좌석 조회를 동적 import 뒤로 되돌린다',
    why: '그 한 줄이 좌석 요청을 첫 묶음에서 떨어뜨리고(+842ms), 거기 매달린 주문 조회까지 지연을 상속한다.',
    file: 'src/pages/user-profile/useMyStores.ts',
    find: "    Promise.resolve(api.get('/api/seller/my-stores/summary'))",
    replace: "    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/my-stores/summary'))",
    test: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
  },
  {
    name: '잔액 조회를 동적 import 뒤로 되돌린다',
    why: '상단 숫자 한 줄이 형제 여섯보다 한 박자 늦게(+836ms) 나간다.',
    file: 'src/pages/user-profile/MyStats.tsx',
    find: "      api.get('/api/points/balance')",
    replace: "      import('@/lib/api').then(({ default: api }) => api.get('/api/points/balance'))",
    test: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
  },
  {
    name: '첫 화면 정적 api import 를 지운다',
    why: '정적 import 가 사라지면 이 모듈은 다시 동적 경로로 돌아갈 수밖에 없다 — 그 자리를 비워 두면 안 된다.',
    file: 'src/pages/user-profile/seller-section/useSellerWork.ts',
    find: "import api from '@/lib/api'\n",
    replace: '',
    test: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
  },
  {
    name: '시트까지 정적으로 바꾼다 (반대 방향)',
    why: '시트는 사람이 열 때만 마운트돼 놓칠 첫 묶음이 없다 — 여기까지 정적으로 바꾸면 규칙의 경계가 흐려진다.',
    file: 'src/pages/user-profile/seller-section/PinSheet.tsx',
    find: "import { useEffect, useState } from 'react'",
    replace: "import { useEffect, useState } from 'react'\nimport api from '@/lib/api'",
    test: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
  },
  {
    name: '검사 대상 목록을 비운다',
    why: '목록이 비면 it.each 가 0회 돌고 가드가 "지키는 척" 만 한다.',
    file: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
    find: "  'src/pages/user-profile/useMyStores.ts',\n",
    replace: '',
    test: 'src/tests/unit/first-screen-static-api-2026-10-06.test.ts',
  },
]
