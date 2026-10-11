/**
 * 🏷️ **브랜드 구조화 데이터(`Organization` + `WebSite`)의 SSOT**
 * (2026-10-11 대표 — 야놀자 검색 결과 스크린샷 *"이런 식으로까지 나오게 하려면 어떻게 해야해?"*)
 *
 * ## 왜 필요한가 — 구글이 우리 사이트 이름을 `urdeal.kr` 로 쓰고 있다 (대표 스크린샷 실측)
 *
 *     야놀자   NOL(야놀자)        https://nol.yanolja.com   + 사이트링크 6줄
 *     유어딜   urdeal.kr          https://urdeal.kr          (사이트링크 없음)
 *
 * 구글은 **홈페이지의 `WebSite` JSON-LD `name`** 을 사이트 이름의 1순위 소스로 쓴다
 * (없으면 `og:site_name` → `<title>` → 도메인 순으로 내려간다). 우리는 홈 JSON-LD 가
 * **0건**이라 맨 아래 단계인 도메인까지 떨어졌다. 그래서 브랜드를 검색했는데 브랜드 이름이 아니라
 * 주소가 뜬다.
 *
 * ## ⚠️ 사이트링크(야놀자의 "모텔 / 호텔·리조트 / 펜션·풀빌라" 목록)는 **신청할 수 없다**
 *
 * 구글이 사이트 구조·내부 링크·브랜드 검색량을 보고 **자동으로** 고른다. 마크업으로 요청하는
 * 수단이 없다(과거의 `SearchAction` 검색창 사이트링크조차 2024-11 에 지원이 끊겼다 — 그래서
 * 여기에 `potentialAction` 을 **넣지 않는다**. 넣어도 아무 일이 안 일어나고, `/search` 는
 * robots 로 막아 둔 경로라 선언과 현실이 어긋나기만 한다).
 *
 * ⇒ 우리가 할 수 있는 것은 **자격 요건을 갖추는 것**뿐이고, 그중 코드로 되는 것이 이 파일이다:
 *    사이트 이름 · 로고 · 조직 정체성. 나머지(일관된 내부 링크, 독립적 가치를 갖는 상위 카테고리
 *    페이지, 브랜드 검색량)는 구조와 마케팅의 몫이다.
 *
 * ## 🔒 지어내지 않는다
 * `sameAs`(공식 SNS)는 **실제로 운영하는 계정이 있을 때만** 넣는다. 지금은 없다 —
 * 레포에 있는 `youtube.com/@urdeal` 은 어드민 입력창의 **플레이스홀더**다. 없는 계정을 선언하면
 * 구글이 확인하러 가서 404 를 받고, 그건 신뢰 신호를 **깎는다**.
 */

/** 사이트 이름 — 구글이 검색 결과 헤더에 쓰는 값. `SEO.tsx` 의 SITE_NAME 과 같아야 한다. */
export const BRAND_NAME = '유어딜'
/** 라틴 표기 — 영어권 검색·브랜드 혼동 방지용. */
export const BRAND_ALT_NAME = 'UrDeal'
/** 정사각 로고(구글 요구: 최소 112×112, 정사각 권장). `public/icon-512.png` 실재 확인. */
export const BRAND_LOGO_PATH = '/icon-512.png'

/** `</script>` 로 스크립트 블록이 끊기는 것을 막는다(다른 JSON-LD 빌더와 같은 처리). */
function escapeScript(s: string): string {
  return s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

/**
 * 홈(`/`)에만 넣는 브랜드 JSON-LD. 이스케이프까지 끝난 문자열을 돌려준다.
 *
 * ⚠️ **홈 외의 페이지에 넣지 말 것.** 구글은 사이트 이름을 **홈페이지의** `WebSite` 에서만 읽고,
 * 모든 페이지에 뿌리면 중복 엔티티만 늘어난다(상세 페이지는 `Product`+`BreadcrumbList` 가 맞다).
 *
 * @param origin `https://urdeal.kr` 같은 절대 오리진(끝 슬래시 없이)
 * @param description 홈 메타 설명 — 조직 설명으로 재사용(같은 표에서 오므로 갈릴 수 없다)
 */
export function buildBrandJsonLd(origin: string, description: string): string {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: BRAND_NAME,
    alternateName: BRAND_ALT_NAME,
    url: `${origin}/`,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}${BRAND_LOGO_PATH}`,
      width: 512,
      height: 512,
    },
    description: description.replace(/\s+/g, ' ').trim().slice(0, 300),
  }
  const site = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    // 🔑 이 값이 검색 결과 헤더의 **사이트 이름**이 된다(현재는 비어 있어 `urdeal.kr` 로 떨어진다).
    name: BRAND_NAME,
    alternateName: BRAND_ALT_NAME,
    url: `${origin}/`,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${origin}/#organization` },
  }
  return escapeScript(JSON.stringify([org, site]))
}
