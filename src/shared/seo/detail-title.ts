/**
 * 🏷️ 상세 표면의 **`<title>` SSOT** (2026-10-14 신설)
 *
 * ## 왜 — 실측 두 건
 *
 * ### ① 숙소 49건: 서버와 클라가 **다른 제목**을 낸다
 * ```
 * 서버(Yeti·카톡)  그랑블루글램핑&펜션 (강원 속초시) - 유어딜
 * 클라(Googlebot)  그랑블루글램핑&펜션 - 유어딜              ← 지역이 없다
 * ```
 * `react-helmet` 이 `<title>` 을 덮으므로 **JS 를 렌더하는 Googlebot 은 지역을 잃는다.**
 * 지역 키워드는 로컬 질의의 핵심인데, 구글 쪽에서만 사라지고 네이버만 받고 있었다.
 * 게다가 **지역 문자열 공식도 두 벌**이었다 — 서버는 `[sido, sigungu].join(' ')`,
 * 클라는 `stayRegionLabel(sido, sigungu, address)`(주소가 있으면 주소 앞 두 토큰).
 *
 * ### ② 교환권 ~135건: 같은 말을 두 번
 * ```
 * 스타벅스 e카드 5만원 교환권 교환권 - 유어딜
 * 교보문고 기프트카드 교환권 10만원권 교환권 - 유어딜
 * 롯데모바일교환권 5만원권 교환권 - 유어딜
 * ```
 * 실측 100건 중 **6건**이 이름에 이미 `교환권` 을 품었는데 서버·클라 둘 다 ` 교환권` 을 덧붙였다
 * (2,260건 추정 ~135건). 이 레포엔 바로 그 규칙의 SSOT(`store-name-dedupe.ts` — *"같은 말을
 * 두 번 안 한다"*)가 있는데 **제목만 그 규칙 밖**이었다.
 * ⚠️ 교환권 상세는 `noindex` 라 **색인 영향은 없다** — 공유 카드 제목·브라우저 탭의 품질 결함이다.
 *
 * ### ③ 이용권 310건: 제목이 **"공동구매"** 라고 말한다 (2026-10-15 대표 승인으로 수리)
 * ```
 * 전  마라샹궈 2인 세트 공동구매 - 신룽푸마라탕 명동점
 * 후  마라샹궈 2인 세트 이용권  - 신룽푸마라탕 명동점
 * ```
 * 그 단어가 **사실이 아니다.** 2026-05-30 에 경제를 **즉시판매 단일가**로 바꿨고(인원 무관),
 * 2026-09-04 대표 확정이 *"마감 개념은 없어"* 다. 그런데 **검색 결과 310건의 제목이 "여러 명이
 * 모여야 하는 것"처럼** 말하고 있었다. 명칭 SSOT(CLAUDE.md)는 이 상품을 **이용권**이라 정한다.
 *
 * 🔴 **"유어딜" 을 접미사로 붙이지 않았다** — 다른 표면은 `… - 유어딜` 로 끝나지만 이 제목은
 *    이미 23~35자(실측)라 사이트 이름을 더하면 검색 결과에서 잘린다. 구글이 사이트 이름을 알아서
 *    붙이므로(`WebSite.name` 을 2026-10-11 에 봇 셸로 배달했다) 꼬리는 **가게 이름**이 더 값지다.
 *    가게 이름이 없으면 그때만 사이트 이름으로 떨어진다(종전과 같다).
 *
 * ⚠️ **같은 말을 두 번 하지 않는다** — 라이브 310건 중 **2건**(`1개월 이용권 + 운동복`)이 이름에
 *    이미 `이용권` 을 품었다. ②와 같은 `includes` 규칙을 쓴다(그 둘은 `… + 운동복 이용권` 이
 *    되는 대신 이름 그대로 남는다).
 *
 * 🏪 **공구 서비스(운영자 몰)의 `공동구매` 는 그대로 둔다** — `/{몰슬러그}` 의 픽업 공구는
 *    *실제로* 여러 명이 모여 사는 것이고 서비스가 다르다(CLAUDE.md 서비스 분리). `worker/index.ts`
 *    의 MALL 메타·`mall-ssr-meta.ts`·`MallHomePage` 는 무접촉이다.
 *
 * ## 규율
 * - **완성된 제목을 돌려준다**(사이트 이름 포함). 클라의 `<SEO title>` 은 `withSiteName` 을
 *   지나는데 그 함수는 *이미 사이트 이름이 들어 있으면 그대로* 돌려주므로 양쪽이 같아진다.
 * - **지역 문자열은 `stayRegionLabel` 하나**(주소 우선 규칙 포함) — 두 공식을 합쳤다.
 * - `교환권` 판정은 **`includes`** 다. `store-name-dedupe` 는 일부러 `startsWith` 인데
 *   (가게명이 꼬리에 든 것은 사람이 쓴 꼬리일 수 있다) 여기는 반대다 — 실측 6건이
 *   `…교환권 10만원권`·`롯데모바일교환권 …` 처럼 **가운데**에 들었고, 그 단어를 또 붙이는 것은
 *   어느 자리든 중복이다.
 */
import { stayRegionLabel } from '../stay-address'
import { CONSUMER_SITE_NAME } from './consumer-surfaces'

/**
 * 숙소 상세 제목.
 *
 * 🔴 **지역은 컬럼(`region_sido`+`region_sigungu`)이 먼저다** — 서버가 종전에 쓴 바로 그 공식이라
 *    라이브 49건의 제목이 **byte-동일**로 남는다(바뀌는 것은 *클라가 이제 같은 값을 낸다*는 것뿐).
 *    컬럼이 정규화된 짧은 형태(`강원`)이고, 그게 `/region/강원` 슬러그와도 같은 표기다 —
 *    주소에서 뽑으면 `강원특별자치도` 가 되어 제목이 길어지고 그 슬러그와 어긋난다.
 * 🔁 컬럼이 **둘 다 비었을 때만** 주소에서 뽑는다(`stayRegionLabel` — 화면이 쓰는 그 규칙).
 *    순수 추가라 기존 출력은 안 바뀌고, 컬럼이 빈 숙소만 지역을 되찾는다.
 */
export function stayDetailTitle(
  name: unknown,
  region: { sido?: string | null; sigungu?: string | null; address?: string | null },
  siteName: string = CONSUMER_SITE_NAME,
): string {
  const n = String(name ?? '').trim()
  const cols = [region?.sido, region?.sigungu].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ')
  const r = cols || stayRegionLabel(null, null, region?.address)
  return `${n}${r ? ` (${r})` : ''} - ${siteName}`
}

/** 교환권 상세 제목. 이름에 이미 `교환권` 이 있으면 **덧붙이지 않는다**. */
export function voucherDetailTitle(name: unknown, siteName: string = CONSUMER_SITE_NAME): string {
  const n = String(name ?? '').trim()
  return `${n.includes('교환권') ? n : `${n} 교환권`} - ${siteName}`
}

/**
 * 이용권 상세(`/pass/:id`) 제목. 310건이 이걸 쓴다 — 근거는 머리말 ③.
 *
 * 🔑 꼬리는 **가게 이름**이고, 없을 때만 사이트 이름이다(머리말 🔴).
 * ⚠️ 이름에 이미 `이용권` 이 들어 있으면 덧붙이지 않는다(머리말 ⚠️ — 실측 2건).
 */
export function passDetailTitle(
  name: unknown,
  storeName: unknown,
  siteName: string = CONSUMER_SITE_NAME,
): string {
  const n = String(name ?? '').trim()
  const store = String(storeName ?? '').trim()
  // 🩸 `.trim()` 이 붙은 이유: 이름이 비면 `" 이용권 - 가게"`(앞 공백)가 됐다. 라이브 310건은
  //    전부 이름이 있어 안 드러나지만, `<title>` 앞 공백은 그 자체로 흠이고 한 호출이면 막는다.
  return `${(n.includes('이용권') ? n : `${n} 이용권`).trim()} - ${store || siteName}`
}
