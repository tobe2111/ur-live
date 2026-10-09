/**
 * 🖼️ OG 카드용 — 사진을 SVG **안에** 박아 넣는다 (data URI)
 *
 * 왜 필요한가 (2026-09-28 대표 신고 *"카카오로 링크 공유했는데 이 형태 너무한데?"*):
 *   우리 유어샵 OG 카드는 SVG 인데, 그 안에서 사진을 `<image href="https://…">` 로
 *   **바깥에서 불러왔다**. 카카오 스크래퍼는 SVG 를 그림으로 굽기만 하고 **그 안의 외부
 *   하위 리소스는 가져오지 않는다** — 그래서 라이브 카드가 글자만 남고 사진 자리가 전부
 *   까만 칸이었다(실측: SVG 에 `<image>` 4개가 멀쩡히 들어 있는데 렌더된 카드엔 0장).
 *   에러가 안 나서 아무도 신고하지 않는 종류다.
 *
 *   ⇒ 네트워크를 타지 않는 `data:` URI 로 바꾸면 **어떤 렌더러든** 사진이 나온다.
 *
 * 🔒 제약(일부러 좁게 잡았다 — OG 는 스크래퍼가 부르는 핫패스다):
 *   - 같은 오리진의 cdn-cgi 리사이저를 거쳐 **작게** 받는다(원본을 그대로 박으면 SVG 가 MB 단위).
 *   - `format=jpeg` 고정. AVIF/WebP 는 굽는 쪽이 못 읽을 수 있고, 여기서 아끼는 바이트보다
 *     "안 보인다"의 대가가 훨씬 크다.
 *   - 실패·초과는 **null**. 카드는 사진 없이도 멀쩡해야 한다(호출부가 그렇게 그린다).
 */

/** 타일 1장이 넘으면 포기하는 크기. 넘는 건 대개 리사이저를 못 탄 원본이다. */
export const OG_INLINE_MAX_BYTES = 160_000

/** 사진을 절대 URL 로 — 상대 경로(`/api/media/…`)는 오리진을 붙인다. */
export function toAbsolute(raw: string | null | undefined, origin: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/')) return `${origin}${s}`
  return ''
}

/** cdn-cgi 리사이저 주소 — 호출부가 원하는 화면 크기를 주면 그 크기로 받는다. */
export function resizedUrl(absUrl: string, origin: string, width: number, height: number): string {
  // 원본 URL 에 `%` 가 있으면 경로에서 한 번 더 디코딩돼 404 가 난다(2026-08-11 실측·수리와 같은 함정).
  const safe = absUrl.includes('%') ? absUrl.replace(/%/g, '%25') : absUrl
  return `${origin}/cdn-cgi/image/width=${width},height=${height},fit=cover,gravity=auto,quality=70,format=jpeg,onerror=redirect/${safe}`
}

/**
 * Cloudflare Images 바인딩 중 여기서 쓰는 부분만. 실제 타입 패키지에 기대지 않는다(번들·타입 결합 0).
 * `input(stream).transform(opts).output(opts)` → `.response()` 가 줄인 그림 응답을 준다.
 */
export interface ImagesBindingLike {
  input(stream: ReadableStream<Uint8Array>): {
    transform(o: Record<string, unknown>): {
      output(o: { format: string; quality?: number }): Promise<{ response(): Response }>
    }
  }
}

/** 바인딩에 넘길 원본 상한 — 이보다 크면 받지 않는다(OG 는 스크래퍼 핫패스다). */
export const OG_SOURCE_MAX_BYTES = 8_000_000

/** 바이트 → base64. 한 번에 spread 하면 큰 이미지에서 스택이 터지므로 조각내 돈다. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

/**
 * 사진 1장을 `data:image/jpeg;base64,…` 로. 못 받으면 **null**(카드는 사진 없이 그린다).
 * `fetchImpl` 은 테스트 주입용이고 기본은 전역 fetch 다.
 */
export async function inlineImage(
  raw: string | null | undefined,
  origin: string,
  width: number,
  height: number,
  fetchImpl: typeof fetch = fetch,
  images?: ImagesBindingLike,
): Promise<string | null> {
  const abs = toAbsolute(raw, origin)
  if (!abs) return null
  // 🖼️ 2026-10-10 1순위: Images 바인딩이 있으면 원본을 받아 서버 안에서 줄인다.
  //   (cdn-cgi 는 바깥에서는 줄여 주지만 서버 안에서 부르면 원본이 와서 한도를 넘는다 — 10-09 실측)
  if (images) {
    try {
      const src = await fetchImpl(abs, { headers: { Accept: 'image/*' } })
      const len = Number(src.headers.get('content-length') || 0)
      if (src.ok && src.body && !(len > OG_SOURCE_MAX_BYTES)) {
        const out = await images
          .input(src.body)
          .transform({ width, height, fit: 'cover', gravity: 'auto' })
          .output({ format: 'image/jpeg', quality: 70 })
        const buf = await out.response().arrayBuffer()
        if (buf.byteLength && buf.byteLength <= OG_INLINE_MAX_BYTES) {
          return `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(buf))}`
        }
      }
    } catch {
      /* 바인딩 실패는 아래 종전 경로로 */
    }
  }
  try {
    const res = await fetchImpl(resizedUrl(abs, origin, width, height), {
      headers: { Accept: 'image/jpeg,image/*' },
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > OG_INLINE_MAX_BYTES) return null
    return `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(buf))}`
  } catch {
    return null
  }
}
