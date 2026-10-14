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
 * ## 🔴 이용권(`/pass/:id`)은 건드리지 않는다
 * `${상품명} 공동구매 - ${가게명}` 310건은 **서버·클라가 이미 같고**, 그 문구 자체(`공동구매` ·
 * 꼬리 가게명)는 **결재 #35 대기**다. 여기 섞으면 승인 없이 310건의 검색 제목을 바꾸게 된다.
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
