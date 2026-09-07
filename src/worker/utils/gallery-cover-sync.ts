/**
 * 🖼️ 커버와 갤러리 첫 칸을 한 몸으로 유지한다 — "같은 사진이 두 장" 을 만드는 자리.
 *
 * ■ 무엇이 났나 (2026-09-03 대표 신고 — *"사진이 1개인 이용권인데 여러 장인 것처럼 나온다"*)
 *   `products.images`(갤러리)는 만들 때부터 **첫 칸이 커버**다 — recondition 이
 *   `[cover, ...imgs]` 로 저장한다(`demo-image-rehost.ts`). 그런데 사진을 R2 로 옮기는
 *   bulk 이관은 **`image_url` 만** 새 주소로 바꾸고 `images[0]` 은 옛 외부 주소로 뒀다.
 *   같은 사진이 주소 둘을 갖게 되고, 상세는 `[image_url, ...images]` 를 합치며 문자열로만
 *   중복을 지우므로 **같은 사진이 두 칸**으로 남는다(좌우로 넘겨도 같은 그림).
 *
 *   실측(2026-09-03 라이브): 활성 이용권 **100개 중 99개**가 이 상태였고, 그중 **78개는
 *   정확히 [이관본 + 원본] 두 장** — 대표가 본 화면이다.
 *
 * ■ 왜 여기서 고치나
 *   표시 쪽에서는 **원리상 못 고친다.** R2 키가 랜덤 UUID 라 "이 주소가 저 주소의 사본" 이라는
 *   정보가 어디에도 없다(`rehost-image.ts`). 그래서 두 값이 갈리는 **쓰기 시점**에 같이 쓴다.
 */

/** 갤러리 JSON 을 배열로 — 형식이 아니면 null(호출부가 건드리지 않게). */
function parseGallery(imagesJson: string | null | undefined): string[] | null {
  if (!imagesJson) return null
  try {
    const arr = JSON.parse(imagesJson)
    if (!Array.isArray(arr)) return null
    return arr.filter((u): u is string => typeof u === 'string' && !!u)
  } catch { return null }
}

/** 배열 → JSON. 내용이 같으면 null(불필요한 UPDATE 안 하게). */
function serializeIfChanged(next: string[], prev: string[]): string | null {
  const dedup = Array.from(new Set(next))
  if (dedup.length === prev.length && dedup.every((u, i) => u === prev[i])) return null
  return JSON.stringify(dedup)
}

/**
 * 커버를 옮겼을 때 갤러리 안의 **같은 주소**도 새 주소로 바꾼다(재발 차단).
 *
 * 정확 일치만 바꾼다 — 옛 커버가 갤러리에 없으면 아무것도 안 한다(추측 금지).
 * @returns 새 갤러리 JSON, 바꿀 게 없으면 null
 */
export function replaceGalleryUrl(
  imagesJson: string | null | undefined,
  from: string | null | undefined,
  to: string,
): string | null {
  const arr = parseGallery(imagesJson)
  if (!arr || !from || !to || from === to) return null
  if (!arr.includes(from)) return null
  return serializeIfChanged(arr.map((u) => (u === from ? to : u)), arr)
}

/**
 * 이미 어긋난 행을 되돌린다 — 커버는 우리 저장소인데 `images[0]` 이 외부 주소인 경우.
 *
 * ⚠️ **추측이 아니라 데이터 모델**이다: `images[0]` 은 저장 시점의 커버다(위 주석). 커버만
 *   교체돼 갈린 것이므로, 첫 칸을 현재 커버로 맞추면 중복 제거가 걸려 한 장으로 접힌다.
 *   사진을 **지우는 게 아니라 주소를 맞추는 것**이라 다른 사진이 사라지지 않는다.
 *
 * 첫 칸이 이미 커버거나(정상) 커버가 아직 외부면(이관 전) 건드리지 않는다.
 * @returns 새 갤러리 JSON, 바꿀 게 없으면 null
 */
export function repairGalleryCover(
  imagesJson: string | null | undefined,
  cover: string | null | undefined,
): string | null {
  const arr = parseGallery(imagesJson)
  if (!arr || !arr.length || !cover) return null
  if (!isHostedUrl(cover)) return null          // 커버가 아직 외부 — 이관 전이라 손댈 때가 아니다
  const first = arr[0]
  if (first === cover) return null              // 이미 정합
  if (!/^https?:\/\//i.test(first)) return null // 첫 칸이 외부 주소일 때만(상대경로는 우리 것)
  return serializeIfChanged([cover, ...arr.slice(1)], arr)
}

/** 우리가 서빙하는 주소인가(R2 이관본). */
export function isHostedUrl(u: string | null | undefined): boolean {
  if (!u) return false
  return u.startsWith('/api/media/') || u.includes('media.ur-team.com/')
}
