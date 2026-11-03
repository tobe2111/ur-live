/**
 * 🧬 주입 — 제휴사 입점 위젯 최종안 (2026-11-02 대표 "E2 형광펜 + P1 판매 수 + P3 +1 · 판매 수 바탕 검정")
 *    가드: src/tests/unit/embed-partner-final-2026-11-02.test.tsx
 */
const T = 'src/tests/unit/embed-partner-final-2026-11-02.test.tsx'
const M = 'src/worker/utils/embed-partner-motion.ts'
const W = 'src/worker/utils/embed-widget.ts'
export default [
  {
    name: '제휴최종 — 형광펜을 뺀다',
    file: W,
    find: '<span class="ln"><span class="em-m">인플루언서와 함께</span> 파세요</span>',
    replace: '<span class="ln">인플루언서와 함께 파세요</span>',
    test: T,
    why: '대표가 고른 강조(E2 형광펜)가 조용히 사라진다 — 제목은 멀쩡해 보인다.',
  },
  {
    name: '제휴최종 — 판매 수 상자를 다시 파랑으로',
    file: M,
    find: 'background:#16181C;color:#fff;font-size:12px;white-space:nowrap;',
    replace: 'background:#1C69EF;color:#fff;font-size:12px;white-space:nowrap;',
    test: T,
    why: '대표가 검정으로 바꾸라고 한 상자가 파랑으로 돌아간다.',
  },
  {
    name: '제휴최종 — +1 박자를 어긋낸다',
    file: M,
    find: '.pt .it:nth-child(6) .plus{animation-delay:-9s}',
    replace: '.pt .it:nth-child(6) .plus{animation-delay:-3s}',
    test: T,
    why: '숙소가 팔렸다고 알림이 뜨는데 +1 은 PT 줄에서 튄다 — 한 이야기가 깨지는데 화면은 그럴듯하다.',
  },
  {
    name: '제휴최종 — 판매 수를 짧게 돌려 되감긴다',
    file: M,
    find: 'animation:cnt 900s steps(300,start) infinite',
    replace: 'animation:cnt 48s steps(16,start) infinite',
    test: T,
    why: '48초마다 판매 수가 140 → 124 로 줄어든다 — 성과를 보여 주려던 숫자가 거꾸로 간다.',
  },
  {
    name: '제휴최종 — 움직임 줄이기에서 형광펜이 안 보인다',
    file: M,
    find: '.pt .mlive .m1{opacity:1}.pt .em-m{background-size:100% 100%}}',
    replace: '.pt .mlive .m1{opacity:1}}',
    test: T,
    why: '움직임을 꺼 둔 사람에게는 형광펜이 0% 로 멈춰 강조가 통째로 없다.',
  },
]
