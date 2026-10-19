/** 🧬 주입 — 로그인 전 유어샵 탭 예시 진열대 자리 잡기 (2026-10-19 라이브 CLS 0.39) */
const T = 'src/tests/unit/guest-urshop-reserve-2026-10-19.test.tsx'
const F = 'src/pages/guest/GuestUrShopPage.tsx'
export default [
  { name: '게스트예약 — 응답 전 자리를 안 잡는다', file: F, find: 'const pins: PassItem[] = waiting ? PLACEHOLDER_PINS : real', replace: 'const pins: PassItem[] = real', test: T, why: '도착 순간 혜택·가입 버튼이 425px 밀린다.' },
  { name: '게스트예약 — 자리표시가 보인다', file: F, find: "const hide = waiting ? ' invisible' : ''", replace: "const hide = ''", test: T, why: '빈 줄 세 개가 화면에 그대로 보인다.' },
  { name: '게스트예약 — 0건이어도 자리표시를 남긴다', file: F, find: 'const waiting = isLoading && real.length === 0', replace: 'const waiting = real.length === 0', test: T, why: '응답이 비면 빈 진열대가 영원히 자리를 차지한다.' },
]
