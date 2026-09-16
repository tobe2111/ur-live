/**
 * 🕳️ 라우트 그림자 가드 자신의 건강 — 주입 매니페스트 (2026-09-16 등록).
 * 가드: src/tests/unit/live-defects-2026-09-02.test.ts (가드를 **실제로 실행**해 0건을 확인한다)
 *
 * 이 파일이 지키는 것은 라우트가 아니라 **가드 자신**이다. 이 레포에서 가드가 죽은 방식은
 * "실패했다" 가 아니라 **"정상 코드에 빨간불을 내서 아무도 안 켰다"** 쪽이었다
 * (CLAUDE.md 가 `check-input-text-color` 로 기록한 2개월+ 미등록). 오탐은 기능 결함이다.
 */
export default [
  {
    name: '[그림자가드] 테스트 파일을 다시 스캔 (자기를 돕는 테스트에 오탐)',
    file: 'scripts/check-route-shadowing.mjs',
    find: "  .filter((f) => !f.includes('/tests/') && !/\\.test\\.[cm]?tsx?$/.test(f))",
    replace: '  .filter(() => true)',
    test: 'src/tests/unit/live-defects-2026-09-02.test.ts',
    why: '순서 불변식을 검사하는 테스트는 `app.get(\'/:id\'` 를 문자열로 담는다 — 그걸 등록으로 읽으면 멀쩡한 코드가 위반이 되고, 결국 가드를 끄게 된다.',
  },
]
