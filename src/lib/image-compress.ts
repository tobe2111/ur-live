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
  const fast = await encodeDocumentFast(file).catch(() => null); if (fast) return fast
  return compressForUpload(file, { maxSizeMB: 2, maxWidthOrHeight: 2400 })
}

/**
 * ⚡ 2026-11-11 (대표 신고 — *"사진 올리는 속도 최적화 필요"*, 가게 등록 `/store/biz-cert`): 문서 사진의 **빠른 길**.
 *
 * 느렸던 이유 둘:
 *   ① 2MB 미만이면 **원본을 그대로** 올렸다 — 폰 회선의 올리는 속도는 받는 속도의 몇 분의 일이라 1.9MB 가 그대로 대기 시간이다.
 *   ② 2MB 이상이면 압축 라이브러리(~51KB)를 그때 내려받고, 그 워커가 CDN 스크립트를 또 받으려다(CSP 가 막는다) 메인 스레드로 물러난다.
 * 여기선 브라우저 내장 기능만 쓴다(내려받는 것 0 · 한 번에 끝): 긴 변 `DOCUMENT_FAST_MAX_SIDE` 로 줄여 WebP 로 다시 담는다.
 * WebP 를 못 만드는 브라우저(옛 iOS 사파리 — toBlob 이 PNG 를 돌려준다)는 JPEG 로.
 *
 * 🔑 가독성 하한은 그대로다 — 긴 변 2000px 이면 A4 등록증의 본문 글자가 20px 남짓이다(상품 사진 1280px 로 내리지 말 것 · 2026-09-15).
 * 실패하거나(디코드 불가·캔버스 없음) 결과가 천장을 넘으면 `null` → 종전 길(라이브러리)이 받는다. 원본보다 커지면 원본을 돌려준다.
 */
export const DOCUMENT_FAST_SKIP_BYTES = 400 * 1024
export const DOCUMENT_FAST_MAX_SIDE = 2000
export const DOCUMENT_FAST_QUALITY = 0.8
const DOCUMENT_FAST_CEILING_BYTES = 2 * 1024 * 1024

/** 긴 변을 `maxSide` 에 맞춘 크기(키우지는 않는다). */
export function fitWithin(w: number, h: number, maxSide: number): { w: number; h: number } {
  const k = Math.min(1, maxSide / Math.max(w, h, 1))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export async function encodeDocumentFast(file: File): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null
  if (file.size <= DOCUMENT_FAST_SKIP_BYTES) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  try {
    const { w, h } = fitWithin(bmp.width, bmp.height, DOCUMENT_FAST_MAX_SIDE)
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d'); if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, w, h)
    const blobOf = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
    let blob = await blobOf('image/webp', DOCUMENT_FAST_QUALITY)
    if (!blob || blob.type !== 'image/webp') blob = await blobOf('image/jpeg', 0.85)
    if (!blob || blob.size < 100 || blob.size > DOCUMENT_FAST_CEILING_BYTES) return null
    if (blob.size >= file.size) return file.size <= DOCUMENT_FAST_CEILING_BYTES ? file : null
    const base = (file.name || '').replace(/\.[^.]+$/, '').trim() || `image_${Date.now()}`
    return new File([blob], `${base}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type })
  } finally { bmp.close?.() }
}
