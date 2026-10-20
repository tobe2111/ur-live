/**
 * 🔗 2026-10-12 — **매장 엔티티의 `sameAs`**(카카오 장소 프로필).
 *
 * 📊 **실측(라이브 · Googlebot UA 로 받아 JSON-LD 를 재귀로 훑었다)**
 *
 *       표면              JSON-LD 노드                                   sameAs
 *       /pass/2919       Product + FoodEstablishment + Breadcrumb       **0**
 *       /stays/2887      Product + LodgingBusiness + AggregateOffer     **0**
 *       /products/2917   Product + Breadcrumb (매장 노드 자체가 없다)    **0**
 *
 *    그런데 `kakao_place_url` 은 **활성 딜 14/14**(표본) · 숙소 상세에도 있었다. `sameAs` 는 "이 가게가
 *    저기 그 가게다" 를 말하는 **유일한 표준 속성**이고 국내 로컬 질의의 권위는 카카오맵이다 — 로컬
 *    검색이 본류인 서비스에서 가진 신호를 안 쓰고 있었다.
 *
 * 🔑 **값은 지어내지 않는다** — `placeSameAs` 가 host + 숫자 id 를 확인하고 정규형으로만 돌려준다.
 *    죽은 `sameAs` 는 신뢰 신호를 **깎으므로**, 모양이 아니면 **아예 안 낸다**.
 *
 * ⚠️ **이 가드가 못 보는 것**
 *    - 그 주소가 **실제로 살아 있는지**(실측: 진짜 id 200 · 지어낸 id 400 — 숫자라고 사는 게 아니다).
 *      요청마다 두드리면 서브리퀘스트 예산(무료 50, 실측 ~49)을 먹어 확인하지 않는다.
 *    - 구글·AI 엔진이 그 신호를 실제로 쓰는지(외부 판정 · 색인 수일~수주 · 서치콘솔은 대표만 본다).
 *    - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildDetailMeta, buildStayDetailMeta, placeSameAs } from '@/worker/utils/detail-ssr-meta'

const ORIGIN = 'https://urdeal.kr'
const KAKAO = 'https://place.map.kakao.com/10256701'

/** 🩸 모양을 손으로 지어 쓰지 않는다 — 라이브 응답(`/api/group-buy/products/:id`)의 키 그대로. */
function passSeed(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    success: true,
    data: {
      id: 2919, name: '닭도리탕', price: 31000, original_price: 35000, category: 'meal_voucher',
      restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배중앙로 165',
      restaurant_lat: 37.4, restaurant_lng: 127.0, group_buy_status: 'active',
      kakao_place_url: KAKAO, ...extra,
    },
  })
}
/** 라이브 `/api/group-buy/stays/:id` 는 `{ data: { product, rooms } }` 다. */
function staySeed(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    success: true,
    data: {
      product: {
        id: 2887, restaurant_name: '그랑블루글램핑&펜션', address: '강원특별자치도 양양군 강현면 동해대로 3275',
        region_sido: '강원', property_type: 'glamping', kakao_place_url: KAKAO, ...extra,
      },
      rooms: [{ base_price_weekday: 149000 }],
    },
  })
}

function nodes(jsonLd: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(jsonLd.replace(/<\\\/script/g, '</script')) as unknown
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>
  const o = parsed as Record<string, unknown>
  const g = o['@graph']
  return Array.isArray(g) ? (g as Array<Record<string, unknown>>) : [o]
}
const placeNode = (ns: Array<Record<string, unknown>>) =>
  ns.find(n => String(n['@id'] || '').endsWith('#place'))
const productNode = (ns: Array<Record<string, unknown>>) => ns.find(n => n['@type'] === 'Product')

describe('① 매장 노드가 sameAs 를 낸다', () => {
  it('/pass/:id — FoodEstablishment 에 정규형 한 개', () => {
    const m = buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')
    const p = placeNode(nodes(m!.jsonLd))
    expect(p, '매장 노드가 없다').toBeTruthy()
    expect(p!['@type']).toBe('FoodEstablishment')
    expect(p!.sameAs).toEqual([KAKAO])
  })

  it('/stays/:id — LodgingBusiness 에 정규형 한 개', () => {
    const m = buildStayDetailMeta(staySeed(), ORIGIN, '/stays/2887')
    const p = placeNode(nodes(m!.jsonLd))
    expect(p!['@type']).toBe('LodgingBusiness')
    expect(p!.sameAs).toEqual([KAKAO])
  })

  it('Product 에는 붙지 않는다 — sameAs 는 *사업체*의 정체성이다', () => {
    for (const jsonLd of [
      buildDetailMeta(passSeed(), ORIGIN, '/pass/2919')!.jsonLd,
      buildStayDetailMeta(staySeed(), ORIGIN, '/stays/2887')!.jsonLd,
    ]) {
      expect(productNode(nodes(jsonLd))!.sameAs, 'Product 에 sameAs 가 붙었다').toBeUndefined()
      // 문서 전체에 정확히 한 번(두 노드에 중복 선언하면 같은 말을 두 번 한다).
      expect((jsonLd.match(/sameAs/g) || []).length).toBe(1)
    }
  })
})

describe('② 모양이 아니면 아예 안 낸다', () => {
  it.each([
    ['빈 값', ''],
    ['공백', '   '],
    ['URL 아님', 'not a url'],
    ['id 가 숫자 아님', 'https://place.map.kakao.com/abc'],
    ['id 없음', 'https://place.map.kakao.com/'],
    ['남의 호스트', 'https://evil.example.com/10256701'],
    ['호스트 접미 함정', 'https://place.map.kakao.com.evil.com/123'],
  ])('%s → sameAs 없음', (_label, raw) => {
    expect(placeSameAs(raw)).toBeNull()
    const m = buildDetailMeta(passSeed({ kakao_place_url: raw }), ORIGIN, '/pass/2919')
    expect(placeNode(nodes(m!.jsonLd))!.sameAs).toBeUndefined()
    expect(m!.jsonLd).not.toContain('sameAs')
  })

  it('null·undefined·숫자도 던지지 않고 null', () => {
    for (const v of [null, undefined, 123, {}, []]) expect(placeSameAs(v)).toBeNull()
  })
})

describe('③ 정규형으로 돌려준다', () => {
  // 🔄 2026-10-13 — `http://` 를 **거부에서 정규화로 옮겼다**(전엔 ② 의 "모양이 아니면" 목록에
  //   있었다). 종전 판정은 https 만 받았는데, 그건 *내보내는 값*이 https 여야 한다는 요구를
  //   *입력*에까지 적용한 것이었다 — 사람이 http 로 붙여넣은 멀쩡한 카카오 장소가 그 이유로
  //   `sameAs` 를 못 받았다. 우리가 내보내는 것은 아래 단언대로 **언제나 https 정본**이다.
  it.each([
    ['그대로', KAKAO],
    ['끝 슬래시', `${KAKAO}/`],
    ['쿼리', `${KAKAO}?from=kakao`],
    ['해시', `${KAKAO}#x`],
    ['쿼리+해시+슬래시', `${KAKAO}/?a=1#b`],
    ['http → https', 'http://place.map.kakao.com/10256701'],
    // 🔢 같은 가게를 가리키는 다른 껍데기 셋 — 라이브 실측으로 같은 id 공간임을 확인했다
    //   (`shared/kakao-place-url.ts` 머리말의 표). 종전엔 이 셋이 전부 `sameAs` 0 이었다.
    ['지도 itemId', 'https://map.kakao.com/?itemId=10256701'],
    ['지도 itemId(다른 파라미터와 함께)', 'https://map.kakao.com/?map_type=TYPE_MAP&itemId=10256701'],
    ['공유 link/map', 'https://map.kakao.com/link/map/10256701'],
    ['길찾기 link/to', 'https://map.kakao.com/link/to/10256701'],
  ])('%s → 한 모양', (_l, raw) => {
    expect(placeSameAs(raw)).toBe(KAKAO)
  })

  it('id 를 못 뽑는 카카오 링크는 sameAs 를 안 낸다 — 단축링크·좌표형', () => {
    // 🔴 `kko.to` 는 URL 안에 id 가 없다(풀려면 네트워크 왕복이고 이 환경에서 그 동작을 검증할
    //   수 없었다). 좌표형 `link/map/{이름},{위도},{경도}` 는 애초에 장소 id 가 아니다 —
    //   **틀린 id 로 접는 것은 `sameAs` 가 없는 것보다 나쁘다**(남의 가게를 선언하게 된다).
    for (const raw of [
      'https://kko.to/AbC_123',
      'https://map.kakao.com/',
      'https://map.kakao.com/link/map/달빛한스푼,37.5,127.0',
      'https://map.kakao.com/?itemId=abc',
    ]) expect(placeSameAs(raw)).toBeNull()
  })

  it('언제나 https 정본 한 모양으로 나간다', () => {
    for (const raw of [KAKAO, 'http://place.map.kakao.com/10256701', 'https://map.kakao.com/?itemId=10256701']) {
      expect(placeSameAs(raw)).toMatch(/^https:\/\/place\.map\.kakao\.com\/\d+$/)
    }
  })
})

describe('④ 반대 방향 — 이 값으로 매장 노드를 만들지 않는다', () => {
  it('주소·좌표가 없으면 노드 자체가 없고, sameAs 도 안 샌다', () => {
    // `hasPlace` 게이트: 매장명 + (주소 | 좌표). 주소·좌표를 지우면 노드가 없어야 한다 —
    // 🔴 sameAs 때문에 노드가 생기면 이름뿐인 사업체를 선언하는 셈이다.
    const m = buildDetailMeta(
      passSeed({ restaurant_address: '', restaurant_lat: 0, restaurant_lng: 0 }),
      ORIGIN, '/pass/2919',
    )
    expect(placeNode(nodes(m!.jsonLd)), '주소·좌표가 없는데 매장 노드가 생겼다').toBeUndefined()
    expect(m!.jsonLd).not.toContain('sameAs')
  })

  it('매장명이 없으면 노드도 sameAs 도 없다', () => {
    const m = buildDetailMeta(passSeed({ restaurant_name: '' }), ORIGIN, '/pass/2919')
    expect(placeNode(nodes(m!.jsonLd))).toBeUndefined()
    expect(m!.jsonLd).not.toContain('sameAs')
  })
})

describe('⑤ 배선 — 손으로 적지 않는다', () => {
  // 🩸 주석 제거기를 **새로 쓰지 않는다** — 블록 주석을 비탐욕 와일드카드로 지우는 순진한 정규식은
  //    문자열·정규식 리터럴 안의 주석 시작 기호에 물려 소스를 통째로 먹는다(이 레포가 네 번 밟아
  //    `check-comment-stripper` 를 만든 자리이고, 이 시험의 첫 판이 그 패턴을 **다시 썼다** —
  //    pre-push 게이트가 잡았다).
  //    ⚠️ **정확히 적자면 그 첫 판이 헛돌고 있지는 않았다**: 아래 단언은 전부 *존재* 검사라 소스가
  //    증발하면 0 이 되어 **빨간불**이 났을 것이고, 실제로 두 방식 모두 같은 값으로 통과한다
  //    (= 지금의 이 파일에는 그 지뢰가 없다). 막는 것은 **그 지뢰가 들어오는 날**이다.
  //    🔴 그리고 그 패턴을 **주석에 인용해서도 안 된다** — 그 가드는 원문을 스캔하는 래칫이라
  //    설명문에 적어도 걸린다(그게 래칫의 옳은 동작이다: 주석으로 우회할 수 있으면 안 된다).
  //    판정은 SSOT `helpers/source-text` 로.
  const code = readCode('src/worker/utils/detail-ssr-meta.ts')

  it('매장 주소를 코드에 박아 두지 않는다', () => {
    // 🔴 호스트를 두 벌로 적으면 한쪽만 고쳐지는 날이 온다.
    // 🔄 2026-10-13 재조준 — 판정이 SSOT(`shared/kakao-place-url`)로 옮겨갔다. 불변식은 그대로이고
    //   **자리만** 바뀌었다: 이 파일엔 호스트가 **0건**이어야 하고, SSOT 한 곳에만 있어야 한다.
    //   (느슨해진 게 아니다 — 종전엔 "2건" 이라 세 번째가 새면 잡혔지만 **두 벌 자체**는 허용했다.)
    expect((code.match(/place\.map\.kakao\.com/g) || []).length,
      '호스트 리터럴이 SSOT 밖에도 있다').toBe(0)
    const ssot = readCode('src/shared/kakao-place-url.ts')
    expect((ssot.match(/place\.map\.kakao\.com/g) || []).length,
      'SSOT 가 호스트를 갖고 있지 않다 — 그러면 위 0 이 통과여도 아무것도 안 지킨다')
      // 🩸 1 이다. SSOT 의 검증 정규식은 `place\\.map\\.kakao\\.com` 처럼 **이스케이프된 글자**라
      //   이 패턴에 안 걸린다 — 평문으로 호스트가 적히는 자리는 정규형 조립 한 곳뿐이고,
      //   그게 "한 곳에만 있다" 는 이 단언이 바라던 상태다.
      .toBeGreaterThanOrEqual(1)
  })

  it('두 빌더가 같은 함수를 쓴다', () => {
    expect((code.match(/placeSameAs\(/g) || []).length).toBeGreaterThanOrEqual(3) // 정의 1 + 호출 2
    expect(code).toContain('placeSameAs(d.kakao_place_url)')
    expect(code).toContain('placeSameAs(p.kakao_place_url)')
  })

  it('시드 타입에 그 필드가 선언돼 있다 — 없으면 조용히 undefined 가 된다', () => {
    expect((code.match(/kakao_place_url\?: string/g) || []).length).toBe(2) // DetailData + StayData
  })
})
