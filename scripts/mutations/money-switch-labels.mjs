/**
 * 🔢 머니 스위치 라벨 가드의 되돌려-검증 (2026-09-30).
 *
 * 대표가 *"스위치 on 어떤거 얘기하는거야?"* 라고 물은 자리 — 화면에 ⑨ 가 둘이어서 지시가 통하지
 * 않았다. 그 정리가 되돌아가면 같은 일이 난다. 각 주입은 정리 이전 상태를 한 조각씩 되살린다.
 */
const SWITCH = 'src/pages/admin-platform-settings/money-switch-fields.ts'
const TEST = 'src/tests/unit/money-switch-labels-2026-09-30.test.ts'

export default [
  {
    name: '머니 스위치 라벨 — 동그라미 번호가 되살아난다',
    file: SWITCH,
    find: "label: '자동정산에서 원장 기록분 제외'",
    replace: "label: '⑨ 자동정산에서 원장 기록분 제외'",
    test: TEST,
    why: '⑨ 가 둘이 되면 "⑨ 를 켜세요" 가 통하지 않는다 — 2026-09-30 에 실제로 통하지 않았다.',
  },
  {
    name: '머니 스위치 라벨 — 같은 번호가 둘이 된다(짚을 수 없음)',
    file: SWITCH,
    find: "label: '소개 정산을 이용권 사용 뒤로'",
    replace: "label: '[순서 4] 소개 정산을 이용권 사용 뒤로'",
    test: TEST,
    why: '[순서 N] 이 겹치면 hint 의 상호참조가 어느 스위치를 가리키는지 알 수 없다.',
  },
  {
    name: '머니 스위치 라벨 — 두 스위치가 같은 이름이 된다',
    file: SWITCH,
    find: "label: '부분환불 금액 지정'",
    replace: "label: '이용권 일부 환불 (장 단위)'",
    test: TEST,
    why: '이름이 유일하지 않으면 번호를 떼는 처방 자체가 무의미해진다.',
  },
  {
    name: '머니 스위치 — 부속 값 필드가 부모에서 떨어진다(↳ 표기 소실)',
    file: SWITCH,
    // 🎯 2026-10-01 재조준: 부가세 별도 안내가 라벨에 붙어 문구가 바뀌었다(Q4). 불변식(↳ 유지)은 그대로.
    find: "label: '↳ 직접 입점 요율 (%, 부가세 포함 차감률)'",
    replace: "label: '직접 입점 요율 (%, 부가세 포함 차감률)'",
    test: TEST,
    why: '↳ 가 없으면 값 필드가 독립 스위치처럼 보여 대표가 부모 없이 그것만 고친다.',
  },
  {
    name: '머니 스위치 hint — 번호로 다른 스위치를 가리킨다',
    file: SWITCH,
    // 🎯 2026-10-01 재조준: hint 가 여러 줄 연결(`+`)로 길어졌다(부가세 안내). 첫 조각만 앵커로 잡는다.
    find: "hint: '바로 위 **채널별 플랫폼 요율** 이 ON 일 때만 쓰인다. 비우면 코드 기본 10%. '",
    replace: "hint: '③ 이 ON 일 때만 쓰인다. 비우면 코드 기본 10%. '",
    test: TEST,
    why: '정리 전 이 hint 의 "③" 은 화면의 두 ③ 중 **엉뚱한 쪽**(셀러 소개비 필드)을 가리켰다.',
  },
  {
    name: '머니 스위치 — 손잡이 키가 사라진다(표시 정리가 스위치를 지웠다)',
    file: SWITCH,
    find: "    key: 'settlement_skip_ledgered', label: '자동정산에서 원장 기록분 제외', default: 'false',",
    replace: "    key: 'settlement_skip_ledgered_TYPO', label: '자동정산에서 원장 기록분 제외', default: 'false',",
    test: TEST,
    why: '표시를 고치다 키를 잃으면 그 게이트를 켤 방법이 화면에서 사라진다 — 이 파일이 반복해 당한 사고.',
  },
  {
    name: '머니 스위치 — 머리말의 번호 금지 규약이 사라진다',
    file: SWITCH,
    find: ' * 🔢 **라벨에 동그라미 번호(①②③…)를 붙이지 마라**',
    replace: ' * 🔢 (규약 삭제됨)',
    test: TEST,
    why: '규약이 없으면 다음 세션이 새 스위치에 "다음 번호"를 붙인다 — 그게 이 사고의 원인이었다.',
  },
]
