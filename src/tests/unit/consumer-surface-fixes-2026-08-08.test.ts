/**
 * 🛠️ 2026-08-08 대표 신고 4건의 수리를 고정한다. 넷 다 **에러가 안 나는 종류**라, 되돌아가도
 * 빌드는 초록이고 아무도 모른다. 그래서 각각을 앵커로 박는다.
 *
 * | # | 신고 | 진짜 원인 |
 * |---|---|---|
 * | ① | "교환권 페이지에선 교환권만 검색되게" | `/vouchers` 검색이 `/search` 로 보내는데 그 화면은 **교환권을 통째로 제외**(2026-07-16 "검색은 무조건 이용권만") |
 * | ② | "카테고리 눌러도 맨 위가 그 카테고리가 아님" | PC 홈 **어드민 쇼케이스 섹션이 카테고리를 모른다** — 걸러진 그리드는 그 아래 |
 * | ③ | "데모 사진이 전혀 안 맞음" | 사진 폴백 ③④ 가 **그 매장이라는 근거가 없다** (연합뉴스 파도 사진이 풀빌라 커버로) |
 * | ④ | "데모는 구매하기 대신 응모하기" | 데모 판정에 쓸 `slug` 가 **상세 응답에 없었다** — 분기가 항상 false |
 *
 * ⚠️ **못 막는 것**: 실제 렌더 결과. 이 환경은 브라우저가 프록시를 못 뚫어 스크린샷을 못 찍는다.
 * 화면 확인은 배포 후 사람 눈이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { isBlockedPhotoUrl } from '../../worker/utils/demo-photo-set'
import { PRODUCT_DETAIL_FIELDS } from '../../shared/db/product-columns'

/** 주석은 배선이 아니다 — 실행 코드만 남기고 판정한다(이 레포가 반복해 걸린 함정). */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

describe('① 교환권 페이지 검색은 교환권만', () => {
  it('/vouchers 검색 버튼이 scope 를 붙여 보낸다', () => {
    /**
     * 🔎 2026-08-31: 검색 버튼이 상단 바 컴포넌트로 분리되면서(파일 크기 래칫) 이 검사가 **낡은 지도**가 돼
     *   빨간불이 났다 — 동작은 그대로인데 보던 파일에 코드가 없어진 경우다. 그래서 파일 하나가 아니라
     *   **교환권 표면 전체**(페이지 + 그 컴포넌트 폴더)를 본다. 앞으로 또 옮겨도 불변식은 살아 있고,
     *   `scope` 를 빼면 여전히 빨간불이 된다(그게 이 검사가 지키는 것이다).
     */
    const surface = ['src/pages/VouchersPage.tsx', ...readdirSync('src/pages/vouchers')
      .filter((f) => f.endsWith('.tsx')).map((f) => `src/pages/vouchers/${f}`)]
      .map(code).join('\n')
    expect(surface, "맨 `/search` 로 보내면 교환권이 전부 빠진다(그 화면 기본이 이용권만)")
      .toContain("navigate('/search?scope=exchange')")
  })

  it('SearchPage 가 scope=exchange 를 교환권 전용으로 해석한다', () => {
    const s = code('src/pages/SearchPage.tsx')
    expect(s).toContain("searchParams.get('scope')")
    expect(s, 'scope 분기가 deal_only=1(교환권)만 남겨야 한다')
      .toMatch(/scope === 'exchange'[\s\S]{0,80}deal_only\) === 1/)
  })

  it('기본(scope 없음)은 종전대로 이용권만 — 홈·지도 검색을 바꾸지 않는다', () => {
    const s = code('src/pages/SearchPage.tsx')
    // 2026-07-16 대표 "검색은 무조건 이용권만" 이 기본으로 살아 있어야 한다.
    expect(s).toContain('if (Number(product.deal_only) === 1) return false')
    expect(s).toContain('isVoucherCategory(product.category)')
  })
})

describe('② 카테고리를 고르면 그 카테고리만 보인다 (PC 홈)', () => {
  const pc = code('src/pages/pc-home/PcHomePage.tsx')

  it("🔴 쇼케이스 편성은 category === 'all' 일 때만 렌더된다", () => {
    // 이 조건이 빠지면 숙소를 눌러도 화면 맨 위가 어드민 편성(카테고리 무관)으로 남는다.
    expect(pc, '쇼케이스가 카테고리 게이트 없이 렌더되고 있다')
      .toMatch(/HOME_SHOWCASE_ENABLED && category === 'all'/)
  })

  it('제목이 선택 카테고리를 말한다 (걸러졌다는 신호)', () => {
    expect(pc).toContain('catLabel')
    // 라벨은 레일과 같은 표에서 온다 — 문구가 두 벌이면 반드시 갈린다.
    expect(pc, '라벨 SSOT(DEAL_CATS)를 import 해야 한다').toContain('DEAL_CATS')
    expect(code('src/pages/pc-home/PcHomeRail.tsx')).toContain('export const DEAL_CATS')
  })
})

describe('③ 데모 사진 — 그 매장이라는 근거가 없으면 안 쓴다', () => {
  const photo = code('src/worker/utils/demo-photo-set.ts')

  it('🔴 언론사·스톡 출처는 하드 배제된다 (저작권)', () => {
    // 실사고: "경포파도네 풀빌라" 커버가 연합뉴스 워터마크 파도 사진이었다.
    expect(isBlockedPhotoUrl('https://img.yna.co.kr/photo/ap/2026/01/02/x.jpg')).toBe(true)
    expect(isBlockedPhotoUrl('https://image.newsis.com/2026/a.jpg')).toBe(true)
    expect(isBlockedPhotoUrl('https://www.shutterstock.com/x.jpg')).toBe(true)
    // 지도 계열 실사진은 통과해야 한다(과차단이면 사진이 전멸한다).
    expect(isBlockedPhotoUrl('https://ldb-phinf.pstatic.net/2026/a.jpg')).toBe(false)
    expect(isBlockedPhotoUrl('https://t1.daumcdn.net/place/a.jpg')).toBe(false)
  })

  it('빈 URL 은 버린다 (확신 없으면 안 쓴다)', () => {
    expect(isBlockedPhotoUrl('')).toBe(true)
  })

  it('🔴 업종·지역 일반검색 폴백이 제거돼 있다', () => {
    // 그 매장과 아무 관계 없는 사진을 "그 매장 대표사진" 자리에 앉히던 경로.
    expect(photo, 'fetchNaverImageUrl(일반검색) 이 되살아났다').not.toContain('fetchNaverImageUrl(')
  })

  it('지도 대표사진 경로(①②)는 유지된다 — 근거 있는 사진까지 없애면 안 된다', () => {
    expect(photo).toContain('fetchKakaoPlacePhotos')
    expect(photo).toContain('fetchNaverPlaceMainPhoto')
  })

  it('기존 데모에도 적용되도록 재조정 버전이 올라가 있다', () => {
    // 버전을 안 올리면 새 규칙이 **앞으로 만들 데모에만** 걸린다(이미 박힌 332장은 그대로).
    const rehost = code('src/worker/cron/demo-image-rehost.ts')
    const m = rehost.match(/DEMO_COND_V\s*=\s*'(\d+)'/)
    expect(m, 'DEMO_COND_V 를 못 읽었다').toBeTruthy()
    expect(Number(m![1]), '사진 규칙을 바꿨으면 버전을 올려야 전량 재적용된다').toBeGreaterThanOrEqual(4)
  })

  it('정비 대상이 좁은 접두사로 되돌아가지 않는다', () => {
    const rehost = code('src/worker/cron/demo-image-rehost.ts')
    expect(rehost, "demo-deal-/demo-stay- 로 좁히면 새 데모 종류가 또 누락된다(2026-08-03 사고)")
      .not.toContain('demo-deal-%')
  })
})

describe('③-b 사진을 못 구한 데모는 **매대에 올리지 않는다** (대표 2026-08-08)', () => {
  // 대표: "사진이 아예 없으면 그 데모 이용권은 안올려져야지. 자체가."
  //   나쁜 사진을 안 쓰는 것만으로는 부족했다 — 사진 0장인 상품이 그대로 목록에 남으면
  //   89,000원짜리 숙박권이 회색 더미로 걸린다. 그것도 같은 종류의 거짓말이다.

  it('🔴 숙소 시드: 사진 0장이면 생성을 건너뛴다 (picsum 폴백 금지)', () => {
    const stays = code('src/features/admin/api/admin-stays.routes.ts')
    expect(stays, '사진 없으면 continue 해야 한다').toMatch(/imgs\.length === 0.*continue/)
    expect(stays, 'picsum 더미로 채워 올리던 폴백이 되살아났다')
      .not.toMatch(/picsum\.photos\/seed\/\$\{slug\}/)
  })

  it('🔴 동네딜 시드: 사진 0장이면 생성을 건너뛴다', () => {
    const prod = code('src/features/admin/api/admin-products.routes.ts')
    expect(prod).toMatch(/!realPhoto && !resolvedImgSets\[i\]\[0\].*continue/)
  })

  it('정비 회차가 사진 없는 기존 데모를 내린다 — 삭제가 아니라 is_active=0(가역)', () => {
    const rehost = code('src/worker/cron/demo-image-rehost.ts')
    expect(rehost).toContain('demo_hidden_no_photo')
    expect(rehost, '삭제가 아니라 비활성이어야 되돌릴 수 있다').toMatch(/UPDATE products SET is_active = 0/)
  })

  it('사진이 다시 잡히면 자동 복귀한다 (사람이 켜 주길 기다리지 않는다)', () => {
    const rehost = code('src/worker/cron/demo-image-rehost.ts')
    expect(rehost).toMatch(/demo_hidden_no_photo === '1'[\s\S]{0,200}is_active = 1/)
  })

  it('멀쩡한 커버를 가진 데모는 끌어내리지 않는다', () => {
    // 이번 회차에 사진을 못 구했다고 예전에 확보한 실사진까지 버리면 과잉 대응이다.
    const rehost = code('src/worker/cron/demo-image-rehost.ts')
    expect(rehost).toContain('hasUsableCover')
  })
})

describe('④ 데모 상세는 "응모하기"', () => {
  it('🔴 slug 가 상세 응답에 실린다 — 없으면 판정이 항상 false', () => {
    // 라이브 실측(2026-08-08): /api/group-buy/products/2791 → slug null 이라 분기가 죽어 있었다.
    expect(PRODUCT_DETAIL_FIELDS as readonly string[]).toContain('slug')
  })

  it('상세 페이지가 SSOT 판정(isDemoSlug)을 쓴다', () => {
    const d = code('src/pages/GroupBuyDetailPage.tsx')
    expect(d, "'demo-' 를 다시 박으면 판정이 화면마다 갈린다").toContain('isDemoSlug')
    expect(d, 'PC 패널로 isDemo 를 내려야 한다').toContain('isDemo={isDemoDeal}')
  })

  it('두 변형(모바일 푸터·PC 패널) 모두 문구가 갈린다', () => {
    // 🔴 2026-08-11 정정: 원래 이 테스트는 `'응모하기'` 를 고정했다. 그런데 라이브에서 보니
    //   **같은 화면에 `응모하기` 가 둘**이었고 하나는 공짜였다 —
    //     중간 FcfsApplyBlock : [응모하기]        "결제 없이 응모하면 추첨으로 선정돼요"  ← 무료
    //     하단 이 버튼        : [36,500원 응모하기]                                    ← 실제 결제
    //   `onBuy` → `handleJoin` 은 토스 카드/딜 차감으로 간다. "결제 없이 응모"를 읽은 사람이
    //   아래 버튼을 누르면 결제창이 뜬다 — 결제 오인은 환불 분쟁으로 직행한다.
    //   ⇒ 데모 결제 CTA 는 `'결제하기'`. 대표가 데모엔 안 맞다고 한 '구매하기' 를 되살리지 않으면서
    //     돈이 나간다는 사실은 라벨에 박는다. 무료 응모 블록은 그대로 남는다(갈라놓은 것).
    const box = code('src/pages/group-buy/DealPurchaseBox.tsx')
    expect(box).toContain("isDemo ? '결제하기' : '구매하기'")
    const d = code('src/pages/GroupBuyDetailPage.tsx')
    // 모바일 푸터도 같이 바뀌어야 한다 — 한쪽만 고치면 화면에 따라 다른 말을 한다.
    expect(d).toContain("isDemoDeal ? '결제하기' : '구매하기'")
  })
})
