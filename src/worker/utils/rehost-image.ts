/**
 * 🎯 2026-07-21 (대표 "남은 이상적인 것까지"): 외부 이미지 → 우리 R2(MEDIA_BUCKET) 재호스팅 헬퍼.
 *   admin-products.routes.ts 의 시드 전용 인라인(2026-07-03)을 공용 util 로 추출 — 데모 시드(커버)와
 *   신규 cron(demo-image-rehost — 갤러리 2~5번째 점진 이관)이 같은 SSOT 를 쓴다. 로직 동일(byte-이동).
 *
 * 핫링크의 구조적 문제(인증서 불일치·혼합콘텐츠·핫링크차단·원본 404/삭제)를 원천 소멸 —
 * 저장되는 건 항상 우리 URL(/api/media/…)이라 렌더 시 cfImage(zone 리사이저)가 same-origin 리사이즈.
 * 실패(키·네트워크·비이미지·과대/과소) → null → 호출측이 원본 유지/스킵 판단. 완전 fail-soft.
 */

export async function rehostImageToR2(
  env: { MEDIA_BUCKET?: R2Bucket },
  srcUrl: string | null | undefined,
  source = 'dongnedeal-demo',
): Promise<string | null> {
  if (!srcUrl || !env.MEDIA_BUCKET || !/^https?:\/\//i.test(srcUrl)) return null
  try {
    // ⏱️ 2026-07-21: 실측상 일부 커버(카카오 CDN)가 6s 를 넘겨 타임아웃 → 이관 실패. 10s 로 상향
    //   (요청당 커버 ~5개라 최악 50s 도 CF 엣지 100s 안쪽). 느린 대표사진도 이관되게.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    let res: Response
    try {
      // 🖼️ 2026-07-22: **fetch 시점 리사이즈**(Cloudflare Image Resizing) — 카카오/다음 원본이 8~10MB
      //   풀해상도라 6MB 캡에 걸려 이관 실패하던 것 근본해결. 1600px/품질82 로 축소해 받으면 ~100~400KB
      //   → 캡 통과 + 다운로드/메모리/R2 저장 전부 경량. fit:scale-down = 작은 원본은 그대로(확대 안 함).
      //   리사이즈 미적용(기능 off/원본 접근불가) 시엔 원본 반환이라 아래 크기 캡이 최종 안전판.
      res = await fetch(srcUrl, {
        signal: ctrl.signal,
        cf: { image: { width: 1600, quality: 82, fit: 'scale-down' } },
      } as RequestInit)  // 인증서오류/DNS → throw → null
    } finally { clearTimeout(timer) }
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim()
    if (!ct.startsWith('image/')) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 500 || buf.byteLength > 8 * 1024 * 1024) return null // 아이콘/깨짐 or 과대(리사이즈 후엔 사실상 불가)
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'
    const yyyymm = new Date().toISOString().slice(0, 7)
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const key = `uploads/demo/${yyyymm}/${rand}.${ext}`
    await env.MEDIA_BUCKET.put(key, buf, {
      httpMetadata: { contentType: ct, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { source, at: new Date().toISOString() },
    })
    return `/api/media/${key}`  // upload.routes 의 same-origin 서빙 규약과 동일(PUBLIC_R2_URL 무관하게 표시)
  } catch { return null }
}

/**
 * 🩹 2026-07-21 (대표 "가끔 안 뜨는 게 있네"): 이미지 URL 이 실제로 로드되는지 서버측 검증.
 *   referer 없이 fetch(네이버 핫링크 차단 우회) → 200 + image/* + 최소크기면 성한 사진.
 *   내부(/api/media·상대경로)는 워커가 항상 200 서빙이라 성함으로 간주(fetch 생략). fail→false.
 */
export async function validateImageLoads(url: string | null | undefined): Promise<boolean> {
  if (!url) return false
  if (!/^https?:\/\//i.test(url)) return true          // 상대경로(/api/media 등) = 내부 서빙, 항상 OK
  if (url.includes('/api/media/') || (() => { try { return new URL(url).hostname === 'media.ur-team.com' } catch { return false } })()) return true
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    let res: Response
    try {
      res = await fetch(url, { signal: ctrl.signal })  // referer 없음(워커 기본) → 네이버 핫링크 통과
    } finally { clearTimeout(timer) }
    if (!res.ok) return false
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!ct.startsWith('image/')) return false
    const len = Number(res.headers.get('content-length') || 0)
    if (len && len < 500) return false                 // 아이콘/깨짐 방지(길이 헤더 있을 때만)
    return true
  } catch { return false }
}

/** 우리 도메인/R2 가 아닌 외부 http(s) URL 인지 — 재호스팅 후보 판정. */
export function isExternalImageUrl(u: string | null | undefined): boolean {
  if (!u || typeof u !== 'string') return false
  if (!/^https?:\/\//i.test(u)) return false            // 상대경로(/api/media/…) = 내부
  if (u.includes('/api/media/')) return false            // 절대형 내부 서빙
  try {
    const host = new URL(u).hostname
    if (host === 'media.ur-team.com') return false       // R2 커스텀 도메인
    if (host.endsWith('picsum.photos')) return false     // 시드 placeholder — 재호스팅 가치 없음(교체 대상)
    return true
  } catch { return false }
}
