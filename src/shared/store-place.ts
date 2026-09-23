/**
 * 📍 지도에서 고른 가게 한 곳 — **가입 문과 매장 등록 문이 같은 그릇을 쓴다** (2026-09-21 대표 확정 "안 B").
 *
 * 🩸 왜 생겼나: `KakaoMapPicker` 는 가게 하나를 고르면 **여덟 가지**를 준다(상호·도로명·지번·전화·
 *   업종·위도·경도·place_id). 매장 등록 위저드(`StoreRegisterModal` → `POST /api/seller/stores`)는
 *   그걸 전부 저장하는데, **가입 화면은 `AddressPickerField` 에서 주소 문자열 하나만 꺼내고 일곱을
 *   버렸다.** 그래서 사장님이 방금 고른 가게의 상호·전화·업종을 **손으로 다시 쳤고**, 그 주소마저
 *   `sellers.description` 안 `[주소: …]` 텍스트로만 남아 **읽는 코드가 레포 전체에 0건**이었다
 *   (라이브 실측: 셀러 4명 전원 `description`·`business_address` 비어 있음).
 *
 * ⇒ 두 문이 같은 타입을 쓰면 한쪽만 고쳐지는 일이 구조적으로 줄어든다. 이 파일이 그 타입이다.
 *
 * ⚠️ `phone` 은 **가게 전화**다(가입 폼의 '담당자 연락처' 와 다른 축 — 그쪽은 알림톡을 받는
 *   휴대폰이라 가게 대표번호로 덮으면 안 된다). 섞지 말 것.
 */

export interface PickedStore {
  /** 상호 (카카오 `place_name`) */
  name: string
  /** 도로명 우선, 없으면 지번 — 손님이 찾아올 때 쓰는 주소 */
  address: string
  /** 가게 전화 (대표번호). 담당자 휴대폰이 **아니다** */
  phone: string
  /** 카카오 업종 원문 — 예: `음식점 > 일식 > 돈까스,우동` */
  category: string
  lat: string
  lng: string
  /** 카카오 place id — 매장 등록 문의 중복 검사(`seller_meta.kakao_place_id`)가 읽는 열쇠 */
  placeId: string
  placeUrl: string
}

/**
 * 카카오 업종 원문 → 가입 폼의 `store_category` 8종 중 하나. 못 고르면 `''`(= 칩을 그대로 보여 준다).
 *
 * ⚠️ **순서가 의미를 가진다.** 카카오는 카페를 `음식점 > 카페 > 커피전문점` 처럼 **음식점 밑에**
 *   달아 두므로, `음식점` 을 먼저 보면 모든 카페가 '음식점' 이 된다. 좁은 것부터 본다.
 */
const KAKAO_CATEGORY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/카페|베이커리|제과|디저트|커피/, 'cafe'],
  [/숙박|호텔|모텔|펜션|게스트하우스|리조트/, 'stay'],
  [/미용|네일|헤어|피부|왁싱|뷰티|에스테틱/, 'beauty'],
  [/헬스|요가|필라테스|피트니스|스포츠|체육/, 'fitness'],
  [/세탁|마사지|스파|수리|사진|학원|병원|약국|서비스/, 'service'],
  [/음식점|주점|술집/, 'restaurant'],
  [/마트|편의점|의류|판매|소매|쇼핑/, 'retail'],
]

export function storeCategoryFromKakao(kakaoCategory: string | undefined | null): string {
  const raw = String(kakaoCategory || '')
  if (!raw.trim()) return ''
  for (const [re, value] of KAKAO_CATEGORY_RULES) if (re.test(raw)) return value
  return ''
}
