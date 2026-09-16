/**
 * 🏝️ light-island 의 두 구조적 함정 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/light-island-tokens-2026-09-15.test.ts
 *
 * 둘 다 **대표가 실제로 본 결함**을 그대로 되살린다(지도 딜 카드 제목이 안 보임).
 */
const TEST = 'src/tests/unit/light-island-tokens-2026-09-15.test.ts'
const CARD = 'src/pages/restaurant-map/SelectedDealCard.tsx'
const CSS = 'src/index.css'

export default [
  {
    name: '[섬] 카드 자신에 dark:bg 가 다시 붙는다 (배경만 검어지고 글자는 라이트로 남는다)',
    file: CARD,
    find: 'className="light-island ur-content-wide pointer-events-auto relative rounded-2xl border border-gray-100 bg-white',
    replace: 'className="light-island ur-content-wide pointer-events-auto relative rounded-2xl border border-gray-100 dark:border-[#2C2F35] bg-white dark:bg-[#11141C]',
    test: TEST,
    why: '대표가 신고한 원본 상태 그대로다 — 제목(text-gray-900)이 근검정 배경 위에 남아 안 보였다.',
  },
  {
    name: '[섬] --sale 을 되박기 목록에서 뺀다 (흰 카드 위 할인율 3.01:1)',
    file: CSS,
    find: '  --sale: #DC2626;\n  --lift: 0 2px 10px rgb(22 24 28 / 0.06);\n  --rule: rgb(22 24 28 / 0.08);\n  --rule-strong: rgb(22 24 28 / 0.28);\n  --wash: rgb(22 24 28 / 0.05);',
    replace: '  --lift: 0 2px 10px rgb(22 24 28 / 0.06);\n  --rule: rgb(22 24 28 / 0.08);\n  --rule-strong: rgb(22 24 28 / 0.28);\n  --wash: rgb(22 24 28 / 0.05);',
    test: TEST,
    why: '되박기 전 상태 — html.dark 에서 `text-sale` 이 #FF5C69 로 남아 흰 카드 위 3.01:1(브라우저 실측).',
  },
  {
    name: '[섬] 잉크 토큰을 되박기 목록에서 뺀다 (흰 카드 위 다크용 밝은 글자)',
    file: CSS,
    find: '  --ink: #16181C;\n  --ink2: #3D3C3A;\n  --ink-soft: #6E6B68;\n  --ink-faint: #8A8580;',
    replace: '  --ink2: #3D3C3A;\n  --ink-soft: #6E6B68;\n  --ink-faint: #8A8580;',
    test: TEST,
    why: '목록이 불완전하면 언제든 같은 사고가 난다 — 하나만 빠져도 잡혀야 한다.',
  },
  {
    name: '[섬] 주소 줄이 다시 비활성 색(gray-400)으로 돌아간다',
    file: CARD,
    find: '<p className="text-[11px] text-gray-500 mt-1 flex items-center gap-0.5 truncate">',
    replace: '<p className="text-[11px] text-gray-400 mt-1 flex items-center gap-0.5 truncate">',
    test: TEST,
    why: 'gray-400 은 `--ink-faint`(비활성·플레이스홀더)다 — 흰 카드 위 3.65:1 로 AA 미달.',
  },
  {
    name: '[섬] 쿠폰가 라벨이 다시 비활성 색으로 돌아간다',
    file: CARD,
    find: '<span className="text-[10px] text-gray-500">쿠폰가</span>',
    replace: '<span className="text-[10px] text-gray-400">쿠폰가</span>',
    test: TEST,
    why: '10px 라 더 나쁘다 — 3.65:1.',
  },
  {
    name: '[섬] 정가 취소선이 다시 비활성 색으로 돌아간다',
    file: CARD,
    find: '<span className="text-[11px] text-gray-500 line-through">',
    replace: '<span className="text-[11px] text-gray-400 line-through">',
    test: TEST,
    why: '취소선이어도 사람이 읽는 숫자다.',
  },
]
