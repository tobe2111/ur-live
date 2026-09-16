/**
 * 📏 세로 스택 버튼 높이 — 주입 매니페스트 (2026-09-16)
 *
 * 대표 신고 *"버튼 크기도 세로길이가 짧고, 버튼이 이게 뭐야"*. 세로 스택에서 `flex-1` 이
 * `h-[52px]` 를 이겨 버튼이 23~25px 로 찌그러졌다(PC 는 58~60px 정상). 되돌리면 빨간불이어야 한다.
 */
export default [
  {
    name: '📏 히어로 CTA 가 다시 세로로 찌그러진다',
    file: 'src/pages/partners/PartnerHero.tsx',
    find: `className="sm:flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand`,
    replace: `className="flex-1 h-[52px] lg:h-[58px] rounded-2xl bg-brand`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '이게 배포됐던 상태다. `flex-col` 안에서 주축은 높이라 `flex-basis: 0%` 가 `height` 를 이기고, ' +
      '컨테이너 높이가 auto 라 나눠 줄 여유가 0 이므로 버튼이 글자 높이까지 줄어든다. ' +
      '`sm:flex-row` 로 바뀌는 PC 에서는 멀쩡해서 **리뷰로는 안 보인다.**',
  },
  {
    name: '📏 마지막 CTA 가 다시 세로로 찌그러진다',
    file: 'src/pages/PartnersPage.tsx',
    find: `className="sm:flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand`,
    replace: `className="flex-1 h-[52px] lg:h-[60px] rounded-2xl bg-brand`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '같은 결함의 두 번째 자리. 랜딩에서 마지막으로 누르는 버튼이라 여기가 찌그러지면 ' +
      '"대충 만든 페이지" 로 읽힌다 — 대표가 실제로 그렇게 신고했다.',
  },
]
