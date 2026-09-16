/**
 * 🏪 **업체 정보는 한 페이지다** (2026-09-16 대표 확정, 당근비즈니스 시안)
 *
 * > 대표: *"셀러대시보드에서 업체 정보 입력하는 페이지는 하나로 통일하고 보내준 당근 이미지처럼
 * > 구성해줄래? 굳이 분산할 필요없는 것들은 한 페이지로 모아주면 좋을 것 같아"*
 *
 * ## 이 가드가 지키는 것 — **다시 흩어지지 않기**
 * 흩어짐은 한 번에 일어나지 않는다. "이 칸 하나만 여기 두자" 가 쌓여서 세 곳이 됐다.
 * 그래서 *같은 값이 두 화면에 있으면 빨간불* 을 불변식으로 박는다. 같은 값을 두 곳에서 고칠 수
 * 있으면 반드시 한쪽이 낡고, 사장님은 **"분명 고쳤는데"** 를 겪는다(그리고 그건 에러가 안 난다).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - 화면이 예쁜지·미리보기가 실제와 같은지 — 눈으로 봐야 한다.
 *   - 서버 저장이 실제로 되는지(두 엔드포인트) — 그건 각 라우트의 짝 시험 소관.
 *   - 새로 만든 **다른** 화면에 업체 칸을 또 만드는 것 — 아래 ④가 알려진 세 곳만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { districtOf, categoryLeaf } from '@/pages/seller-store-info/StorePreviewCard'

const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const PAGE = 'src/pages/SellerStoreInfoPage.tsx'
const HOOK = 'src/pages/seller-store-info/useStoreInfo.ts'
const PROFILE = 'src/pages/SellerProfileEditPage.tsx'
const ROUTES = 'src/routes/seller.routes.tsx'

describe('① 한 페이지가 세 곳의 칸을 전부 갖는다', () => {
  it('매장·유어샵·SNS 칸이 모두 폼에 있다', () => {
    const h = src(HOOK)
    for (const k of [
      'name', 'address', 'phone', 'verify_pin', 'manager_phone',      // 옛 모달
      'banner_url', 'brand_color',                                    // 옛 유어샵 설정
      'bio', 'profile_image', 'sns_instagram', 'website_url', 'kakao_chat_link', // 옛 셀러 프로필
    ]) {
      expect(h, `${k} 가 빠지면 그 칸을 고칠 화면이 없어진다`).toContain(k)
    }
  })

  it('저장이 두 저장소로 나뉘어 나간다 (매장 전파 ↔ 유어샵)', () => {
    const h = src(HOOK)
    expect(h).toContain('/api/seller/stores/${sellerId}/profile')
    expect(h).toContain("api.put('/api/seller/profile'")
  })

  it('🔴 부분 성공을 숨기지 않는다 — 어느 쪽이 실패했는지 남긴다', () => {
    const h = src(HOOK)
    // ⚠️ 이름만 재면 타입 선언(`{ store?, shop? }`)과 아래 `if (!failed.store)` 때문에 늘 통과한다
    //    (주입이 잡았다) — **각 catch 블록이 자기 쪽을 적는지**를 본다.
    const storeCatch = h.slice(h.indexOf('/api/seller/stores/${sellerId}/profile'), h.indexOf("api.put('/api/seller/profile'"))
    expect(storeCatch, '실패를 하나로 뭉치면 이미 저장된 절반까지 다시 입력하게 된다')
      .toMatch(/failed\.store =/)
    const shopCatch = h.slice(h.indexOf("api.put('/api/seller/profile'"))
    expect(shopCatch).toMatch(/failed\.shop =/)
    expect(h, '성공한 쪽만 기준선을 옮겨야 실패한 칸이 다시 저장된다')
      .toMatch(/if \(!failed\.store\)[\s\S]{0,120}if \(!failed\.shop\)/)
  })

  it('안 바뀐 키는 안 보낸다 — 서버의 "빈 값 무시" 규칙에 기대지 않는다', () => {
    const h = src(HOOK)
    expect(h).toMatch(/if \(form\[k\] !== initial\[k\]\) storePatch\[k\]/)
  })
})

describe('② 옛 입구 셋이 새 페이지로 간다', () => {
  it('매장 정보 모달이 사라졌다 (두 곳에서 열리고 있었다)', () => {
    expect(existsSync('src/components/seller/StoreProfileModal.tsx'),
      '모달이 남아 있으면 그 화면에서 고친 값이 새 페이지와 갈린다').toBe(false)
    for (const f of ['src/pages/SellerStoresPage.tsx', 'src/pages/seller-page/MyStoresPanel.tsx']) {
      expect(src(f), `${f} 가 아직 모달을 연다`).not.toContain('StoreProfileModal')
      expect(src(f), `${f} 의 [정보] 가 새 페이지로 가야 한다`).toContain('/seller/store?id=')
    }
  })

  it('유어샵 설정 페이지는 사라지고 그 주소는 새 페이지로 보낸다', () => {
    expect(existsSync('src/pages/SellerMiniShopPage.tsx')).toBe(false)
    const r = src(ROUTES)
    expect(r, '라우트를 통째로 지우면 퍼져 있는 옛 링크가 404 가 된다')
      .toMatch(/path="\/seller\/mini-shop"[\s\S]{0,120}Navigate to="\/seller\/store"/)
  })

  it('새 라우트가 실제로 걸려 있다', () => {
    expect(src(ROUTES)).toMatch(/path="\/seller\/store"/)
  })
})

describe('③ 셀러 프로필에는 업체 칸이 남아 있지 않다', () => {
  it('소개·SNS·이미지·홈페이지·카톡 칸이 전부 빠졌다', () => {
    const p = src(PROFILE)
    for (const k of ['formData.bio', 'formData.sns_instagram', 'formData.profile_image',
      'formData.website_url', 'formData.kakao_chat_link']) {
      expect(p, `${k} 가 남아 있으면 같은 값을 두 화면에서 고치게 된다`).not.toContain(k)
    }
  })

  it('보이지 않는 폼을 저장하는 버튼이 없다', () => {
    const p = src(PROFILE)
    expect(p, '기본 탭이 business 라 이 버튼은 화면에 없는 값을 저장했다').not.toMatch(/onClick=\{handleSave\}/)
  })

  it('계정·운영(카카오 연동·보안 PIN·배송)은 그대로 남아 있다', () => {
    const p = src(PROFILE)
    expect(p).toContain('shippingData.base_shipping_fee')
    expect(p).toContain('handleSaveShipping')
  })
})

describe('④ 네비가 새 페이지를 가리킨다', () => {
  it('매장 묶음에 업체 정보가 있고, 유어샵 설정 항목은 없다', () => {
    const g = src('src/components/seller/seller-tab-groups.ts')
    expect(g).toContain("path: '/seller/store'")
    expect(g, '없어진 화면을 가리키는 메뉴는 낡은 지도다').not.toContain("path: '/seller/mini-shop'")
  })
})

describe('⑤ 미리보기 부제 — 실제 값으로 계산한다', () => {
  it('주소에서 동 이름을 뽑는다', () => {
    expect(districtOf('서울특별시 서초구 방배동 919-20')).toBe('방배동')
    expect(districtOf('전북특별자치도 전주시 덕진구 가리내10길 10')).toBe('덕진구')
    expect(districtOf('')).toBe('')
  })

  it('업종은 맨 끝 조각이 사람이 아는 이름이다', () => {
    expect(categoryLeaf('음식점 > 일식 > 돈까스,우동')).toBe('돈까스,우동')
    expect(categoryLeaf('카페')).toBe('카페')
    expect(categoryLeaf('')).toBe('')
  })

  it('🔒 비공개 칸은 미리보기에 없다 — "손님에게 보이는구나" 로 읽히면 개인정보 사고다', () => {
    const c = src('src/pages/seller-store-info/StorePreviewCard.tsx')
    expect(c).not.toContain('verify_pin')
    expect(c).not.toContain('manager_phone')
  })

  it('미리보기는 서버가 아니라 폼을 그린다 — 저장 전에도 바뀌어야 미리보기다', () => {
    const c = src('src/pages/seller-store-info/StorePreviewCard.tsx')
    // ⚠️ `api.` 만 보면 **import 줄**(`from '@/lib/api'`)을 못 잡는다(주입이 잡았다).
    expect(c, '서버를 부르면 저장 후에만 맞는 카드가 된다').not.toContain("from '@/lib/api'")
    expect(c).not.toMatch(/\bapi\.(get|post|put|patch)\(/)
  })

  it('저장 버튼의 "이용권 N개 반영" 은 전파되는 칸이 바뀌었을 때만 뜬다', () => {
    expect(src(HOOK), 'dirty 로 대신하면 소개글만 고쳐도 그 문구가 뜬다')
      .toMatch(/storeDirty = useMemo\(\(\) => STORE_KEYS\.some/)
    expect(src(PAGE)).toMatch(/productCount > 0 && storeDirty/)
  })
})
