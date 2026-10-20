/**
 * 🏷️ 브랜드 엔티티 JSON-LD (Organization + WebSite) — **크롤러 셸 전용** 출처
 *
 * 2026-10-11 (대표 *"사이트 이름 우리 야놀자처럼 유어딜 로 되나?"* — 라이브 실측).
 *
 * 🔎 **왜 이 모듈이 생겼나 — 제가 같은 자리에서 두 번 틀렸다.**
 *   ① 처음엔 *"홈 JSON-LD 가 0건이라 사이트 이름이 도메인으로 떨어졌다"* 고 진단하고 이 모듈을
 *      만들었다. ② 그 뒤 `index.html:495` 에 `Organization`+`WebSite` 가 **이미** 있고 `@id` 까지
 *      같은 것을 보고 *"내 코드는 중복"* 이라며 통째로 지웠다. ③ **라이브를 UA 별로 재니 ②가
 *      틀렸다** — 크롤러는 그 문서를 **받지 않는다.**
 *
 *      | UA | 서빙되는 셸 | `#organization` |
 *      |---|---|---|
 *      | iPhone·PC | `index.html`(정적 `@graph` 포함) | 있음 |
 *      | Yeti·Googlebot·DaumOA | `app.get('*')` 의 손으로 쓴 최소 HTML | **0** |
 *
 *      즉 `WebSite.name = 유어딜` 은 **어떤 검색 크롤러도 한 번도 받은 적이 없다.** 파일에 있는
 *      것과 크롤러가 받는 것은 다른 일이고, 그 둘을 구분하지 않아 진단이 두 번 뒤집혔다.
 *
 * 🧷 **게다가 사이트 전체가 없는 노드를 가리키고 있었다**(같은 실측): 크롤러가 받는 `/blog` 의
 *   JSON-LD 는 `publisher: {"@id": ".../#organization"}` · `isPartOf: {"@id": ".../#website"}` 로
 *   **정의되지 않은 `@id`** 를 참조한다(dangling reference). 이 모듈이 그 두 노드를 같은 문서에
 *   놓아 참조를 이어 준다.
 *
 * 🔴 **중복은 구조적으로 불가능하다** — 두 셸은 **상호배타**다(봇 UA 면 최소 HTML, 아니면
 *   `index.html`). 그래서 이 모듈은 **봇 셸에만** 꽂는다. `index.html` 쪽 경로나
 *   `applySurfaceMeta`/`detail-ssr-meta` 에 이 값을 또 넣으면 같은 `@id` 가 한 문서에 두 벌이
 *   되고, 그게 ②에서 제가 두려워한 바로 그 결함이다(가드가 고정한다).
 *
 * 🔒 **`index.html` 의 블록과 글자 하나까지 같은 값이어야 한다** — 두 벌이 갈리면 사람과 크롤러가
 *   서로 다른 브랜드 설명을 받는다(에러는 안 난다). `seo-crawler-visibility-2026-10-11.test.ts`
 *   가 양쪽을 **파싱해 deep-equal** 로 대조한다. 한쪽만 고치면 빨간불이다.
 */

/** `index.html:495` 의 `@graph` 와 **같은 값**(테스트가 deep-equal 로 고정). */
export const BRAND_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://urdeal.kr/#organization',
      name: '유어딜',
      alternateName: ['urdeal', 'UrDeal'],
      url: 'https://urdeal.kr/',
      logo: 'https://urdeal.kr/icon-512.png',
      description:
        '유어딜(urdeal.kr)은 우리 동네 매장 이용권을 할인가로 구매해 매장에서 QR로 바로 사용하는 로컬 커머스 플랫폼입니다. 식사·뷰티·숙소 이용권, 기프티콘 교환권, 내 주변 동네딜 지도, 누구나 만드는 유어샵을 제공합니다.',
      email: 'jiwon@ur-team.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '남부순환로359길 14, 3층(도곡동)',
        addressLocality: '강남구',
        addressRegion: '서울특별시',
        addressCountry: 'KR',
      },
      parentOrganization: { '@type': 'Organization', name: '리스터코퍼레이션' },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://urdeal.kr/#website',
      url: 'https://urdeal.kr/',
      name: '유어딜',
      alternateName: 'urdeal',
      inLanguage: 'ko',
      publisher: { '@id': 'https://urdeal.kr/#organization' },
    },
  ],
} as const

/**
 * JSON-LD 를 `<script>` 태그로 싼다.
 *
 * ⚠️ **`</script>` 탈출만 막는다 — HTML escape 는 하지 않는다.** 값은 전부 상수(사용자 입력 0)이고,
 *   `&` → `&amp;` 가 JSON 안으로 들어가면 파서가 그 블록을 **통째로 버린다**(에러도 경고도 없다).
 *
 * 🔬 인자를 받는 이유는 **시험이 동작을 잴 수 있게** 하는 것이다 — 상수만 싸는 함수는
 *   "escape 를 했는가" 를 판정할 수 없다(지금 데이터엔 `&`·`<` 가 한 글자도 없어서 escape 를
 *   끼워 넣어도 결과가 같다. 주입 러너가 그걸 잡아서 이 모양이 됐다).
 */
export function jsonLdScriptTag(data: unknown): string {
  const json = JSON.stringify(data).replace(/<\//g, '<\\/')
  return `<script type="application/ld+json">${json}</script>`
}

/** 봇 셸 `<head>` 에 꽂는 브랜드 노드 한 덩어리. */
export function brandJsonLdScript(): string {
  return jsonLdScriptTag(BRAND_JSONLD)
}
