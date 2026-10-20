/**
 * 🏪 셀러 가입 화면 — 안 2 + 시각 C 의 되돌려-검증 (2026-09-16 대표 확정)
 * 시험: src/tests/unit/seller-signup-c-2026-09-16.test.ts · 시안: docs/design/seller-signup-documents.md
 */
const TEST = 'src/tests/unit/seller-signup-c-2026-09-16.test.ts'

export default [
  {
    name: '가입C — 입력이 작아진다(채운 칸과 빈 칸이 같은 무게로 회귀)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    find: "'min-h-[34px] w-full border-0 bg-transparent p-0 text-[17px] font-bold",
    replace: "'min-h-[34px] w-full border-0 bg-transparent p-0 text-[13px] font-bold",
    test: TEST,
    why: '시각 C 의 전부가 "채운 값을 크게" 다 — 작아지면 빈 칸과 채운 칸이 같은 무게라 어디까지 했는지가 안 보인다(대표가 별로라고 한 그 상태).',
  },
  {
    name: '가입C — 포커스 신호가 사라진다(키보드 사용자가 위치를 잃는다)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    find: 'group-focus-within:opacity-100',
    replace: 'opacity-0',
    test: TEST,
    why: '상자 테두리를 없앴으므로 포커스가 유일한 위치 신호다 — 꺼지면 키보드 사용자가 자기가 어느 칸에 있는지 알 수 없다(접근성 회귀).',
  },
]
