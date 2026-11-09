/** 🧬 주입 — 로그인 화면 서버 첫 화면 (2026-11-09) */
const T = 'src/tests/unit/login-first-screen-2026-11-09.test.ts'
const B = 'src/worker/utils/login-first-screen.ts'
export default [
  { name: '로그인첫화면 — /login 이 탭에서 빠진다', file: 'src/worker/utils/guest-first-screen.ts', find: ": p === '/login' ? 'login' : null", replace: ': null', test: T, why: '서버가 로그인 화면을 안 그려 첫 글자가 다시 1.6초.' },
  { name: '로그인첫화면 — 카카오 버튼 클래스를 손으로 바꾼다', file: B, find: '<button type="button" class="${LOGIN_CLS.kakao}">', replace: '<button type="button" class="w-full h-[52px] bg-[#FEE500] rounded-xl">', test: T, why: '서버와 앱 버튼 모양이 갈려 마운트 때 버튼이 바뀐다.' },
  { name: '로그인첫화면 — 유달이를 lazy 로', file: B, find: 'loading="eager" fetchpriority="high" decoding="async" data-udal="hello"', replace: 'loading="lazy" decoding="async" data-udal="hello"', test: T, why: '첫 화면 자리의 그림이 지연 로딩된다.' },
  { name: '로그인첫화면 — 페이지가 모션을 무조건 붙인다', file: 'src/pages/LoginPage.tsx', find: "className={`${enterMotion ? 'ur-lg-h ' : ''}${LOGIN_CLS.h1}`}", replace: 'className={`ur-lg-h ${LOGIN_CLS.h1}`}', test: T, why: '서버가 먼저 그린 글자가 마운트 때 0 에서 다시 떠올라 깜빡인다.' },
]
