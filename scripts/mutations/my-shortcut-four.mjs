/**
 * 🧹 2026-09-30 (대표 확정 ⑥) — 마이 판매 바로가기 넷 + 전체 도구.
 *
 * 되돌리려는 사고: **바로가기 목록이 다시 자라 첫 화면을 먹는 것.** 2026-09-26 까지 실제로
 * 그렇게 자랐고(아홉), 폰 한 화면이 `전체 도구` 에서 정확히 끝나 손님 줄이 0이었다.
 * 그리고 줄을 빼는 쪽의 위험도 함께 본다 — **전체 도구에도 없으면 기능이 그냥 사라진다.**
 *
 * 가드: src/tests/unit/my-shortcut-four-2026-09-30.test.ts
 */
const TEST = 'src/tests/unit/my-shortcut-four-2026-09-30.test.ts'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'

export default [
  {
    name: '🧹 바로가기가 다시 자란다 (다섯째 줄)',
    file: SECTION,
    find: `        <ToolRow
          icon={<WonCoinIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="정산"`,
    replace: `        <ToolRow
          icon={<WonCoinIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="가게"
          hint="이름 · 연락처 · 주소"
          busy={entering}
          onClick={() => openTool('store')}
        />
        <ToolRow
          icon={<WonCoinIcon className="w-[18px] h-[18px]" aria-hidden="true" />}
          label="정산"`,
    test: TEST,
    why:
      '한 줄이 늘어도 화면은 안 깨진다 — 그래서 아홉까지 자랐다. 48px 씩 조용히 먹다가 ' +
      '어느 날 손님 줄이 0이 된다(2026-09-30 실측이 그 상태였다).',
  },
  {
    name: '🧹 오늘 숫자가 매출 분석으로 안 간다 (닿는 길이 하나 줄어든다)',
    file: SECTION,
    find: "            onClick={() => openTool('analytics')}",
    replace: '            onClick={() => {}}',
    test: TEST,
    why: '바로가기에서 뺀 대신 오늘 숫자를 입구로 삼았다 — 그 배선이 끊기면 매출 분석은 전체 도구에만 남는다.',
  },
  {
    name: '🧹 클릭면이 말을 안 한다 (표시 없는 누름)',
    file: SECTION,
    find: `                매출 분석
                <ChevronRight className="w-4 h-4" aria-hidden="true" />`,
    replace: '                <ChevronRight className="w-4 h-4" aria-hidden="true" />',
    test: TEST,
    why:
      '2026-07-02 상세의 "ChevronRight 로 클릭 유도하면서 onClick 없던 dead 어포던스" 의 **정반대**. ' +
      'onClick 은 있는데 무엇이 열리는지 안 적혀 있으면 아무도 안 누른다 — 기능을 숨긴 것과 같다.',
  },
  {
    name: '🧹 뺀 기능이 전체 도구에서도 사라진다 (진짜로 없어진다)',
    file: SECTION,
    find: "  '/seller/influencer-deals': 'partners',",
    replace: '',
    test: TEST,
    why:
      '바로가기 줄을 뺀 근거가 **"전체 도구가 같은 시트로 보낸다"** 였다. 그 표에서 빠지면 ' +
      '근거가 사라지고 소개 파트너는 마이에서 닿을 수 없게 된다 — 조용히.',
  },
  {
    name: '🧹 줄 세기가 헛돈다 (label 형태가 바뀌어 0개)',
    file: TEST,
    find: "    const rows = [...code.matchAll(/^\\s*label=\"([^\"]+)\"$/gm)].map((m) => m[1])",
    replace: "    const rows: string[] = []",
    test: TEST,
    why: '이 레포가 반복해 당한 헛도는 가드 — 0개를 세고도 "다섯 이하" 라 통과한다. 하한이 그것을 잡는다.',
  },
]
