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
 * 🩸 2026-10-12 라이브 실측 — **사진이 한 장도 안 박히고 있었다.**
 * `https://urdeal.kr/api/og/curator/jiwon1228` 가 **1,694바이트 · `<image>` 0개**로 나왔다(핀은 4장
 * 멀쩡히 있다). 유어샵 카드가 "글자만 있는 투박한 판"으로 보인 이유가 디자인이 아니라 이것이다.
 * 이용권 카드도 같은 원인으로 302 폴백(생 사진)을 타고 있었다 — 우리 카드가 아예 안 나간다.
 *
 * 🔎 **원인은 둘이고 겹쳐 있었다**:
 *   ① 워커 **안에서** `/cdn-cgi/image/…` 를 부르면 리사이즈가 안 걸린다(2026-10-09 실측).
 *      그 주소는 **들어오는 요청**에 대한 엣지 기능이라, 워커 서브리퀘스트는 그 파이프라인을 안 탄다.
 *      Workers 에서 같은 일을 하는 공식 수단은 **`fetch(url, { cf: { image: … } })`** 다.
 *   ② 타일이 `/api/media/<key>` 라 **자기 자신(워커)** 을 다시 부른다. 그 자리는 R2 공개 도메인
 *      `media.ur-team.com/<key>` 으로 바로 가면 된다(2026-06-11 에 깐 파이프라인 — 같은 파일이다).
 *
 * 📏 바깥에서 같은 사진을 같은 식으로 받아 보면 **6~11KB** 다(`cf-resized: internal=ok`, 상한 160KB의
 *   7% 미만). 즉 크기 때문이 아니라 **줄여 주는 경로를 안 타고 있던 것**이다.
 *
 * 🔒 전부 fail-soft 다 — `cf.image` 가 무시되면 원본이 오고 상한에 걸려 `null`(= 오늘과 같다).
 *   예외가 나면 아래 종전 URL 경로로 떨어진다. **회귀가 구조적으로 불가능하다.**
 */
/** R2 공개 도메인 — `/api/media/<key>` 는 워커를 거치지 말고 여기로 바로 간다. */
const R2_PUBLIC_HOST = 'https://media.ur-team.com'

/** 워커가 **받아올** 주소. 표시용 `toAbsolute` 와 달리 자기 자신을 다시 부르지 않는다. */
export function toFetchable(raw: string | null | undefined, origin: string): string {
  const abs = toAbsolute(raw, origin)
  if (!abs) return ''
  const m = abs.match(/^https?:\/\/[^/]+\/api\/media\/(.+)$/)
  return m ? `${R2_PUBLIC_HOST}/${m[1]}` : abs
}

/**
 * 받은 응답이 **그림이 아님이 분명한가**. 자기-자신 호출이 SPA 셸을 200 으로 돌려주면
 * HTML 을 jpeg 라고 박게 되고, 그건 빈 칸보다 나쁘다(깨진 그림 + 에러 0).
 *
 * 🔒 **`image/*` 만 통과시키지는 않는다.** content-type 이 **없는** 응답은 받아들인다 —
 *   일부 오리진·프록시가 그림에 타입을 안 붙여 주는데, 그걸 막으면 오늘 나오던 사진이
 *   사라진다(기존 가드의 픽스처가 정확히 그 모양이라 그 사실을 알려 줬다).
 *   막으려는 것은 *타입이 분명히 그림이 아닌* 응답 하나뿐이다.
 */
function looksLikeImage(res: Response): boolean {
  const ct = (res.headers.get('content-type') || '').toLowerCase().trim()
  if (!ct) return true
  return ct.startsWith('image/')
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
  // 받아오는 주소는 R2 공개 도메인으로 — 워커가 자기 자신을 다시 부르지 않게.
  const src = toFetchable(raw, origin)
  // 🖼️ 2026-10-10 1순위: Images 바인딩이 있으면 원본을 받아 서버 안에서 줄인다.
  //   (cdn-cgi 는 바깥에서는 줄여 주지만 서버 안에서 부르면 원본이 와서 한도를 넘는다 — 10-09 실측)
  if (images) {
    try {
      const srcRes = await fetchImpl(src, { headers: { Accept: 'image/*' } })
      const len = Number(srcRes.headers.get('content-length') || 0)
      if (srcRes.ok && srcRes.body && !(len > OG_SOURCE_MAX_BYTES)) {
        const out = await images
          .input(srcRes.body)
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
  // 🖼️ 2026-10-12 2순위: Workers 네이티브 리사이즈. `/cdn-cgi/image/…` 는 워커 안에서 안 먹지만
  //   `cf.image` 는 먹는다(머리말 실측). 무시되면 원본이 와서 상한에 걸려 null = 종전과 동일.
  try {
    const res = await fetchImpl(src, {
      headers: { Accept: 'image/jpeg,image/*' },
      cf: { image: { width, height, fit: 'cover', gravity: 'auto', quality: 70, format: 'jpeg' } },
    } as RequestInit)
    if (res.ok && looksLikeImage(res)) {
      const buf = await res.arrayBuffer()
      if (buf.byteLength && buf.byteLength <= OG_INLINE_MAX_BYTES) {
        return `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(buf))}`
      }
    }
  } catch {
    /* cf.image 미지원·실패는 아래 종전 경로로 */
  }
  try {
    const res = await fetchImpl(resizedUrl(abs, origin, width, height), {
      headers: { Accept: 'image/jpeg,image/*' },
    })
    if (!res.ok || !looksLikeImage(res)) return null
    const buf = await res.arrayBuffer()
    if (!buf.byteLength || buf.byteLength > OG_INLINE_MAX_BYTES) return null
    return `data:image/jpeg;base64,${bytesToBase64(new Uint8Array(buf))}`
  } catch {
    return null
  }
}
