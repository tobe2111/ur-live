/**
 * 🏷️ 유어쇼츠 분류 SSOT — **도시**와 **카테고리**를 글자에서 뽑는다 (2026-09-21 대표 확정 "시안 A + 카테고리").
 *
 * ## 왜 필요한가
 * 대표가 *"도시별로 선택하는 유어쇼츠 페이지"* 를 요청했는데, 실측해 보니 **영상에 지역 필드가
 * 하나도 없었다**(`home_shorts` 컬럼 11개 중 0개). 상품 쪽도 못 쓴다 — `products.region_si` 는
 * 활성 이용권 2,620개 중 **1개**만 채워져 있다. 카테고리도 마찬가지로 이용권이 붙은 영상이
 * 10편 중 2편뿐이라 상품 조인만으론 8편이 "모름"이다.
 * ⇒ 도시·카테고리는 **영상 자신의 글자**(제목·설명글·태그·채널)에서 와야 한다.
 *
 * ## 🔴 이 파일의 불변식 — **모르면 `null`**
 * 다섯 군데를 다 봐도 안 잡히면 찍지 않는다. 찍어 넣으면 "부산 영상"이라며 서울 것을 보여 주게
 * 되고, 그건 **에러가 아니라 그냥 틀린 화면**이라 아무도 신고하지 않는다(이 레포가 반복해 당한
 * "조용한 부재" 클래스). 모르는 영상은 '전체'에만 나온다.
 *
 * ## 서버 전용
 * 분류는 **저장 시점에 한 번** 서버가 하고 결과를 컬럼에 넣는다. 화면은 컬럼만 읽으므로
 * 이 표(수백 개 문자열)가 소비자 번들에 들어가지 않는다 — 이 파일을 클라에서 import 하지 말 것.
 */
import { normalizeCategory, type VoucherCategory } from './constants/voucher-categories'
import { KOREA_REGIONS, findRegionByKey } from './constants/korea-regions'
import { URSHORTS_REGION_KEYS } from './urshorts-regions'

/**
 * 🔁 **지역 표는 새로 만들지 않는다** — `korea-regions.ts` 를 그대로 쓴다.
 *
 * 그 파일은 2026-05-17 대표 시안으로 만든 16개 시·도 × 상권 그룹 표이고, 이용권 지역 필터가
 * 이미 그 단어들로 돈다. 쇼츠가 자기 표를 따로 들면 **같은 동네를 두 이름으로 부르게 되고**
 * (교환권 필터는 '해운대'인데 쇼츠 칩은 '부산'만), 한쪽을 고쳐도 다른 쪽은 안 고쳐진다.
 *
 * ⚠️ **다만 쓰는 자리가 다르다**: 그 표는 원래 *주소* 매칭용이고 여기선 *영상 제목·설명글*에 쓴다.
 *    주소에서 '수영'은 수영구지만 제목에서는 수영장일 수 있다. 그래서 (a) 시가 이미 잡혔으면
 *    **그 시의 상권만** 본다 (b) 어드민이 손으로 고칠 자리를 둔다. 완벽을 노리지 않는다 —
 *    7할을 자동으로 맞히고 나머지는 사람이 고치는 것이 목표다.
 */

/** 칩이 되는 축 = `korea-regions.ts` 의 시·도 키. */
export type RegionSi = string

/**
 * 시·도 키 목록(서버 PATCH 허용 목록).
 *
 * 🔴 **화면은 이 파일을 import 하지 않는다** — 칩·드롭다운은 `urshorts-regions.ts` 의 작은 표를
 *    쓴다(여기를 import 하면 상권 키워드 수백 개가 소비자 번들에 실린다). 두 목록이 같은지는
 *    `urshorts-facets.test.ts` 가 순서까지 대조한다.
 */
export const REGION_SI: readonly string[] = URSHORTS_REGION_KEYS

/** 글에 나올 법한 다른 표기 → 시·도 키. */
const SI_ALIAS: Record<string, string> = {
  서울특별시: '서울', 서울시: '서울', 부산광역시: '부산', 부산시: '부산',
  대구광역시: '대구', 대구시: '대구', 인천광역시: '인천', 인천시: '인천',
  광주광역시: '광주', 대전광역시: '대전', 대전시: '대전',
  울산광역시: '울산', 울산시: '울산',
  세종특별자치시: '충남세종', 세종시: '충남세종', 세종: '충남세종', 충남: '충남세종',
  충청남도: '충남세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원',
  충청북도: '충북', 전라북도: '전북', 전북특별자치도: '전북', 전주: '전북',
  전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주도: '제주', 제주시: '제주', 제주특별자치도: '제주',
}

export interface ShortRegion {
  /** 칩이 되는 축(시·도 키). 못 찾으면 `null`. */
  si: RegionSi | null
  /** 카드에 붙는 작은 라벨(기장·서면·용산). 못 찾으면 `null`. */
  area: string | null
}

/**
 * 글에서 도시를 뽑는다.
 *
 * ① 시·도 이름(별칭 포함) 중 **가장 앞에 나온 것** — 제목 앞쪽이 그 영상의 주제다.
 * ② 상권 이름(`korea-regions.ts` 의 keywords):
 *    - 시가 아직 없으면 → 가장 앞에 나온 상권이 시까지 정한다
 *    - 시가 이미 있으면 → **그 시의 상권만** 본다
 *
 * 🔴 ②의 두 번째 규칙이 핵심이다. 전 지역 상권을 무차별로 보면 '고성'(강원·경남 둘 다) ·
 *    '사천'(강원 사천동·경남 사천시) 같은 이름이 엉뚱한 시를 만든다. 시가 이미 잡힌 글에서
 *    다른 시의 상권을 채택할 이유는 없다.
 */
export function extractRegion(text: string | null | undefined): ShortRegion {
  const hay = (text ?? '').replace(/\s+/g, ' ')
  if (!hay) return { si: null, area: null }

  // ① 시·도 — 별칭이 더 길어 먼저 본다('부산광역시'가 '부산'으로 잘려 위치가 밀리지 않게)
  let si: RegionSi | null = null
  let siAt = Number.POSITIVE_INFINITY
  for (const [alias, canon] of Object.entries(SI_ALIAS)) {
    const at = hay.indexOf(alias)
    if (at >= 0 && at < siAt) { si = canon; siAt = at }
  }
  for (const r of KOREA_REGIONS) {
    const at = hay.indexOf(r.key)
    if (at >= 0 && at < siAt) { si = r.key; siAt = at }
  }

  // ② 상권 이름
  let area: string | null = null
  let areaAt = Number.POSITIVE_INFINITY
  for (const r of KOREA_REGIONS) {
    if (si && r.key !== si) continue
    for (const g of r.districtGroups) {
      for (const kw of g.keywords) {
        const at = hay.indexOf(kw)
        if (at < 0 || at >= areaAt) continue
        areaAt = at
        area = kw
        if (!si) si = r.key
      }
    }
  }
  // 시가 상권에서 나온 경우, 그 시의 다른 상권이 더 앞에 있을 수 있다 — 한 번 더 좁혀 본다.
  if (si && area) {
    const region = findRegionByKey(si)
    for (const g of region?.districtGroups ?? []) {
      for (const kw of g.keywords) {
        const at = hay.indexOf(kw)
        if (at >= 0 && at < areaAt) { areaAt = at; area = kw }
      }
    }
  }
  return { si, area }
}

/**
 * 카테고리 키워드. 값은 이용권 4종 SSOT(`voucher-categories.ts`)와 **같은 축**이라
 * 지도 칩·교환권 필터와 말이 어긋나지 않는다.
 *
 * ⚠️ `health`(피부과·헬스·요가)는 그 SSOT 가 `beauty` 로 통합했으므로 여기서도 beauty 다.
 */
const CATEGORY_WORDS: Record<VoucherCategory, string[]> = {
  meal_voucher: [
    '맛집', '음식', '식당', '먹방', '카페', '커피', '디저트', '베이커리', '브런치', '빵집',
    '한식', '중식', '일식', '양식', '분식', '고기', '삼겹살', '치킨', '피자', '파스타',
    '쌀국수', '국밥', '초밥', '스시', '라멘', '떡볶이', '김밥', '햄버거', '도넛', '케이크',
    '술집', '포차', '이자카야', '뷔페', '횟집', '곱창', '막창', '냉면', '칼국수', '족발',
    '보쌈', '샐러드', '아이스크림', '와인바', '수제맥주', '미쉐린', '미슐랭', '부슐랭',
  ],
  beauty_voucher: [
    '미용실', '헤어', '네일', '속눈썹', '왁싱', '피부관리', '에스테틱', '마사지', '태닝',
    '반영구', '염색', '두피', '스파', '피부과', '필라테스', '요가', '헬스', '체형교정',
    '눈썹문신', '제모', '바디케어', '셀프네일', '아이래쉬',
  ],
  stay_voucher: [
    '호텔', '숙소', '펜션', '게스트하우스', '리조트', '모텔', '글램핑', '캠핑',
    '풀빌라', '한옥스테이', '숙박', '1박2일', '독채', '오션뷰숙소',
  ],
  etc_voucher: [
    '방탈출', '볼링', '사진관', '스튜디오', '공방', '원데이클래스', '체험',
    '애견', '반려동물', '세차', '골프연습', '스크린골프', '키즈카페', '보드게임',
  ],
}

/**
 * 글에서 이용권 카테고리를 뽑는다. **가장 많이 걸린 것 하나**, 동점이거나 0이면 `null`.
 *
 * 🔴 동점을 억지로 가르지 않는 이유: "호텔 브런치" 는 숙소이기도 식사이기도 하다. 우리가
 * 찍으면 반은 틀리고, 틀린 쪽은 화면에만 조용히 남는다. 어드민이 손으로 고르는 자리가 있다.
 *
 * ⚠️ 이용권이 **연결된** 영상은 이 함수를 쓰지 않는다 — 그때는 `products.category` 가 진실이다
 *    (공개 SQL 이 `COALESCE(p.category, s.category)` 로 상품을 먼저 본다).
 */
export function extractCategory(text: string | null | undefined): VoucherCategory | null {
  const hay = (text ?? '')
  if (!hay) return null
  let best: VoucherCategory | null = null
  let bestN = 0
  let tied = false
  for (const [cat, words] of Object.entries(CATEGORY_WORDS) as [VoucherCategory, string[]][]) {
    let n = 0
    for (const w of words) if (hay.includes(w)) n++
    if (n === 0) continue
    if (n > bestN) { best = cat; bestN = n; tied = false }
    else if (n === bestN) tied = true
  }
  return tied ? null : best
}

/** 분류에 넣을 재료. 없는 건 안 넘기면 된다. */
export interface ShortClassifyInput {
  title?: string | null
  channel?: string | null
  description?: string | null
  tags?: string[] | null
  /** 연결된 이용권의 매장명·주소 — 있으면 가장 정확한 지역 신호다. */
  storeName?: string | null
  storeAddress?: string | null
  /** 연결된 이용권의 카테고리. 있으면 추출을 건너뛴다(그게 우리가 실제로 파는 것이다). */
  productCategory?: string | null
}

export interface ShortClassification {
  region_si: RegionSi | null
  region_area: string | null
  category: VoucherCategory | null
}

/**
 * 한 편을 분류한다.
 *
 * 지역은 **매장 주소·매장명을 먼저** 본다 — 그게 실제 좌표에 가장 가깝다. 그 다음이 제목,
 * 설명글, 태그, 채널 순이다(채널이 마지막인 이유: `부산일보TV` 가 서울 영상을 올릴 수도 있다).
 */
export function classifyShort(input: ShortClassifyInput): ShortClassification {
  const parts = [
    input.storeAddress, input.storeName, input.title,
    input.description, (input.tags ?? []).join(' '), input.channel,
  ]
  let region: ShortRegion = { si: null, area: null }
  for (const p of parts) {
    const got = extractRegion(p)
    if (!region.si && got.si) region = got
    else if (region.si && !region.area && got.si === region.si && got.area) region = { si: region.si, area: got.area }
    if (region.si && region.area) break
  }
  const linked = normalizeCategory(input.productCategory)
  const category = linked ?? extractCategory(
    [input.title, input.description, (input.tags ?? []).join(' '), input.storeName].filter(Boolean).join(' '),
  )
  return { region_si: region.si, region_area: region.area, category }
}
