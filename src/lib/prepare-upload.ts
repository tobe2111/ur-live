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

/** 홈 히어로 권장 폭(`BANNER_SLOT_SPECS.hero.recommendedWidth`) — 이보다 줄이면 레티나에서 흐리다. */
export const HERO_MAX_EDGE = 2400
/** 히어로 압축 목표 — 파일 천장(≈0.99MB)보다 낮게 잡아 압축기 오차를 흡수한다. */
export const HERO_TARGET_MB = 0.85

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
 * - `hero: true` → 홈 배너(0.85MB · 2400px). 홈 최상단 전폭이라 레티나 해상도를 지킨다(2026-10-14).
 * - 기본 → 사진(0.5MB · 1280px).
 *
 * ⚠️ GIF 를 넘기지 말 것 — 압축기가 WebP 로 바꾸며 **첫 프레임만 남긴다**(움직임이 사라진다).
 *   움직이는 GIF 는 호출부가 크기만 보고 그대로 올리거나 거절한다(`BannerMediaUpload` 가 그렇게 한다).
 *
 * 압축 실패는 **업로드를 막지 않는다**(fail-soft — 원본으로 시도). 다만 그 원본이 천장을 넘으면
 * 413 을 맞기 전에 우리가 던진다 — 사용자는 브라우저 기본 오류가 아니라 우리 문구를 봐야 한다.
 *
 * @throws {UploadTooLargeError}
 */
export async function prepareImageForUpload(
  file: File,
  opts: { thumbnail?: boolean; hero?: boolean } = {},
): Promise<File> {
  if (file.size > UPLOAD_SOURCE_MAX_BYTES) {
    throw new UploadTooLargeError('source', file.size)
  }

  // ⚠️ 동적 import — 위 머리말 참조(잠금표 계약).
  const { compressForThumbnail, compressForUpload } = await import('./image-compress')
  const compress = opts.thumbnail
    ? compressForThumbnail
    : opts.hero
      ? (f: File) => compressForUpload(f, { maxSizeMB: HERO_TARGET_MB, maxWidthOrHeight: HERO_MAX_EDGE })
      : compressForUpload
  const ready = await compress(file).catch(() => file)

  if (!fitsApiBodyLimit(ready.size)) {
    throw new UploadTooLargeError('compressed', ready.size)
  }
  return ready
}
