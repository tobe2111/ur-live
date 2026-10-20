/**
 * 🎟️ 마이 사용처리 = QR 티켓 (2026-10-10 대표 확정 안 3 — *"바코드 모양이 아니라 QR모양이어야 하잖아 버튼이"*)
 * 가드: src/tests/unit/my-scan-ticket-qr-2026-10-10.test.ts
 */
const TEST = 'src/tests/unit/my-scan-ticket-qr-2026-10-10.test.ts'
const FILE = 'src/pages/user-profile/SellerSection.tsx'

export default [
  {
    name: '🎟️ 사용처리 꼬리가 QR 에서 다른 그림으로 바뀐다',
    file: FILE,
    find: '                : <QrScanIcon size={32} aria-hidden="true" />}',
    replace: '                : <OrdersIcon className="w-7 h-7" aria-hidden="true" />}',
    test: TEST,
    why: '꼬리가 QR 이 아니면 손님이 내미는 이용권과 같은 물건으로 안 읽힌다(대표 지적 그대로).',
  },
  {
    name: '🎟️ 사용처리 티켓이 다시 진한 블루 면이 된다',
    file: FILE,
    find: 'rounded-[10px] bg-brand-tint text-gray-900',
    replace: 'rounded-[10px] bg-brand text-gray-900',
    test: TEST,
    why: '진한 블루가 등록 줄과 둘이 되면 어느 쪽도 강조가 아니다(표면 규칙 ②).',
  },
  {
    name: '🎟️ 티켓 홈이 판과 다른 색이 된다',
    file: FILE,
    find: 'className="absolute -left-[9px] top-1/2 -mt-[9px] w-[18px] h-[18px] rounded-full bg-surface"',
    replace: 'className="absolute -left-[9px] top-1/2 -mt-[9px] w-[18px] h-[18px] rounded-full bg-white"',
    test: TEST,
    why: '다크에서 판은 #1D1F29 인데 홈이 흰색이면 티켓이 아니라 흰 점 두 개다.',
  },
]
