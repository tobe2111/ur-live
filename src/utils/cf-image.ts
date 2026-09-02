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
 *   - 같은 도메인 (urdeal.kr) 이미지만 동작 (외부 URL X)
 *   - 외부 URL (i.ibb.co 등) 는 그대로 반환
 *   - SVG 는 변환 불가 — 그대로 반환
 */

interface ResizeOptions {
  width?: number
  height?: number
  quality?: number  // 1-100, default 85
  format?: 'auto' | 'webp' | 'avif' | 'json'
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  /**
   * 🎯 2026-08-31 [UNLOCK_LOADING] (대표 승인 — "너가 얘기해준 가장 이상적인 방법들로 할게")
   *   자를 **위치**. 상세 히어로처럼 고정 프레임에 사진을 채워야 할 때, 우리 사진은 비율이 제각각이라
   *   (네이버 사진 70장 실측: 세로가 더 긴 것 37%, 중앙값 정확히 1:1) 가운데를 자르면 피사체가
   *   잘려 나간다. `auto` 는 Cloudflare 가 피사체를 찾아 자른다 — 라이브 실측으로 동작 확인
   *   (`cf-resized: internal=ram`, center 대비 결과 바이트가 달라짐 = 실제로 다른 곳을 자른다).
   */
  gravity?: 'auto' | 'center' | 'left' | 'right' | 'top' | 'bottom'
}

/**
 * 크롭 옵션 조각 — **`gravity` 를 명시했을 때만** 나온다.
 * ⚠️ 이 게이트가 중요하다: 검증 호스트 빠른 경로는 옵션 문자열을 손으로 조립하고 있어서,
 *    조건 없이 붙이면 **기존 모든 호출의 URL 이 바뀌어** 엣지 캐시가 통째로 미스 난다.
 *    지금 `gravity` 를 넘기는 곳은 상세 히어로뿐이라, 나머지는 URL 이 바이트 그대로다.
 */
function cropFrag(o: ResizeOptions): string {
  if (!o.gravity) return ''
  const h = o.height ? `,height=${o.height}` : ''
  return `${h},fit=${o.fit || 'cover'},gravity=${o.gravity}`
}

const SUPPORTED_HOSTS = new Set([
  'urdeal.kr',
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
  // 🔎 2026-09-02 (대표 "QA 도와줘" — 라이브 홈 실측): 데모 사진 출처가 카카오 플레이스라 **임의 CDN** 이 섞인다.
  //   목록에 없으면 `cfImage` 가 원본 URL 을 그대로 돌려줘 **리사이저를 아예 안 거친다**(홈 한 화면에서 5장 실측).
  //   활성 상품 15개(커버 4 · 갤러리 11)가 이 상태였다. 아래 둘은 cf-resized 실측 통과 → CDN_CGI_VERIFIED 승격.
  'cloudfront.net',           // 실측 internal=ok (d2uja84sd90jmv / d12zq4w4guyljn, w200/400/600)
  'digitaloceanspaces.com',   // thx2.sfo2.cdn.digitaloceanspaces.com
  'gift-img.kt.com',
  'image.kt.com',
  'static.kt.com',
  // 🛡️ 2026-05-27 (셀러 업로드): ImgBB — 셀러가 상품 이미지를 api.imgbb.com 으로 업로드 후 i.ibb.co 에 호스팅.
  //   메인/공구/상세 카드에서 자주 노출 → WebP/AVIF 변환 + 1년 immutable cache 효과 큼.
  'i.ibb.co',
  // Google 프로필 이미지 (OAuth/Gravatar fallback).
  'lh3.googleusercontent.com',
  // 🏁 2026-06-11: R2 업로드 공개 도메인 (PUBLIC_R2_URL) — CDN_CGI_VERIFIED 와 짝, 실측 통과.
  'media.ur-team.com',
  // 🏁 2026-07-02 [LOADING_ADDITIVE] (대표 신고 "홈 이미지 늦게 뜸" — 라이브 실측): 홈 동네딜 피드
  //   이미지 호스트 누락분. ldb-phinf/naverbooking-phinf 는 '-phinf' 형태라 위 'phinf.pstatic.net'
  //   suffix 매칭(`'.' + host`)에 안 걸려 **원본 그대로**(실측 1,055KB/1.6s — 300px 카드에 1MB)
  //   다운로드되고 있었음. apex 'pstatic.net' 등재로 전 네이버 정적 서브도메인 커버(-phinf 변형 포함).
  'pstatic.net',
  'imgnews.naver.net',          // 네이버 뉴스 이미지 (셀러 등록 상품에 사용례)
  'yt3.googleusercontent.com',  // 유튜브 채널 아바타 (브랜드 아이콘)
  'picsum.photos',              // 데모/시드 이미지
  // 🚑 2026-07-02 (대표 신고 CSP/cert — 네이버 쇼핑 이미지): shop1.phinf.naver.net 등 *.phinf.naver.net 는
  //   http:// 로 저장돼 브라우저 직결 시 CSP 차단 + https 승격 시 인증서 오류(ERR_CERT_COMMON_NAME_INVALID)로
  //   **완전 깨짐**. cdn-cgi 리사이저는 http 원본 fetch 가능(라이브 실측 cf-resized ok, 50KB) → same-origin
  //   https 로 서빙되며 CSP/cert 문제 원천 해소. apex 등재로 shop1/shop2… 전 서브도메인 커버.
  'phinf.naver.net',
  // 🚀 2026-08-19: apex 등재로 kakaocdn 전 서브도메인 커버(추가만 — 제거 0).
  'kakaocdn.net',
  'daumcdn.net',
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

/**
 * 🚑 2026-08-11 [UNLOCK_LOADING] (AB 스윕 라이브 실측): cdn-cgi **경로에 박히는 원본 URL** 의
 * 퍼센트 기호를 한 번 더 이스케이프한다.
 *
 * 네이버 지도 사진 중 **파일명이 한글**인 것들은 URL 이 이미 퍼센트 인코딩돼 있다:
 * `…/1781789159233fqISB_JPEG/%B8%DE%B4%BA%C6%C7_….jpg`(EUC-KR). 이걸 그대로
 * `/cdn-cgi/image/<옵션>/<URL>` 경로에 이어붙이면 **리사이저가 경로를 디코딩**해 원본 fetch 주소가
 * 달라지고 **404** 가 난다. 실측:
 *
 * ```
 * raw            200  429,680B
 * cdn-cgi 그대로  404      151B   ← onerror=redirect 도 안 걸린다(리사이저가 404 를 직접 반환)
 * %→%25 한 번    200  151,961B   ← 정상 리사이즈
 * ```
 * 라이브 영향: 갤러리 이미지에 `%` 를 가진 활성 상품 **134개**(커버 1개).
 *
 * ⚠️ `encodeURIComponent` 를 쓰면 안 된다 — `:` `/` 까지 인코딩돼 URL 이 통째로 깨진다.
 *
 * 🔴 **쿼리스트링은 절대 건드리지 않는다.** 처음엔 URL 전체의 `%` 를 바꿨는데 라이브 표본 5개로
 * 재보니 그게 **회귀**였다 — 카카오 썸네일은 쿼리에 서명을 달고(`…&signature=TKCd…%3D&ts=…`),
 * 그 `%3D` 를 `%253D` 로 바꾸면 서명이 깨져 리사이저가 원본을 못 가져온다. 실측:
 *
 * ```
 *                       raw        그대로     전체 %25    경로만 %25
 * EUC-KR 한글 파일명   200/5.8M    404/151B   200/102KB   200/102KB   ← 수리 대상
 * 쿼리에 서명(%3D)     200/117KB   200/225KB  200/820B🔴  200/225KB   ← 건드리면 안 되는 쪽
 * ```
 * 깨진 것은 **경로에 박힌 원본 URL** 이지 쿼리가 아니므로, 경로만 고치는 것이 정확히 맞는 범위다.
 */
function cdnCgiSafe(src: string): string {
  if (!src.includes('%')) return src
  const q = src.indexOf('?')
  const path = q === -1 ? src : src.slice(0, q)
  return path.replace(/%/g, '%25') + (q === -1 ? '' : src.slice(q))
}

// 🔀 2026-09-02 [UNLOCK_LOADING] (대표 "그것도 다 진행해줘 · 가장 이상적으로"): 이 목록을 **모듈 스코프로 올린다.**
//   전에는 `EXTERNAL_PROXY_HOSTS` 안쪽에서만 검사해서, **목록에 없는** 핫링크 차단 호스트(예: 새로 생긴
//   네이버 블로그 서브도메인)는 아래 미지-호스트 기본 경로(cdn-cgi)로 가 403 → 302 → 또 403 = 깨진 사진이
//   된다. 값·순서 불변(동일성은 `hotlink-rehost-scope.test.ts` 가 SSOT 와 대조).
// 🚑 2026-07-21 [UNLOCK_LOADING] (대표 신고 "네이버 사진 안 뜸 403" — 라이브 실측):
//   네이버 **블로그 CDN**(postfiles/mblogthumb/dthumb/blogfiles.pstatic.net)은 **우리 도메인
//   referer 요청만 403** 핫링크 차단(실측: no-referer→200, referer=urdeal.kr→403). cdn-cgi
//   리사이저는 페이지 referer 를 달고 네이버에 요청 → 403 → 사진 안 뜸. `onerror=redirect` 도
//   브라우저가 원본을 우리 도메인 referer 로 재요청 → 또 403. → 이 호스트들만 **워커 프록시**
//   (/api/image/resize)로 강제: 워커가 **referer 없이 서버측 fetch → 200**(폴백 경로). 엣지+R2
//   캐시로 반복 비용 0. 네이버 플레이스 CDN(ldb/shop/naverbooking-phinf)은 차단 안 해 cdn-cgi 유지.
// 2026-07-21 전수조사 보강: 블로그 CDN(실측 403) + shop/booking-phinf(미실측이나 핫링크 위험 —
//   워커 프록시는 안전하면 cdn-cgi 통과·막히면 no-referer 폴백이라 어느 쪽이든 안전). place CDN
//   (ldb-phinf)은 대표사진 출처라 제외(cdn-cgi 유지).
const HOTLINK_BLOCKED_HOSTS = ['postfiles.pstatic.net', 'mblogthumb-phinf.pstatic.net', 'dthumb-phinf.pstatic.net', 'blogfiles.pstatic.net', 'blogpfthumb-phinf.pstatic.net', 'shop-phinf.pstatic.net', 'naverbooking-phinf.pstatic.net']

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

  // 🏭 2026-06-06 (사용자 신고 — 유어샵 배경/프로필 업로드 후 404): 워커가 R2 에서 서빙하는
  //   same-origin 업로드 이미지(/api/media/*, /api/upload/*)는 Cloudflare 의 /cdn-cgi/image/ URL
  //   리사이즈가 워커 서브요청 소스를 못 풀어 404 가 났음. 외부 이미지(Firebase 등)와 동일하게
  //   검증된 워커 프록시(/api/image/resize, cf.image fetch)로 경유 — 리사이즈가 비활성이어도 원본을
  //   200 으로 반환(절대 404 안 남). urdeal.kr/ur-live.pages.dev 는 worker ALLOWED_HOSTS 포함.
  //   (ADD only — SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS·Save-Data 동작 불변)
  // 🏁 2026-06-11 [LOADING_ADDITIVE] (사용자 승인 — R2 커스텀 도메인 media.ur-team.com 연결):
  //   prod 실측(diag): https://media.ur-team.com/<key> 200 image/jpeg + zone 리사이저 래핑 시
  //   cf-resized OK · 779KB→9.7KB(128px) · 1y immutable 캐시. 레거시 저장분('/api/media/<key>')도
  //   같은 객체이므로 도메인 매핑만으로 전부 즉시 치유(재업로드 불필요).
  //   워커 프록시(/api/image/resize)는 리사이즈 불가(플랫폼 제약 — 06-11 실측)라 업로드 이미지의
  //   유일한 변환 경로가 이것. 도메인 장애 시 롤백 = 이 분기만 이전 프록시로 복원.
  if (src.startsWith('/api/media/')) {
    const w = opts.width || 400
    const q = opts.quality || 85
    // 🛡️ 2026-07-14 (대표 신고 "이미지가 떴다 안 떴다 불안정"): onerror=redirect 추가.
    //   피드가 카드 수십~수백 장을 동시에 열면 zone 리사이저가 콜드-fetch 를 그만큼 동시 수행 →
    //   일부가 순간 타임아웃(524) 시 기존엔 그냥 깨졌음(캐시 후 새로고침하면 정상 = "불안정" 체감).
    //   onerror=redirect = 리사이즈 실패 시 Cloudflare 가 원본(media.ur-team.com/<key>, 항상 200)으로
    //   302 → 브라우저가 원본 로드(자가치유). 라이브 실측: 유효 이미지 200 유지 + param 수용 확인.
    //   외부 호스트 분기(아래)가 이미 쓰는 패턴을 업로드 이미지에도 확장(제거 아님 — additive).
    return `/cdn-cgi/image/width=${w},quality=${q},format=auto,onerror=redirect${cropFrag(opts)}/https://media.ur-team.com/${src.slice('/api/media/'.length)}`
  }
  if (src.startsWith('/api/upload/')) {
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
    host = 'urdeal.kr'  // 상대 경로는 같은 도메인 가정
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
      // media.ur-team.com: 2026-06-11 diag 실측 통과 (cf-resized, 779KB→9.7KB) — 신규 업로드 절대 URL 용.
      // 🟢 2026-07-13 [UNLOCK_LOADING] (대표 신고 "홈 첫방문 느림" — 라이브 실측 후 복원): giftishow 가
      //   과거(2026-06-17) 데이터센터/CF IP 를 차단해 cdn-cgi 524/403 → raw 강제였으나, **현재 차단 해제됨**.
      //   prod 실측(5/5 이미지 `cf-resized: internal=ok`, 원본 20~86KB → 3~12KB, 4~6× 축소, same-origin+엣지캐시).
      //   홈 교환권 피드 이미지 = 100% bizimg.giftishow.com 라 이 복원이 홈 첫페인트 이미지 최대 레버.
      //   `onerror=redirect` 안전판: 향후 재차단 시 리사이저 실패 → 원본 302 폴백(사용자 브라우저 IP 는 미차단)
      //   = 2026-06-17 raw 동작과 동일 → 최악의 경우 다운사이드 0. (raw 강제 분기 제거 — CDN_CGI_VERIFIED 로 승격.)
      // 🏁 2026-07-02 [LOADING_ADDITIVE] (라이브 실측 — 홈 피드 이미지 1MB 원본 다운로드 수리):
      //   ldb-phinf.pstatic.net / naverbooking-phinf.pstatic.net / imgnews.naver.net /
      //   yt3.googleusercontent.com / picsum.photos 전부 `cf-resized: internal=ok` 실측 통과
      //   (1,055KB→14KB). apex 'pstatic.net' 로 기존 프록시 경유 pstatic 서브도메인도 승격 —
      //   /api/image/resize 프록시는 리사이즈 불가(06-11 실측)라 cdn-cgi 직결이 유일 변환 경로.
      //   `onerror=redirect` 를 함께 부여: 리사이저 원본 fetch 실패 시 원본으로 302 → 항상 표시
      //   (2026-06-11 kakaocdn 깨짐 클래스 구조적 차단 — 실패해도 현행(원본)과 동일).
      if (HOTLINK_BLOCKED_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
        return `/api/image/resize?url=${encodeURIComponent(src)}&w=${w}&q=${q}`
      }
      // 🚀 2026-08-19 [UNLOCK_LOADING] (대표 신고 "사진 불러오는게 많이 느리네?" — 라이브 실측):
      //   홈 카드의 **카카오 CDN 사진이 원본 그대로** 내려오고 있었다(카드 3장에 2.6MB). 이 목록에
      //   없으면 워커 프록시로 가는데 그 경로는 리사이즈를 못 한다(2026-06-11 실측) → 270px 카드에 1MB.
      //   프로덕션 실측으로 승격 조건 충족(전부 `cf-resized: internal=ok`):
      //     img1.kakaocdn.net  957KB/5.27s → 53KB/1.87s  (18×)
      //     t1.daumcdn.net     747KB → 13.7KB (55×) · 937KB → 70.7KB (13×)
      //   ⚠️ 2026-06-11 에 kakaocdn 이 cdn-cgi 직결로 깨진 적이 있는데, 그때는 `onerror=redirect`
      //   안전판이 없었다(2026-07-02 도입). 지금은 리사이저가 실패하면 원본으로 302 → 현행과 동일 →
      //   최악의 경우 다운사이드 0. 핫링크 차단 호스트는 위 HOTLINK_BLOCKED_HOSTS 가 먼저 걸러 낸다.
      const CDN_CGI_VERIFIED = ['kt.com', 'media.ur-team.com', 'pstatic.net', 'imgnews.naver.net', 'yt3.googleusercontent.com', 'picsum.photos', 'phinf.naver.net', 'giftishow.com', 'kakaocdn.net', 'daumcdn.net', 'cloudfront.net', 'digitaloceanspaces.com']  // giftishow 2026-07-13 재실측 복원 · kakao/daum 2026-08-19 · cloudfront/DO-spaces 2026-09-02 실측 승격(전부 onerror=redirect 안전판)
      if (CDN_CGI_VERIFIED.some(h => host === h || host.endsWith('.' + h))) {
        return `/cdn-cgi/image/width=${w},quality=${q},format=auto,onerror=redirect${cropFrag(opts)}/${cdnCgiSafe(src)}`
      }
      return `/api/image/resize?url=${encodeURIComponent(src)}&w=${w}&q=${q}`
    }
    // 🕳️ 2026-09-02 [UNLOCK_LOADING] (대표 "QA 도와줘" 실측 → "그것도 다 진행해줘, 가장 이상적으로"):
    //   **여기가 구멍이었다.** 목록에 없는 외부 호스트는 원본 URL 을 그대로 돌려줘 리사이저를 아예 안 거쳤다
    //   (라이브 홈 한 화면에서 5장 — cdn-cgi 요청 자체가 0). 데모 사진 출처가 카카오 플레이스라 임의 CDN 이
    //   섞이므로 **호스트 목록은 원리상 계속 샌다** — 승격은 사후약방문이고, 기본값을 고쳐야 닫힌다.
    //
    //   ⚖️ 왜 안전한가(세 경우가 전부 현행과 같거나 낫다):
    //     ① 리사이저가 원본을 받을 수 있다 → **리사이즈됨**(실측 1MB급 → 수십 KB). 이득.
    //     ② 리사이저가 못 받는다 → `onerror=redirect` 로 원본 302 → 브라우저가 원본 로드 = **현행과 동일**
    //        (대가는 리다이렉트 한 홉. 2026-07-02 에 이 안전판을 도입한 이유가 정확히 이 클래스다).
    //     ③ 원본을 브라우저도 못 받는다(referer 차단 등) → 오늘도 깨져 있다 = 동일. 단 그 클래스는 위
    //        `HOTLINK_BLOCKED_HOSTS`(이제 모듈 스코프)가 먼저 워커 프록시로 빼돌려 **오히려 개선**된다.
    //   ⚠️ 2026-06-11 카카오 프로필 깨짐 사고는 `onerror=redirect` **도입 전**이었다 — 그때의 실패 모드는
    //      지금 ②로 흡수된다. 그래서 이 기본값 전환이 그 사고의 재발이 아니다.
    if (!isSupported && !isExternalProxyable) {
      const w = opts.width || 400
      const q = opts.quality || 85
      if (HOTLINK_BLOCKED_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
        return `/api/image/resize?url=${encodeURIComponent(src)}&w=${w}&q=${q}`
      }
      return `/cdn-cgi/image/width=${w},quality=${q},format=auto,onerror=redirect${cropFrag(opts)}/${cdnCgiSafe(src)}`
    }
  }

  const params: string[] = []
  if (opts.width) params.push(`width=${opts.width}`)
  if (opts.height) params.push(`height=${opts.height}`)
  if (opts.quality) params.push(`quality=${opts.quality}`)
  params.push(`format=${opts.format || 'auto'}`)
  if (opts.fit) params.push(`fit=${opts.fit}`)
  if (opts.gravity) params.push(`gravity=${opts.gravity}`)

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

/**
 * 🛡️ 2026-07-14 <img onError> 자가치유 폴백 (대표 "이미지 불안정" — 영구 해결 2계층).
 *
 * cfImage 변환 URL(리사이즈/외부프록시)이 로드 실패하면 **원본으로 1회 교체 + 표시 복원**.
 *  - `/api/media/*` 원본 = 워커가 R2 바인딩으로 직접 서빙(리사이저·커스텀도메인 둘 다 우회 — 항상 200).
 *  - onerror=redirect(서버측 1차 자가치유)마저 실패하는 극단 케이스의 최종 안전망(클라 3차).
 * 무한루프 방지(1회 플래그) + srcset 제거(원본만) + opacity 복원(하단 카드 숨김 방지).
 *
 * 사용: `<img onError={(e) => cfImageOnError(e.currentTarget, p.image_url)} .../>`
 */
export function cfImageOnError(img: HTMLImageElement | null | undefined, originalSrc?: string | null): void {
  if (!img) return
  // 1단계: cfImage 변환 실패 → 원본으로 1회 교체(리사이저 우회).
  if (img.dataset.cfFallback !== '1' && img.dataset.cfFallback !== '2') {
    img.dataset.cfFallback = '1'
    img.style.opacity = '1'
    if (originalSrc && img.getAttribute('src') !== originalSrc) {
      img.removeAttribute('srcset')
      img.src = originalSrc
      return  // 원본 재시도 — 이것도 실패하면 onError 재발화 → 아래 2단계.
    }
  }
  // 2단계 (2026-07-21 대표 "사진 깨지는 경우 처리"): 원본까지 죽음(404/삭제/핫링크차단) →
  //   깨진 아이콘 박스 대신 **이미지 숨김**으로 부모(카테고리색/스켈레톤 배경)가 보이게. 무한루프 0.
  if (img.dataset.cfFallback !== '2') {
    img.dataset.cfFallback = '2'
    img.style.visibility = 'hidden'
  }
}
