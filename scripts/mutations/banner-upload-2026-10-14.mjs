/**
 * 🧬 주입 — 배너 이미지 업로드가 원본을 그대로 보내던 것(2026-10-14, 화면 "최대 10MB" ↔ 실제 천장 1MB)
 */
const T = 'src/tests/unit/banner-upload-2026-10-14.test.ts'
export default [
  {
    name: '배너업로드 — 압축 계획인데 원본을 그대로 보낸다',
    file: 'src/pages/admin/banners/BannerMediaUpload.tsx',
    find: "plan.action === 'compress' ? await prepareImageForUpload(file, { hero: true }) : file",
    replace: 'file',
    test: T,
    why: '1MB 넘는 배너 사진이 전부 413(요청 본문이 너무 큽니다) — 2026-10-14 대표 신고의 그 결함.',
  },
  {
    name: '배너업로드 — GIF 도 압축기로 보낸다(움직임이 사라진다)',
    file: 'src/pages/admin/banners/banner-upload-plan.ts',
    find: "  if (file.type === 'image/gif') {",
    replace: "  if (false && file.type === 'image/gif') {",
    test: T,
    why: '압축기는 WebP 로 바꾸며 첫 프레임만 남긴다 — 움직이는 배너가 조용히 정지 이미지가 된다.',
  },
  {
    name: '배너업로드 — 히어로 압축 목표가 천장을 넘는다',
    file: 'src/lib/prepare-upload.ts',
    find: 'export const HERO_TARGET_MB = 0.85',
    replace: 'export const HERO_TARGET_MB = 2',
    test: T,
    why: '압축해도 1MB 를 넘어 413 — 압축이 아무것도 해결하지 못한다.',
  },
  {
    name: '배너업로드 — 히어로 폭을 1280 으로 깎는다',
    file: 'src/lib/prepare-upload.ts',
    find: 'export const HERO_MAX_EDGE = 2400',
    replace: 'export const HERO_MAX_EDGE = 1280',
    test: T,
    why: '홈 최상단 전폭 배너가 레티나에서 흐려진다(권장 2,400px).',
  },
  {
    name: '배너업로드 — hero 옵션이 무시되고 기본 압축(1280px)을 탄다',
    file: 'src/lib/prepare-upload.ts',
    find: '    : opts.hero\n',
    replace: '    : false\n',
    test: T,
    why: '상수는 맞는데 쓰이지 않는다 — 배너가 상품 사진 기준으로 깎인다.',
  },
]
