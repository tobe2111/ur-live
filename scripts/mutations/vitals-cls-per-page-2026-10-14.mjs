/**
 * 📏 실사용자 CLS 를 그 페이지 몫만·표준 방식으로 (2026-10-14 — `/my-vouchers` 0.721 오귀속) — 주입 매니페스트.
 * 가드: src/tests/unit/vitals-cls-per-page-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/vitals-cls-per-page-2026-10-14.test.ts'
const FILE = 'src/lib/web-vitals-report.ts'

export default [
  {
    name: '📏 앱 안에서 다른 화면으로 가도 계속 센다',
    file: FILE,
    find: "if (window.location.pathname !== page) { flushCls(); return }",
    replace: '',
    test: TEST,
    why: '홈에서 난 밀림 0.699 가 처음 연 지갑 페이지 점수로 붙는다 — 멀쩡한 화면을 고치게 된다.',
  },
  {
    name: '📏 이동을 확인하는 타이머를 뺀다',
    file: FILE,
    find: "if (window.location.pathname !== page) { clearInterval(navCheck); flushCls() }",
    replace: '',
    test: TEST,
    why: '이동 뒤 밀림이 없으면 관측 콜백이 안 와서 확정되지 않고, 나중 화면의 밀림까지 섞일 창이 남는다.',
  },
  {
    name: '📏 세션 창 없이 전부 더한다',
    file: FILE,
    find: 'if (cur > 0 && t - last < 1000 && t - first < 5000) { cur += value; last = t }',
    replace: 'if (true) { cur += value; last = t }',
    test: TEST,
    why: '오래 머문 사람일수록 점수가 커져, 화면이 나쁜 것과 오래 본 것을 구분하지 못한다.',
  },
  {
    name: '📏 입력 직후 밀림도 센다',
    file: FILE,
    find: '        if (e.hadRecentInput) continue\n',
    replace: '',
    test: TEST,
    why: '누른 뒤 열리는 시트·펼침까지 밀림으로 잡혀 점수가 부풀려진다(표준 정의 위반).',
  },
]
