/**
 * 🍞 2026-10-14 — 빵부스러기 체인을 **한 곳**에서 조립한다.
 *
 * ## 실측 (Googlebot UA 로 서버 HTML 을 받아 `BreadcrumbList` 를 파싱해서 셌다)
 *
 *     /pass/{N}      310건   홈(/)  >  동네딜(/)      >  상품      ← item 1·2 가 **같은 URL**
 *     /stays/{N}      49건   홈(/)  >  숙소(/stays)   >  숙소명    ← 정상
 *     /products/{N}    1건   홈(/)  >  쇼핑(/browse)  >  상품명    ← 정상
 *     목록·지역·블로그 90여   유어딜(/) > …                        ← 루트 이름이 다르다
 *
 * **결함 둘이 같은 뿌리에서 나온다 — 조립하는 곳이 넷이고 전부 루트를 손으로 적는다.**
 *
 * ① **사슬이 안 나아간다.** 빵부스러기는 *서로 다른 페이지*의 사슬인데 `/pass/{N}` 은 연속한 두
 *    항목이 `https://urdeal.kr/` 하나다. 그러면 같은 페이지가 한 목록 안에서 `홈` 과 `동네딜`
 *    **두 이름**을 갖는다. 2026-09-16 에 *"`/group-buy` 는 홈으로 301 되는 별칭이라 빵부스러기가
 *    리다이렉트를 가리키고 있었다"* 를 고치면서 목적지를 홈으로 옮겼는데, 그 처방이 리다이렉트는
 *    없애고 **중복을 만들었다**(에러 0 · 빌드 0 · 화면 무관 — 파싱해서 센 사람만 안다).
 *
 * ② **루트 이름이 두 벌.** 같은 URL 을 상세 359건은 `홈`, 목록 90여 표면은 `유어딜` 로 부른다.
 *    구글은 SERP 의 URL 줄을 이 `name` 들로 바꿔 그리므로, 사이트가 자기 루트를 두 가지로 부른다.
 *
 * ## 처방 — 루트는 `CONSUMER_SITE_NAME` 하나, 그리고 **연속한 같은 URL 은 접는다**
 *
 * 🔴 `동네딜` 에 자기 목록 URL 을 주지 **않는다**. 유어딜의 `/` 가 곧 동네딜 피드이고
 *    (`HomeRoute` — CLAUDE.md *"모바일 홈은 지도가 아니라 딜 피드"*), 옛 `/group-buy` 는 홈으로
 *    301 되는 별칭이라 sitemap 에서도 빠졌다. 즉 **줄 URL 이 없다** ⇒ 단계를 넣지 않는다.
 *    이 레포가 유어샵에서 내린 것과 **같은 판단**이다 — CLAUDE.md:
 *    *"유어샵은 **두 단계**다 — `유어샵` 을 중간에 넣으면 `/u` 라는 **없는 URL** 을 가리킨다."*
 *    여기서는 *없는 URL* 이 아니라 *이미 사슬에 있는 URL* 이고, 결과는 같다.
 *
 * ❌ **버린 길 둘** (둘 다 계층을 지어내는 쪽이다):
 *    ⓐ `/map` 을 부모로 — `/map` 은 같은 피드의 *지도 보기*이고 상품이 그 아래 있는 게 아니다.
 *       `유어딜 › 동네딜 지도 › 불족발` 은 사실과 어긋난 계층이다.
 *    ⓑ 지역 페이지(`/region/경기/파주시`)를 부모로 — 로컬 커머스엔 가장 좋은 체인이지만
 *       그 색인 여부는 **워커의 지역 요약**이 정하고(딜 3건 미만이면 noindex) 이 빌더는 그걸 모른다.
 *       색인하지 말라고 한 URL 을 부모로 가리키는 것은 이 레포가 피하는 *서로 반대 신호* 쪽이다.
 *
 * ⚠️ **이 모듈이 못 보는 것**: 체인이 *의미상* 맞는지(계층을 지어내도 URL 만 다르면 통과한다) ·
 *    구글이 그 trail 을 실제로 그리는지(색인 수일~수주 · 서치콘솔은 대표만 본다).
 */
import { CONSUMER_SITE_NAME } from './consumer-surfaces'

export interface CrumbStep {
  name: string
  url: string
}

/**
 * 루트(`CONSUMER_SITE_NAME` → `${origin}/`)를 앞에 붙이고, **직전 항목과 URL 이 같은 단계는 버린다**.
 *
 * 🔑 접을 때 살아남는 이름은 **앞 항목**이다 — 루트를 `동네딜` 로 개명하면 310개 페이지가 사이트
 *    루트를 그렇게 부르게 된다(고치려던 것보다 나쁘다).
 * 이름·URL 이 빈 단계도 버린다(값이 없는데 사슬을 늘리면 빈 항목이 SERP trail 에 뜬다).
 */
export function withCrumbRoot(origin: string, steps: readonly CrumbStep[]): CrumbStep[] {
  const out: CrumbStep[] = [{ name: CONSUMER_SITE_NAME, url: `${origin}/` }]
  for (const s of steps) {
    const name = String(s?.name ?? '').trim()
    const url = String(s?.url ?? '').trim()
    if (!name || !url) continue
    if (out[out.length - 1]!.url === url) continue
    out.push({ name, url })
  }
  return out
}

/** `itemListElement` — position 은 **접은 뒤** 1..N 으로 다시 매긴다(구멍이 생기면 리치결과가 깨진다). */
export function crumbItems(trail: readonly CrumbStep[]): Array<Record<string, unknown>> {
  return trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url }))
}
