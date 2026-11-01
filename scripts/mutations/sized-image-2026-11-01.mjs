// 🖼️ 2026-11-01 크기별로 미리 저장한 사진 — 가드가 실제로 실패할 수 있는지.
export default [
  {
    name: '[sized-image] 크기별 사진을 다시 리사이저로 보낸다',
    file: 'src/utils/cf-image.ts',
    find: '  if (sized) return sizedVariantUrl(sized, pickSizedWidth(opts.width, getSaveData()))',
    replace: '  if (sized && false) return sizedVariantUrl(sized, pickSizedWidth(opts.width, getSaveData()))',
    test: 'src/tests/unit/sized-image-2026-11-01.test.ts',
    why: '크기별로 저장해 둔 사진도 변환 한도를 쓴다 — 이 작업의 목적이 통째로 사라진다.',
  },
  {
    name: '[sized-image] 작은 크기 하나가 실패해도 주소를 준다',
    file: 'src/lib/image-sized.ts',
    find: '    if (!r?.success || !r.data?.batch) return null',
    replace: '    if (!r?.success || !r.data?.batch) continue',
    test: 'src/tests/unit/sized-image-2026-11-01.test.ts',
    why: '320 이 없는 주소가 저장되면 카드에서 사진이 깨진다.',
  },
  {
    name: '[sized-image] 업로드 묶음 이름을 검사하지 않는다',
    file: 'src/features/upload/api/upload.routes.ts',
    find: '    if (batchIn && !SIZED_BATCH_RE.test(batchIn))',
    replace: '    if (false && batchIn && !SIZED_BATCH_RE.test(batchIn))',
    test: 'src/tests/unit/sized-image-2026-11-01.test.ts',
    why: '묶음 이름에 경로 조각을 넣어 다른 자리에 쓸 수 있다.',
  },
  {
    name: '[sized-image] 갤러리 교체가 따옴표 없이 부분 문자열을 바꾼다',
    file: 'src/features/upload/api/image-sizing-admin.routes.ts',
    find: '.bind(`"${rel}"`, `"${next}"`, `"${abs}"`, `"${next}"`, `"${rel}"`, `"${abs}"`)',
    replace: '.bind(rel, next, abs, next, rel, abs)',
    test: 'src/tests/unit/sized-image-2026-11-01.test.ts',
    why: 'a.jpg 를 바꾸면서 ab.jpg 같은 다른 주소의 일부까지 바뀐다.',
  },
  {
    name: '[sized-image] commit 이 R2 확인 없이 주소를 바꾼다',
    file: 'src/features/upload/api/image-sizing-admin.routes.ts',
    find: '      if (!head) return c.json(',
    replace: '      if (false) return c.json(',
    test: 'src/tests/unit/sized-image-2026-11-01.test.ts',
    why: '저장이 안 된 크기를 가리키는 주소로 바뀌어 사진이 깨진다.',
  },
]
