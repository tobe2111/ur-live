/**
 * 🎬 작은 움직임 키트 (2026-11-02 대표 "이전에 만든 모션그래픽 다 적용해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/motion-kit-2026-11-02.test.ts
 */
const TEST = 'src/tests/unit/motion-kit-2026-11-02.test.ts'

export default [
  {
    name: '🎬 목록 카드가 모든 클릭을 가로채 화면 전환을 건다',
    file: 'src/pages/main-home/GroupBuyFeedCard.tsx',
    find: '        if (!canRunDealTransition(e)) return',
    replace: '        if (false) return',
    test: TEST,
    why: '새 탭 열기·지원 안 하는 브라우저·동작 줄이기에서도 전환을 걸면 링크가 안 열리거나 화면이 멈춘다.',
  },
  {
    name: '🎬 누름 반응이 레이아웃 속성(width)을 움직인다',
    file: 'src/index.css',
    find: '@keyframes ur-press { 0% { transform: scale(1); }',
    replace: '@keyframes ur-press { 0% { transform: scale(1); width: 10px; }',
    test: TEST,
    why: '크기·위치를 움직이면 옆 글자가 밀린다(로딩 밀림 클래스).',
  },
{
    name: '🎬 공용 시트 배경을 누르면 내려가지 않고 툭 사라진다',
    file: 'src/pages/user-profile/seller-section/Sheet.tsx',
    find: 'onClick={requestClose} aria-hidden="true"',
    replace: 'onClick={onClose} aria-hidden="true"',
    test: TEST,
    why: '닫을 때만 다른 길로 사라지면 "같은 창" 이 아니라 두 개처럼 보인다(시안 3차 통일의 반쪽).',
  },
  {
    name: '🎬 숫자 굴림이 끝나도 옛 숫자가 겹쳐 남는다',
    file: 'src/components/ui/RollingNumber.tsx',
    find: 'const t = window.setTimeout(() => setOut(null), 280)',
    replace: 'const t = window.setTimeout(() => {}, 280)',
    test: TEST,
    why: '수량 칸에 1 과 2 가 겹쳐 보인다 — 몇 개를 골랐는지 읽을 수 없다.',
  },
]
