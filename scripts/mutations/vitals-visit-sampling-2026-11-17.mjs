/**
 * 📉 속도 측정 방문 표본 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/vitals-visit-sampling-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/vitals-visit-sampling-2026-11-17.test.ts'

export default [
  {
    name: '📉 서버가 브라우저 표본(s:1)을 또 25% 로 버린다(표본 1/16 로 굶주림)',
    file: 'src/worker/routes/analytics.routes.ts',
    find: '  if ((body as { s?: number }).s !== 1 && Math.random() > VITALS_SAMPLE_RATE)',
    replace: '  if (Math.random() > VITALS_SAMPLE_RATE)',
    test: TEST,
    why: '방문의 25% × 서버 25% = 6% — 실사용 SLO 가 판정할 표본이 모자란다(2026-09-02 의 하루 1건 사고).',
  },
  {
    name: '📉 브라우저가 방문 표본을 안 보고 모든 신호를 보낸다(요청 4배)',
    file: 'src/lib/web-vitals-report.ts',
    find: '  if (!isSampledVisit()) return\n',
    replace: '',
    test: TEST,
    why: '버릴 신호를 매 방문 ~10개씩 서버로 보낸다 — 사람이 몰릴수록 그대로 요청이 는다.',
  },
]
