/**
 * 🟡 `--phone-audit` 판정 보류 규칙 (2026-10-01) — 주입 매니페스트.
 * 가드: src/tests/unit/phone-audit-empty-hint.test.ts
 *
 * ⚠️ 이 규칙이 조용히 망가지는 모양은 **둘 다 나쁘다**:
 *   ① 너무 넓으면 🟡 가 상시 켜져 아무도 안 읽는다(실제로 그랬다 — 정산 화면)
 *   ② 너무 좁으면 빈 화면을 "🟢 깨끗" 으로 내준다(2026-09-30 측정 1차가 그렇게 헛돌았다)
 */
const TEST = 'src/tests/unit/phone-audit-empty-hint.test.ts'

export default [
  {
    name: '🟡 빈 상태 말투가 맨 `없습니다` 로 되돌아간다(거짓 보류)',
    file: 'scripts/preview-seeds/empty-screen-hint.mjs',
    find: '[이가]\\s*없습니다',
    replace: '없습니다',
    test: TEST,
    why: '안내 문장("필요 없습니다")이 다시 빈 화면으로 읽혀 멀쩡한 화면이 상시 🟡 가 된다 — 신호가 신호 구실을 못 한다.',
  },
  {
    name: '🟡 백지 안전판(firstScreen)이 사라진다',
    file: 'scripts/preview-seeds/empty-screen-hint.mjs',
    find: "return EMPTY_HINT.test(bodyText ?? '') || Number(firstScreenLines ?? 0) < 8",
    replace: "return EMPTY_HINT.test(bodyText ?? '')",
    test: TEST,
    why: '문구가 아예 없는 백지(렌더 실패·로딩 고착)는 정규식이 못 본다 — 안전판이 없으면 🟢 로 나간다.',
  },
  {
    name: '🟡 하네스가 모듈 대신 인라인 정규식으로 되돌아간다',
    file: 'scripts/visual-preview.mjs',
    find: 'const suspect = looksEmpty(bodyText, audit.firstScreen)',
    replace: 'const EMPTY_HINT = /없어요|없습니다/\n  const suspect = EMPTY_HINT.test(bodyText) || audit.firstScreen < 8',
    test: TEST,
    why: '규칙이 다시 한 줄로 숨으면 아무도 재 보지 않는다 — 거짓 🟡 가 태어난 자리가 정확히 거기다.',
  },
  {
    name: '🟡 판정만 찍고 근거를 안 찍는다',
    file: 'scripts/visual-preview.mjs',
    find: '    console.log(`   ↳ 근거: ${why',
    replace: '    void why; console.log(`   ↳ (생략) ${why',
    test: TEST,
    why: '근거가 없으면 "화면 전체가 빈 것" 과 "블록 하나가 빈 것" 을 사람이 구분 못 한다 — 정산 화면이 정확히 그 둘째였고, 그걸 알아내는 데 렌더를 여러 번 돌렸다.',
  },
]
