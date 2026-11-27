/**
 * 🧬 주입 — Sentry 잡음 필터: 내장 브라우저(CefSharp) 거절 문장 (2026-11-27 대표 신고 `UnhandledRejection /ads`).
 * 가드: src/tests/unit/feed-sort-and-sentry-noise.test.ts
 */
const T = 'src/tests/unit/feed-sort-and-sentry-noise.test.ts'

export default [
  {
    name: '[sentry-noise] 내장 브라우저 거절이 다시 Sentry 로 올라간다',
    file: 'src/lib/sentry-noise.ts',
    find: "  if (EMBEDDED_BROWSER_REJECTION.test(text)) return true",
    replace: "",
    test: T,
    why: '메일 링크를 미리 열어 보는 장치가 올 때마다 대표에게 오류 알림이 간다 — 진짜 오류가 그 사이에 묻힌다.',
  },
  {
    name: '[sentry-noise] 판정이 넓어져 "Not Found" 를 다 버린다',
    file: 'src/lib/sentry-noise.ts',
    find: "export const EMBEDDED_BROWSER_REJECTION = /Object Not Found Matching Id:\\d+, MethodName:\\w+, ParamCount:\\d+/",
    replace: "export const EMBEDDED_BROWSER_REJECTION = /Not Found/",
    test: T,
    why: '우리 화면의 404 처리에서 난 진짜 버그까지 조용히 사라진다.',
  },
]
