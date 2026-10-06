/**
 * 🩹 이용권 QR 바텀시트 넘침 — 주입 매니페스트 (2026-09-21 등록).
 * 가드: src/tests/unit/voucher-qr-sheet-overflow-2026-09-21.test.ts
 *
 * 이 결함의 고약한 점은 **에러가 안 난다**는 것이다. 빌드도 타입도 통과하고, 개발자 화면(넓은 창)에서는
 * 멀쩡히 보인다. 좁은 인앱 브라우저에서만 **위쪽이 화면 밖으로 밀려 나가고 스크롤이 없어 되돌릴 수 없다.**
 * 그래서 "높이 상한"·"스크롤 컨테이너" 둘 중 하나만 사라져도 조용히 재발한다 — 셋 다 잠근다.
 */
export default [
  {
    name: 'QR 시트에서 높이 상한을 뺀다(내용이 길어지면 위가 화면 밖으로 넘친다)',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'flex flex-col max-h-[92dvh] sm:max-h-[88dvh]',
    replace: 'flex flex-col',
    test: 'src/tests/unit/voucher-qr-sheet-overflow-2026-09-21.test.ts',
    why:
      '상한이 없으면 패널이 내용만큼 자란다. 바텀시트는 `items-end` 라 **아래가 고정**이므로 ' +
      '자란 만큼 **위가 뷰포트 밖으로** 나가고, 스크롤이 없어 손댈 수 없다(2026-09-21 대표 신고의 원형). ' +
      '헤드리스 실측: 390×640 에서 패널 812px · 제목 top −160px.',
  },
  {
    name: '상한을 dvh 대신 vh 로 쓴다(모바일에서 주소창만큼 더 넘친다)',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'max-h-[92dvh] sm:max-h-[88dvh]',
    replace: 'max-h-[92vh] sm:max-h-[88vh]',
    test: 'src/tests/unit/voucher-qr-sheet-overflow-2026-09-21.test.ts',
    why:
      '모바일 `100vh` 는 **주소창을 포함한** 높이라 실제 보이는 영역보다 크다(레포 룰 — `check-mobile-viewport`). ' +
      'vh 로 상한을 잡으면 상한이 있는데도 여전히 조금 넘치고, 그 조금이 하필 **맨 위 제목**이다.',
  },
  {
    name: '본문 스크롤 컨테이너에서 min-h-0 을 뺀다(스크롤이 아예 안 생긴다)',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'className="flex-1 min-h-0 overflow-y-auto overscroll-contain"',
    replace: 'className="flex-1 overflow-y-auto overscroll-contain"',
    test: 'src/tests/unit/voucher-qr-sheet-overflow-2026-09-21.test.ts',
    why:
      'flex 자식의 기본 `min-height:auto` 는 **콘텐츠보다 작아지지 않는다.** 그래서 `overflow-y-auto` 를 ' +
      '줘도 컨테이너가 안 줄어들어 스크롤이 안 생기고, 대신 형제(패널)가 밀린다 — 레포 룰이 ' +
      '`flex-1 min-h-0 overflow-y-auto` 를 한 묶음으로 요구하는 이유가 이것이다.',
  },
  {
    name: '닫기(X)를 스크롤 영역 안으로 넣는다(스크롤하면 닫기 버튼이 사라진다)',
    file: 'src/pages/my-vouchers/QRModal.tsx',
    find: 'className="absolute top-3 right-3 w-8 h-8',
    replace: 'className="top-3 right-3 w-8 h-8',
    test: 'src/tests/unit/voucher-qr-sheet-overflow-2026-09-21.test.ts',
    why:
      '`absolute` 를 떼면 버튼이 흐름에 들어가 본문과 함께 스크롤된다. 아래로 내리면 **닫을 방법이 ' +
      '배경 탭뿐**이 되는데, 바텀시트가 화면을 거의 덮고 있어 배경이 얼마 안 남는다.',
  },
]
