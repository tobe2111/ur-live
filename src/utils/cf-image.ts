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
  // 🛡️ 2026-05-27 (사용자 지적): 네이버 image search 결과는 다양한 외부 호스트.
  //   pstatic / blogfiles / postfiles / search.pstatic — 모두 원본 미변환 시 큰 트래픽.
  //   worker proxy 경유 → cf.image WebP transform + 1년 immutable cache.
  'search.pstatic.net',
  'shop-phinf.pstatic.net',
  'blogfiles.pstatic.net',
  'postfiles.pstatic.net',
  'phinf.pstatic.net',
  'mblogthumb-phinf.pstatic.net',
  // 카카오 image 호스트
  't1.daumcdn.net',
  'i1.daumcdn.net',
  'img1.daumcdn.net',
  'img2.daumcdn.net',
  'cf.daumcdn.net',
  // 🛡️ 2026-05-27 (Lighthouse 진단): img1.kakaocdn.net 등 — LCP 이미지가 934KB 그대로 다운로드되던 사고.
  //   카카오 계정/스토어 이미지가 이 호스트에 호스팅 — proxy 누락으로 WebP/AVIF 변환 회피되고 있었음.
  'img1.kakaocdn.net',
  'img2.kakaocdn.net',
  'k.kakaocdn.net',  // 이미 있을 수도 — Set 이라 중복 무관
  // 🛡️ 2026-05-27 (교환권 audit): KT Alpha / giftishow 카탈로그 image 호스트.
  //   goodsImgS / goodsImgB / brandIconImg 가 외부 호스트 반환 → cfImage 변환 안 되면 원본 다운로드.
  'image.giftishow.com',
  'imghub.giftishow.com',
  'bizapi.giftishow.com',
  'mall.giftishow.com',
  'gift.giftishow.com',
  'static.giftishow.com',
  // 🏭 2026-06-05 (사용자 신고 — 교환권 카드 그라데이션이 검정으로 귀결): 기프티쇼 이미지가 bizimg.giftishow.com
  //   호스트라 프록시 누락 → cross-origin → canvas 대표색 추출 실패 → 검정 fallback. giftishow.com 전체 서브도메인
  //   프록시(same-origin)로 추가 → 추출 성공 → 이미지색 반영(쇼핑 카드와 동일). (ADD only, 제거 금지 룰 준수)
  'bizimg.giftishow.com',
  'giftishow.com',
  'gift-img.kt.com',
  'image.kt.com',
  'static.kt.com',
  // 🛡️ 2026-05-27 (셀러 업로드): ImgBB — 셀러가 상품 이미지를 api.imgbb.com 으로 업로드 후 i.ibb.co 에 호스팅.
  //   메인/공구/상세 카드에서 자주 노출 → WebP/AVIF 변환 + 1년 immutable cache 효과 큼.
  'i.ibb.co',
  // Google 프로필 이미지 (OAuth/Gravatar fallback).
  'lh3.googleusercontent.com',
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
let _saveDataCached: boolean | null = null
function getSaveData(): boolean {
  if (_saveDataCached !== null) return _saveDataCached
  _saveDataCached = detectSaveData()
  return _saveDataCached
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

  // 🏭 2026-06-06 (사용자 신고 — 링크샵 배경/프로필 업로드 후 404): 워커가 R2 에서 서빙하는
  //   same-origin 업로드 이미지(/api/media/*, /api/upload/*)는 Cloudflare 의 /cdn-cgi/image/ URL
  //   리사이즈가 워커 서브요청 소스를 못 풀어 404 가 났음. 외부 이미지(Firebase 등)와 동일하게
  //   검증된 워커 프록시(/api/image/resize, cf.image fetch)로 경유 — 리사이즈가 비활성이어도 원본을
  //   200 으로 반환(절대 404 안 남). live.ur-team.com/ur-live.pages.dev 는 worker ALLOWED_HOSTS 포함.
  //   (ADD only — SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS·Save-Data 동작 불변)
  if (src.startsWith('/api/media/') || src.startsWith('/api/upload/')) {
    if (typeof window !== 'undefined') {
      const w = opts.width || 400
      const q = opts.quality || 85
      return `/api/image/resize?url=${encodeURIComponent(window.location.origin + src)}&w=${w}&q=${q}`
    }
    return src  // SSR/비브라우저 — 원본 그대로(R2 same-origin 서빙은 정상)
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
      // 🔬 2026-06-11 [LOADING_ADDITIVE] (사용자 신고 "카드 이미지 현저히 느림" — prod 실측 수리):
      //   기존 /api/image/resize 프록시는 워커 내부 cdn-cgi subrequest 에 리사이저가 적용되지 않아
      //   항상 원본 폴백(실측: 143KB 그대로 + 기프티쇼 origin 1~4.5s + 엣지캐시 미적중).
      //   zone 리사이저 직접 래핑은 실측 OK(cf-resized, 143KB→18KB, zone 캐시) — 브라우저가
      //   /cdn-cgi/image/<옵션>/<외부절대URL> 을 직접 요청. same-origin 응답이라 canvas 대표색
      //   추출(2026-06-05 프록시 도입 사유였던 CORS)도 동일하게 안전.
      //   ⚠️ 당일 회귀 교훈(카카오 프로필 깨짐): cdn-cgi 직결은 **리사이저의 원본 fetch 가 성공하는
      //   호스트에서만** 안전 — 기프티쇼/KT 만 실측 검증됨. kakaocdn 등 핫링크 보호 가능 호스트는
      //   기존 프록시 유지(느려도 항상 표시). 신규 호스트는 prod-diag 로 cf-resized 실측 후 추가.
      //   ⚠️ 워커 경로(/api/media 등)는 zone 리사이저가 origin 을 못 풀어 404(2026-06-06 사고) —
      //   그 분기는 기존 프록시 유지. EXTERNAL_PROXY_HOSTS 목록·Save-Data quality 불변(제거 X).
      const CDN_CGI_VERIFIED = ['giftishow.com', 'kt.com']
      if (CDN_CGI_VERIFIED.some(h => host === h || host.endsWith('.' + h))) {
        return `/cdn-cgi/image/width=${w},quality=${q},format=auto/${src}`
      }
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
