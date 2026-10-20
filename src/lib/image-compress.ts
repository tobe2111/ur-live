/**
 * 클라이언트 사이드 이미지 압축 헬퍼
 *
 * 목적: Cloudflare Images 유료 구독 회피 — 업로드 전 브라우저에서 강하게 압축
 *
 * 기본값:
 * - maxSizeMB: 0.5 (500KB) — 상품 이미지 권장
 * - maxWidthOrHeight: 1280 — 웹 디스플레이 충분
 * - WebP 변환 — JPEG 대비 25-35% 추가 절감, 모든 모던 브라우저 지원
 *
 * 🛡️ 2026-05-27 (loading P1): browser-image-compression (~51KB) 함수 내 dynamic import.
 *   이전: module-level eager import → image-compress.ts 가 ImageUpload / SellerProfileEdit /
 *   SellerPublicPage 등에서 import 되는 순간 critical path 51KB ↑.
 *   일반 사용자 (셀러 아님) 도 SellerPublicPage 가 lazy 라도 prefetch / hover 시 다운로드.
 *   변경: compressForUpload / compressForThumbnail 첫 호출 시점에만 fetch.
 */

export interface CompressOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  toWebP?: boolean
}

type ImageCompressionFn = (file: File, opts: Record<string, unknown>) => Promise<File>
let _imageCompressionPromise: Promise<ImageCompressionFn> | null = null
function loadImageCompression(): Promise<ImageCompressionFn> {
  if (!_imageCompressionPromise) {
    _imageCompressionPromise = import('browser-image-compression').then(m => m.default as ImageCompressionFn)
  }
  return _imageCompressionPromise
}

export async function compressForUpload(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const { maxSizeMB = 0.5, maxWidthOrHeight = 1280, toWebP = true } = opts

  // 이미 충분히 작으면 스킵 (chunk 다운로드도 회피)
  if (file.size < maxSizeMB * 1024 * 1024 && file.type.startsWith('image/')) {
    return file
  }

  const targetType = toWebP ? 'image/webp' : file.type
  const imageCompression = await loadImageCompression()

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

/**
 * 📄 문서(사업자등록증 등) — **읽을 수 있어야 하는 이미지**.
 *
 * 🩸 2026-09-15 (대표 신고 — 사업자등록증 업로드 413): 이 레포의 모든 이미지 업로드가
 *   `compressForUpload` 를 거치는데 **사업자등록증 두 경로만 원본을 그대로 올리고 있었다.**
 *   서버 상한은 10MB 인데 요즘 폰 사진은 그걸 쉽게 넘는다 → 413, 그리고 사장님은
 *   "사진을 줄여서 다시 찍으세요" 라는 말을 들을 곳이 없다(매장 등록이 거기서 막힌다).
 *
 * ⚠️ 상품 사진용 기본값(500KB · 1280px)을 쓰면 **안 된다** — 등록증의 사업자번호·상호·주소가
 *   뭉개져 어드민이 심사를 못 한다. 사람이 읽을 해상도를 남기고 크기만 확실히 낮춘다.
 */
export async function compressForDocument(file: File): Promise<File> {
  return compressForUpload(file, { maxSizeMB: 2, maxWidthOrHeight: 2400 })
}
