/**
 * 🎟️ 마이 판매 두 칸 (2026-10-10 안 3 → 2026-10-25 대표 확정 안 G 로 재조준)
 *   사용처리 = 진한 블루 칸(QR) · 이용권 등록·관리 = 흰 칸. 둘은 생김새가 달라야 한다.
 * 가드: src/tests/unit/my-scan-ticket-qr-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/my-scan-ticket-qr-2026-10-10.test.ts'
const FILE = 'src/pages/user-profile/SellerSection.tsx'

export default [
  {
    name: '🎟️ 사용처리 그림이 QR 에서 다른 그림으로 바뀐다',
    file: FILE,
    find: '              : <QrScanIcon size={28} aria-hidden="true" />}',
    replace: '              : <OrdersIcon className="w-7 h-7" aria-hidden="true" />}',
    test: TEST,
    why: 'QR 이 아니면 손님이 내미는 이용권과 같은 물건으로 안 읽힌다(대표 지적 그대로).',
  },
  {
    name: '🎟️ 등록 칸이 사용처리와 같은 진한 블루 면이 된다',
    file: FILE,
    find: 'className="min-w-0 flex items-center gap-2 h-16 px-3 rounded-2xl bg-surface shadow-lift text-left active:opacity-70 disabled:opacity-60"',
    replace: 'className="min-w-0 flex items-center gap-2 h-16 px-3 rounded-2xl bg-brand text-white text-left active:opacity-70 disabled:opacity-60"',
    test: TEST,
    why: '둘이 같은 면이면 대표가 말한 "다르더라도 티가 나야" 가 깨지고, 파란 면이 둘이 된다(표면 규칙 ②).',
  },
  {
    name: '🎟️ 사용처리 칸이 판 안으로 다시 들어간다',
    file: FILE,
    find: '      <div className="grid grid-cols-2 gap-2">',
    replace: '      <div className="hidden">',
    test: TEST,
    why: '격자가 사라지면 매일 누르는 두 칸이 판 밖 위에 나란히 서지 않는다(안 G 의 핵심).',
  },
]
