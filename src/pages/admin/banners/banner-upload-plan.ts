import { BANNER_VIDEO_MAX_FILE_BYTES, fitsApiBodyLimit } from '@/shared/upload-limits'

/**
 * 🖼️ 배너 업로드 계획 — 파일을 받으면 **올리기 전에** 무엇을 할지 정한다.
 *
 * 🩸 2026-10-14 (대표 지시 *"배너 업로드 문제도 해결해줘"*): 배너 이미지 업로드 화면은
 *   *"JPG · PNG · WebP · GIF · 최대 10MB"* 라고 안내하면서 원본을 **그대로** `/api/upload/image` 로
 *   보냈다. 그 엔드포인트의 본문 천장은 1MB 라(`shared/upload-limits.ts` — 다른 업로드는 전부 압축을
 *   거친다) 1MB 를 넘는 배너 사진은 전부 *"요청 본문이 너무 큽니다"* 로 거절됐다. 안내는 10배 거짓말이었다.
 *   그리고 가드(`upload-body-limit-2026-10-11.test.ts` ②)가 이 파일을 **영상 사유로 통째 면제**하고
 *   있어서 같은 파일의 이미지 경로가 함께 눈에서 빠졌다.
 *
 * 🔑 처방은 천장을 올리는 게 아니라 **다른 업로드처럼 브라우저에서 줄여 올리는 것**이다
 *   (천장을 올리면 공용 엔드포인트가 IP 당 1GB/10분이 된다 — 2026-10-13 결재에서 기각한 길).
 *   압축은 공용 `prepareImageForUpload({ hero: true })` 가 한다(2400px · 0.85MB).
 *
 * ⚠️ GIF 는 줄이지 않는다 — 압축기는 첫 프레임만 남겨 **움직임이 사라진다.** 1MB 이하면 그대로,
 *   넘으면 영상(MP4)으로 올리라고 말한다. 조용히 정지 이미지로 바꾸는 것보다 정직하다.
 */

export type BannerUploadPlan =
  | { action: 'upload' }
  | { action: 'compress' }
  | { action: 'reject'; message: string }

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm']

export function planBannerUpload(file: { type: string; size: number }, kind: 'image' | 'video'): BannerUploadPlan {
  if (kind === 'video') {
    if (!VIDEO_TYPES.includes(file.type)) return { action: 'reject', message: 'MP4 또는 WebM 영상만 올릴 수 있어요.' }
    if (file.size > BANNER_VIDEO_MAX_FILE_BYTES) {
      return { action: 'reject', message: '영상은 10MB 이하만 올릴 수 있어요. 길이를 줄이거나 화질을 낮춰 주세요.' }
    }
    return { action: 'upload' }
  }

  if (!IMAGE_TYPES.includes(file.type)) return { action: 'reject', message: 'JPG · PNG · WebP · GIF 이미지만 올릴 수 있어요.' }

  if (file.type === 'image/gif') {
    if (fitsApiBodyLimit(file.size)) return { action: 'upload' }
    return { action: 'reject', message: '움직이는 GIF 는 1MB 이하만 올릴 수 있어요. 더 크면 영상(MP4)으로 올려 주세요.' }
  }

  return { action: 'compress' }
}

/** 원본이 너무 크거나 줄여도 천장을 넘을 때의 안내(서버의 413 문구보다 먼저, 사람이 할 수 있는 말로). */
export function bannerTooLargeMessage(reason: 'source' | 'compressed'): string {
  return reason === 'source'
    ? '25MB 이하 사진만 다룰 수 있어요.'
    : '줄여도 1MB 를 넘어요. 더 단순한 사진이거나 해상도가 낮은 사진으로 올려 주세요.'
}
