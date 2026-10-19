/**
 * 🧬 주입 — 실사용 LCP 쪼개기 (2026-10-19)
 */
const T = 'src/tests/unit/vitals-lcp-breakdown-2026-10-19.test.ts'
export default [
  {
    name: 'LCP쪼개기 — 그리기 칸을 빼먹어 합이 LCP 와 안 맞는다',
    file: 'src/lib/web-vitals-report.ts',
    find: '    erd: Math.round(lcp - resEnd),',
    replace: '    erd: 0,',
    test: T,
    why: '넷의 합이 LCP 가 아니면 "어디서 늦나" 가 거짓말이 된다.',
  },
  {
    name: 'LCP쪼개기 — 숨은 탭 표본을 버리지 않는다',
    file: 'src/lib/web-vitals-report.ts',
    find: '      if (hiddenAt <= lcpValue) return',
    replace: '      if (false) return',
    test: T,
    why: '백그라운드로 열린 탭은 그려지지 않아 LCP 가 부풀고 홈 p75 를 끌어올린다.',
  },
  {
    name: 'LCP쪼개기 — 키가 SLO 판정 접두와 섞인다',
    file: 'src/worker/routes/analytics.routes.ts',
    find: '`vitals:${day}:LCPB:${page}`',
    replace: '`vitals:${day}:LCP:${page}#b`',
    test: T,
    why: '배열 묶음이 LCP 숫자 표본 자리에 섞이면 SLO 판정이 깨진다.',
  },
]
