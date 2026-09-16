/**
 * 🎨 유어샵 헤더 SNS 링크 = 잉크 한 색 글리프 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/ushop-sns-mono-2026-09-16.test.ts
 */
const TEST = 'src/tests/unit/ushop-sns-mono-2026-09-16.test.ts'
const SRC = 'src/pages/curator-page/CuratorHeader.tsx'
const TILE = 'w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors'

export default [
  {
    name: '🎨 유튜브 타일이 순수 빨강으로 돌아온다 (표면 규칙 ② 위반)',
    file: SRC,
    find: `aria-label="YouTube" className="${TILE}"`,
    replace: 'aria-label="YouTube" className="w-[34px] h-[34px] rounded-[10px] bg-[#FF0000] flex items-center justify-center"',
    test: TEST,
    why: '바로 아래 블루 버튼까지 치면 한 화면에 색 면이 넷이 된다. 링크는 자랑거리가 아니라 링크다.',
  },
  {
    name: '🎨 인스타 그라디언트가 돌아온다 (표면 규칙 ⑥ "그라디언트 0")',
    file: SRC,
    find: `aria-label="Instagram" className="${TILE}"`,
    replace: 'aria-label="Instagram" className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: \'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)\' }}',
    test: TEST,
    why: '3-stop 그라디언트는 디자인 시스템이 이름 대고 금지한 것이다.',
  },
  {
    name: '🎨 글리프에 흰색을 박는다 (테마·hover 를 못 따라간다)',
    file: SRC,
    find: '<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">',
    replace: '<svg width="19" height="19" viewBox="0 0 24 24" fill="#fff">',
    test: TEST,
    why: 'currentColor 라야 바깥 className 이 색을 정한다 — 흰색을 박으면 라이트에서 안 보인다.',
  },
  {
    name: '🎨 탭 영역이 36 → 34px 로 줄어든다 (접근성 회귀)',
    file: SRC,
    find: `aria-label="TikTok" className="${TILE}"`,
    replace: 'aria-label="TikTok" className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors"',
    test: TEST,
    why: '타일을 없애면서 터치 영역까지 없애면 안 된다 — 셋이 한 글자까지 같아야 한 줄로 읽힌다.',
  },
  {
    name: '🎨 왼쪽 당김이 사라진다 (글리프 줄만 ~8px 들어가 보인다)',
    file: SRC,
    find: '<div className="flex items-center -ml-2 empty:hidden">',
    replace: '<div className="flex items-center empty:hidden">',
    test: TEST,
    why: '타일이 없으면 글리프가 원 안에서 가운데라, 안 당기면 이름·소개 줄과 선이 안 맞는다.',
  },
]
