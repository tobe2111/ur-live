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
 *
 * ✅ 2026-10-13 대표 승인(*"기본안대로 모두 승인"* — `docs/decisions/archive/2026-10-11-upload-body-limit.md` 안 1):
 *   압축으로 **풀 수 없는 두 엔드포인트만** 천장을 올린다. 값은 이 파일의 `API_BODY_LIMIT_OVERRIDES`
 *   **한 곳**에 있고 워커 미들웨어(`bodyLimitByPath(apiBodyLimitFor)`)·업로드 라우트·클라 가드가 전부
 *   여기서 받는다 — 세 군데가 다른 말을 하던 이 파일의 출발점을 되풀이하지 않기 위해서다.
 *     · `/api/upload/business-cert` 2.2MB — 등록증은 해상도를 깎으면 심사 불가(2026-09-15)
 *     · `/api/upload/banner-video` 10MB(+경계) — 브라우저에 영상 압축 수단이 없다. `requireAdmin`
 *   `/api/upload/image` 는 **그대로 1MB** 다(압축이 해결했다 — 넓히면 IP 당 1GB/10분이 된다).
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

/** 등록증·영업신고증 파일 천장 — `compressForDocument`(2MB 목표)가 들어가고 경계까지 담기는 값. */
export const BUSINESS_CERT_BODY_LIMIT_BYTES = 2_200_000
export const BUSINESS_CERT_MAX_FILE_BYTES = BUSINESS_CERT_BODY_LIMIT_BYTES - MULTIPART_OVERHEAD_BYTES

/** 홈 히어로 영상 파일 천장(라우트가 안내하는 "최대 10MB" 그대로). 본문 천장은 경계만큼 더 크다. */
export const BANNER_VIDEO_MAX_FILE_BYTES = 10 * 1024 * 1024
export const BANNER_VIDEO_BODY_LIMIT_BYTES = BANNER_VIDEO_MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES

/**
 * 경로별 본문 천장 — **정확한 경로 일치만**(접두 일치 금지: `/api/upload/` 전체가 열리는 것을 막는다).
 * `Map` 인 이유: 평범한 객체로 두면 `constructor` 같은 프로토타입 키가 숫자가 아닌 값을 돌려줘
 * 비교가 늘 거짓 = **천장 없음**이 된다. 경로는 늘 `/api/` 로 시작해 지금은 안 걸리지만 구조로 막는다.
 */
export const API_BODY_LIMIT_OVERRIDES: ReadonlyMap<string, number> = new Map([
  ['/api/upload/business-cert', BUSINESS_CERT_BODY_LIMIT_BYTES],
  ['/api/upload/banner-video', BANNER_VIDEO_BODY_LIMIT_BYTES],
])

/** 이 경로의 본문 천장. 목록에 없으면 전역 1MB. */
export function apiBodyLimitFor(path: string): number {
  return API_BODY_LIMIT_OVERRIDES.get(path) ?? API_BODY_LIMIT_BYTES
}
