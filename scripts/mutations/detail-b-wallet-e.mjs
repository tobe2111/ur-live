/**
 * 🧬 주입 — 이용권 상세 "안 B" · 지갑 "안 E" (대표 확정 2026-09-15)
 *
 * 여기서 지키는 것들은 전부 **에러 없이 조용히 되돌아간다**. 고정 문구가 되살아나도,
 * 빨강이 다시 갈려도, 지갑이 도로 전부 펼쳐져도 빌드는 초록이고 화면은 멀쩡히 그려진다.
 * 특히 ①은 디자인이 아니라 **사실 오류**다 — 단일 매장 이용권에 "전 지점 사용"이 나가면 분쟁이다.
 */
const TEST = 'src/tests/unit/detail-b-wallet-e-2026-09-15.test.ts'
const GB = 'src/pages/GroupBuyDetailPage.tsx'

export default [
  {
    name: '[상세B지갑E] 🎟️상세에 고정 안내 3줄이 되살아난다',
    file: GB,
    find: `          <UsageGuide voucherExpiry={detail.voucher_expiry} voucherTerms={detail.voucher_terms} />`,
    replace: `          <div>{['즉시 교환권 발급', '전 지점 사용', '결제 즉시 사용'].map((l) => <span key={l}>{l}</span>)}</div>`,
    test: TEST,
    why:
      '라이브 2888(홍대돈까스·전주 단일 매장)에 "전 지점 사용"이 그대로 나가고 있었다. ' +
      '손님이 다른 지점에서 못 쓰면 분쟁이고, 에러가 안 나서 아무도 신고하지 않는다.',
  },
  {
    name: '[상세B지갑E] 🎟️이용 안내가 두 번 렌더된다',
    file: GB,
    find: `        {/* 대표 메뉴 — 백엔드 menu`,
    replace: `        <UsageGuide voucherExpiry={detail.voucher_expiry} voucherTerms={detail.voucher_terms} />
        {/* 대표 메뉴 — 백엔드 menu`,
    test: TEST,
    why:
      '안 B 는 스펙표를 **위로 올리고 아래 것을 지우는** 한 쌍이다. 한쪽만 되돌리면 ' +
      '같은 표가 한 페이지에 두 번 뜨는데, 둘 다 정상 렌더라 눈으로도 놓치기 쉽다.',
  },
  {
    name: '[상세B지갑E] 💸하단 결제 바가 할인액을 다시 말한다',
    // 🔀 2026-09-15 머지: main 이 하단 바를 부품으로 분리했다 — 앵커가 그 파일로 옮겨진다.
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: `      {minReviewLevel && minReviewLevel > 1 ? (`,
    replace: `      <span>{formatNumber(total)}원 할인 중</span>
      {minReviewLevel && minReviewLevel > 1 ? (`,
    test: TEST,
    why:
      '같은 할인을 한 화면에서 세 번 말하던 그 세 번째다(위에 정가 취소선 + 할인율이 이미 있다). ' +
      '중복은 버그처럼 보이지 않아 되돌아오기 쉽다.',
  },
  {
    name: '[상세B지갑E] 🏷️상세 할인율이 다시 전용 빨강으로 갈린다',
    file: GB,
    find: `color: 'var(--sale)', letterSpacing: '-.02em' }}>{displayDiscountPct}%`,
    replace: `color: 'var(--gbd-danger)', letterSpacing: '-.02em' }}>{displayDiscountPct}%`,
    test: TEST,
    why:
      '2026-09-07 대표가 할인율 색을 `--sale` 로 확정했는데 상세만 빠져 있었다. ' +
      '되돌아가면 **같은 상품이 목록과 상세에서 다른 빨강**이 된다 — 아무도 에러로 알아채지 못한다.',
  },
  {
    name: '[상세B지갑E] 🩶섹션 사이 회색 띠가 되살아난다',
    file: GB,
    // ⚠️ 하이라인은 네 곳이라 **뒤따르는 코드**로 유일하게 만든다(주석은 검사기가 먼저 걷어낸다).
    find: `            <div aria-hidden style={{ height: 1, margin: '0 18px', background: 'var(--gbd-line)' }} />
            <StoreLocation`,
    replace: `            <div style={{ height: 8, background: 'var(--gbd-bg)' }} />
            <StoreLocation`,
    test: TEST,
    why:
      '표면 규칙은 "표면 두 톤"인데 띠 자체가 세 번째 톤이라 층이 계속 끊겼다. ' +
      '한 줄짜리 되돌림이라 다음 세션이 "여백이 허전하다" 며 쉽게 복원한다.',
  },
  {
    name: '[상세B지갑E] 📍매장 위치 카드에 테두리가 되살아난다',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: `      <div style={{ borderRadius: 14, overflow: 'hidden' }}>
        {map}`,
    replace: `      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--gbd-line2)' }}>
        {map}`,
    test: TEST,
    why: '표면 규칙 ① "카드 테두리 0, 화이트만 들림 한 값". 테두리는 어디서든 조용히 되돌아온다.',
  },
  {
    name: '[상세B지갑E] ☎️매장 전화 버튼이 사라진다',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: '        {phone && (\n          <a href={`tel:${phone}`}',
    replace: '        {false && (\n          <a href={`tel:x${phone}`}',
    test: TEST,
    why:
      '전화번호를 제목 밑 주소 줄에서 뺀 짝이 이 버튼이다. 버튼만 사라지면 ' +
      '**번호가 화면 어디에도 없어진다** — 지우는 쪽은 에러가 안 난다.',
  },
  {
    name: '[상세B지갑E] 🎫지갑이 다시 전부 펼친 티켓이 된다',
    file: 'src/pages/MyVouchersPage.tsx',
    find: `                    <VoucherTicket key={shown[0].id} v={shown[0]} muted={false} locale={locale} t={t} onShowQr={() => setQrVoucher(shown[0])} />`,
    replace: `                    {shown.map(v => <VoucherTicket key={v.id} v={v} muted={false} locale={locale} t={t} onShowQr={() => setQrVoucher(v)} />)}`,
    test: TEST,
    why:
      '안 E 의 전부다. 되돌려도 화면은 멀쩡하고 오히려 "정보가 더 많아 보인다" — ' +
      '8장 가진 사람이 훑는 비용은 화면을 찍어 보지 않으면 안 보인다.',
  },
  {
    name: '[상세B지갑E] 🎫접힌 줄이 아무것도 안 한다',
    file: 'src/pages/my-vouchers/WalletRow.tsx',
    find: `      onClick={onOpen}`,
    replace: `      onClick={() => {}}`,
    test: TEST,
    why:
      '접기는 **삭제가 아니다**. 줄을 눌러도 QR 이 안 열리면 그 이용권은 쓸 방법이 사라지는데, ' +
      '빈 핸들러는 콘솔에도 안 남는다.',
  },
  {
    name: '[상세B지갑E] 🔴임박 강조가 툴킷 기본 빨강으로 돌아간다',
    file: 'src/pages/my-vouchers/WalletRow.tsx',
    find: `urgent ? 'font-extrabold text-tone-bad' : ''`,
    replace: `urgent ? 'font-extrabold text-[#DC2626]' : ''`,
    test: TEST,
    why:
      '값이 우연히 비슷해 눈으로는 구분이 안 되지만, 다크에서 갈린다(`--tone-bad` 는 다크에서 밝힌다). ' +
      '"AI 같다"의 정체가 정확히 이 클래스였다 — 툴킷 기본색이 화면마다 섞인 것.',
  },
]
