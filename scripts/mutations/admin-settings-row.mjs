/**
 * ⚙️ 2026-09-28 (대표 신고 — 폰에서 설정 라벨이 한 글자씩 세로로 쌓임) 주입 매니페스트.
 *
 * 지키는 것 넷: **좁으면 쌓기 · sm 부터 한 줄 · 호출부 배선 · 접두사 없는 shrink-0 금지**.
 * 아래 결함을 심으면 `admin-settings-row-2026-09-28.test.ts` 가 빨간불이어야 한다.
 */
const TEST = 'src/tests/unit/admin-settings-row-2026-09-28.test.ts'
const ROW = 'src/pages/admin-platform-settings/SettingRow.tsx'

export default [
  {
    name: '설정행 — 세로 쌓기를 없애고 종전 한 줄로 되돌린다 (폰에서 라벨 0px)',
    file: ROW,
    find: 'className="flex flex-col items-stretch gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"',
    replace: 'className="flex items-center justify-between gap-4 px-5 py-4"',
    test: TEST,
    why:
      '이게 정확히 대표가 본 화면이다. 360px 실측으로 **깨진 행 29개 · 최악 라벨 0px · 가장 높은 행 ' +
      '3,739px**. PC 에서는 멀쩡해서 개발 중엔 안 보이고, 하필 머니 스위치가 가장 심하다 ' +
      '(`<select>` 선택지 문구가 길어 고유 폭이 297~363px).',
  },
  {
    name: '설정행 — 입력을 좁을 때도 shrink-0 으로 고정한다',
    file: ROW,
    find: "  `w-full ${w ? `${w} ` : ''}sm:shrink-0 px-3 py-2",
    replace: "  `w-full ${w ? `${w} ` : ''}shrink-0 px-3 py-2",
    test: TEST,
    why:
      '`shrink-0` 은 "이 입력은 절대 안 줄어든다" 는 뜻이라, 폰에서 남는 폭을 입력이 다 가져가고 ' +
      '라벨이 0px 가 된다. 넓을 때만(`sm:`) 걸어야 한다. ' +
      '⚠️ 이 검사는 **함수를 호출해** 나오는 클래스를 본다 — 첫 판에서 소스 문자열을 정규식으로 ' +
      '봤다가 템플릿 리터럴의 백틱에 걸려 헛돌았다.',
  },
  {
    name: '설정행 — items-stretch 를 center 로 (좁을 때 입력이 쪼그라든다)',
    file: ROW,
    find: 'flex flex-col items-stretch gap-2',
    replace: 'flex flex-col items-center gap-2',
    test: TEST,
    why:
      '세로로 쌓아도 `items-center` 면 입력이 **내용 폭**으로 쪼그라들어 가로로 안 찬다 — ' +
      '쌓기만 하고 못 쓰는 상태가 된다. 쌓기와 늘리기는 한 쌍이다.',
  },
  {
    name: '설정행 — 프로모 바 줄이 label 이 아니게 된다 (설명 클릭 포커스 소실)',
    file: 'src/pages/admin-platform-settings/PromoBarSection.tsx',
    find: '<SettingRow as="label" label="버튼 링크"',
    replace: '<SettingRow as="div" label="버튼 링크"',
    test: TEST,
    why:
      '종전엔 행 전체가 `<label>` 이라 **설명을 눌러도 입력에 포커스**가 갔다. 부품으로 옮기면서 ' +
      '`as` 를 빠뜨리면 `<div>` 가 되어 그 성질이 조용히 사라진다 — 화면은 똑같아 보이고 에러도 안 난다. ' +
      '🩸 첫 판에서 이 항목을 "통과해도 되는 주입" 으로 적고 `expectPass` 라는 옵션을 **지어냈다**. ' +
      '러너에 그런 옵션은 없다(있는 척하면 이 항목이 헛돈다) — 대신 시험이 실제로 지키게 만들었다.',
  },
]
