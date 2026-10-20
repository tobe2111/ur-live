/**
 * ⚡ 추첨 배지 움직임 + 프로모 띠 캐시 — 되돌려-검증 주입 (2026-10-10).
 */
const T = 'src/tests/unit/fcfs-badge-motion-2026-10-10.test.ts'
export default [
  {
    name: '⚡ 스파크가 다시 text-shadow 를 애니메이션한다',
    file: 'src/index.css',
    find: '    0%, 100% { opacity: 1; }\n    50% { opacity: 0.6; }',
    replace: '    0%, 100% { text-shadow: 0 0 0 rgba(249, 115, 22, 0); }\n    50% { text-shadow: 0 0 9px rgba(249, 115, 22, 0.6); }',
    test: T,
    why: 'text-shadow 는 컴포지터가 못 돌려 매 프레임 레이아웃을 다시 한다 — 홈 메인 스레드 24% 상시 점유가 돌아온다.',
  },
  {
    name: '⚡ 불꽃에 will-change 가 돌아온다',
    file: 'src/index.css',
    find: '    animation: fcfs-flame 1s ease-in-out infinite;\n  }',
    replace: '    animation: fcfs-flame 1s ease-in-out infinite;\n    will-change: transform;\n  }',
    test: T,
    why: '배지마다 상시 레이어를 하나씩 잡는다(홈 48개).',
  },
  {
    name: '⚡ 프로모 띠가 꺼져 있을 때 캐시 헤더 없이 돌아간다',
    file: 'src/worker/routes/public-utility.routes.ts',
    find: "    c.header('Cache-Control', 'public, max-age=60')\n    c.header('CDN-Cache-Control', 'public, max-age=300')\n    if (s.promo_bar_enabled !== 'true' || !s.promo_bar_text) return c.json(empty)",
    replace: "    if (s.promo_bar_enabled !== 'true' || !s.promo_bar_text) return c.json(empty)\n    c.header('Cache-Control', 'public, max-age=60')\n    c.header('CDN-Cache-Control', 'public, max-age=300')",
    test: T,
    why: '모든 페이지가 부르는 요청이라 평소(꺼짐)마다 D1 을 읽는다.',
  },
]
