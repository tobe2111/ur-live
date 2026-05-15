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
  // 외부 CDN 도 origin 등록 시 동작하나 보수적으로 같은 도메인만
])

export function cfImage(src: string | undefined | null, opts: ResizeOptions = {}): string {
  if (!src) return ''
  if (typeof src !== 'string') return ''

  // data: URL, blob: URL 그대로
  if (src.startsWith('data:') || src.startsWith('blob:')) return src

  // SVG / GIF (애니메이션) 그대로 — Cloudflare 변환 부작용
  if (/\.(svg|gif)(\?|$)/i.test(src)) return src

  // 절대 URL 인지 확인
  const isAbsolute = /^https?:\/\//i.test(src)
  let host = ''
  if (isAbsolute) {
    try { host = new URL(src).hostname } catch { return src }
  } else {
    host = 'live.ur-team.com'  // 상대 경로는 같은 도메인 가정
  }

  // 지원 호스트만 변환 (외부 이미지는 그대로 — CF 가 변환 못 함)
  if (!SUPPORTED_HOSTS.has(host)) return src

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
  return [1, 2, 3]
    .map(dpi => `${cfImage(src, { width: baseWidth * dpi })} ${dpi}x`)
    .join(', ')
}
