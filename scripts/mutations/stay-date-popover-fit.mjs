/**
 * 🏨 숙소 날짜 팝오버가 화면을 넘지 않는다 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/stay-date-popover-fit-2026-09-15.test.ts
 *
 * 되돌려-검증은 브라우저 하네스로도 했다(수리본 vh 640~1000 전부 통과 / 종전 코드 vh 760·640 에서
 * '적용하기' 안 보임). 여기서는 그 실측을 성립시킨 **배선**이 사라지면 빨간불이 되는지를 고정한다.
 */
const TEST = 'src/tests/unit/stay-date-popover-fit-2026-09-15.test.ts'
const FILE = 'src/pages/stay-detail/StayDateGuestPicker.tsx'

export default [
  {
    name: '[숙소팝오버] PC 세로 제한이 다시 풀린다 (sticky 안이라 잘린 곳에 못 닿는다)',
    file: FILE,
    find: 'className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0 overflow-y-auto"',
    replace: 'className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-h-[52vh] lg:max-h-none overflow-y-auto"',
    test: TEST,
    why: '대표 신고의 원본 코드 그대로다 — 하네스 실측에서 vh 760·640 일 때 적용하기 버튼이 화면 밖으로 나갔다.',
  },
  {
    name: '[숙소팝오버] 측정을 버리고 상한을 안 건다',
    file: FILE,
    find: '      setPopMax(Math.max(isDesktop() ? MIN_POPOVER_H : Math.round(vh * 0.52), room))',
    replace: '      setPopMax(null)',
    test: TEST,
    why: '상수·주석에 이름이 남아도 실제 대입이 없으면 상한이 안 걸린다 — 모양이 아니라 동작을 앵커로 잡는지 확인.',
  },
  {
    name: '[숙소팝오버] 바닥값 분기를 없애 모바일을 종전보다 짧게 만든다',
    file: FILE,
    find: 'isDesktop() ? MIN_POPOVER_H : Math.round(vh * 0.52)',
    replace: 'MIN_POPOVER_H',
    test: TEST,
    why: '모바일은 흐름 안이라 넘쳐도 스크롤로 닿는다. PC 규칙을 그대로 쓰면 팝오버가 종전(52vh)보다 짧아진다.',
  },
  {
    name: '[숙소팝오버] 인원 팝오버만 상한에서 빠진다',
    file: FILE,
    find: `          style={popMax ? { maxHeight: popMax } : undefined}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10500] overflow-y-auto rounded-2xl`,
    replace: `          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10500] overflow-y-auto rounded-2xl`,
    test: TEST,
    why: '둘 중 하나만 고치면 카드가 화면 아래쪽일 때 인원 패널이 같은 방식으로 잘린다.',
  },
  {
    name: '[숙소팝오버] 적용하기 줄이 줄어들어 다시 밀려난다',
    file: FILE,
    find: 'className="shrink-0 flex items-center justify-between gap-3 mt-3',
    replace: 'className="flex items-center justify-between gap-3 mt-3',
    test: TEST,
    why: 'flex 컬럼에서 shrink-0 이 없으면 달력이 커질 때 푸터가 찌그러진다 — 잘려서 못 누르던 그 버튼이다.',
  },
  {
    name: '[숙소팝오버] 스크롤마다 강제 레이아웃을 읽는다 (rAF 없이)',
    file: FILE,
    find: '    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }',
    replace: '    const schedule = () => { measure() }',
    test: TEST,
    why: 'dep 없는 effect 가 매 렌더 레이아웃을 읽어 홈 부팅을 1.1초 먹은 사고와 같은 클래스다.',
  },
]
