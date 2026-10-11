/**
 * 📤 업로드 한도 — 실제로 자르는 것이 클라의 전제와 같은가 (2026-10-11, 대표 신고 413).
 * 가드: src/tests/unit/upload-body-limit-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/upload-body-limit-2026-10-11.test.ts'

export default [
  {
    name: '📤 프로필 사진이 압축본 대신 원본을 올린다 (대표 신고 413 재발)',
    file: 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx',
    find: "      fd.append('file', ready)",
    replace: "      fd.append('file', file)",
    test: TEST,
    why: '전역 bodyLimit 이 1MB 라 폰 사진은 예외 없이 413 이고, 사용자는 우리 문구가 아니라 미들웨어 문구를 받는다.',
  },
  {
    name: '📤 리뷰 사진이 원본을 올린다',
    file: 'src/pages/my-vouchers/ReviewBonusButton.tsx',
    find: "      fd.append('file', ready)",
    replace: "      fd.append('file', file)",
    test: TEST,
    why: '같은 413 이 리뷰 보너스 신청에서도 난다 — 문이 여러 개라 전부 고정해야 한다.',
  },
  {
    name: '📤 영입 증빙이 원본을 올린다',
    file: 'src/pages/SellerProspectsPage.tsx',
    find: "      fd.append('file', ready)",
    replace: "      fd.append('file', file)",
    test: TEST,
    why: '세 번째 문. 한 자리만 고치면 다음 세션이 "압축은 하고 있다" 고 오판한다.',
  },
  {
    name: '📤 클라가 서버 천장을 지어낸다 (상수를 서버와 어긋나게)',
    file: 'src/shared/upload-limits.ts',
    find: 'export const API_BODY_LIMIT_BYTES = 1_000_000',
    replace: 'export const API_BODY_LIMIT_BYTES = 10_000_000',
    test: TEST,
    why: '이 사고의 본질이 바로 "클라가 믿는 한도"와 "서버가 자르는 한도"의 불일치다. 서버 소스에서 다시 파싱해 대조해야 한다.',
  },
  {
    name: '📤 압축 후 천장 검사를 뺀다 (413 을 우리가 먼저 못 잡는다)',
    file: 'src/lib/prepare-upload.ts',
    find: '  if (!fitsApiBodyLimit(ready.size)) {',
    replace: '  if (false) {',
    test: TEST,
    why: '압축이 실패했는데도 그대로 보내면 사용자는 다시 브라우저 기본 413 을 본다.',
  },
  {
    name: '📤 압축 전 원본 상한을 서버 천장으로 되돌린다 (폰 사진을 그냥 거절)',
    file: 'src/shared/upload-limits.ts',
    find: 'export const UPLOAD_SOURCE_MAX_BYTES = 25 * 1024 * 1024',
    replace: 'export const UPLOAD_SOURCE_MAX_BYTES = 1 * 1024 * 1024',
    test: TEST,
    why: '압축하면 올라갈 사진을 미리 거절하는 것이 종전 5MB 가드의 두 번째 결함이었다.',
  },
  {
    name: '📤 압축 실패가 업로드를 막는다 (fail-soft 소실)',
    file: 'src/lib/prepare-upload.ts',
    find: '  const ready = await compress(file).catch(() => file)',
    replace: '  const ready = await compress(file)',
    test: TEST,
    why: '압축은 편의 기능이다 — 그게 던져서 사진 변경이 실패하면 본말이 전도된다.',
  },
  {
    name: '🔒 잠금표 계약 — 압축 모듈을 정적으로 끌어올린다 (첫 페인트 +51KB)',
    file: 'src/lib/prepare-upload.ts',
    find: "  const { compressForThumbnail, compressForUpload } = await import('./image-compress')",
    replace: "  const { compressForThumbnail, compressForUpload } = await Promise.resolve(require('./image-compress'))",
    test: TEST,
    why: 'image-compress 는 browser-image-compression(~51KB)을 함수 안에서만 불러야 하는 잠금 항목이다.',
  },
  {
    name: '📤 허용목록에 사유 없이 새 자리를 숨긴다',
    file: TEST,
    // 🔁 2026-10-11 재조준: 종전 앵커는 허용목록의 **사유 문구**였는데, 대표 정정(도매몰은 안 하는
    //   서비스)으로 그 문구를 고치자 앵커가 낡았다(pre-push 게이트가 잡았다). 문구는 또 바뀐다 ⇒
    //   안 바뀌는 **선언 줄**에 걸어 사유 없는 항목을 맨 앞에 끼워 넣는다.
    find: 'const ALLOW: Record<string, string> = {',
    replace: "const ALLOW: Record<string, string> = {\n  'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx': 'x',",
    test: TEST,
    why: '래칫의 탈출구는 허용목록이다 — 사유 없는 면제가 들어오면 가드가 지키는 척만 한다.',
  },
]
