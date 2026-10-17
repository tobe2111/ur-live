/**
 * 🧬 주입 — 사진 업로드 자리들이 공용 준비 헬퍼를 건너뛰던 것(2026-10-14, 압축 전 5MB·10MB 가드 · 천장 검사 없음)
 */
const T = 'src/tests/unit/upload-prepare-everywhere-2026-10-14.test.ts'
export default [
  {
    name: '업로드전수 — 매장 사진에 압축 전 10MB 가드가 되살아난다',
    file: 'src/pages/seller-store-info/ImageField.tsx',
    find: '    setBusy(true)\n    try {\n      // 🗜️ 2026-10-14',
    replace: "    if (file.size > 10 * 1024 * 1024) { toast.error('10MB 이하 이미지만 가능합니다'); return }\n    setBusy(true)\n    try {\n      // 🗜️ 2026-10-14",
    test: T,
    why: '폰 사진(4~12MB)은 줄이면 올라가는데 이 가드가 먼저 거절한다.',
  },
  {
    name: '업로드전수 — 블로그·몰·숙소 업로드가 원본을 그대로 보낸다',
    file: 'src/components/upload/ImageUpload.tsx',
    find: 'const optimized = await prepareImageForUpload(file, { size: PREP_SIZE })',
    replace: 'const optimized = file',
    test: T,
    why: '1MB 넘는 사진이 전부 미들웨어 413("요청 본문이 너무 큽니다").',
  },
  {
    name: '업로드전수 — 상품 사진이 압축기를 직접 불러 천장 검사를 건너뛴다',
    file: 'src/components/ImageUpload.tsx',
    find: "compressedFile = await prepareImageForUpload(file, { size: { maxSizeMB: maxSizeKB / 1024, maxWidthOrHeight: 1280 } })",
    replace: "compressedFile = await (await import('@/lib/image-compress')).compressForUpload(file, { maxSizeMB: maxSizeKB / 1024, maxWidthOrHeight: 1280 })",
    test: T,
    why: '줄여도 천장을 넘는 사진이 우리 문구 없이 413 을 맞는다.',
  },
  {
    name: '업로드전수 — 자리별 목표가 천장 위로 새어 나간다',
    file: 'src/lib/prepare-upload.ts',
    find: 'maxSizeMB: Math.min(opts.size!.maxSizeMB, SIZE_TARGET_CAP_MB),',
    replace: 'maxSizeMB: opts.size!.maxSizeMB,',
    test: T,
    why: '호출부가 큰 목표를 적으면 압축해도 413 — 목표를 천장 아래로 누르는 장치가 사라진다.',
  },
  {
    name: '업로드전수 — 천장 안 GIF 도 압축기로 보낸다(움직임이 사라진다)',
    file: 'src/lib/prepare-upload.ts',
    find: "  if (file.type === 'image/gif' && fitsApiBodyLimit(file.size)) return file\n",
    replace: '',
    test: T,
    why: '움직이는 GIF 가 조용히 첫 프레임 정지 이미지로 바뀐다.',
  },
  {
    name: '업로드전수 — 한국어 사진 안내가 다시 "최대 10MB" 라고 말한다',
    file: 'public/locales/ko/translation.json',
    find: '"imageFormatHint": "JPG, PNG, WebP • 큰 사진은 자동으로 {{maxSizeKB}}KB 이하로 줄여 올립니다"',
    replace: '"imageFormatHint": "JPG, PNG, GIF (최대 10MB) • 자동으로 {{maxSizeKB}}KB 이하로 압축됩니다"',
    test: T,
    why: '로케일 값이 코드 기본값을 이긴다 — 코드만 고치면 화면은 계속 거짓말을 한다.',
  },
]
