/**
 * 🔵 주 버튼은 브랜드 블루다 (2026-09-28)
 * 가드: scripts/check-primary-button-color.mjs · src/tests/unit/primary-button-color-2026-09-28.test.ts
 *
 * 되돌리려는 사고는 **한 화면씩 검정으로 새는 것**이다. 버튼 하나를 `bg-gray-900` 으로 적어도
 * 빌드도 화면도 안 깨지고, 그 화면에서만 주 버튼이 검정이다. 그렇게 224곳까지 자랐고
 * *"다시 시도"* 가 마이에선 파랑, 숙소 목록에선 검정이었다.
 */
const TEST = 'src/tests/unit/primary-button-color-2026-09-28.test.ts'

export default [
  {
    name: '🔵 주 버튼 하나가 검정으로 돌아간다 (잠기지 않은 화면)',
    file: 'src/pages/AffiliatePage.tsx',
    find: 'bg-brand text-white rounded-xl text-xs',
    replace: 'bg-gray-900 text-white rounded-xl text-xs',
    test: TEST,
    why: '한 화면만 검정이면 에러가 없다 — 같은 역할의 버튼이 화면마다 다른 색이 되는 것이 정확히 이 사고다.',
  },
  {
    name: '🔵 가드가 "누를 수 있는가"를 안 본다 (다크 카드까지 잡아 오탐 폭발)',
    file: 'scripts/check-primary-button-color.mjs',
    find: "    if (!PRESSABLE.test(window)) return\n",
    replace: '',
    test: TEST,
    why: '이 한 줄이 없으면 다크 *카드*·섹션까지 위반으로 잡혀(첫 판 실측 144건 중 상당수) 가드를 결국 끄게 된다.',
  },
  {
    name: '🔵 "측정 0 = 통과" 로 되돌아간다 (경로가 낡아도 초록)',
    file: 'scripts/check-primary-button-color.mjs',
    find: 'if (files.length < 200) {',
    replace: 'if (false) {',
    test: TEST,
    why: 'ROOTS 가 낡아 훑을 게 0개가 돼도 초록이 뜬다 — 이 레포가 반복해 당한 "헛도는 가드".',
  },
  {
    name: '🔵 잠금표 잔여분을 동결이 아니라 영구 면제로 바꾼다',
    file: 'scripts/primary-button-baseline.json',
    find: '"src/pages/BrowsePage.tsx": 5',
    replace: '"src/pages/BrowsePage.tsx": 99',
    test: TEST,
    why: '동결값을 크게 잡으면 그 파일 안에서는 얼마든지 검정이 늘어난다 — 래칫이 아니라 면제가 된다.',
  },
]
