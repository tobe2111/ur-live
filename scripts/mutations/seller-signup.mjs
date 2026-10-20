/**
 * 📱 사업자 유저 가입 폼 개편 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-signup-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-signup-2026-09-15.test.ts'

export default [
  {
    name: '📱 가입 폼 입력이 14px 로 돌아간다 (iOS 가 탭마다 화면을 확대한다)',
    file: 'src/pages/seller-register/RegisterFields.tsx',
    // 🔀 2026-09-16 재조준 — 대표 확정 시각 C 로 입력이 `h-11 … px-3.5` 상자에서
    //    테두리 없는 큰 글자로 바뀌었다. **불변식은 그대로**: 16px 미만 금지.
    find: "p-0 text-[17px] font-bold",
    replace: "p-0 text-[14px] font-bold",
    test: TEST,
    why: 'iOS Safari 는 16px 미만 입력에 포커스하면 자동 확대한다 — 그 확대가 "폼이 흔들린다" 신고의 실체다.',
  },
]
