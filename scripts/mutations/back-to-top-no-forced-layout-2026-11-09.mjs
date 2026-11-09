/** 🧬 주입 — 맨 위로 버튼이 마운트 순간 레이아웃을 강제하면 빨간불인가. */
export default [
  {
    name: '맨위로 — 마운트 순간 scrollY 를 읽는다',
    file: 'src/pages/mobile-home/BackToTop.tsx',
    find: '    const raf = requestAnimationFrame(read)\n',
    replace: '    read()\n    const raf = 0\n',
    test: 'src/tests/unit/back-to-top-no-forced-layout-2026-11-09.test.tsx',
    why: '홈이 붙는 순간 전체 레이아웃을 한 번 더 계산해 폰에서 ~0.1초 멈춘다.',
  },
]
