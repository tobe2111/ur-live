/**
 * 📤 업로드 전 준비 — **압축하고, 서버 천장을 넘는지 우리가 먼저 판정한다.**
 *
 * 🩸 2026-10-11 (대표 신고 — 프로필 사진 413): 이 레포의 이미지 업로드는 **거의** 전부 압축을 거치는데
 *   세 곳(프로필 사진 · 리뷰 사진 · 영입 증빙)만 **원본을 그대로** 올리고 있었다. 전역 바디 한도가
 *   1MB 라(`shared/upload-limits.ts` 참조) 폰 사진은 예외 없이 413 이고, 사용자가 받는 것은
 *   우리 문구가 아니라 미들웨어의 "요청 본문이 너무 큽니다" 다.
 *
 * 🔑 **왜 호출부마다 세 줄을 적지 않고 헬퍼를 두는가**: 압축기·천장·실패 문구가 호출부마다 갈리면
 *   같은 사고가 네 번째 자리에서 또 난다(2026-09-15 등록증 413 이 이미 두 번째였다).
 *   이 함수 하나만 통과하면 세 자리가 **같은 규칙**으로 움직이고, 가드도 이 이름 하나만 본다.
 *
 * ⚠️ `image-compress.ts` 는 **잠금표 파일**이다(`browser-image-compression` ~51KB 를 함수 안에서
 *   dynamic import — module-level eager 금지). 그래서 여기서도 **동적으로** 불러 그 계약을 지킨다
 *   (정적 import 로 바꾸면 이 모듈을 쓰는 화면의 첫 페인트에 51KB 가 실린다).
 */
import { UPLOAD_SOURCE_MAX_BYTES, fitsApiBodyLimit } from '@/shared/upload-limits'

/** `source` = 압축 전 원본이 너무 큼 · `compressed` = 압축했는데도 천장을 넘음(사실상 드물다). */
export type UploadTooLargeReason = 'source' | 'compressed'

export class UploadTooLargeError extends Error {
  constructor(
    readonly reason: UploadTooLargeReason,
    readonly bytes: number,
  ) {
    super(`upload-too-large:${reason}:${bytes}`)
    this.name = 'UploadTooLargeError'
  }
}

/**
 * 이미지를 업로드할 수 있는 상태로 만든다.
 *
 * - `thumbnail: true` → 프로필·아바타(0.3MB · 1024px). 작게 보이는 자리라 더 강하게 줄인다.
 * - 기본 → 사진(0.5MB · 1280px).
 *
 * 압축 실패는 **업로드를 막지 않는다**(fail-soft — 원본으로 시도). 다만 그 원본이 천장을 넘으면
 * 413 을 맞기 전에 우리가 던진다 — 사용자는 브라우저 기본 오류가 아니라 우리 문구를 봐야 한다.
 *
 * @throws {UploadTooLargeError}
 */
export async function prepareImageForUpload(
  file: File,
  opts: { thumbnail?: boolean } = {},
): Promise<File> {
  if (file.size > UPLOAD_SOURCE_MAX_BYTES) {
    throw new UploadTooLargeError('source', file.size)
  }

  // ⚠️ 동적 import — 위 머리말 참조(잠금표 계약).
  const { compressForThumbnail, compressForUpload } = await import('./image-compress')
  const compress = opts.thumbnail ? compressForThumbnail : compressForUpload
  const ready = await compress(file).catch(() => file)

  if (!fitsApiBodyLimit(ready.size)) {
    throw new UploadTooLargeError('compressed', ready.size)
  }
  return ready
}
