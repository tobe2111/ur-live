/**
 * 🧬 주입 — KT 조각 갱신 · 데이터 신선도 (2026-11-17) · 가드: src/tests/unit/kt-catalog-chunk-freshness-2026-11-17.test.ts
 */
const T = 'src/tests/unit/kt-catalog-chunk-freshness-2026-11-17.test.ts'
export default [
  {
    name: '🧩 조금만 받은 바퀴에서도 상품을 대량으로 내린다',
    file: 'src/worker/cron/kt-alpha-catalog-chunk.ts',
    find: '  return c.total > 0 && c.received >= Math.floor(c.total * 0.8)',
    replace: '  return true',
    test: T,
    why: 'KT 가 빈 페이지를 주면 멀쩡한 교환권 수천 개가 판매 중지된다.',
  },
  {
    name: '🧩 비밀값이 없으면 다시 조용히 skip 한다',
    file: 'src/worker/cron/kt-alpha-catalog-chunk.ts',
    find: "  if (!env.KT_ALPHA_AUTH_CODE) throw new Error('KT_ALPHA_AUTH_CODE 미설정 — KT 목록 갱신 불가')",
    replace: "  if (!env.KT_ALPHA_AUTH_CODE) return { skipped: true }",
    test: T,
    why: '반 년 침묵(2026-05-19~11-17)이 그대로 재발한다.',
  },
  {
    name: '🩺 신선도 감시가 오래된 갱신을 못 본다',
    file: 'src/worker/cron/data-freshness.ts',
    find: '  else if (h > KT_STALE_HOURS) out.push',
    replace: '  else if (h > KT_STALE_HOURS * 1000) out.push',
    test: T,
    why: '갱신이 멈춰도 경보가 안 뜬다.',
  },
]
