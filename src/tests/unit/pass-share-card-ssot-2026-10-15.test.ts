/**
 * 🔗 2026-10-15 — 이용권 **공유 카드 문구**가 세 가지를 동시에 틀리던 것 (대표 결재 "응 결재 해줄게 해줘").
 *
 * 같은 날 오전/오후에 제목·설명을 SSOT 로 모았는데 **공유 카드는 빠져 있었다**. 재 보니 셋이었다:
 *
 *   ① `{N}명 함께 구매 중` — 라이브 활성 이용권 **359건 중 357건이 `group_buy_current = 0`**(분포
 *      `0:357 · 1:1 · 3:1`)이라 실제로는 `0명 함께 구매 중` 이었다. 그리고 이 상품은 **모여서 사는 게
 *      아니다**(2026-05-30 A2 즉시판매 단일가 · 2026-09-04 대표 "마감 개념은 없어").
 *   ② `{상품명} 공구 참여하기` — '참여'는 폐기된 개념(2026-06-27 명칭 SSOT). 그리고 **제목은 전 경로에
 *      실린다** — `commercePayload` 는 `description` 을 안 받으므로(실측) 가격이 있는 이용권의 카카오
 *      카드엔 **제목만** 간다. 즉 ②가 ①보다 도달이 넓다.
 *   ③ `친구 초대 시 양쪽 0.5% 보너스 (첫 1회)` — 라이브 `user_referral_bonus_pct` 가 **0** 이다
 *      (2026-08-23 대표 "심플 모델"). **안 주는 보상을 약속하고 있었다.** 2026-10-06 에 `MyVouchersPage`
 *      의 공유 모달을 **정확히 같은 이유로** 지웠는데(그 파일 주석이 기록) 이 자리가 남아 있었다.
 *
 * 고정하는 것:
 *   ① 공유 카드 제목·설명이 검색과 **같은 SSOT**(`passDetailTitle`·`passDetailDescription`)를 지난다
 *   ② 죽은 문구 넷이 **실행되는 코드**에 0건(주석은 제거본으로 판정 — 내 주석이 그 문구를 인용한다)
 *   ③ 보이는 머리글(`title`)과 공유 카드 제목(`shareTitle`)이 **가려져** 있다
 *   ④ 🔴 **반대 방향** — 숙소는 `shareTitle` 을 안 넘겨 종전 동작(제목=가게명)이고, 잠금표 지문은 byte-불변
 *   ⑤ 실제 함수를 돌려 공유 카드 값이 **서버 og 와 같은 문자열**인지(라이브 시드)
 *
 * ⚠️ 이 가드가 **못 보는 것**: 카카오가 실제로 그리는 카드(렌더 주체가 카카오다 — 대표만 판정) ·
 *    `navigator.share` 시트의 생김새 · 카카오 SDK 가 로드·init 되는지(브라우저 밖) ·
 *    `?ref=` 진입 배너(`참여 시 양쪽 0.5% 보너스 딜`)는 **같은 죽은 약속인데 다른 표면**이라 승인 범위
 *    밖으로 뒀다(별건 — 혜택 약속은 결재 대상이고 선례는 삭제다).
 */
import { describe, it, expect } from 'vitest'
import { passDetailTitle } from '@/shared/seo/detail-title'
import { passDetailDescription } from '@/shared/seo/detail-description'
import { readCode } from '../helpers/source-text'

const CLIENT = 'src/pages/GroupBuyDetailPage.tsx'
const HEADER = 'src/components/deal/DetailFloatingHeader.tsx'
const STAY = 'src/pages/StayDetailPage.tsx'
const KSB = 'src/components/KakaoShareButton.tsx'

/** 2026-10-15 라이브 `/api/group-buy/products/:id` 에서 그대로 복사. */
const LIVE = {
  2919: {
    name: '달빛한스푼 닭도리탕', description: '달빛한스푼 이용권',
    price: 31000, original_price: 35000, current_discount_pct: 0,
    restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배중앙로 165',
    avg_rating: 0, review_count: 0, group_buy_current: 1,
  },
  2887: {
    name: '평일 1박 숙박권 (프리미엄 리버뷰 스위트)',
    description: '장비를 챙길 필요가 없는 글램핑입니다. 개별 화로가 있고 텐트에 냉난방이 들어와요.',
    price: 209000, original_price: 272000, current_discount_pct: 0,
    restaurant_name: '그랑블루글램핑&펜션', restaurant_address: '강원특별자치도 양양군 강현면 동해대로 3275',
    avg_rating: 4.6, review_count: 9, group_buy_current: 0,
  },
} as const

describe('① 공유 카드가 검색과 같은 SSOT 를 지난다', () => {
  const src = readCode(CLIENT)

  it('플로팅 헤더가 shareTitle·shareDescription 을 SSOT 로 넘긴다', () => {
    expect(src).toContain('shareTitle={passDetailTitle(detail.name, detail.restaurant_name)}')
    expect(src).toContain('shareDescription={passDetailDescription(detail)}')
  })

  it('PC 탭바의 카카오 버튼도 같은 SSOT 를 쓴다', () => {
    expect(src).toContain('title={passDetailTitle(detail.name, detail.restaurant_name)}')
    expect(src).toContain('description={passDetailDescription(detail)}')
  })

  it('공유 문구를 손으로 조립하지 않는다 — 템플릿 리터럴 0', () => {
    // 🔬 `shareDescription=` / KakaoShareButton 의 `description=` 이 백틱으로 시작하면 사본이다.
    expect(src).not.toMatch(/shareDescription=\{`/)
    expect(src).not.toMatch(/\n\s+title=\{`\$\{detail\.name\}/)
  })
})

describe('② 죽은 문구 — 실행되는 코드에 0건', () => {
  // 🩸 판정은 **주석 제거본**으로 한다. 제거를 기록한 내 주석이 그 문구를 인용하므로
  //    원문 전체를 검사하면 거짓 빨간불이 난다(이 레포가 d1-migrate·robots 에서 두 번 밟았다).
  for (const file of [CLIENT, HEADER]) {
    it(`${file} — 참여 인원수·공구 참여·안 주는 보너스 문구가 없다`, () => {
      const code = readCode(file)
      expect(code).not.toContain('명 함께 구매 중')
      expect(code).not.toContain('공구 참여하기')
      expect(code).not.toContain('나도 참여하기')
      expect(code).not.toMatch(/0\.5% 보너스 \(첫 1회\)/)
    })
  }

  it('공유 카드 문구가 group_buy_current 를 읽지 않는다', () => {
    const code = readCode(CLIENT)
    // 참가자 수는 화면 본문(buyers 등)에선 계속 쓴다 — 공유 **문구**에만 안 들어가면 된다.
    expect(code).not.toMatch(/share(Title|Description)=\{[^}]*group_buy_current/)
    expect(code).not.toMatch(/description=\{[^}]*group_buy_current[^}]*\}\s*\n\s+imageUrl=/)
  })
})

describe('③ 보이는 머리글과 공유 카드 제목이 가려져 있다', () => {
  const hdr = readCode(HEADER)

  it('DetailFloatingHeader 가 shareTitle 을 선택 prop 으로 받고 title 로 폴백한다', () => {
    expect(hdr).toMatch(/shareTitle\?:\s*string/)
    expect(hdr).toContain('title={shareTitle ?? title}')
  })

  it('보이는 머리글은 여전히 title 하나다 — 가게명이 붙지 않는다', () => {
    // 🔬 머리글 렌더(`{title}`)가 shareTitle 로 바뀌면 좁은 화면에서 제목이 잘린다.
    expect(hdr).toMatch(/>\s*\{title\}\s*</)
    expect(hdr).not.toMatch(/>\s*\{shareTitle/)
  })

  it('공유 버튼 라벨이 구매하기다 — 참여 라벨로 돌아가지 않는다', () => {
    expect(hdr).toContain('buttonText="구매하기"')
  })
})

describe('④ 🔴 반대 방향 — 숙소 불변 · 잠금표 지문 byte-불변', () => {
  it('숙소는 shareTitle 을 안 넘긴다(제목 = 가게명, 종전 동작)', () => {
    const stay = readCode(STAY)
    expect(stay).toContain('<DetailFloatingHeader')
    expect(stay).not.toContain('shareTitle')
  })

  it('제목이 전 경로에 실린다는 전제 — commercePayload 는 title 을 받고 description 은 안 받는다', () => {
    // 🔑 ②의 "제목이 ①보다 도달이 넓다" 는 주장의 근거. 여기가 바뀌면 그 주장을 다시 재야 한다.
    const ksb = readCode(KSB)
    expect(ksb).toMatch(/commercePayload\(\{\s*title,/)
    expect(ksb).not.toMatch(/commercePayload\(\{[^}]*\bdescription\b/)
  })

  it('잠긴 로딩 계약이 byte-불변 — 주석 제거본 기준 개수', () => {
    const code = readCode(CLIENT)
    const n = (re: RegExp) => (code.match(re) || []).length
    // ⚠️ 원문 grep 과 다르다 — `CountdownRing` 은 **주석에만** 있어 실행 코드엔 0 이다(2026-10-15 실측).
    expect(n(/__SSR_INITIAL_DETAIL__/g)).toBe(1)
    expect(n(/pickSeedDetail/g)).toBe(2)
    expect(n(/lazy\(/g)).toBe(3)
    expect(n(/passShareCardUrl/g)).toBe(3)
    expect(n(/rootMargin/g)).toBe(1)
  })

  it('SSR 시드 즉시 소비가 **모양으로** 살아 있다', () => {
    // 🩸 개수만 세면 `false ? … : null` 로 감싼 중성화를 못 본다(2026-10-15 주입이 잡았다).
    expect(readCode(CLIENT)).toContain('useMemo<GroupBuyDetail | null>(() => pickSeedDetail<GroupBuyDetail>(')
  })
})

describe('⑤ 실제 함수를 돌려 — 공유 카드 값이 검색과 같은 문자열', () => {
  for (const [id, seed] of Object.entries(LIVE)) {
    it(`/pass/${id} — 제목·설명에 죽은 문구가 없다`, () => {
      const title = passDetailTitle(seed.name, seed.restaurant_name)
      const desc = passDetailDescription(seed)
      for (const s of [title, desc]) {
        expect(s).not.toContain('함께 구매 중')
        expect(s).not.toContain('공구')
        expect(s).not.toContain('보너스')
        expect(s).not.toContain('참여')
      }
      expect(title).toContain(seed.restaurant_name)
      expect(desc.length).toBeGreaterThan(10)
    })
  }

  it('줄표를 쓰지 않는다 (anti-slop)', () => {
    for (const seed of Object.values(LIVE)) {
      expect(passDetailDescription(seed)).not.toContain('—')
      expect(passDetailTitle(seed.name, seed.restaurant_name)).not.toContain('—')
    }
  })
})
