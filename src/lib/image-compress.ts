/**
 * 클라이언트 사이드 이미지 압축 헬퍼
 *
 * 목적: Cloudflare Images 유료 구독 회피 — 업로드 전 브라우저에서 강하게 압축
 *
 * 기본값:
 * - maxSizeMB: 0.5 (500KB) — 상품 이미지 권장
 * - maxWidthOrHeight: 1280 — 웹 디스플레이 충분
 * - WebP 변환 — JPEG 대비 25-35% 추가 절감, 모든 모던 브라우저 지원
 */

import imageCompression from 'browser-image-compression'

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  toWebP?: boolean
}

export async function compressForUpload(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxSizeMB = 0.5, maxWidthOrHeight = 1280, toWebP = true } = opts

  // 이미 충분히 작으면 스킵
  if (file.size < maxSizeMB * 1024 * 1024 && file.type.startsWith('image/')) {
    return file
  }

  const targetType = toWebP ? 'image/webp' : file.type

  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: targetType,
    initialQuality: 0.82,
  })

  // 파일명 확장자도 webp 로 변경 (서버 확장자 검증 통과)
  if (toWebP) {
    const newName = file.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([compressed], newName, { type: targetType })
  }
  return compressed
}

/**
 * 프로필/썸네일용 — 더 강한 압축
 */
export async function compressForThumbnail(file: File): Promise<File> {
  return compressForUpload(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1024 })
}
