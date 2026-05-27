/**
 * 🛡️ 2026-05-15 (Lighthouse): Cloudflare Image Resizing URL 변환.
 *
 * Cloudflare Pages 의 /cdn-cgi/image/... 패턴으로 이미지 동적 resize.
 *
 * 효과:
 *   - WebP/AVIF 자동 변환 (브라우저 Accept 기반)
 *   - 디바이스 해상도 별 width 최적화 (LCP ↓)
 *   - 원본 보다 50-80% 트래픽 절감
 *
 * 비용:
 *   - Pages Standard plan: 무료 (월 100만 변환까지)
 *   - 초과 시 $5 / 추가 100만 (현실: 1만 사용자 시 충분)
 *
 * 사용:
 *   <img src={cfImage(p.image_url, { width: 400, format: 'auto' })} ... />
 *
 * 주의:
 *   - 같은 도메인 (live.ur-team.com) 이미지만 동작 (외부 URL X)
 *   - 외부 URL (i.ibb.co 등) 는 그대로 반환
 *   - SVG 는 변환 불가 — 그대로 반환
 */

interface ResizeOptions {
  width?: number
  height?: number
  quality?: number  // 1-100, default 85
  format?: 'auto' | 'webp' | 'avif' | 'json'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
}

const SUPPORTED_HOSTS = new Set([
  'live.ur-team.com',
  'ur-live.pages.dev',
])

// 🛡️ 2026-05-27 (loading P0): 외부 origin (Firebase Storage 등) 도 변환.
//   기존: same-zone 이미지만 변환 → 대부분의 상품 이미지 (Firebase Storage) 가 원본 1MB+ 그대로 → LCP 1-3s
//   변경: 외부 도메인은 worker proxy (/api/image/resize) 경유 — cf.image transform + 1년 immutable cache.
//         첫 요청만 worker, edge cache hit 이후 worker 호출 0 (무료 한도 안전).
const EXTERNAL_PROXY_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'img.youtube.com',
  'k.kakaocdn.net',
  'images.unsplash.com',
])

// 🛡️ 2026-05-27 (mobile data saver): Save-Data 감지 — 데이터 절약 모드 사용자에게 quality 65 로 다운.
//   브라우저가 Chrome 모바일 / Lite mode 등에서 navigator.connection.saveData=true 전송.
//   효과: 모바일 데이터 절약 사용자에게 image 트래픽 추가 ~25% ↓.
function detectSaveData(): boolean {
  if (typeof navigator === 'undefined') return false
  try {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    return !!conn?.saveData
  } catch { return false }
}
const _saveDataCached: boolean | null = null
function getSaveData(): boolean {
  if (_saveDataCached !== null) return _saveDataCached
  return detectSaveData()
}

export function cfImage(src: string | undefined | null, opts: ResizeOptions = {}): string {
  if (!src) return ''
  if (typeof src !== 'string') return ''

  // data: URL, blob: URL 그대로
  if (src.startsWith('data:') || src.startsWith('blob:')) return src

  // SVG / GIF (애니메이션) 그대로 — Cloudflare 변환 부작용
  if (/\.(svg|gif)(\?|$)/i.test(src)) return src

  // 🛡️ Save-Data 사용자는 quality 85 → 65 (트래픽 25% ↓ but 시각적 거의 동일)
  if (getSaveData() && !opts.quality) {
    opts = { ...opts, quality: 65 }
  }

  // 절대 URL 인지 확인
  const isAbsolute = /^https?:\/\//i.test(src)
  let host = ''
  if (isAbsolute) {
    try { host = new URL(src).hostname } catch { return src }
  } else {
    host = 'live.ur-team.com'  // 상대 경로는 같은 도메인 가정
  }

  // 외부 도메인 (Firebase Storage 등) → worker proxy 경유
  if (isAbsolute) {
    const isSupported = [...SUPPORTED_HOSTS].some(h => host === h)
    const isExternalProxyable = [...EXTERNAL_PROXY_HOSTS].some(h => host === h || host.endsWith('.' + h))
    if (!isSupported && isExternalProxyable) {
      const w = opts.width || 400
      const q = opts.quality || 85
      return `/api/image/resize?url=${encodeURIComponent(src)}&w=${w}&q=${q}`
    }
    if (!isSupported && !isExternalProxyable) return src  // 미지원 도메인 → 원본
  }

  const params: string[] = []
  if (opts.width) params.push(`width=${opts.width}`)
  if (opts.height) params.push(`height=${opts.height}`)
  if (opts.quality) params.push(`quality=${opts.quality}`)
  params.push(`format=${opts.format || 'auto'}`)
  if (opts.fit) params.push(`fit=${opts.fit}`)

  const paramsStr = params.join(',')
  const cleanSrc = isAbsolute ? src.replace(/^https?:\/\/[^/]+/, '') : src

  return `/cdn-cgi/image/${paramsStr}${cleanSrc.startsWith('/') ? '' : '/'}${cleanSrc}`
}

/**
 * srcset 헬퍼 — 1x / 2x / 3x DPI 자동 생성.
 *
 * 사용:
 *   <img
 *     src={cfImage(url, { width: 400 })}
 *     srcSet={cfSrcSet(url, 400)}
 *     sizes="(max-width: 768px) 100vw, 400px"
 *   />
 */
export function cfSrcSet(src: string | undefined | null, baseWidth: number): string {
  if (!src) return ''
  // 🛡️ 2026-05-27: 외부 도메인은 worker proxy 1회만 (DPI별 변환은 cf.image 가 처리).
  //   1x/2x/3x 모두 별도 fetch 시 proxy 3회 → 비효율. 단일 high-res 만 반환.
  if (/^https?:\/\//i.test(src)) {
    const host = (() => { try { return new URL(src).hostname } catch { return '' } })()
    const isExternalProxy = [...EXTERNAL_PROXY_HOSTS].some(h => host === h || host.endsWith('.' + h))
    if (isExternalProxy) {
      return `${cfImage(src, { width: baseWidth * 2 })} 2x`
    }
  }
  return [1, 2, 3]
    .map(dpi => `${cfImage(src, { width: baseWidth * dpi })} ${dpi}x`)
    .join(', ')
}
