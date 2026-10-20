/**
 * 🏪 결제 동선의 가게 간판·귀환 버튼 — 주입 매니페스트 (2026-09-16 등록).
 * 가드: src/tests/unit/mall-surface-boundary.test.ts · src/tests/unit/mall-origin-banner.test.tsx
 *
 * 이 조각이 지키는 명제는 둘뿐이다:
 *   ① **몰 손님을 유어딜이 데려가지 않는다** — 간판이 걸리고, 가장 큰 버튼이 가게로 돌아간다.
 *   ② **본진 손님 화면은 종전과 같다** — 흔적이 없으면 아무것도 안 그리고 버튼은 `/` 로 간다.
 * 둘 다 "빼먹어도 에러가 안 나는" 종류라 사람 눈으로는 못 지킨다.
 *
 * ⚠️ `PaymentSuccessPage.tsx` 는 **Toss 감사 잠금 파일**이다. 주입은 테스트를 깨뜨리기 위한
 *    일시 변경이고 러너가 곧바로 복원한다 — 잠금 절차(대표 승인)와 무관하다.
 */
const BOUNDARY = 'src/tests/unit/mall-surface-boundary.test.ts'
const PSP = 'src/pages/PaymentSuccessPage.tsx'
const MC = 'src/worker/utils/mall-consumer.ts'

export default [
  {
    name: '[몰결제] 결제완료의 가장 큰 버튼을 유어딜 홈으로 되돌림',
    file: PSP,
    find: '                <ContinueShoppingLink\n                  onFallback={() => navigate(\'/\')}',
    replace: '                <ContinueShoppingLink\n                  onFallback={() => navigate(\'/home\')}',
    test: BOUNDARY,
    why: '폴백이 `/` 가 아니면 본진 손님 화면이 종전과 달라진다. 화면은 멀쩡히 그려지므로 눈으로는 안 보인다.',
  },
  {
    name: '[몰결제] 결제완료 배너 렌더 제거 (import 는 남긴다)',
    file: PSP,
    find: '<MallOriginBanner className="mt-4 sm:mt-5" />',
    replace: '{null /* 배너 제거 */}',
    test: BOUNDARY,
    why: 'import 만 보는 판정이면 통과한다 — 그 함정을 이 주입이 고정한다(렌더 여부를 봐야 한다).',
  },
  {
    name: '[몰결제] 잠금 파일에서 몰을 직접 판정 (승인 절차 형해화)',
    file: PSP,
    find: 'export default function PaymentSuccessPage() {',
    replace: 'export default function PaymentSuccessPage() {\n  const _mall = (window as any).readMallOrigin?.()',
    test: BOUNDARY,
    why: '판정을 잠금 파일에 심으면 다음 세션이 거기에 조건을 계속 얹는다 — 그게 이 규칙의 진짜 이유다.',
  },
  {
    name: '[몰결제] 주문 내역 가게 찍기에서 본진 제외를 없앰',
    file: MC,
    find: '          AND m.id != ?\n',
    replace: '',
    test: BOUNDARY,
    why: '본진 행(`유통스타트`)에 consumer_path 가 켜지는 날 모든 유어딜 주문에 도매 브랜드가 찍힌다.',
  },
  {
    name: '[몰결제] 두 가게가 섞였을 때 동점 타이브레이크 제거 (화면이 흔들린다)',
    file: MC,
    find: '|| (Number(r.n) === Number(cur.n) && Number(r.mid) < Number(cur.mid))',
    replace: '',
    test: BOUNDARY,
    why: '품목 수가 같으면 입력 순서(=SQLite 마음)로 갈려 같은 주문이 새로고침마다 다른 가게로 보인다.',
  },
  {
    name: '[몰결제] 셀러 전환 넛지의 몰 세션 차단 제거 (고객 가로채기)',
    file: 'src/pages/payment-success/SellerConversionNudge.tsx',
    find: ' || isFromMallSession()',
    replace: '',
    test: BOUNDARY,
    why: '운영자가 데려온 손님에게 유어딜이 셀러 전환을 권한다 — 브랜딩이 아니라 고객 가로채기다.',
  },
  {
    name: '[몰결제] 장바구니의 계속-쇼핑을 유어딜 홈 링크로 되돌림',
    file: 'src/pages/CartPage.tsx',
    find: '<ContinueShoppingLink',
    replace: '<button type="button" hidden /><ContinueShoppingLinkRemoved',
    test: BOUNDARY,
    why: '장바구니부터가 유어딜 화면이라 여기서 새면 뒤 화면을 다 고쳐도 소용이 없다.',
  },
]
