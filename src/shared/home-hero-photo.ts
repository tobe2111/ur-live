/**
 * 🖼️ 홈 히어로 사진 고르기 — **클라이언트와 워커가 같은 답을 내야 하는** 순수 로직.
 *
 * 워커가 이 사진을 `<link rel="preload">` 로 미리 받게 하려면(2026-08-29 대표 — "히어로에 나올
 * 사진이 가장 늦긴 해"), 워커도 클라이언트와 **똑같은 사진**을 골라야 한다. 한 장이라도 어긋나면
 * preload 가 버려지고 같은 사진을 두 번 받는다 — 에러도 없이 더 느려진다.
 * ⇒ 고르는 규칙은 여기 한 곳에만 둔다. `HomeHeroDefault` 는 DOM 에서 시드를 읽어 이 함수에 넘긴다.
 */

/**
 * 🖼️ 우리가 직접 올린 사진인가 — R2(`/api/media/…` · `media.ur-team.com`).
 *
 * 왜 호스트로 가르나: 2026-08-04 에 **데모 사진에 타사 워터마크 보도사진(YONHAP)이 섞여** 홈
 * 최상단에 오를 뻔했다. 그때의 처방은 "데모를 전부 금지"였는데, 그 규칙은 **라이브 카탈로그가
 * 100% 데모가 되자 히어로를 영구히 빈 색면으로** 만들었다(2026-08-27 실측: 시드 50/50 데모,
 * 어드민 배너 0건 → 사진 소스가 아예 없음).
 *
 * ⇒ 금지의 축을 "데모냐"에서 **"사진의 출처가 우리냐"** 로 옮긴다. 사고의 원인은 데모라는 사실이
 *   아니라 **남의 사진**이었다. 우리 버킷에 우리가 올린 것은 그 위험이 구조적으로 없다.
 */
export function isOwnMedia(url: string): boolean {
  return url.startsWith('/api/media/') || /^https?:\/\/media\.ur-team\.com\//.test(url)
}

export interface HeroPhotoPick { src: string; href: string }

/**
 * 홈 MAIN 시드의 `data` 배열에서 히어로에 쓸 사진 1장. 없으면 null(= 사진 없는 색면).
 *
 * 우선순위: ① 실상품(비데모) → ② 실상품이 하나도 없으면 **우리 호스트 데모**.
 * ⚠️ 외부 호스트 사진을 가진 데모는 어느 단계에서도 안 쓴다(위 `isOwnMedia` 주석의 사고).
 *
 * @param data 파싱된 시드의 `data` (모양을 신뢰하지 않는다 — 워커·클라 양쪽에서 깨진 시드가 올 수 있다)
 */
export function pickHeroPhotoFrom(data: unknown): HeroPhotoPick | null {
  if (!Array.isArray(data)) return null
  let ownDemo: HeroPhotoPick | null = null
  for (const raw of data as Array<Record<string, unknown>>) {
    const img = typeof raw?.image_url === 'string' ? raw.image_url : ''
    const slug = typeof raw?.slug === 'string' ? raw.slug : ''
    const id = raw?.id
    if (!img) continue
    const hit: HeroPhotoPick = { src: img, href: id != null ? `/group-buy/${id}` : '/' }
    if (slug.startsWith('demo-deal-')) {
      // 데모는 **마지막 수단**이고, 그중에서도 우리가 올린 사진만. 실상품을 계속 찾는다.
      if (!ownDemo && isOwnMedia(img)) ownDemo = hit
      continue
    }
    return hit
  }
  return ownDemo
}

/** 시드 JSON 문자열에서 바로 고른다 — 워커가 쓰는 입구(파싱 실패는 null, fail-soft). */
export function pickHeroPhotoFromSeedJson(json: string): HeroPhotoPick | null {
  try {
    const parsed = JSON.parse(json) as { success?: boolean; data?: unknown }
    if (!parsed?.success) return null
    return pickHeroPhotoFrom(parsed.data)
  } catch {
    return null
  }
}
