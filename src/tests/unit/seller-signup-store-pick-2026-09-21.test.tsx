/**
 * 🏪 가입 앞문 — **안 B "가게부터"** (2026-09-21 대표 확정 *"응 안 B로 하는데"*).
 *
 * ## 🩸 이 시험이 생긴 이유
 * `KakaoMapPicker` 는 가게 하나를 고르면 **여덟 가지**를 준다(상호·도로명·지번·전화·업종·위도·경도·place_id).
 * 매장 등록 문(`/store/new`)은 그걸 전부 저장하는데, 가입 문(`/seller/register/supplier`)의
 * `AddressPickerField` 는 **주소 문자열 하나만 꺼내고 일곱을 버렸다.** 그래서 사장님이 방금 고른
 * 가게의 상호를 바로 위 칸에 손으로 다시 쳤고, 그 주소마저 `sellers.description` 안
 * `[주소: …]` 텍스트로만 남아 **읽는 코드가 레포 전체에 0건**이었다(라이브 실측: 셀러 4명 전원
 * `description`·`business_address` 비어 있음 · 좌표는 매장 등록 문으로 들어온 단 한 곳만 보유).
 *
 * ## 이 시험이 지키는 불변식
 * 1. **고른 것을 버리지 않는다** — picker 가 place 객체를 통째로 올려보낸다.
 * 2. **payload 가 그것을 싣는다** — 좌표·place_id·업종이 서버로 간다.
 * 3. **`[주소: …]` 조립이 되살아나지 않는다** — 읽는 코드가 0건인 문자열이었다.
 * 4. **서버가 제 자리에 남긴다** — `sellers.address` + `seller_meta`(매장 등록 문과 **같은 키**).
 * 5. **담당자 휴대폰을 가게 대표번호로 덮지 않는다** — 덮으면 알림톡이 유선번호로 간다.
 * 6. **탈출구가 상시다** — 지도에 없는 가게는 종전 입력 칸이 남는다.
 * 7. **업종 매핑은 좁은 것부터** — 카카오는 카페를 `음식점 > 카페 …` 로 다므로 순서가 의미를 가진다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **실제 카카오 응답 모양.** jsdom 은 지도 SDK 를 못 띄운다 ⇒ 소스 계약 + 순수 함수로 고정한다.
 * - 고른 가게가 **진짜 그 사장님 가게인지**. 그건 등록증과 사람이 대조하는 일이다(승인 큐).
 *
 * 🪦 2026-10-12 축소: 옛 가입 폼과 그 부품(`StoreSection`·`AddressPickerField`·`PickedStoreCard`)을
 *   지웠다 — 가입 문은 2026-10-10 부터 `/store/new` 하나이고, 그 파일들은 import 하는 곳이 0 이었다.
 *   위 불변식 1·2·3·6 은 지킬 화면이 사라져 함께 뺐다. 남은 것은 **서버**(4·5)와 **업종 매핑**(7)이다
 *   — `seller-signup-meta` 와 `store-place` 는 아직 살아 있는 코드다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { storeCategoryFromKakao } from '@/shared/store-place'

const META = stripComments(readFileSync('src/features/seller/api/seller-signup-meta.ts', 'utf-8'))
const ROUTE = stripComments(readFileSync('src/features/seller/api/seller-registration.routes.ts', 'utf-8'))
const STORES = stripComments(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf-8'))

/** `stampSignupStorePlace` 본문만 — 같은 파일의 다른 함수 코드가 섞여 통과하지 않게 앵커로 자른다. */
function placeFn(): string {
  const i = META.indexOf('export async function stampSignupStorePlace')
  expect(i, 'stampSignupStorePlace 가 사라졌다 — 이 시험의 앵커가 낡았다').toBeGreaterThan(0)
  return META.slice(i)
}

describe('안 B — 서버가 고른 가게를 제자리에 남긴다', () => {
  it('④ 서버가 payload 를 받아 stampSignupStorePlace 로 넘긴다', () => {
    expect(ROUTE).toContain('stampSignupStorePlace')
    const i = ROUTE.indexOf('await stampSignupStorePlace(')
    expect(i, '호출이 없다 — import 만 남아도 아무 일이 안 일어난다').toBeGreaterThan(0)
    const call = ROUTE.slice(i, ROUTE.indexOf('});', i))
    for (const key of ['address', 'store_phone', 'store_category', 'kakao_place_id', 'kakao_place_url', 'kakao_category', 'lat', 'lng']) {
      expect(call, `${key} 를 안 넘긴다`).toContain(`body.${key}`)
    }
  })

  it('⑤ 매장 등록 문과 **같은 메타 키**를 쓴다 (두 문이 갈리면 읽는 쪽이 한쪽만 안다)', () => {
    const fn = placeFn()
    // 매장 등록 문(`POST /api/seller/stores`)이 실제로 쓰는 키를 그 소스에서 뽑아 대조한다.
    for (const key of ['kakao_place_id', 'kakao_place_url', 'kakao_category', 'store_lat', 'store_lng']) {
      expect(STORES, `매장 등록 문이 ${key} 를 더는 안 쓴다 — 이 대조가 낡았다`).toContain(key)
      expect(fn, `가입 문이 ${key} 를 안 남긴다`).toContain(key)
    }
    expect(fn).toContain('UPDATE sellers SET address')
  })

  it('⑥ 담당자 휴대폰(sellers.phone)을 건드리지 않는다 — 알림톡이 유선번호로 가면 안 된다', () => {
    const fn = placeFn()
    expect(fn).not.toMatch(/SET\s+phone\s*=/i)
    expect(fn).not.toMatch(/phone\s*=\s*\?/)
    // 가게 전화는 별도 키로만 남는다
    expect(fn).toContain('store_phone')
  })

  it('⑦ 좌표는 숫자일 때만 남긴다 (문자열을 그대로 믿으면 지도가 엉뚱한 곳을 가리킨다)', () => {
    const fn = placeFn()
    expect(fn).toContain('Number.isFinite')
    expect(fn, '위도·경도는 한 쌍으로만 의미가 있다').toMatch(/if \(lat && lng\)/)
  })

  it('⑧ 주소는 비어 있을 때만 쓴다 (덮어쓰기 금지)', () => {
    expect(placeFn()).toContain("COALESCE(address, '') = ''")
  })
})

describe('업종 매핑 — 좁은 것부터 (실제 함수를 돌린다)', () => {
  it('⑬ 카페가 음식점보다 먼저다 (카카오는 카페를 음식점 밑에 단다)', () => {
    expect(storeCategoryFromKakao('음식점 > 카페 > 커피전문점')).toBe('cafe')
    expect(storeCategoryFromKakao('음식점 > 일식 > 돈까스,우동')).toBe('restaurant')
  })

  it('⑭ 주요 업종이 우리 8종으로 떨어진다', () => {
    expect(storeCategoryFromKakao('숙박 > 모텔')).toBe('stay')
    expect(storeCategoryFromKakao('서비스,산업 > 뷰티 > 네일샵')).toBe('beauty')
    expect(storeCategoryFromKakao('스포츠,레저 > 스포츠시설 > 헬스장')).toBe('fitness')
    expect(storeCategoryFromKakao('가정,생활 > 세탁소')).toBe('service')
    expect(storeCategoryFromKakao('가정,생활 > 편의점')).toBe('retail')
  })

  it('⑮ 못 고르면 빈 문자열 — 억지로 찍지 않는다(칩이 그대로 남는다)', () => {
    expect(storeCategoryFromKakao('')).toBe('')
    expect(storeCategoryFromKakao(null)).toBe('')
    expect(storeCategoryFromKakao('알 수 없는 업종')).toBe('')
  })
})
