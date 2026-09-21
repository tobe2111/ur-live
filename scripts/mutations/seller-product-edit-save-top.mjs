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
    name: '🔤 로고 폰트가 다시 swap 으로 (로딩 중 워드마크가 사라진다)',
    file: 'index.html',
    find: 'text=urdeal&display=optional"',
    replace: 'text=urdeal&display=swap"',
    test: 'src/tests/unit/seller-product-edit-save-top-2026-09-21.test.ts',
    why:
      'swap 은 폰트를 기다리는 동안 글자를 투명하게 둔다 — 로더가 떠 있는 바로 그 순간과 겹쳐 ' +
      '워드마크가 사라지고 브랜드 점만 남는다(대표가 본 그 화면).',
  },
]
