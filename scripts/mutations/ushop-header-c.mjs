/**
 * 🔵 유어샵 헤더 공유·관리 버튼 — 안 C(위계) 주입 매니페스트.
 *   대표 *"여기 관리, 공유 버튼이 촌스럽네.."* → 시안 셋 중 **C 확정**(2026-10-07).
 * 가드: src/tests/unit/ushop-sns-mono-2026-09-16.test.ts · ushop-a3-p1.test.ts
 */
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const SNS = 'src/tests/unit/ushop-sns-mono-2026-09-16.test.ts'
const A3 = 'src/tests/unit/ushop-a3-p1.test.ts'

export default [
  {
    name: '🔵 공유가 다시 테두리 친 알약이 된다 (한 줄에 모양 두 종류)',
    file: HEADER,
    find: "              className={iconBtnCls}\n              aria-label={t('curator.share'",
    replace:
      "              className=\"h-[31px] px-2 rounded-lg border border-rule-strong bg-surface text-[12px] font-semibold text-gray-600 inline-flex items-center gap-2 shrink-0\"\n" +
      "              aria-label={t('curator.share'",
    test: SNS,
    why:
      '대표가 "촌스럽다" 고 지적한 바로 그 모양이다 — 36px 민 원 옆에 31px 테두리 알약이 서서 ' +
      '한 줄에 **모양 2종 · 높이 2종**이 된다. 에러가 안 나고 화면도 안 깨져서, 되돌아가도 ' +
      '아무도 신고하지 않는다.',
  },
  {
    name: '🔵 SNS 세 링크가 상수 대신 손으로 적은 치수로 돌아간다',
    file: HEADER,
    find: "aria-label=\"Instagram\" className={iconBtnCls}>",
    replace:
      'aria-label="Instagram" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-wash active:opacity-70 transition-colors">',
    test: SNS,
    why:
      '문자열을 다시 적는 순간 셋이 갈릴 수 있게 된다 — 2026-09-16 이 "글자 하나까지 같아야 ' +
      '한 줄로 읽힌다" 고 고정했던 그 성질이 상수 한 벌로 **구조가 된** 것이고, 손으로 적으면 ' +
      '그 구조가 사라진다(한 줄만 고쳐도 당장은 똑같아 보인다).',
  },
  {
    name: '🔵 관리 버튼에서 채운 면을 뺀다 (주인 전용 자리가 공유와 같은 무게로)',
    file: HEADER,
    find: "const manageBtnCls = 'h-9 px-3 rounded-full bg-brand text-white",
    replace: "const manageBtnCls = 'h-9 px-3 rounded-full border border-rule-strong text-gray-600",
    test: A3,
    why:
      '안 C 의 전부다 — c2 가 *"주인/방문자 차이는 버튼 한 자리"* 라고 정한 그 자리가 ' +
      '**눈으로 한 자리가 아니게** 된다. 390px 렌더에서 `관리` 와 `공유` 가 같은 무게로 서던 ' +
      '2026-09-28 상태로 그대로 되돌아간다.',
  },
  {
    name: '🔵 헤더의 다른 자리에 색 면이 하나 더 생긴다',
    file: HEADER,
    find: '<div className="lg:hidden flex items-center px-4 pt-3">',
    replace: '<div className="lg:hidden flex items-center px-4 pt-3 bg-brand">',
    test: A3,
    why:
      '🎫 규칙 ②(강조색 하나)를 어긴다. 헤더의 유일한 색 면이 **주인 전용 자리**라는 것이 ' +
      'c2 의 의도를 지탱하는데, 면이 둘이 되면 그 신호가 즉시 무의미해진다.',
  },
  {
    name: '🔵 관리 버튼이 상수를 안 쓰고 자기 클래스를 적는다',
    file: HEADER,
    find: '<Link to="/u/me/manage" className={manageBtnCls}>',
    replace:
      '<Link to="/u/me/manage" className="h-9 px-3 rounded-full bg-brand text-white text-[15px] font-bold inline-flex items-center gap-1 shrink-0 active:opacity-70">',
    test: A3,
    why:
      '지금은 "채운 면 = `bg-brand` 1회 = 관리 버튼 상수" 가 한 줄로 이어져 있어, 색 면이 어디 ' +
      '하나 더 생기면 세어서 잡힌다. 손으로 적으면 그 세기가 헐거워진다(겉보기는 동일하다).',
  },
  {
    name: '🔵 터치 영역이 36px 아래로 줄어든다',
    file: HEADER,
    find: "const iconBtnCls = 'w-9 h-9",
    replace: "const iconBtnCls = 'w-8 h-8",
    test: SNS,
    why:
      '2026-09-16 이 타일을 없애면서 **터치 영역은 오히려 키웠다**(34px → 36px). 32px 는 ' +
      '손가락으로 누르기 시작하는 경계 아래라 접근성 회귀인데, 화면으로는 "조금 작아졌다" 로만 보인다.',
  },
]
