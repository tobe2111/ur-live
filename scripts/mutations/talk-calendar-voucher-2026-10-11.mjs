/**
 * 🧬 주입 — 이용권 만료일 톡캘린더 (2026-10-11 대표 "1,2,4 해줄래" 중 2번)
 */
const T = 'src/tests/unit/talk-calendar-voucher-2026-10-11.test.ts'
export default [
  {
    name: '톡캘린더 — 만료 자정 1초 보정을 뺀다',
    file: 'src/features/kakao-social/voucher-calendar.ts',
    find: 'new Date(expMs - 1000 + KST_MS)',
    replace: 'new Date(expMs + KST_MS)',
    test: T,
    why: 'KST 자정에 끝나는 이용권이 하루 늦은 날짜(이미 만료된 날)로 알림이 잡힌다.',
  },
  {
    name: '톡캘린더 — 남의 이용권도 넣게 소유권 조건을 뺀다',
    file: 'src/features/kakao-social/api/kakao-social.routes.ts',
    find: 'WHERE v.code = ? AND v.user_id IN (?, ?)',
    replace: 'WHERE v.code = ? AND ? IS NOT NULL AND ? IS NOT NULL',
    test: T,
    why: '코드만 알면 남의 이용권 정보(상품·매장·만료일)를 내 캘린더로 빼 갈 수 있다(IDOR).',
  },
  {
    name: '톡캘린더 — 암호화 키를 안 넘긴다',
    file: 'src/features/kakao-social/api/kakao-social.routes.ts',
    find: "{ body: `event=${encodeURIComponent(JSON.stringify(event))}` },\n      c.env.DATA_ENCRYPTION_KEY,\n    );",
    replace: "{ body: `event=${encodeURIComponent(JSON.stringify(event))}` },\n    );",
    test: T,
    why: '암호문을 토큰으로 보내 실패하고, 이어지는 갱신 실패가 그 사용자의 카카오 토큰을 지운다.',
  },
  {
    name: '톡캘린더 — 동의 콜백이 돌아갈 경로를 state 통째로 쓴다',
    file: 'src/pages/KakaoConsentCallbackPage.tsx',
    find: "try { return safeInternalPath(atob(state.slice(i + 1)), '/') } catch { return '/' }",
    replace: "return safeInternalPath(state, '/')",
    test: T,
    why: '동의하고 나면 지갑이 아니라 홈으로 튕긴다(종전 결함).',
  },
  {
    name: '톡캘린더 — 동의 후 남긴 할 일을 안 이어서 한다',
    file: 'src/pages/KakaoConsentCallbackPage.tsx',
    find: 'const note = await runPendingKakaoAction()',
    replace: 'const note = null as string | null',
    test: T,
    why: '동의만 하고 일정은 안 들어가 사람이 버튼을 다시 눌러야 한다.',
  },
]
