/** 🧬 주입 — shell-sw 의 사고 재발 울타리가 하나라도 빠지면 빨간불인가. 가드: src/tests/unit/shell-sw-policy-2026-11-09.test.ts */
const T = 'src/tests/unit/shell-sw-policy-2026-11-09.test.ts'
const SW = 'public/shell-sw.js'
export default [
  {
    name: 'shellsw — 금지 목록에서 /auth 가 빠진다',
    file: SW,
    find: "  '/auth', '/oauth', '/api',",
    replace: "  '/oauth', '/api',",
    test: T,
    why: '2026-04-27 사고 그대로 — 카카오 로그인 시작을 SW 가 다룬다.',
  },
  {
    name: 'shellsw — 쿼리가 있어도 다룬다',
    file: SW,
    find: '  if (u.search) return false',
    replace: '  // (쿼리 검사 제거)',
    test: T,
    why: '?code= ?paymentKey= ?ref= 가 붙은 요청을 저장본으로 덮어 로그인·결제 복귀·소개 귀속이 깨진다.',
  },
  {
    name: 'shellsw — navigate 가 아닌 요청도 다룬다',
    file: SW,
    find: "  if (method !== 'GET' || mode !== 'navigate') return false",
    replace: "  if (method !== 'GET') return false",
    test: T,
    why: 'API·청크 요청까지 가로챈다(2026-05-16 캐시-우선 SW 사고 클래스).',
  },
  {
    name: 'shellsw — 리다이렉트된 응답을 그대로 돌려준다',
    file: SW,
    find: '    if (res.redirected) return Response.redirect(res.url, 302)',
    replace: '',
    test: T,
    why: "'a redirected response was used for a request whose redirect mode is not follow' — 사고 메시지 그대로.",
  },
  {
    name: 'shellsw — main.tsx 청소가 shell-sw 를 지운다',
    file: 'src/main.tsx',
    find: "        if (scriptUrl.includes('push-sw.js') || scriptUrl.includes('shell-sw.js')) return Promise.resolve()",
    replace: "        if (scriptUrl.includes('push-sw.js')) return Promise.resolve()",
    test: T,
    why: '매 로드마다 SW 를 지우고 다시 등록 → 제어 중이면 reload 루프.',
  },
  {
    name: 'shellsw — 킬스위치 기본값이 켜짐',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: "{ key: 'shell_sw_enabled', kind: 'setting', label: '재방문 즉시 표시 SW(shell-sw)', default_value: 'false',",
    replace: "{ key: 'shell_sw_enabled', kind: 'setting', label: '재방문 즉시 표시 SW(shell-sw)', default_value: 'true',",
    test: T,
    why: '확인 전에 전체 손님에게 켜진다.',
  },
  {
    name: 'shellsw — 오프라인이면 브라우저 기본 오류로 돌아간다(안내 화면 제거)',
    file: SW,
    find: "try { res = await fetchShell(u.href) } catch (e) { return offlineResponse() }",
    replace: 'res = await fetchShell(u.href)',
    test: T,
    why: '2026-11-09 대표 ④ — 지하철에서 끊기면 우리 화면이 떠야 한다. respondWith 안에서 던지면 브라우저가 네트워크 오류 화면을 낸다.',
  },
  {
    name: 'shellsw — 안내 화면을 저장소에 남긴다(no-store 제거)',
    file: SW,
    find: "'Cache-Control': 'no-store', 'X-Shell-Served': 'offline'",
    replace: "'X-Shell-Served': 'offline'",
    test: T,
    why: '안내 화면이 캐시되면 연결이 돌아와도 안내만 계속 뜬다.',
  },
]
