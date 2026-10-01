/**
 * 🧨 2026-10-01 — "셀러 공용 chrome 의 탭 타깃" 의 되돌려-검증.
 *
 * 되돌리려는 사고가 **둘**이다:
 *   ① 작은 타깃이 돌아오는 것(24×24 닫기 — 일곱 화면 전부)
 *   ② **고치려다 배너를 두껍게 만드는 것** — 박스째 키우면 글자 칸이 좁아져 109 → 148px(+39px).
 *      ②는 내가 실제로 한 실수이고, 측정 도구가 `::after` 를 못 봐서 "아직 안 고쳐졌다" 고
 *      보고하는 동안 **다음 세션이 또 그 길로 가게** 되어 있었다.
 * 둘 다 **조용한** 실패다 — 빌드도 화면도 안 깨진다.
 */
const TEST = 'src/tests/unit/seller-chrome-tap-reach-2026-10-01.test.ts'

export default [
  {
    name: '👆 공용 배너 닫기의 넓힌 히트 영역을 떼어낸다 (24×24 로 복귀)',
    why: '이 배너는 셀러 일곱 화면 전부에 뜬다 — 한 자리가 일곱 화면의 누름을 좌우한다.',
    file: 'src/components/SellerKakaoLinkBanner.tsx',
    find: 'className="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors tap-reach"',
    replace: 'className="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"',
    test: TEST,
  },
  {
    name: '👆 배너 CTA 를 박스째 키운다 (내가 실제로 한 실수 — 배너 +39px)',
    why: 'ur-btn-md 는 높이 40 에 좌우 패딩 18px 라 같은 행의 글자 칸이 197 → 167px 로 좁아진다. 설명이 한 줄 더 감겨 배너가 두꺼워지고, 그게 일곱 화면에 쌓인다.',
    file: 'src/components/SellerKakaoLinkBanner.tsx',
    find: 'className="ur-btn ur-btn-sm ur-btn-primary shrink-0 tap-reach"',
    replace: 'className="ur-btn ur-btn-md ur-btn-primary shrink-0"',
    test: TEST,
  },
  {
    name: '👆 tap-reach 가 폭까지 40px 로 고정된다 (옆 버튼을 삼킨다)',
    why: 'max(100%, …) 가 아니면 넓은 버튼의 히트 영역이 40px 로 **줄어든다**. 그리고 좁은 이웃끼리 겹치면 엉뚱한 버튼이 눌린다.',
    file: 'src/index.css',
    find: '  width: max(100%, 2.5rem);\n  height: max(100%, 2.5rem);',
    replace: '  width: 2.5rem;\n  height: max(100%, 2.5rem);',
    test: TEST,
  },
  {
    name: '👆 넓힌 히트 영역이 포인터를 안 받는다 (닿지 않는 40px)',
    why: '"장식용 의사요소" 로 보여 누군가 pointer-events: none 을 넣으면, 클래스는 그대로인데 **닿는 범위가 통째로 사라진다**. 측정 도구의 히트 테스트가 이 모양을 🔴 로 잡는 것을 확인했다.',
    file: 'src/index.css',
    find: '  width: max(100%, 2.5rem);\n  height: max(100%, 2.5rem);\n}',
    replace: '  width: max(100%, 2.5rem);\n  height: max(100%, 2.5rem);\n  pointer-events: none;\n}',
    test: TEST,
  },
  {
    name: '👆 셀러 헤더가 고정 높이를 잃는다 (40px 버튼의 전제 붕괴)',
    why: '헤더 버튼을 박스째 키워도 됐던 이유는 헤더가 h-14(56px) 고정이기 때문이다. 그 전제가 바뀌면 처방도 바뀌어야 한다.',
    file: 'src/components/SellerLayout.tsx',
    find: '<header className="flex h-14 md:h-12 flex-shrink-0',
    replace: '<header className="flex h-11 md:h-12 flex-shrink-0',
    test: TEST,
  },
  {
    name: '👆 알림 벨이 36px 로 되돌아간다',
    why: '벨은 셀러·어드민·에이전시 대시보드가 **같은 부품**을 쓴다 — 한 줄이 세 서비스의 헤더를 좌우한다.',
    file: 'src/components/DashboardNotificationBell.tsx',
    find: 'className={`relative p-2.5 rounded-lg transition-colors',
    replace: 'className={`relative p-2 rounded-lg transition-colors',
    test: TEST,
  },
  {
    name: '📏 측정 도구가 히트 테스트를 잃는다 (클래스만 보고 "고쳐졌다")',
    why: 'tap-reach 가 붙었는지만 보면 조상 overflow:hidden 에 잘린 경우를 놓친다 — 넓혔다고 적어 두고 실제로는 안 닿는 상태가 된다.',
    file: 'scripts/visual-preview.mjs',
    find: '        const hit = document.elementFromPoint(x, y)',
    replace: '        const hit = el',
    test: TEST,
  },
  {
    name: '📏 안 닿는 히트 영역이 판정에서 빠진다 (빨간불이 안 뜬다)',
    why: '세어만 놓고 판정(bad)에 안 넣으면 🟢 가 뜬다 — 이 레포가 반복해 당한 "검사가 실패할 수 없음" 이다.',
    file: 'scripts/visual-preview.mjs',
    find: ' || audit.reachDead > 0',
    replace: '',
    test: TEST,
  },
  /**
   * 🧨 같은 날 **시드 기제를 합치면서** 드러난 두 실패 모드.
   *   (파일을 따로 두지 않는다 — 합친 커밋이 이 커밋이라 되돌림도 여기서 본다.)
   */
  
  {
    name: '📦 협업 코드 봉투가 최상위로 새어 나간다 (화면은 "아직 코드가 없어요")',
    why: '서버 코드만 보면 codes: 가 최상위처럼 읽히지만 success() 가 한 겹 더 감싼다. 틀려도 404 도 에러도 안 난다 — 빈 화면이 조용히 측정된다.',
    file: 'scripts/preview-seeds/seller-lists.mjs',
    find: "'/api/seller-marketing/codes': () => ({ success: true, data: empty ? { codes: [], influencer_pct_cap: SELLER_MKT_CODES.influencer_pct_cap } : SELLER_MKT_CODES })",
    replace: "'/api/seller-marketing/codes': () => ({ success: true, ...(empty ? { codes: [] } : SELLER_MKT_CODES) })",
    test: 'src/tests/unit/seller-list-fixtures-2026-10-01.test.ts',
  },
  {
    name: '🗓️ 일별 매출 시드가 고정 날짜로 돌아간다 (달이 넘어가면 이번 달 ₩0)',
    why: '화면은 이번 달 키만 더한다. 지난달로 박히면 시드는 멀쩡해 보이는데 숫자만 0 이라 "판매 0" 으로 오판한다 — 2026-10-01 에 실제로 겪었다.',
    file: 'scripts/preview-seeds/seller-lists.mjs',
    find: '  daily_revenue: DAILY.map((revenue, i) => ({ date: kstDayKey(DAILY.length - 1 - i), revenue })),',
    replace: "  daily_revenue: DAILY.map((revenue, i) => ({ date: `2026-09-${String(24 + i).padStart(2, '0')}`, revenue })),",
    test: 'src/tests/unit/seller-list-fixtures-2026-10-01.test.ts',
  },
]
