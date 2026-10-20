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

/** 자리별 목표의 상한 — 파일 천장(≈0.99MB) 아래. 이보다 큰 목표는 압축해도 413 이다. */
export const SIZE_TARGET_CAP_MB = 0.9

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
 * - `size: { maxSizeMB, maxWidthOrHeight }` → 자리별 목표(상품 사진 800KB · 매장 사진 1920px 등).
 *   목표는 천장 아래로 **눌러 담는다**(`SIZE_TARGET_CAP_MB`) — 호출부가 큰 값을 적어도 413 이 안 난다.
 * - 기본 → 사진(0.5MB · 1280px).
 *
 * 🎞️ GIF 는 천장 안이면 **그대로** 둔다(2026-10-14) — 압축기는 WebP 로 바꾸며 첫 프레임만 남겨
 *   움직임이 사라진다. 천장을 넘는 GIF 만 정지 이미지로 줄인다. 움직임이 꼭 필요한 자리(배너)는
 *   호출부가 큰 GIF 를 먼저 거절한다(`BannerMediaUpload`).
 *
 * 압축 실패는 **업로드를 막지 않는다**(fail-soft — 원본으로 시도). 다만 그 원본이 천장을 넘으면
 * 413 을 맞기 전에 우리가 던진다 — 사용자는 브라우저 기본 오류가 아니라 우리 문구를 봐야 한다.
 *
 * @throws {UploadTooLargeError}
 */
export async function prepareImageForUpload(
  file: File,
  opts: { thumbnail?: boolean; hero?: boolean; size?: { maxSizeMB: number; maxWidthOrHeight: number } } = {},
): Promise<File> {
  if (file.size > UPLOAD_SOURCE_MAX_BYTES) {
    throw new UploadTooLargeError('source', file.size)
  }
  if (file.type === 'image/gif' && fitsApiBodyLimit(file.size)) return file

  // ⚠️ 동적 import — 위 머리말 참조(잠금표 계약).
  const { compressForThumbnail, compressForUpload } = await import('./image-compress')
  const compress = opts.thumbnail
    ? compressForThumbnail
    : opts.hero
      ? (f: File) => compressForUpload(f, { maxSizeMB: HERO_TARGET_MB, maxWidthOrHeight: HERO_MAX_EDGE })
      : opts.size
        ? (f: File) => compressForUpload(f, {
            maxSizeMB: Math.min(opts.size!.maxSizeMB, SIZE_TARGET_CAP_MB),
            maxWidthOrHeight: opts.size!.maxWidthOrHeight,
          })
        : compressForUpload
  const ready = await compress(file).catch(() => file)

  if (!fitsApiBodyLimit(ready.size)) {
    throw new UploadTooLargeError('compressed', ready.size)
  }
  return ready
}

/**
 * 천장 초과를 **사람이 할 수 있는 말**로. 호출부마다 문구를 지어내면 또 갈린다(이 파일이 생긴 이유).
 * `source` 는 원본이 브라우저가 다룰 수 없을 만큼 크다는 뜻이고, `compressed` 는 줄여도 넘는다는 뜻이다.
 */
export function uploadTooLargeMessage(err: UploadTooLargeError): string {
  return err.reason === 'source'
    ? '25MB 이하 사진만 올릴 수 있어요.'
    : '줄여도 너무 커요. 다른 사진으로 올려 주세요.'
}
