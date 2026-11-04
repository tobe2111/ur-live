/** 🧬 주입 — 견적 단계 화면 키보드(2026-11-04). 가드: src/tests/unit/life-step-keyboard-2026-11-04.test.ts */
const TEST = 'src/tests/unit/life-step-keyboard-2026-11-04.test.ts'
export default [
  {
    name: '⌨️ 견적 단계 — 입력칸에 포커스해도 끌어오지 않는다',
    file: 'src/pages/life/request/Sheet.tsx',
    find: "setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)",
    replace: 'void el',
    test: TEST,
    why: '키보드가 올라오면 입력칸이 "다음" 버튼 뒤로 숨는다(대표 신고).',
  },
]
