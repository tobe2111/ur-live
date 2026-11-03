/** 📷 매장 계산대 안 B (2026-11-03) — 주입 매니페스트. 가드: src/tests/unit/store-scan-plan-b-2026-11-03.test.ts */
const TEST = 'src/tests/unit/store-scan-plan-b-2026-11-03.test.ts'
export default [
  {
    name: '📷계산대B 카메라 전체 화면이 종전 카드로 돌아간다',
    file: 'src/pages/StoreScanPage.tsx',
    find: '<VoucherScanner full />',
    replace: '<VoucherScanner />',
    test: TEST,
    why: '대표 확정 안 B — 카메라가 화면을 채워야 손님 QR 을 비추기 쉽고 글자가 준다.',
  },
  {
    name: '📷계산대B 전체 화면에서 사용 처리 확인창이 빠진다',
    file: 'src/components/voucher/VoucherScanner.tsx',
    find: "        {pending && <UseConfirmSheet pending={pending} onCancel={closePending} onConfirm={confirmPending} />}\n      </div>\n    )\n  }",
    replace: "      </div>\n    )\n  }",
    test: TEST,
    why: '비추면 확인 없이 되돌릴 수 없는 사용이 나간다(되돌릴 수 없다는 경고도 그 창이 한다).',
  },
]
