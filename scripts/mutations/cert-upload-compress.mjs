/**
 * 📄 사업자등록증 업로드 압축 (2026-09-15, 대표 신고 413) — 주입 매니페스트.
 * 가드: src/tests/unit/cert-upload-compress-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/cert-upload-compress-2026-09-15.test.ts'

export default [
  {
    name: '📄 매장 등록이 압축본 대신 원본을 올린다 (413 재발)',
    file: 'src/components/seller/StoreRegisterModal.tsx',
    find: "      fd.append('file', prepared)",
    replace: "      fd.append('file', file)",
    test: TEST,
    why: '서버 상한 10MB 인데 폰 사진은 그걸 쉽게 넘는다 — 등록증 단계에서 매장 등록이 통째로 막힌다.',
  },
  {
    name: '📄 가입 단계 업로드가 원본을 올린다',
    file: 'src/components/BusinessCertUpload.tsx',
    find: "      fd.append('file', prepared)",
    replace: "      fd.append('file', file)",
    test: TEST,
    why: '같은 413 이 가입 경로에서도 난다. 두 문이 따로 있으니 둘 다 고정해야 한다.',
  },
  {
    name: '📄 압축 실패가 등록을 막는다 (fail-soft 소실)',
    file: 'src/components/seller/StoreRegisterModal.tsx',
    find: '      const prepared = await compressForDocument(file).catch(() => file)',
    replace: '      const prepared = await compressForDocument(file)',
    test: TEST,
    why: '압축은 편의 기능이다 — 그게 던져서 사업자등록증 첨부가 실패하면 본말이 전도된다.',
  },
  {
    name: '📄 문서를 상품 사진 기본값으로 압축한다 (등록증 글자가 뭉개진다)',
    file: 'src/lib/image-compress.ts',
    find: '  return compressForUpload(file, { maxSizeMB: 2, maxWidthOrHeight: 2400 })',
    replace: '  return compressForUpload(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1280 })',
    test: TEST,
    why: '1280px 로 줄이면 사업자번호·상호·주소가 읽히지 않아 어드민이 심사를 못 한다. 압축했는데 쓸모가 없어진다.',
  },
  {
    name: '📄 가입 경로가 큰 사진을 압축 전에 거절한다 (옛 막다른 길)',
    file: 'src/components/BusinessCertUpload.tsx',
    find: '      const prepared = await compressForDocument(file).catch(() => file)',
    replace: "      if (file.size > 10 * 1024 * 1024) { toast.error('이미지는 10MB 이하만 가능해요'); return }\n      const prepared = file",
    test: TEST,
    why: '"10MB 이하만 가능해요" 는 사장님이 할 수 있는 일이 없는 안내다 — 그래서 압축으로 바꿨다.',
  },
]
