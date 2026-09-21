/**
 * 💾 이용권 편집 저장 버튼 위치 — 되돌려-검증 주입 (2026-09-21).
 */
export default [
  {
    name: '💾 저장 버튼이 다시 폼 하단으로 내려간다 (헤더에서 사라짐)',
    file: 'src/pages/SellerProductEditPage.tsx',
    find: '                form={EDIT_FORM_ID}',
    replace: '                data-form-removed',
    test: 'src/tests/unit/seller-product-edit-save-top-2026-09-21.test.ts',
    why:
      '폼 밖 버튼은 `form` 속성이 없으면 이 폼을 제출하지 못한다 — 눌러도 아무 일이 안 일어난다. ' +
      '대표가 고쳐 달라고 한 그 불편(끝까지 스크롤해야 저장)이 그대로 돌아온다.',
  },
  {
    name: '💾 헤더 저장이 폼 검증을 우회한다 (onClick 직접 제출)',
    file: 'src/pages/SellerProductEditPage.tsx',
    find: '                type="submit"\n                form={EDIT_FORM_ID}',
    replace: '                type="button"\n                onClick={handleSubmit}',
    test: 'src/tests/unit/seller-product-edit-save-top-2026-09-21.test.ts',
    why:
      'required 검증·브라우저 기본 검증을 건너뛰는 두 번째 저장 경로가 생긴다. ' +
      '빈 칸인 채로 저장이 날아가고, 서버가 거절하면 셀러는 왜인지 모른다.',
  },
  {
    name: '🔤 로고 폰트가 다시 optional 로 (첫 로드에서 Poppins 를 통째로 건너뛴다)',
    file: 'index.html',
    find: 'text=urdeal&display=swap"',
    replace: 'text=urdeal&display=optional"',
    test: 'src/tests/unit/seller-product-edit-save-top-2026-09-21.test.ts',
    why:
      '2026-09-21 에 실제로 한 번 이 방향으로 갔다가 되돌렸다 — 근거였던 "swap 은 글자를 투명하게 둔다"가 ' +
      '측정으로 뒤집혔기 때문이다(swap·optional 둘 다 20ms 부터 칠해진 픽셀 1,626 로 동일). ' +
      'optional 은 폰트가 늦으면 그 로드에서 아예 안 써서 첫 방문자가 로더에서 로고 폰트를 못 본다.',
  },
]
