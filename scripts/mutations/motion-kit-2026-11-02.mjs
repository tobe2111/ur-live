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
{
    name: '🎬 부품 안 CSS 에 끄기 규칙이 조건 밖으로 샌다(움직임이 늘 꺼짐)',
    file: 'src/pages/my-vouchers/WalletRow.tsx',
    find: ".ur-blink-once { animation: ur-blink-once",
    replace: ".ur-blink-once { animation: none !important; }.ur-x { animation: ur-blink-once",
    test: TEST,
    why: '조건 밖 끄기 규칙은 에러 없이 그 움직임을 모든 사람에게서 지운다(2026-11-02 실제로 다섯 곳).',
  },
  {
    name: '🎬 동작 줄이기 조건이 선택자 목록에 다시 삼켜진다',
    file: 'src/pages/seller-orders/MobileOrderList.tsx',
    find: '.ur-order-new { animation: ur-order-in .4s cubic-bezier(.2,1,.3,1) both, ur-flash 1.8s ease .1s both; }@media (prefers-reduced-motion: reduce)',
    replace: '.ur-order-new { animation: ur-order-in .4s cubic-bezier(.2,1,.3,1) both, ur-flash 1.8s ease .1s both; }.ur-flash,@media (prefers-reduced-motion: reduce)',
    test: TEST,
    why: '`…,@media` 는 규칙 통째로 버려진다 — 동작 줄이기를 켠 사람에게도 움직인다(2026-11-02 여섯 파일 실측).',
  },
  {
    name: '🎬 사장님 주문 화면을 처음 열면 모든 주문이 "새 주문" 으로 반짝인다',
    file: 'src/pages/seller-orders/MobileOrderList.tsx',
    find: 'if (!num || !seen.current || seen.current.size === 0) return false',
    replace: 'if (!num || !seen.current) return false',
    test: TEST,
    why: '빈 목록 → 첫 목록 도착을 새 주문으로 읽으면 화면을 열 때마다 전부 움직여 진짜 새 주문을 못 알아본다.',
  },
  {
    name: '🎬 카카오로 공유했는데도 공유 버튼이 "복사됨" 체크로 바뀐다',
    file: 'src/pages/CuratorPage.tsx',
    find: 'if (await shareViaKakao(ushopCardPayload(card))) return false',
    replace: 'if (await shareViaKakao(ushopCardPayload(card))) return true',
    test: TEST,
    why: '복사하지 않았는데 복사됐다고 말하는 거짓 신호다.',
  },
  {
    name: '🎬 결제 처리 중 표시에서 도는 원이 빠진다',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: '{joining ? <span className="ur-pay-busy"><span className="ur-pay-spin" aria-hidden="true" />처리 중…</span>',
    replace: "{joining ? '처리 중…'",
    test: TEST,
    why: '눌렀는지 모르는 몇 초 동안 손님이 결제 버튼을 다시 누른다.',
  },
  {
    name: '🎬 지갑 탭 밑줄이 두 개 그려진다(미끄러지는 밑줄 + 옛 밑줄)',
    file: 'src/pages/MyVouchersPage.tsx',
    find: '{tab === key && !tabBar && <span aria-hidden="true"',
    replace: '{tab === key && <span aria-hidden="true"',
    test: TEST,
    why: '측정 뒤에도 옛 밑줄이 남으면 미끄러지는 동안 고른 탭 밑에 밑줄이 하나 더 보인다.',
  },
]
