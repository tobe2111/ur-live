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
    find: 'bg-brand text-white rounded-xl text-[12px]',
    replace: 'bg-gray-900 text-white rounded-xl text-[12px]',
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
    /* 🕳️ 2026-10-01: 가드가 **토큰 이름만** 보고 있어서 `bg-[#111]` 을 통째로 통과시켰다 —
       로그인·가입의 주 버튼이 정확히 그 모양이라 두 화면이 조용히 검정으로 남아 있었다.
       렌더해 보고서야 드러났다. 이름이 아니라 **색**을 보도록 넓혔으니 다시 좁아지면 빨간불. */
    name: '🔵 가드가 hex 검정에 다시 눈먼다 (토큰 이름만 본다)',
    file: 'scripts/check-primary-button-color.mjs',
    find: '(?:bg-gray-900|bg-black|bg-\\[#(?:0{3,8}|1{3}|111111|0A0A0A|16181C)\\])',
    replace: 'bg-gray-900',
    test: TEST,
    why: '`bg-[#111]` 은 화면에서 검정인데 가드엔 안 보인다 — 체계 밖으로 나가는 가장 쉬운 길이고 실제로 그 길로 샜다.',
  },
  {
    /* 🔧 2026-09-30 재조준: 대표 승인으로 잠금표 잔여 21건을 전부 이행해 `primary-button-baseline.json`
       자체가 없어졌다. **탈출구는 자리를 옮겼을 뿐이다** — 이제는 `primary-button-ok` 표식이
       그 자리다. 진짜 주 버튼에 표식을 달면 빨간불이 떠야 한다. */
    name: '🔵 예외 표식이 진짜 주 버튼의 면제로 쓰인다 (탈출구가 자리를 옮겼다)',
    file: 'src/pages/BrowsePage.tsx',
    find: "className=\"px-6 py-2 bg-brand hover:bg-brand-dark text-white rounded-xl font-semibold transition-colors\"",
    replace: "className=\"px-6 py-2 bg-gray-900 text-white rounded-xl font-semibold transition-colors\" /* primary-button-ok */ /* primary-button-ok */",
    test: TEST,
    why: '표식은 "카드 바탕·스크림" 같은 진짜 예외에만 쓰라고 있는 것이다 — 주 버튼에 달면 그 파일은 조용히 체계 밖으로 나간다.',
  },
]
