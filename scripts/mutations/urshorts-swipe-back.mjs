/**
 * 🎬 유어쇼츠 — 위로 되돌아가는 스와이프 + 닫기 버튼 자리 (2026-09-13 대표 신고).
 * 가드: src/tests/unit/urshorts-viewer-chrome.test.ts
 */
const TEST = 'src/tests/unit/urshorts-viewer-chrome.test.ts'
const V = 'src/pages/VideosPage.tsx'

export default [
  {
    name: '🖐️ 제스처 층이 세로 팬을 다시 브라우저에 넘긴다 (당겨서-새로고침이 이전 영상을 먹는다)',
    file: V,
    find: 'className="absolute inset-0 z-10 touch-none"',
    replace: 'className="absolute inset-0 z-10"',
    test: TEST,
    why:
      '이 화면은 스크롤이 없어서 맨 위에서 아래로 끄는 손짓이 당겨서-새로고침으로 잡힌다. ' +
      '그러면 touchcancel 만 오고 touchend 가 안 와서 go(-1) 이 영영 안 불린다 — ' +
      '대표가 실제로 신고한 "아래로는 넘겨지는데 위로는 다시 안됨" 이 이것이다.',
  },
  {
    name: '🖐️ 루트 오버스크롤 차단 제거 (touch-action 이 새는 브라우저에서 재발)',
    file: V,
    find: 'className="relative min-h-[100dvh] overflow-hidden overscroll-none bg-[#0A0C12]"',
    replace: 'className="relative min-h-[100dvh] overflow-hidden bg-[#0A0C12]"',
    test: TEST,
    why: '방어가 하나뿐이면 그 하나가 안 통하는 인앱 브라우저에서 같은 증상이 그대로 돌아온다.',
  },
  {
    name: '🖐️ 판정을 다시 뗄 때만 한다 (취소되면 아무 일도 안 일어난다)',
    file: V,
    find: '          if (Math.abs(dy) > 60) { swiped.current = true; go(dy < 0 ? 1 : -1) }',
    replace: '          if (Math.abs(dy) > 60) { swiped.current = true }',
    test: TEST,
    why: '브라우저가 손짓을 가져가면 touchend 가 안 온다 — 임계에서 판정해야 취소돼도 이미 넘어가 있다.',
  },
  {
    name: '🖐️ 한 손짓에 두 칸 넘어간다 (이동 판정 + 뗄 때 판정 중복)',
    file: V,
    find: '          if (swiped.current) { swiped.current = false; return }',
    replace: '          swiped.current = false',
    test: TEST,
    why: '이동 중에 이미 넘겼는데 뗄 때 또 넘기면 영상 하나를 건너뛴다 — 에러가 안 난다.',
  },
  {
    name: '🖐️ 취소된 손짓의 시작점을 안 지운다 (다음 터치가 옛 좌표로 잰다)',
    file: V,
    find: `        onTouchCancel={() => {
          // 브라우저가 제스처를 가져간 경우. 여기서 안 지우면 다음 터치가 옛 시작점으로 잰다.
          touchY.current = null`,
    replace: `        onTouchCancel={() => {
          const _keep = 1; void _keep`,
    test: TEST,
    why: '옛 시작점이 남으면 다음 탭이 거대한 dy 로 읽혀 엉뚱하게 영상이 넘어간다.',
  },
  {
    name: '❌ 닫기 버튼이 다시 유튜브 Shorts 로고 자리로 (스크린샷의 그 겹침)',
    file: V,
    find: 'className="absolute left-3 top-14 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"',
    replace: 'className="absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur"',
    test: TEST,
    why:
      '유튜브가 그리는 Shorts 로고와 정확히 같은 자리다(실측: 로고 y≈18~42, 우리 X y 12~48). ' +
      '덮어서 해결하는 것은 embed 약관 위반이라 우리 것을 비켜야 한다.',
  },
]
