/**
 * 🧩 마이에 남은 셋 + 안 쓰는 메뉴 정리 (2026-09-26) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-rest-in-my-2026-09-26.test.ts
 */
const TEST = 'src/tests/unit/seller-rest-in-my-2026-09-26.test.ts'
const MESSAGES = 'src/pages/user-profile/seller-section/MessagesSheet.tsx'
const PARTNERS = 'src/pages/user-profile/seller-section/PartnersSheet.tsx'
const SETTLE = 'src/pages/user-profile/seller-section/SettlementsSheet.tsx'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const GROUPS = 'src/components/seller/seller-tab-groups.ts'
const NAV = 'src/components/seller/seller-nav.ts'

export default [
  // 🧹 **2026-10-01 철거 — 주입 6건을 내렸다.** 대상 파일이 사라졌다
  //   (손수 시트는 대시보드 화면의 폰용 **사본**이었고, 사본을 지웠다). 앵커 없는 주입은
  //   아무것도 검증하지 않으므로 함께 내린다 — 가드 쪽 머리주석에 *"원본에도 그 성질이 있나"* 를
  //   대조한 표가 있다. 되돌리려면 revert 한 번이고, 그러면 이 주입들도 함께 돌아온다.
  //   − 🔴 마이에서 알림톡을 보낸다 (회수 불가 · 등급 C 우회)
  //   − 💳 마이가 두 번째 결제 입구를 만든다 (알림톡 충전)
  //   − 0️⃣ 잔액을 모를 때 0 으로 덮는다 ("0건" 이 거짓말이 된다)
  //   − 🤝 콘텐츠 인증이 걸린 제안도 시트에서 수락된다 (서버가 404 를 준다)
  //   − 🤝 내가 보낸 제안에 내가 답한다 (서버 조건과 어긋남)
  //   − 🪑 협업 수락이 좌석 확인 없이 나간다 (남의 가게 계약)
  {
    name: '🧾 정산 금액을 화면이 다시 계산한다 (대시보드와 숫자가 갈린다)',
    file: SETTLE,
    find: '                    {formatNumber(r.settlement_amount)}',
    replace: '                    {formatNumber((r.total_sales ?? 0) - (r.commission_amount ?? 0))}',
    test: TEST,
    why:
      '서버가 계산한 값 대신 화면이 빼면, 반올림·차감 항목 하나만 달라져도 마이와 대시보드가 ' +
      '다른 금액을 말한다. 이 레포가 반복해 당한 클래스다.',
  },
  {
    name: '🧾 지난 정산이 0건과 실패를 같은 말로 뭉갠다',
    file: SETTLE,
    find: "          <p className=\"text-[15px] font-bold text-gray-900 dark:text-white\">아직 정산 내역이 없어요</p>",
    replace: "          <p className=\"text-[14px] font-bold text-gray-900 dark:text-white\">목록</p>",
    test: TEST,
    why: '못 불러온 것을 "내역 없음" 으로 그리면 돈이 사라진 것처럼 보인다(머니 표면 룰).',
  },
  {
    name: '🛏️ 숙소를 사이드바에서만 내린다 (표면이 갈린다)',
    file: NAV,
    find: "      ...(SELLER_DORMANT_HIDDEN ? [] : [navFromGroup('/seller/stays')]),",
    replace: "      navFromGroup('/seller/stays'),",
    test: TEST,
    why:
      '대시보드·마이가 같은 플래그를 봐야 한 번에 접히고 한 번에 돌아온다. 한쪽만 내리면 ' +
      '"어디선 보이고 어디선 안 보이는" 상태가 되고, 되돌릴 때 한 곳을 반드시 잊는다.',
  },
  {
    name: '🔴 리뷰까지 같이 내린다 (근거 없이 — 셀러 상품이 1개라 0인 것뿐)',
    file: GROUPS,
    find: "      { path: '/seller/reviews', labelKey: 'seller.nav.reviews', fallback: '리뷰' },",
    replace: "      ...(SELLER_DORMANT_HIDDEN ? [] : [{ path: '/seller/reviews', labelKey: 'seller.nav.reviews', fallback: '리뷰' }]),",
    test: TEST,
    why:
      '같은 0이라도 뜻이 다르다 — 숙소는 *입구*가 0이고 리뷰는 *셀러 상품이 아직 1개*라 0이다. ' +
      '상품이 늘면 리뷰는 저절로 붙는다. 정리한다고 이것까지 쓸어 담으면 곧 기능이 없어서 못 쓴다.',
  },
  {
    name: '🔌 파트너 시트를 import 만 하고 렌더는 안 한다 (조용한 부재)',
    file: SECTION,
    // 🔁 2026-10-01 철거 재조준: `PartnersSheet` 가 내려갔다 → 남은 시트(정산)로 앵커 교체.
    //   불변식 동일: **import 만 있고 렌더가 없으면 죽은 코드다**(조용한 부재).
    find: "      {tool === 'settlements' && <SettlementsSheet",
    replace: "      {false && <SettlementsSheet",
    test: TEST,
    why:
      'import 만 보는 검사는 렌더를 지워도 초록이다 — 이 레포가 반복해 당한 클래스라 JSX 로 앵커한다. ' +
      '줄은 보이는데 눌러도 아무 일이 안 일어난다.',
  },
  {
    name: '🧭 내린 메뉴를 하단 탭 매핑에서도 지운다 (직링크로 오면 위치를 잃는다)',
    file: 'src/components/seller/seller-primary-nav.ts',
    find: "'/seller/scan', '/seller/review-verifications'],",
    replace: "'/seller/scan'],",
    test: 'src/tests/unit/voucher-nav-reachability-2026-09-03.test.ts',
    why:
      '접은 것이지 지운 게 아니다 — 직링크·검색으로는 여전히 닿는다. 그때 하단 탭이 안 켜지면 ' +
      '"내가 셀러 어디에 있는지" 를 알 수 없다(숙소가 원래 이 방식으로 지켜지고 있었다).',
  },
  {
    // 🔁 2026-09-26 재조준: 예시 나열 자체를 그만뒀다(두 번 어긋났고 두 번 다 손으로 고쳤다).
    //   지키는 것은 더 강해졌다 — **여기에 메뉴 이름을 적지 않는다.** 적으면 반드시 낡는다.
    name: '🧭 "전체 도구" 줄이 다시 메뉴 이름을 나열한다 (반드시 낡는다)',
    file: SECTION,
    // 🔁 2026-09-26 3차 재조준: 구조 시안 A 로 그 줄이 회색 글씨 → `ToolRow` 의 hint 로 옮겨갔다.
    //   지키는 불변식은 그대로다 — **여기에 메뉴 이름을 적지 않는다.**
    find: '          hint="찾아서 바로 열기"',
    replace: '          hint="쿠폰 · 알림톡 · 소개 파트너 · 숙소"',
    test: TEST,
    why:
      '문구가 실제 목록과 어긋나면 사장님이 없는 메뉴를 찾아 헤맨다(쿠폰·숙소는 내려갔다). ' +
      '그리고 여기서 정확한 목록을 세려면 나브 색인을 정적으로 읽어야 하는데, 그 순간 청크가 딸려 온다 — ' +
      '"정확한 예시"와 "가벼운 마이"는 같이 못 가진다.',
  },
]
