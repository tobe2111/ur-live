/**
 * 📤 업로드 한도 SSOT — **실제로 무엇이 잘리는가**를 한 곳에서 말한다.
 *
 * 🩸 2026-10-11 (대표 신고 — *"사진 바꾸니까 요청 본문이 크다는데?"* · `/api/upload/image` 413):
 *   한도가 **세 군데서 서로 다른 말**을 하고 있었다.
 *     ① 클라 가드 ·········· `file.size > 5MB` → "5MB 이하만 올릴 수 있어요"
 *     ② 업로드 라우트 ······ `MAX_SIZE = 10 * 1024 * 1024` + 자체 413
 *     ③ 전역 미들웨어 ······ `worker/index.ts` 의 `bodyLimit(1_000_000)` ← **이것이 자른다**
 *   `app.use('/api/*', _bodyLimit1m)` 이 `app.route('/api', uploadRoutes)` 보다 **먼저** 등록되므로
 *   ②의 10MB 검사는 **도달할 수 없는 죽은 코드**이고 ①이 사람에게 보여 준 "5MB 이하" 는 거짓말이었다.
 *   대표가 본 문구가 그 증거다 — 라우트 문구("파일이 너무 큽니다 (최대 10MB)")가 아니라
 *   미들웨어 문구("요청 본문이 너무 큽니다")였다.
 *
 * 🔑 그래서 **클라가 천장을 지어내지 않는다.** 진실은 서버의 `bodyLimit(...)` 이고 이 상수는 그 값을
 *   옮겨 적은 것일 뿐이다. 둘이 갈리면 `upload-body-limit-2026-10-11.test.ts` 가 서버 소스에서
 *   값을 다시 파싱해 대조하고 빨간불을 낸다.
 *
 * ⚠️ 천장을 올리려면 `worker/index.ts` 를 바꿔야 한다(**잠금표 파일 — 대표 승인 필요**) +
 *   무인증 파싱 증폭(DoS) 표면이 넓어진다. 그 판단은 `docs/decisions/` 로 올린다.
 */

/** 서버 전역 바디 한도(`worker/index.ts` `_bodyLimit1m`). 이 값보다 큰 `Content-Length` 는 라우트 전에 413. */
export const API_BODY_LIMIT_BYTES = 1_000_000

/**
 * multipart 경계·필드 헤더 오버헤드 여유.
 * `Content-Length` 는 **파일 크기가 아니라 본문 전체**다 — 파일이 천장과 같으면 경계 몇 줄 때문에 넘는다.
 */
export const MULTIPART_OVERHEAD_BYTES = 8_192

/** 업로드가 넘지 않아야 하는 **파일** 크기 천장. */
export const UPLOAD_MAX_FILE_BYTES = API_BODY_LIMIT_BYTES - MULTIPART_OVERHEAD_BYTES

/**
 * 압축 **전** 원본 상한 — 서버 한도가 아니라 **브라우저가 다룰 수 있는 크기**다.
 * 요즘 폰 사진은 4~12MB 라 종전 5MB 가드는 압축하면 올라갈 사진을 그냥 거절하고 있었다.
 * (디코드는 캔버스에 통째로 올라가므로 상한 자체는 남긴다 — 50MB RAW 로 탭을 죽이지 않게.)
 */
export const UPLOAD_SOURCE_MAX_BYTES = 25 * 1024 * 1024

/** 이 바이트 수가 전역 바디 한도를 통과하는가. */
export function fitsApiBodyLimit(bytes: number): boolean {
  return bytes <= UPLOAD_MAX_FILE_BYTES
}
