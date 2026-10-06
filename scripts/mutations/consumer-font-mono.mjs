/**
 * 🔤 소비자 화면 터미널 고정폭(`font-mono`) 0 — 주입 매니페스트 (2026-09-23 등록).
 * 가드: src/tests/unit/consumer-font-mono-2026-09-23.test.ts
 *
 * 이 결함은 **에러가 안 난다.** 타입도 빌드도 통과하고 글자도 멀쩡히 읽힌다 — 다만 그 자리만
 * 개발자 콘솔처럼 보이고(대표: *"너무 AI스러운데"*), 시계는 초마다 좌우로 흔들린다.
 * 그래서 두 방향을 같이 잠근다: ① 고정폭이 **되돌아오는 것** ② 자리맞춤이 **사라지는 것**.
 */
export default [
  {
    name: '이용권 코드를 다시 터미널 고정폭으로 되돌린다',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'text-[15px] tabular-nums font-bold',
    replace: 'text-[15px] font-mono font-bold',
    test: 'src/tests/unit/consumer-font-mono-2026-09-23.test.ts',
    why:
      '`font-mono` 는 우리가 고른 글꼴이 아니라 `ui-monospace, Menlo, …` 터미널 폴백이다. ' +
      '이용권 코드는 손님이 매장에서 보여 주는 화면의 주인공이라 이 한 줄이 화면 전체 인상을 바꾼다. ' +
      '코드 알파벳은 이미 I/O/0/1 을 뺐으므로(`generateVoucherCode`) 고정폭으로 얻는 판독성도 없다.',
  },
  {
    name: '실시간 시계에서 자리맞춤을 뺀다(초마다 좌우로 흔들린다)',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'text-gray-400 dark:text-gray-500 tabular-nums',
    replace: 'text-gray-400 dark:text-gray-500',
    test: 'src/tests/unit/consumer-font-mono-2026-09-23.test.ts',
    why:
      'Pretendard 기본 숫자는 **비례폭**이다 — 라이브 실측으로 `08:11:11` 66.47px vs `07:36:15` 74.56px. ' +
      '1초마다 폭이 최대 8px 출렁여 QR 아래 안내가 떨린다. `font-mono` 만 지우고 여기를 안 켜면 ' +
      '"고정폭 0" 시험은 초록인데 화면은 더 나빠진다 — 그래서 두 시험이 짝이다.',
  },
  {
    name: '지갑 헤더 숫자 칸을 고정폭으로 되돌린다',
    file: 'src/pages/my-vouchers/WalletHeader.tsx',
    find: "s.mono ? 'tabular-nums' : ''",
    replace: "s.mono ? 'font-mono' : ''",
    test: 'src/tests/unit/consumer-font-mono-2026-09-23.test.ts',
    why:
      '잔액은 소비자가 가장 자주 보는 숫자다. 조건부(`s.mono ? …`) 형태라 일괄 치환에서 놓치기 쉽고, ' +
      '실제로 문자열 안이라 grep 결과를 눈으로 훑으면 지나친다 — 그래서 따로 잠근다.',
  },
  {
    name: '결제 완료 화면 금액에 고정폭을 넣는다',
    file: 'src/pages/PaymentSuccessPage.tsx',
    find: 'font-semibold text-gray-900 dark:text-white tabular-nums break-all',
    replace: 'font-semibold text-gray-900 dark:text-white font-mono break-all',
    test: 'src/tests/unit/consumer-font-mono-2026-09-23.test.ts',
    why:
      '결제 완료는 소비자가 거래를 확인하는 마지막 화면이고, 이 파일은 **Toss 감사 잠금**이라 ' +
      '고쳐 넣기가 가장 어려운 자리다. 한 번 되돌아가면 오래 남는다.',
  },
  {
    name: '이름에 Seller 가 든 소비자 파일에 고정폭을 넣는다(제외 규칙이 이름으로 걸러지는지)',
    file: 'src/pages/payment-success/SellerConversionNudge.tsx',
    find: '<span className="font-semibold text-gray-900 dark:text-white">urdeal.kr/u/{handle}</span>',
    replace: '<span className="font-mono text-gray-900 dark:text-white">urdeal.kr/u/{handle}</span>',
    test: 'src/tests/unit/consumer-font-mono-2026-09-23.test.ts',
    why:
      '🩸 **첫 판이 정확히 여기서 새어 나갔다.** 제외 규칙을 파일 이름(`Seller*`)으로 짰더니 ' +
      '결제 완료 화면의 이 넛지가 통째로 범위 밖으로 빠졌고, `font-mono` 가 남은 채 초록불이 떴다. ' +
      '그래서 판정을 **디렉터리**로 옮겼다 — 이 주입은 그 교정이 살아 있는지를 본다.',
  },
]
