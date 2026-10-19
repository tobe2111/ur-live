/**
 * 🧬 주입 — 홈 위치 바의 톤이 서로 새는 것 (2026-10-19 대표 "영구적으로 수정해볼래?")
 */
const T = 'src/tests/unit/home-location-bar-tones-2026-10-19.test.tsx'
const F = 'src/pages/pc-home/PcHomeLocationBar.tsx'
export default [
  {
    name: '홈위치바 — 모바일 제목 줄이 세로로 쌓인다(#1878 회귀)',
    file: F,
    find: "    row: 'flex items-center gap-2',\n    pick: 'inline-flex items-center gap-1",
    replace: "    row: 'flex flex-col gap-2',\n    pick: 'inline-flex items-center gap-1",
    test: T,
    why: '모바일 홈 제목이 "공..." 으로 잘리고 현 위치 버튼이 아래 줄로 떨어진다.',
  },
  {
    name: '홈위치바 — 톤 분기가 컴포넌트 안으로 되돌아온다',
    file: F,
    find: '<div className={t.row}>',
    replace: "<div className={tone === 'hero' ? t.row : 'flex flex-col gap-2'}>",
    test: T,
    why: '#1878 이 바로 이 모양(조건 하나로 여러 톤을 같이 집기)에서 났다.',
  },
  {
    name: '홈위치바 — 표를 우회한 클래스로 현 위치 버튼을 그린다',
    file: F,
    find: '          className={t.locate}',
    replace: "          className={`${t.locate} mt-2`}",
    test: T,
    why: '표 밖에서 덧붙인 클래스는 모든 톤에 같이 걸린다.',
  },
]
