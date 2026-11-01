/**
 * 🧬 2026-10-14 — sitemap 이 제출하는 법정 문서 둘(`/privacy`·`/refund`)의 크롤러 본문 주입.
 *
 * 근거·실측은 `src/tests/unit/legal-surface-body-2026-10-14.test.ts` 머리말.
 * **절반이 반대 방향**이다 — 이 수선은 "본문을 준다" 쪽이라 틀리면 ① 아무도 못 보는 영문 글을
 * 크롤러에게 주거나(클로킹) ② 그냥 noindex 로 가려 법정 문서가 검색에서 사라진다. 둘 다 잠근다.
 */
const SSOT = 'src/shared/seo/surface-copy.ts'
const META = 'src/shared/seo/consumer-surface-table.ts' // 🗂️ 2026-11-01 표 분리(불변식 불변 — 대상 파일만 옮겨갔다)
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const TEST = 'src/tests/unit/legal-surface-body-2026-10-14.test.ts'
const REFUND_TEST = 'src/tests/unit/refund-policy-truth-2026-10-13.test.ts'
const THIN_TEST = 'src/tests/unit/thin-surface-copy-2026-10-12.test.ts'

export default [
  {
    name: '⚖️ /privacy 줄을 영문 절에서 고른다 — 라이브에선 아무도 못 본다',
    file: SSOT,
    find: "      '회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.',",
    replace: "      'We retain personal data for as long as your account is active.',",
    test: TEST,
    why:
      '그 페이지는 `isKorea()` 로 갈리고 라이브 호스트는 `urdeal.kr` 뿐이라 영문 절은 **렌더되지 ' +
      '않는다**. 클로킹 가드는 *같은 파일 안*이면 통과시키므로 이 방향은 빨간불이 안 난다 — ' +
      '아무도 못 보는 글을 크롤러에게 선언하는 셈이고 그게 클로킹이다.',
  },
  {
    name: '⚖️ 평탄화 부스러기가 섞인 줄을 넣는다 (`전액 이`)',
    file: SSOT,
    find: "      '회사는 매일 한 번 만료된 이용권을 확인해 환불하고, 처리되면 알림으로 알려드립니다.',",
    replace: "      '따로 신청하지 않아도 결제 금액 전액 이 자동으로 환불됩니다.',",
    test: TEST,
    why:
      '인라인 `<span>` 을 가로지른 문장을 평탄화된 모양 그대로 붙이면 **클로킹 가드는 통과한다** ' +
      '(소스에 그 모양으로 실재하므로). 사람이 읽을 수 없는 글이 크롤러에게 나간다.',
  },
  {
    name: '⚖️ 부스러기 검사를 never-match 로 (헛도는 가드)',
    file: TEST,
    find: '  const STRAY = / (이|은|는|을|를|가|도|의|에|로) /',
    replace: '  const STRAY = /\\u0000NEVER/',
    test: TEST,
    why:
      '정규식 하나를 느슨하게 만들면 그 검사가 **조용히 아무것도 안 지킨다**. 같은 describe 의 ' +
      '"검사가 실제로 발화한다" 가 그 방향을 잡아야 한다.',
  },
  {
    name: '⚖️ /privacy 본문을 통째로 지운다 — 6자로 되돌아간다',
    file: SSOT,
    find: "    source: ['src/pages/PrivacyPolicyPage.tsx'],",
    replace: "    source: [],",
    // 🩸 2026-10-14 재조준 — 처음 `test:` 를 이 PR 의 새 시험으로 뒀더니 **통과**했다(그 시험은
    //   페이지를 상수로 직접 읽어 `source` 를 안 본다). 클로킹 대조는 thin 시험에 있다.
    //   ⇒ 주입은 **그 결함을 실제로 보는 시험**을 가리켜야 한다. 결함은 한 글자도 안 바꿨다.
    test: THIN_TEST,
    why:
      '`source` 가 가리키는 파일이 사라지면 클로킹 대조가 **그 표면을 검사할 수 없다** — ' +
      '길이 바닥만 남아 "화면에 있는 말" 보장이 통째로 빠진다.',
  },
  {
    name: '⚖️ sitemap 에서 /refund 제출을 뺀다 — 짝 주장의 반쪽',
    file: SITEMAP,
    find: "    { loc: '/refund', priority: 0.3, changefreq: 'yearly' },",
    replace: '',
    test: TEST,
    why:
      '본문을 갖춘 법정 문서를 제출에서 빼면 사람이 검색으로 못 찾는다. 푸터 링크와 `/refund-policy` ' +
      '301 이 그 페이지를 가리키는데 색인 요청만 사라지는 비대칭이 된다.',
  },
  {
    name: '⚖️ 반대 방향 — /privacy 를 noindex 로 가린다',
    file: META,
    find: "  '/privacy': {\n    crumb: '개인정보처리방침',",
    replace: "  '/privacy': {\n    noindex: true,\n    crumb: '개인정보처리방침',",
    test: TEST,
    why:
      '**이 방향이 훨씬 비싸다** — thin 을 "가리는" 쪽으로 수선하면 법정 문서가 검색에서 사라지고 ' +
      '색인 복구는 수주다. 본문을 주는 것이 수선이고 noindex 는 수선이 아니다.',
  },
  {
    name: '⚖️ 반대 방향 — /refund 의 crumb 을 지운다 (h1 이 사라진다)',
    file: META,
    find: "  '/refund': {\n    crumb: '환불정책',",
    replace: "  '/refund': {\n",
    test: TEST,
    why:
      '빌더는 `crumb` 으로 h1 을 낸다 — 비면 **제목 요소가 0** 인 문서가 된다(2026-10-13 에 색인 ' +
      '대상 17표면에서 그걸 고쳤다). 빵부스러기도 함께 끊긴다.',
  },
  {
    name: '⚖️ description 을 동어반복으로 되돌린다',
    file: META,
    find: "    description: '유어딜이 수집하는 개인정보 항목과 처리 목적, 보유 기간, 제3자 제공과 위탁, 정보주체의 권리와 파기 절차를 안내합니다.',",
    replace: "    description: '유어딜 개인정보처리방침입니다.',",
    test: TEST,
    why:
      '검색결과 스니펫 자리에 제목을 한 번 더 쓰는 것이다 — 라이브 실측 14자였고 형제 `/terms` 는 ' +
      '내용을 말하는 76자였다.',
  },
  {
    name: '⚖️ /refund description 이 꺼져 있는 기능을 약속한다',
    file: META,
    find: "    description: '쓰지 않은 이용권은 유효기간이 지나면 결제 금액 전액이 자동으로 환불됩니다. 딜 환급, 배송 상품 교환과 반품, 환불 소요기간까지 안내합니다.',",
    replace: "    description: '쓰지 않은 이용권은 장 단위 일부 환불도 가능합니다. 딜 환급, 배송 상품 교환과 반품을 안내합니다.',",
    test: REFUND_TEST,
    why:
      '`voucher_partial_refund_enabled` 는 **기본 OFF** 다(staging P17 전제). 할 수 없는 것을 ' +
      '검색 스니펫에서 약속하면 2026-10-12 결재가 고치려던 그 결함 — 문서 둘이 다른 환불 규칙을 ' +
      '말하는 상태 — 이 다시 생긴다.',
  },
  {
    name: '⚖️ /refund 크롤러 본문에서 만료 자동환불 문장을 뺀다',
    file: SSOT,
    find: "      '유효기간 안에 쓰지 않은 이용권',\n      '회사는 매일 한 번 만료된 이용권을 확인해 환불하고, 처리되면 알림으로 알려드립니다.',",
    replace: "      '배송 상품 교환 및 반품',",
    test: REFUND_TEST,
    why:
      '그 페이지의 **핵심 규칙**이다(쓰지 않았으면 전액). 본문에서 빠지면 크롤러·AI 검색이 ' +
      '"유어딜 환불" 질의에 인용할 문장을 잃고, 구매 버튼의 *"미사용 시 100% 자동환불"* 과 ' +
      '크롤러가 보는 문서가 서로 다른 말을 한다.',
  },
  {
    name: '⚖️ /privacy 본문을 한 줄로 줄인다 (길이 바닥이 잡는다)',
    file: SSOT,
    // 🩸 2026-10-14 — 처음엔 *바닥 숫자를 내리는* 주입이었는데 **통과했다.** 당연하다:
    //   단언을 느슨하게 만드는 변경은 그 단언으로 잡을 수 없다(CLAUDE.md 가 적어 둔
    //   "래칫은 스스로 헐거워지는 걸 못 막는다"). ⇒ 바닥이 **지키는 결함**으로 바꿨다.
    //   숫자를 내리는 PR 은 가드가 아니라 리뷰가 막는다(그 표 주석이 그렇게 적어 뒀다).
    find: "      '처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.',\n      '회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.',",
    replace: "      '처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.',",
    test: THIN_TEST,
    why:
      '한 줄만 빠져도 바닥(470자)이 잡는다 — 전역 하한만 있던 첫 설계는 **205자에서 19자를 ' +
      '지워도 통과**했고 그래서 표면별 래칫이 생겼다.',
  },
  {
    name: '⚖️ 반대 방향 — "삼키지 않는다" 예시를 표에 든 표면으로 되돌린다',
    file: THIN_TEST,
    find: "    for (const p of ['/cart', '/wishlist', '/pass/2919', '/u/jiwon1228', '/notifications']) {",
    replace: "    for (const p of ['/privacy', '/refund', '/pass/2919', '/u/jiwon1228', '/notifications']) {",
    test: THIN_TEST,
    why:
      '표에 들어온 표면을 "표에 없는" 예시로 쓰면 그 단언이 **항상 빨간불**이 된다 — 다음 세션이 ' +
      '단언을 지우는 쪽으로 몰린다. 예시가 낡았으면 불변식이 아니라 **예시를 갈아야** 한다.',
  },
]
