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

  // 🛡️ 2026-05-20: 파일명 보장 — camera API blob 은 name 이 비어있을 수 있음 (.webp 만 남으면
  //   백엔드 `dotIdx > 0` 검증 실패 → "허용되지 않는 파일 확장자". base 이름 없으면 timestamp fallback.
  if (toWebP) {
    const baseRaw = (file.name || '').replace(/\.[^.]+$/, '').trim()
    const base = baseRaw || `image_${Date.now()}`
    return new File([compressed], `${base}.webp`, { type: targetType })
  }
  if (!compressed.name || compressed.name === 'blob') {
    const ext = (file.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '')
    return new File([compressed], `image_${Date.now()}.${ext}`, { type: compressed.type })
  }
  return compressed
}

/**
 * 프로필/썸네일용 — 더 강한 압축
 */
export async function compressForThumbnail(file: File): Promise<File> {
  return compressForUpload(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1024 })
}
