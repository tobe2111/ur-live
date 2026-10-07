/**
 * 🎨 유어샵 헤더 SNS 링크 = 잉크 한 색 글리프 (2026-09-16) — 주입 매니페스트.
 * 가드: src/tests/unit/ushop-sns-mono-2026-09-16.test.ts
 */
const TEST = 'src/tests/unit/ushop-sns-mono-2026-09-16.test.ts'
const SRC = 'src/pages/curator-page/CuratorHeader.tsx'
/**
 * 🔀 2026-10-07 재조준 (대표 확정 **안 C**): 세 링크의 치수 문자열이 상수 `iconBtnCls` 하나로 모였다
 *   (공유 버튼도 같은 상수를 쓴다). 앵커만 그 자리로 옮기고 **막는 것은 그대로다** —
 *   브랜드 색 면 복귀 · 그라디언트 복귀 · 터치 영역 축소.
 */
const TILE = '{iconBtnCls}'

export default [
  {
    name: '🎨 유튜브 타일이 순수 빨강으로 돌아온다 (표면 규칙 ② 위반)',
    file: SRC,
    find: `aria-label="YouTube" className=${TILE}`,
    replace: 'aria-label="YouTube" className="w-[34px] h-[34px] rounded-[10px] bg-[#FF0000] flex items-center justify-center"',
    test: TEST,
    why: '바로 아래 블루 버튼까지 치면 한 화면에 색 면이 넷이 된다. 링크는 자랑거리가 아니라 링크다.',
  },
  {
    name: '🎨 인스타 그라디언트가 돌아온다 (표면 규칙 ⑥ "그라디언트 0")',
    file: SRC,
    find: `aria-label="Instagram" className=${TILE}`,
    replace: 'aria-label="Instagram" className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center" style={{ background: \'linear-gradient(45deg,#F9CE34,#EE2A7B,#6228D7)\' }}',
    test: TEST,
    why: '3-stop 그라디언트는 디자인 시스템이 이름 대고 금지한 것이다.',
  },
  {
    name: '🎨 글리프에 흰색을 박는다 (테마·hover 를 못 따라간다)',
    file: SRC,
    find: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5',
    replace: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M23.5',
    test: TEST,
    why: 'currentColor 라야 바깥 className 이 색을 정한다 — 흰색을 박으면 라이트에서 안 보인다.',
  },
  {
    name: '🎨 탭 영역이 36 → 34px 로 줄어든다 (접근성 회귀)',
    file: SRC,
    find: `aria-label="TikTok" className=${TILE}`,
    replace: 'aria-label="TikTok" className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors"',
    test: TEST,
    why: '타일을 없애면서 터치 영역까지 없애면 안 된다 — 셋이 한 글자까지 같아야 한 줄로 읽힌다.',
  },
  {
    name: '🎨 SNS 전용 줄이 되살아난다 (48px)',
    file: SRC,
    // 🔧 2026-09-28 2차 재조준(대표 확정 **상단 1안**): 그 전용 줄 자체가 없어졌다(SNS 는 이름 줄의
    //   버튼 묶음으로). 그래서 `-ml-2` 도 사라져 앵커가 또 낡았다 — 이제는 **줄의 부활**을 막는다.
    find: '      <div className="max-w-3xl mx-auto">',
    replace: '      <div className="max-w-3xl mx-auto"><div className="flex items-center -ml-2 px-4 pb-3">{snsLinks}</div>',
    test: TEST,
    why:
      '아이콘 두세 개를 위해 줄 하나(36px + pb-3 12px = 48px)를 쓰는 것이 대표가 짚은 낭비다 ' +
      '(*"SNS 로고도 말이야"*). 라이브 실측으로 첫 상품 y 가 185 → 233 으로 되돌아가는 자리다.',
  },
]
