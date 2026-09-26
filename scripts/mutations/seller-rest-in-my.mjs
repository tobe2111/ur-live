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
  {
    name: '🔴 마이에서 알림톡을 보낸다 (회수 불가 · 등급 C 우회)',
    file: MESSAGES,
    find: "      api.get('/api/seller/alimtalk/logs').catch(() => null),",
    replace: "      api.get('/api/seller/alimtalk/logs').catch(() => null),\n      api.post('/api/seller/alimtalk/send', {}).catch(() => null),",
    test: TEST,
    why:
      '발송은 등급 C 다. 그리고 실수의 대가가 비대칭이다 — 안 보낸 건 나중에 보내면 되지만 ' +
      '잘못 보낸 문자는 회수가 안 된다. 시트가 조회 전용임을 엔드포인트 이름으로 고정한다.',
  },
  {
    name: '💳 마이가 두 번째 결제 입구를 만든다 (알림톡 충전)',
    file: MESSAGES,
    find: "      api.get('/api/seller/alimtalk/credits').catch(() => null),",
    replace: "      api.post('/api/seller/alimtalk/credits/charge', {}).catch(() => null),",
    test: TEST,
    why: '결제 흐름이 두 벌이 되면 한쪽만 고쳐지는 날이 온다(Toss 잠금 경로라 더 위험하다).',
  },
  {
    name: '0️⃣ 잔액을 모를 때 0 으로 덮는다 ("0건" 이 거짓말이 된다)',
    file: MESSAGES,
    find: '  const [balance, setBalance] = useState<number | null>(null)',
    replace: '  const [balance, setBalance] = useState<number>(0)',
    test: TEST,
    why: '모르는 것과 0건은 다르다. 로딩 중에도 "남은 건수 0" 이 참말처럼 보이면 사장님이 헛충전한다.',
  },
  {
    name: '🤝 콘텐츠 인증이 걸린 제안도 시트에서 수락된다 (서버가 404 를 준다)',
    file: PARTNERS,
    find: "  if (Number(d.requires_content_proof ?? 0) === 1) {",
    replace: "  if (false) {",
    test: TEST,
    why:
      '서버 WHERE 에 `COALESCE(requires_content_proof,0)=0` 이 있다. 화면이 느슨하면 버튼은 뜨는데 ' +
      '눌러도 404 고, 사장님은 왜 안 되는지 모른 채 같은 버튼을 반복해 누른다.',
  },
  {
    name: '🤝 내가 보낸 제안에 내가 답한다 (서버 조건과 어긋남)',
    file: PARTNERS,
    find: "  if (String(d.proposed_by ?? '') !== 'influencer') return { can: false, why: '내가 보낸 제안이라 상대의 답을 기다려요' }",
    replace: "  if (false) return { can: false, why: '내가 보낸 제안이라 상대의 답을 기다려요' }",
    test: TEST,
    why: '서버는 `proposed_by = influencer` 일 때만 받는다. 자기 제안을 자기가 수락하는 길을 화면이 열면 안 된다.',
  },
  {
    name: '🪑 협업 수락이 좌석 확인 없이 나간다 (남의 가게 계약)',
    file: PARTNERS,
    find: '      assertSeat(sellerId)',
    replace: '      void sellerId',
    test: TEST,
    why: '화면엔 A 가 떠 있는데 토큰이 B 면 B 의 가게에 소개비 약속이 발효된다 — 돈이 걸린 계약이다.',
  },
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
    find: "          <p className=\"text-[14px] font-bold text-gray-900 dark:text-white\">아직 정산 내역이 없어요</p>",
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
    name: '🗑️ 숙소 시트를 지워 버린다 (접는 게 아니라 되돌릴 수 없게)',
    file: 'src/pages/user-profile/seller-section/VoucherSheet.tsx',
    find: '        <StaysSheet',
    replace: '        <div hidden',
    test: TEST,
    why: '플래그로 접는 것의 전제는 "false 로 하면 돌아온다" 이다. 렌더가 사라지면 복구가 코드 작성이 된다.',
  },
  {
    name: '🔌 파트너 시트를 import 만 하고 렌더는 안 한다 (조용한 부재)',
    file: SECTION,
    find: "      {tool === 'partners' && (\n        <PartnersSheet",
    replace: "      {false && (\n        <PartnersSheet",
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
    name: '🧭 "전체 도구" 힌트가 없어진 메뉴를 계속 광고한다',
    file: SECTION,
    find: '          전체 도구 · 사업자등록증 · 운영자 위임 · 운영 가이드',
    replace: '          전체 도구 · 쿠폰 · 알림톡 · 소개 파트너 · 숙소',
    test: TEST,
    why: '문구가 실제 목록과 어긋나면 사장님이 없는 메뉴를 찾아 헤맨다(쿠폰·숙소는 내려갔다).',
  },
]
