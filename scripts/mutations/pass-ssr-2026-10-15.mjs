/**
 * 🧊 이용권 상세 서버 렌더 3단계 — 주입 매니페스트. 가드: src/tests/unit/pass-ssr-2026-10-15.test.ts
 *
 * 이 결함들은 **화면을 안 깨뜨린다** — 워커가 조용히 종전 손그림 첫 화면으로 폴백하거나(서버 렌더가 꺼진 채),
 * PC 에서 내용이 한 번 밀리거나, 앱이 붙기 전 누름이 사라질 뿐이다. 에러가 없어 아무도 신고하지 않는다.
 */
const TEST = 'src/tests/unit/pass-ssr-2026-10-15.test.ts'

export default [
  {
    name: '🧊 워커가 상세 서버 렌더를 안 부른다(손그림만)',
    file: 'src/worker/index.ts',
    find: "const firstScreen = (await passDetailSsr({ payload: ssrPayload, pathname: url.pathname, userAgent: c.req.header('user-agent'), nonce, origin: origin2, waitUntil: ssrWaitUntil(c) })) || buildDetailFirstScreen(",
    replace: 'const firstScreen = buildDetailFirstScreen(',
    test: TEST,
    why: '서버 렌더가 통째로 꺼진다 — 가격·구매하기가 다시 앱 코드 뒤로 1.3초 밀린다(에러 0).',
  },
  {
    name: '🧊 PC 에서도 서버 렌더를 쓴다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: '  if (!isPassSsrPath(o.pathname) || !isMobileUserAgent(o.userAgent)) return ',
    replace: '  if (!isPassSsrPath(o.pathname)) return ',
    test: TEST,
    why: 'PC 는 앱이 상단 네비를 더해 그 높이만큼 내용이 밀린다 — 서버 렌더가 만든 화면이 마운트 때 튄다.',
  },
  {
    name: '🧊 캐시에 있어도 매번 다시 그린다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: '      if (hit) body = await hit.text()',
    replace: '      if (hit && false) body = await hit.text()',
    test: TEST,
    why: '상품마다 같은 HTML 인데 요청마다 리액트 렌더를 돈다 — 격리 첫 렌더 비용(번들 초기화)을 매번 낸다.',
  },
  {
    name: '🧊 이상하게 짧은 렌더를 그대로 보낸다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: "      if (!body || body.length < 2000) return ''",
    replace: "      if (!body) return ''",
    test: TEST,
    why: '로더나 빈 화면이 그려진 결과를 캐시까지 해서 10분 동안 모든 손님에게 보낸다.',
  },
  {
    name: '🧊 배포 빌드가 서버 렌더 번들을 안 만든다',
    file: 'package.json',
    find: '&& npm run build:ssr-pass && npm run build:worker',
    replace: '&& npm run build:worker',
    test: TEST,
    why: '워커가 스텁을 묶어 서버 렌더가 조용히 꺼진다 — 빌드·배포는 초록이다.',
  },
  {
    name: '🧊 앱이 붙기 전 누른 구매하기를 버린다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: "  useEffect(() => { if (consumeEarlyTap('buy') && isJoinable && !isPrelaunch) setOpen(true) }, [])",
    replace: '  useEffect(() => {}, [])',
    test: TEST,
    why: '서버가 그린 구매하기를 눌렀는데 앱이 붙은 뒤에도 아무 일이 없다 — 다시 눌러야 한다.',
  },
  {
    name: '🧊 누름 기억이 링크까지 막는다',
    file: 'src/worker/utils/pass-ssr.ts',
    find: "t.closest('[data-early-tap]')",
    replace: "t.closest('a,[data-early-tap]')",
    test: TEST,
    why: '가게 보기·길찾기 같은 링크는 앱 없이도 이동해야 한다 — 막으면 그 1~2초 동안 링크가 죽는다.',
  },
]
