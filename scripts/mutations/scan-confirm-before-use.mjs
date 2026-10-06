/**
 * ✅ 사장님 QR 스캔 확인 단계 — 되돌려-검증 주입 (2026-10-06).
 */
export default [
  {
    name: '✅ 카메라 인식이 다시 즉시 사용 처리한다 (확인 생략)',
    file: 'src/components/voucher/VoucherScanner.tsx',
    find: '            if (code) void requestUseRef.current(code)',
    replace: '            if (code) await useVoucher(code)',
    test: 'src/tests/unit/scan-confirm-before-use-2026-10-06.test.ts',
    why: '비추는 순간 되돌릴 수 없는 사용이 나간다 — 옆 손님 화면·사진 속 QR 도 소비된다. 대표가 확인을 넣으라고 한 그 흐름.',
  },
  {
    name: '✅ 이미 쓴 이용권에도 사용 처리 버튼을 낸다',
    file: 'src/components/voucher/VoucherScanner.tsx',
    find: '              {usable && !blocked && (',
    replace: '              {true && (',
    test: 'src/tests/unit/scan-confirm-before-use-2026-10-06.test.ts',
    why: '누를 수 없는 버튼을 띄우면 사장님은 눌러 보고서야 "이미 사용됨" 을 안다.',
  },
]
