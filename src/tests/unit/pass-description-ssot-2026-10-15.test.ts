/**
 * 📝 2026-10-15 — 이용권 설명이 **서버·클라 두 벌**이던 것 (대표 승인 "응 승인할게 해줘").
 *
 * 라이브 실측: 서버는 `서울 서초구 · 달빛한스푼 닭도리탕 31,000원 (정가 35,000원) 11% 할인 …`
 * 인데 클라는 `🎉 11% 할인! 달빛한스푼 달빛한스푼 닭도리탕 이용권, 0명 함께 구매 중, 31,000원` 을
 * 냈고, `react-helmet` 이 그 메타를 덮으므로 **Googlebot 은 아래쪽**을 받았다. 근거·규율은
 * `src/shared/seo/detail-description.ts` 머리말.
 *
 * 고정하는 것:
 *   ① 생성기 출력이 **오늘 라이브 서버 문장과 같다**(네 건을 그대로 복사해 넣었다 — byte-불변)
 *   ② 참가자 수(`group_buy_current`)가 어느 쪽 설명에도 들어가지 않는다 (활성 359건 중 357건이 0명)
 *   ③ 서버·클라가 **같은 함수**를 부른다(설명을 손으로 조립하지 않는다)
 *   ④ 🔴 **반대 방향** — 잠금표가 지키는 항목(SSR 시드 즉시 소비 등)은 byte-불변이다
 *   ⑤ 줄표를 쓰지 않는다 (anti-slop · 이 파일은 그 가드 범위 안)
 *
 * ⚠️ 못 막는 것: 구글이 그 설명을 스니펫에 쓰는지(구글이 재작성한다 · 색인 수일~수주) ·
 *    브라우저에서 react-helmet 이 실제로 어느 값을 남기는지(jsdom 밖 — 라이브 판정은 Googlebot
 *    렌더뿐이고 curl 로는 못 본다) · **공유 카드 문구**(`shareDescription`·KakaoShareButton 이
 *    여전히 `N명 함께 구매 중` 을 말한다 — 승인 범위 밖이라 일부러 안 건드렸다).
 */
import { describe, it, expect } from 'vitest'
import { passDetailDescription } from '@/shared/seo/detail-description'
import { buildDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { readCode } from '../helpers/source-text'

const CLIENT = 'src/pages/GroupBuyDetailPage.tsx'
const SERVER = 'src/worker/utils/detail-ssr-meta.ts'
const SSOT = 'src/shared/seo/detail-description.ts'

/** 2026-10-15 라이브 `/api/group-buy/products/:id` 응답에서 그대로 복사한 시드. */
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
  2888: {
    name: '치즈돈가스 2인 세트 할인권', description: '치즈돈가스 2인 세트 할인권',
    price: 16500, original_price: 25000, current_discount_pct: 0,
    restaurant_name: '홍대돈까스', restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
    avg_rating: 0, review_count: 0, group_buy_current: 0,
  },
  2867: {
    name: '주중 자유이용 1주일권', description: null,
    price: 30600, original_price: 45000, current_discount_pct: 0,
    restaurant_name: '목동클라이밍센터', restaurant_address: '서울 양천구 공항대로 596',
    avg_rating: 4.3, review_count: 6, group_buy_current: 0,
  },
} as const

/** 오늘(수리 전) 라이브 서버가 내던 문장 — Googlebot UA 로 받아 파싱해서 복사했다. */
const LIVE_SERVER_DESC: Record<number, string> = {
  2919: '서울 서초구 · 달빛한스푼 닭도리탕 31,000원 (정가 35,000원) 11% 할인 달빛한스푼 이용권',
  2887: '⭐4.6 강원 양양군 · 그랑블루글램핑&펜션 평일 1박 숙박권 (프리미엄 리버뷰 스위트) 209,000원 (정가 272,000원) 23% 할인 장비를 챙길 필요가 없는 글램핑입니다. 개별 화로가 있고 텐트에 냉난방이 들어와요.',
  2888: '전북 전주시 · 홍대돈까스 치즈돈가스 2인 세트 할인권 16,500원 (정가 25,000원) 34% 할인',
  2867: '⭐4.3 서울 양천구 · 목동클라이밍센터 주중 자유이용 1주일권 30,600원 (정가 45,000원) 32% 할인',
}

describe('① 생성기 출력 = 오늘 라이브 서버 문장 (byte-불변)', () => {
  // 🔑 이 단언이 이 PR 의 안전장치다 — 설명을 옮기면서 **310건이 바뀌지 않았다**를 증명한다.
  for (const [id, want] of Object.entries(LIVE_SERVER_DESC)) {
    it(`/pass/${id}`, () => {
      expect(passDetailDescription(LIVE[Number(id) as keyof typeof LIVE])).toBe(want)
    })
  }

  it('서버 빌더를 통째로 돌려도 같은 값이다 (배선까지)', () => {
    for (const [id, want] of Object.entries(LIVE_SERVER_DESC)) {
      const seed = JSON.stringify({ data: { id: Number(id), category: 'meal_voucher', deal_only: 0, ...LIVE[Number(id) as keyof typeof LIVE] } })
      expect(buildDetailMeta(seed, 'https://urdeal.kr', `/pass/${id}`)?.description, id).toBe(want)
    }
  })
})

describe('② 참가자 수를 설명에 쓰지 않는다', () => {
  it('생성기 출력에 "명 함께 구매 중" 0건 — 357/359건이 0명이다', () => {
    for (const k of Object.keys(LIVE)) {
      const s = passDetailDescription(LIVE[Number(k) as keyof typeof LIVE])
      expect(s, k).not.toContain('함께 구매 중')
      expect(s, k).not.toContain('0명')
    }
  })

  it('🔴 설명 생성기·클라 어디에서도 group_buy_current 를 읽지 않는다', () => {
    // 서버는 2026-10-14 부터 안 읽는다. 이번에 **클라 쪽**이 같은 규율에 들어왔다.
    expect(readCode(SSOT), '생성기가 참가자 수를 읽으면 그 숫자가 스니펫에 샌다').not.toContain('group_buy_current')
    // 클라는 화면(진행 바·카드)에서 여전히 읽는다 — 금지하는 것은 **설명 자리**다.
    const c = readCode(CLIENT)
    const i = c.indexOf('description={')
    expect(i, '앵커가 낡았다').toBeGreaterThanOrEqual(0)
    expect(c.slice(i, i + 200), '설명 자리에서 참가자 수를 읽는다').not.toContain('group_buy_current')
  })

  it('존재하지 않는 기제를 말하지 않는다 — 공동구매·마감', () => {
    // 2026-05-30 즉시판매 단일가 · 2026-09-04 "마감 개념은 없어". 제목과 같은 사실이다.
    const s = passDetailDescription(LIVE[2887])
    for (const word of ['공동구매', '마감', '명 참여']) expect(s, word).not.toContain(word)
  })
})

describe('③ 서버·클라가 같은 함수를 부른다', () => {
  it('둘 다 passDetailDescription 을 쓴다', () => {
    for (const f of [SERVER, CLIENT]) expect(readCode(f), f).toContain('passDetailDescription(')
  })

  it('설명을 손으로 조립하는 자리가 0개다', () => {
    // 종전 클라 문구의 지문 — 되살아나면 두 벌로 돌아간다.
    const c = readCode(CLIENT)
    expect(c).not.toContain('명 함께 구매 중, ')
    expect(c).not.toMatch(/🎉 \$\{[^}]+\}% 할인!/)
  })

  it('가게명을 두 번 말하지 않는다 (storeNameJoin SSOT)', () => {
    // 종전 클라는 `달빛한스푼 달빛한스푼 닭도리탕` 을 냈다.
    const s = passDetailDescription(LIVE[2919])
    expect((s.match(/달빛한스푼/g) ?? []).length, s).toBe(2) // 상품명 안의 1 + 소개 꼬리의 1
    expect(s).not.toContain('달빛한스푼 달빛한스푼')
  })

  it('가진 것만 말한다 — 리뷰 0 이면 별점 없음 · 주소 못 읽으면 지역 없음', () => {
    expect(passDetailDescription(LIVE[2919])).not.toContain('⭐')
    expect(passDetailDescription({ ...LIVE[2887], avg_rating: 4.6, review_count: 0 })).not.toContain('⭐')
    expect(passDetailDescription({ ...LIVE[2887], restaurant_address: '' })).not.toContain('·')
  })

  it('빈 입력에도 안 터진다', () => {
    expect(() => passDetailDescription({})).not.toThrow()
    expect(passDetailDescription({})).toContain('유어딜에서 할인가로 바로 구매')
  })
})

describe('④ 🔴 반대 방향 — 잠금표 항목은 byte-불변', () => {
  it('SSR 시드 즉시 소비·below-fold lazy·공유 카드 배선이 그대로다', () => {
    // 이 파일은 로딩 잠금표에 있다. 설명 한 줄을 고치면서 **그 성질을 약화하지 않았다**는 것을
    // 개수로 고정한다(2026-10-15 커밋 시점 실측값).
    // 🩸 개수는 **주석 제거본**으로 센다. 원문으로 세면 설명을 적는 내 주석이 지문에 섞여
    //   "지문이 늘었다" 는 거짓 통과를 만든다(`CountdownRing` 은 실행되는 줄엔 0건이고
    //   주석에만 있다 — 원문 기준 audit log 의 1 은 그 주석이다).
    const code = readCode(CLIENT)
    const count = (re: RegExp) => (code.match(re) ?? []).length
    expect(count(/__SSR_INITIAL_DETAIL__/g), 'SSR 0-RTT 시드').toBe(1)
    expect(count(/pickSeedDetail/g), '시드 동기 소비').toBe(2)
    expect(count(/\blazy\(/g), 'below-fold lazy 3종').toBe(3)
    expect(count(/passShareCardUrl/g), '공유 카드 주소 SSOT').toBe(3)
    expect(count(/rootMargin/g), '관측 여백').toBe(1)
  })

  it('🔴 시드를 **조건부로** 소비하지 않는다 (개수로는 안 잡히는 자리)', () => {
    // 🩸 첫 판은 지문 **개수**만 셌다. 그런데 되돌려-검증이 통과했다 — 호출을 `false ? …` 로
    //   감싸면 개수는 그대로이고 0-RTT 만 죽는다. **계산과 사용은 다른 자리다**(이 레포가
    //   2026-08-02 에 `goneStatus` 에서 치른 그 교훈). 그래서 **모양**을 본다: `useMemo` 본문이
    //   곧바로 `pickSeedDetail` 로 시작해야 하고, 그 사이에 어떤 식도 끼지 않는다.
    const code = readCode(CLIENT)
    expect(code, '시드 소비가 조건 뒤로 밀렸다 — 첫 페인트가 조용히 느려진다')
      .toContain('useMemo<GroupBuyDetail | null>(() => pickSeedDetail<GroupBuyDetail>(')
  })

  it('설명 자리에서 서버 전용 의존을 끌어오지 않는다', () => {
    // SSOT 는 `shared/` 셋만 쓴다 — 워커 전용 모듈이 들어오면 클라 번들이 터진다.
    const s = readCode(SSOT)
    expect(s).not.toMatch(/from '\.\.\/\.\.\/worker/)
    expect(s).not.toMatch(/from '@\/worker/)
  })
})

describe('⑤ 줄표를 쓰지 않는다', () => {
  it('생성기 출력·소스에 em-dash 0건', () => {
    for (const k of Object.keys(LIVE)) expect(passDetailDescription(LIVE[Number(k) as keyof typeof LIVE]), k).not.toContain('—')
    expect(readCode(SSOT), '실행되는 줄에 줄표').not.toContain('—')
  })
})
