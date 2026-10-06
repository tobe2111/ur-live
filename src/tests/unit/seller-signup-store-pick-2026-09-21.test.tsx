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
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { render, fireEvent } from '@testing-library/react'
import { storeCategoryFromKakao } from '@/shared/store-place'
import StoreSection from '@/pages/seller-register/StoreSection'
import type { SignupForm } from '@/pages/seller-register/RegisterFields'

const PICKER = stripComments(readFileSync('src/pages/seller-register/AddressPickerField.tsx', 'utf-8'))
const PAGE = stripComments(readFileSync('src/pages/SellerRegisterSupplierPage.tsx', 'utf-8'))
const SECTION = stripComments(readFileSync('src/pages/seller-register/StoreSection.tsx', 'utf-8'))
const META = stripComments(readFileSync('src/features/seller/api/seller-signup-meta.ts', 'utf-8'))
const ROUTE = stripComments(readFileSync('src/features/seller/api/seller-registration.routes.ts', 'utf-8'))
const STORES = stripComments(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf-8'))

/** `stampSignupStorePlace` 본문만 — 같은 파일의 다른 함수 코드가 섞여 통과하지 않게 앵커로 자른다. */
function placeFn(): string {
  const i = META.indexOf('export async function stampSignupStorePlace')
  expect(i, 'stampSignupStorePlace 가 사라졌다 — 이 시험의 앵커가 낡았다').toBeGreaterThan(0)
  return META.slice(i)
}

describe('안 B — 고른 가게를 버리지 않는다', () => {
  it('① picker 가 place 객체를 통째로 올려보낸다 (주소 문자열 하나가 아니라)', () => {
    // 🔴 뿌리 한 줄: 종전 `onChange(p.road_address_name || p.address_name || '')` 가 일곱을 버렸다.
    const i = PICKER.indexOf('onSelect={(p) =>')
    expect(i, 'onSelect 앵커가 낡았다').toBeGreaterThan(0)
    const body = PICKER.slice(i, PICKER.indexOf('setOpen(false)', i))
    for (const field of ['p.place_name', 'p.phone', 'p.category_name', 'p.y', 'p.x', 'p.id']) {
      expect(body, `${field} 를 안 올려보낸다 — 그 값이 다시 버려진다`).toContain(field)
    }
    // 두 번째 인자로 넘긴다(첫 인자는 여전히 주소 — 직접 입력 경로 호환)
    expect(body).toMatch(/onChange\(\s*address\s*,\s*\{/)
  })

  it('② 제출 payload 가 좌표·place_id·업종을 싣는다', () => {
    const i = PAGE.indexOf("api.post('/api/seller/register-from-user'")
    expect(i).toBeGreaterThan(0)
    const body = PAGE.slice(i, PAGE.indexOf('terms_agreed_version', i))
    // 🩸 첫 판은 **이름만** 셌다 — `...(false ? { store_phone: … } : {})` 로 바꿔도 글자가 남아
    //   통과했다(주입이 잡았다). 이름이 아니라 **값의 출처**를 본다.
    for (const [key, from] of [
      ['kakao_place_id', 'place.placeId'], ['kakao_place_url', 'place.placeUrl'],
      ['kakao_category', 'place.category'], ['lat', 'place.lat'], ['lng', 'place.lng'],
      ['store_phone', 'place.phone'],
    ] as const) {
      expect(body, `payload 의 ${key} 가 ${from} 에서 오지 않는다`).toMatch(
        new RegExp(`${key}:\\s*${from.replace('.', '\\.')}`),
      )
    }
    expect(body, 'place 스프레드가 고른 가게에 걸려 있지 않다').toContain('...(place ? {')
    expect(body).toMatch(/address:\s*form\.address/)
    expect(body).toMatch(/store_category:\s*form\.store_category/)
  })

  it('③ `[주소: …]` 문자열 조립이 되살아나지 않는다 (읽는 코드가 0건이었다)', () => {
    expect(PAGE).not.toContain('[주소:')
    expect(PAGE).not.toContain('[카테고리:')
    expect(PAGE, 'description 메타 조립이 되살아났다').not.toContain('descWithMeta')
  })

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

describe('안 B — 화면', () => {
  it('⑨ 고르면 가게명·주소 입력 칸이 사라지고 카드가 대신한다', () => {
    expect(SECTION).toContain('<PickedStoreCard')
    // 두 칸 모두 `!place` 게이트 뒤에 있어야 한다
    const nameAt = SECTION.indexOf('id="f-business_name"')
    const addrAt = SECTION.indexOf('id="f-address"')
    expect(nameAt).toBeGreaterThan(0)
    expect(addrAt).toBeGreaterThan(0)
    for (const at of [nameAt, addrAt]) {
      const before = SECTION.slice(Math.max(0, at - 320), at)
      expect(before, '입력 칸이 `!place` 게이트 밖에 있다 — 고르고도 다시 치게 된다').toContain('{!place &&')
    }
  })

  it('⑩ 탈출구가 상시다 — 되돌리기(onClear)와 직접 입력이 둘 다 있다', () => {
    expect(SECTION).toContain('onClear={clearPlace}')
    expect(PAGE, '되돌릴 길이 없으면 잘못 고른 사장님이 가입을 다시 한다').toContain('clearPlace={() => setPlace(null)}')
  })

  it('⑪ 매장 종류 칩은 골라도 남는다 — 매핑은 추측이라 고칠 길이 있어야 한다', () => {
    const at = SECTION.indexOf('id="f-store_category"')
    expect(at).toBeGreaterThan(0)
    const before = SECTION.slice(Math.max(0, at - 260), at)
    expect(before, '칩이 조건 뒤로 숨었다 — 잘못 매핑되면 고칠 수 없다').not.toContain('{!form.store_category &&')
  })

  it('⑫ 상호는 지도값이 이긴다 — 카드와 제출값이 다르면 아무도 모른다', () => {
    const i = PAGE.indexOf('function pickStore')
    expect(i).toBeGreaterThan(0)
    const fn = PAGE.slice(i, PAGE.indexOf('/** 제출 버튼', i))
    expect(fn).toMatch(/business_name:\s*p\.name\s*\|\|\s*f\.business_name/)
    // 매장 종류는 반대 — 사장님이 고른 칩이 이긴다
    expect(fn).toMatch(/store_category:\s*f\.store_category\s*\|\|\s*storeCategoryFromKakao/)
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

/**
 * 🖥️ 실제로 렌더해서 본다 — 소스 grep 은 "게이트가 있다"만 말하고 "그래서 무엇이 보이나"는 못 말한다.
 *
 * ⚠️ jsdom 은 레이아웃이 없어 **높이·겹침을 못 잰다.** 여기서 보는 것은 *무엇이 DOM 에 있는가* 하나다.
 */
describe('안 B — 실제 렌더', () => {
  const form: SignupForm = {
    business_name: '', business_number: '', representative_name: '', business_start_date: '',
    phone: '', store_category: '', address: '', description: '',
  }
  const props = {
    errors: {}, cls: () => '', hint: () => undefined, storeDone: 0,
    set: () => () => {}, pickStore: () => {}, clearPlace: () => {},
  }
  const PLACE = {
    name: '홍대돈까스', address: '전북특별자치도 전주시 덕진구 가리내10길 10',
    phone: '063-123-4567', category: '음식점 > 일식 > 돈까스,우동',
    lat: '35.8', lng: '127.1', placeId: '26322749', placeUrl: 'https://place.map.kakao.com/26322749',
  }

  it('⑯ 안 골랐으면 [가게 찾기]·[가게명] 둘 다 있다 (탈출구)', () => {
    const { container } = render(<StoreSection {...props} form={form} place={null} />)
    expect(container.querySelector('#f-address'), '가게 찾기 칸이 없다').not.toBeNull()
    expect(container.querySelector('#f-business_name'), '직접 입력 탈출구가 없다').not.toBeNull()
  })

  it('⑰ 고르면 그 두 칸이 사라지고 카드가 상호·주소·전화를 말한다', () => {
    const { container } = render(
      <StoreSection {...props} form={{ ...form, business_name: PLACE.name, address: PLACE.address }} place={PLACE} />,
    )
    expect(container.querySelector('#f-address'), '고르고도 찾기 칸이 남았다').toBeNull()
    expect(container.querySelector('#f-business_name'), '고르고도 상호를 또 묻는다').toBeNull()
    const text = container.textContent || ''
    for (const v of [PLACE.name, PLACE.address, PLACE.phone]) expect(text).toContain(v)
  })

  it('⑱ 고른 뒤에도 담당자 연락처와 매장 종류 칩은 남는다', () => {
    const { container } = render(<StoreSection {...props} form={form} place={PLACE} />)
    expect(container.querySelector('#f-phone'), '알림톡 받을 번호를 묻지 않는다').not.toBeNull()
    expect(container.querySelector('[role="radiogroup"]'), '업종을 고칠 길이 없다').not.toBeNull()
  })

  it('⑲ 되돌리기 버튼이 실제로 onClear 를 부른다', () => {
    let cleared = 0
    const { getByText } = render(
      <StoreSection {...props} form={form} place={PLACE} clearPlace={() => { cleared += 1 }} />,
    )
    fireEvent.click(getByText('다른 가게 고르기'))
    expect(cleared, '버튼은 있는데 아무 일도 안 한다').toBe(1)
  })
})
