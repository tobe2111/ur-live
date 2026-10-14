/**
 * 🧬 한 문서에 같은 `@type` 을 **두 벌** 내지 않는다 (2026-10-14 — 대표 *"또 개선점 찾아보자. SEO 와 GEO 부분에서"*).
 *
 * ## 실측 — 렌더된 DOM 에서 서버 노드와 클라 노드가 같은 종류를 두 번 말한다
 *
 * 아이폰 UA 로 **실제 렌더**해서 `script[type="application/ld+json"]` 을 센 결과
 * (`[data-rh]` = react-helmet 이 넣은 클라 노드):
 *
 *     /pass/2823          blocks 4 · rh 2 → 중복 `Product` · `BreadcrumbList`
 *     /products/2917      blocks 3 · rh 1 → 중복 `Product`
 *     /region/서울         blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *     /region             blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *     /blog/what-is-urdeal blocks 3 · rh 1 → 중복 `BreadcrumbList`
 *
 * 약 **380 URL**(`/pass` 310 · `/region` 44 · `/blog` 23 …)이 같은 URL 에 대해 **서로 다른 내용의**
 * 같은 종류를 둘 선언한다. `/pass/:id` 가 가장 나쁘다 — 서버 `Product` 는 `aggregateRating`(별점)을
 * 갖고 클라 `Product` 는 **안 갖는다**. 어느 쪽이 쓰일지는 정해져 있지 않다(둘 다 버려질 수도 있다).
 *
 * ## 🔑 누가 영향을 받나 — 측정으로 좁혔다
 *
 * **검색엔진 크롤러는 영향이 없다**(실측): `BOT_UA_REGEX`(googlebot·yeti·daumoa·bingbot …)에
 * 걸리는 UA 는 워커가 **스크립트 없는 문서**를 준다 — Googlebot 스마트폰 UA 로 10초를 기다려도
 * `blocks 2 · rh 0` 이고 앱 엔트리 `<script>` 와 스타일시트가 **문서에 아예 없다**(태그 15개 전수 확인).
 *
 * 영향을 받는 것은 **JS 를 렌더하는데 그 목록에 없는 클라이언트**다 — 사람 브라우저(무해)와
 * **AI 검색봇**(`OAI-SearchBot`·`PerplexityBot`·`Claude-SearchBot` …은 `BOT_UA_REGEX` 에 없어
 * `index.html` 을 받는다). 즉 이것은 **SEO 가 아니라 GEO 축의 결함**이다.
 *
 * ## 🧭 왜 여기서 고치나 (호출부가 아니라)
 *
 * 클라 노드를 내는 자리는 다섯이고 그중 `GroupBuyDetailPage.tsx`(`/pass` 310건)는 **로딩 잠금표
 * 파일**이라 대표 승인이 필요하다. `SEO.tsx` 한 곳에서 거르면 잠금 파일을 건드리지 않고 다섯이
 * 함께 해소되고, **앞으로 생길 표면도 자동으로** 같은 규칙을 받는다.
 *
 * ## ⚠️ SPA 이동 뒤에는 거르지 않는다 (호출부가 그 판단을 한다)
 *
 * 서버 노드는 `<head>` 에 있고 react-helmet 이 **남의 태그를 지우지 않는다** ⇒ 클라 라우팅으로
 * 다른 페이지에 가도 **첫 페이지의 서버 노드가 그대로 남는다**. 그 상태에서 종류가 같다고 거르면
 * *지금 페이지의* 노드를 지우게 된다. 크롤러는 URL 마다 새로 받으므로(SPA 이동을 안 한다)
 * **첫 로드에서만** 거르는 것으로 충분하다 — 그 경로 비교는 `SEO.tsx` 가 한다.
 *
 * ## ⚠️ 이 모듈이 못 하는 것
 *
 * - 서버·클라 노드의 **내용**이 어긋나는 것은 못 고친다(종류가 같을 때 클라를 버릴 뿐이다).
 *   서버 쪽이 더 풍부하다는 전제(실측: `aggregateRating` 은 서버에만 있다)에 기대고 있다.
 * - 중첩 종류는 보지 않는다 — 아래 `topLevelTypes` 주석의 이유.
 */

/**
 * 노드가 **그 자체로 선언하는** 종류들. `@graph` 는 그래프 멤버의 종류까지 센다.
 *
 * 🔴 **깊이 훑지 않는다.** 깊게 훑으면 `Offer`·`PostalAddress`·`ListItem` 같은 *안쪽* 종류가 잡혀서
 *    "서버에 중첩 `Offer` 가 있다" 는 이유로 클라 `Product` 를 지우게 된다 — 그건 과잉이다.
 */
export function topLevelTypes(node: unknown): string[] {
  const out: string[] = []
  const push = (t: unknown) => {
    if (typeof t === 'string' && t) out.push(t)
    else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string' && x) out.push(x)
  }
  const visitOne = (n: unknown) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return
    const o = n as Record<string, unknown>
    push(o['@type'])
    const g = o['@graph']
    if (Array.isArray(g)) for (const m of g) visitOne(m)
  }
  if (Array.isArray(node)) for (const n of node) visitOne(n)
  else visitOne(node)
  return out
}

/**
 * 서버가 이미 선언한 종류를 가진 클라 노드를 버린다.
 *
 * @param client 호출부가 `<SEO jsonLd={…}>` 로 넘긴 노드(하나 또는 배열)
 * @param serverTypes 같은 문서의 **서버(비-helmet)** 노드가 선언한 종류 집합
 * @returns 남길 노드 배열. **빈 배열이면 아무것도 렌더하지 않는다**(서버가 이미 말했다).
 *
 * 🔒 **fail-open 이다** — 못 읽었을 때 조용히 지우는 쪽이 훨씬 나쁘다(구조화 데이터가 통째로
 *    사라지는데 에러가 0 이다). 🩸 다만 그걸 **보장하는 것은 아래 `every` 자체**다: 빈 집합에서는
 *    `serverTypes.has(t)` 가 전부 false 라 어떤 노드도 안 걸러진다. 뒤이은 `size` 단축은 **성능용**
 *    이고 지워도 행동이 같다(그 자리에 주입을 뒀다가 헛돌아서 배운 것 — 주입 파일에 기록).
 */
export function dropServerDuplicates(
  client: Record<string, unknown> | Record<string, unknown>[] | undefined,
  serverTypes: ReadonlySet<string>,
): Record<string, unknown>[] {
  const list = client == null ? [] : Array.isArray(client) ? client : [client]
  if (!serverTypes.size) return list
  return list.filter((n) => {
    const types = topLevelTypes(n)
    // 종류를 못 읽은 노드는 **남긴다**(판단 근거가 없으면 지우지 않는다).
    if (!types.length) return true
    return !types.every((t) => serverTypes.has(t))
  })
}

/**
 * 문서의 **서버 노드**가 선언한 종류 집합. `[data-rh]`(react-helmet) 는 제외한다.
 *
 * ⚠️ 어떤 이유로든 실패하면 **빈 집합**을 돌려준다 ⇒ 위 fail-open 으로 이어진다.
 */
export function serverJsonLdTypes(doc: Pick<Document, 'querySelectorAll'> | undefined | null): Set<string> {
  const out = new Set<string>()
  if (!doc) return out
  try {
    const els = doc.querySelectorAll('script[type="application/ld+json"]:not([data-rh])')
    els.forEach((el) => {
      try {
        for (const t of topLevelTypes(JSON.parse(el.textContent || 'null'))) out.add(t)
      } catch { /* 깨진 블록 하나가 전체를 못 쓰게 만들지 않는다 */ }
    })
  } catch { return new Set<string>() }
  return out
}
