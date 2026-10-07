/**
 * ✅ 사장님 QR 스캔 확인 단계 — 되돌려-검증 주입 (2026-10-06).
 */
export default [
  {
    name: '✅ 카메라 인식이 다시 즉시 사용 처리한다 (확인 생략)',
    file: 'src/components/voucher/VoucherScanner.tsx',
    // 🩸 2026-10-07 재조준 **2회**: ① 네이티브 경로에 폴백 전환이 생겨 들여쓰기가 두 칸 줄었다
    //   ② 그래서 한 줄만 앵커했더니 **wasm 콜백과 글자까지 같아져 주입 대상이 2곳**이 됐다
    //   (러너가 "유일해야 한다" 로 막았다 — 엉뚱한 곳을 고칠 수 있으므로). ⇒ 경로별로 **앞 줄까지**
    //   포함해 가른다. 지키려는 것은 그대로다 — **스캔은 조회만 하고, 사용은 확인 뒤에만**.
    //   ⚠️ 두 경로를 **각각** 심는다: 한쪽만 심으면 다른 경로가 조용히 즉시 소비할 수 있다.
    find: '          const code = found.length ? extractCode(found[0].rawValue) : null\n          if (code) void requestUseRef.current(code)',
    replace: '          const code = found.length ? extractCode(found[0].rawValue) : null\n          if (code) await useVoucher(code)',
    test: 'src/tests/unit/scan-confirm-before-use-2026-10-06.test.ts',
    why: '비추는 순간 되돌릴 수 없는 사용이 나간다 — 옆 손님 화면·사진 속 QR 도 소비된다. 대표가 확인을 넣으라고 한 그 흐름(네이티브 디코더 경로).',
  },
  {
    name: '✅ wasm 경로가 다시 즉시 사용 처리한다 (확인 생략)',
    file: 'src/components/voucher/VoucherScanner.tsx',
    find: '          const code = extractCode(res.data)\n          if (code) void requestUseRef.current(code)',
    replace: '          const code = extractCode(res.data)\n          if (code) void useVoucher(code)',
    test: 'src/tests/unit/scan-confirm-before-use-2026-10-06.test.ts',
    why:
      '같은 결함의 **다른 경로**다. 2026-10-07 에 네이티브→wasm 자동 폴백이 생겼으므로, 아이폰과 ' +
      '"네이티브가 못 읽는 안드로이드" 는 이 콜백을 탄다 — 여기만 즉시 소비하면 그 기기들에서만 ' +
      '되돌릴 수 없는 사용이 나간다(재현이 기기에 묶여 더 찾기 어렵다).',
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
