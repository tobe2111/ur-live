/** 🧬 주입 — 요청 전 구간 계측이 빠지면 빨간불인가. 가드: src/tests/unit/vitals-pre-request-2026-11-09.test.ts */
export default [
  {
    name: '요청전계측 — 서버가 PRE 를 버린다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: "const validNames = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN', 'D1', 'SRV', 'PRE', 'DNS', 'TCP']",
    replace: "const validNames = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN', 'D1', 'SRV']",
    test: 'src/tests/unit/vitals-pre-request-2026-11-09.test.ts',
    why: '검은 화면 8초가 어디서 가는지(리다이렉트·DNS·연결) 아무도 모른다.',
  },
]
