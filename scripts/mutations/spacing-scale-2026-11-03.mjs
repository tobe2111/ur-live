/** 🧬 주입 — 손님 화면 공백 체계(2026-11-03). 가드: src/tests/unit/spacing-scale-2026-11-03.test.ts */
const TEST = 'src/tests/unit/spacing-scale-2026-11-03.test.ts'
export default [
  {
    name: '📏 공백 체계 — 바깥 여백 16 이 다시 들어온다(체계 밖 값이 는다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: '<CompanyInfoFooter className="mt-8" />',
    replace: '<CompanyInfoFooter className="mt-4 mb-4 mx-4 gap-4" />',
    test: TEST,
    why: '하나씩 손으로 적은 16·24 가 쌓여 화면마다 여백이 다시 제각각이 된다.',
  },
  {
    name: '📏 공백 체계 — 변환기가 바깥 여백을 좁히는 쪽으로 바뀐다',
    file: 'scripts/codemods/spacing-scale.mjs',
    find: 'const OUT = { 4: 5, 6: 8, 7: 8, 9: 8, 10: 12, 14: 12, 16: 12 }',
    replace: 'const OUT = { 4: 3, 6: 5, 7: 8, 9: 8, 10: 8, 14: 12, 16: 12 }',
    test: TEST,
    why: '구역 사이가 좁아져 시안의 "구역과 구역은 32" 가 깨진다.',
  },
]
