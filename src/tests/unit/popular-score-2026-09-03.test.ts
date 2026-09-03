/**
 * 🏆 홈 '인기순' = 결제·리뷰·클릭 종합 (2026-09-03 대표 확정)
 *
 * 대표 안: *"어드민에서 정할 수도 있고 순서를, 만약 정하지 않는다면 리뷰 수, 클릭수, 결제 수로
 * 총합 판정"* + *"조작을 한 리뷰숫자라도 마찬가지"*(시드값도 그대로 신뢰) + 가중치 3:2:1.
 *
 * 실측으로 드러난 것: 세 신호 중 **클릭만 존재하지 않았다** — `products.view_count` 는 컬럼만 있고
 * 올리는 코드가 블로그 글 조회수뿐이라 이용권 339개가 전부 0 이었다. 그래서 비콘을 함께 만들었다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 정렬 결과(D1 실행). 여기서 고정하는 것은 **점수식의 모양**과
 *   **배선**이다 — 라이브 순서 판정은 배포 후 실측 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  popularScoreSql,
  POPULAR_WEIGHT_DEFAULTS,
  POPULAR_WEIGHT_KEYS,
} from '@/features/sections/api/section-rules'

const RULES = readFileSync('src/features/sections/api/section-rules.ts', 'utf8')
const HOOK = readFileSync('src/hooks/useProductViewBeacon.ts', 'utf8')
const BEACON = readFileSync('src/features/products/api/product-view.routes.ts', 'utf8')
const LABELS = readFileSync('src/shared/constants/home-showcase.ts', 'utf8')

describe('① 점수식 — 세 신호가 모두 들어가고, 정규화된다', () => {
  const sql = popularScoreSql({ sold: 3, review: 2, view: 1 })

  it('결제·리뷰·클릭 세 컬럼을 모두 쓴다', () => {
    expect(sql).toContain('p.sold_count')
    expect(sql).toContain('p.review_count')
    expect(sql).toContain('p.view_count')
  })

  it('가중치가 식에 그대로 들어간다', () => {
    expect(sql).toMatch(/3 \* /)
    expect(sql).toMatch(/2 \* /)
    expect(sql).toMatch(/1 \* /)
  })

  it('🔒 각 신호를 최대값으로 나눈다 — 안 나누면 결제가 혼자 결정한다', () => {
    // 라이브 실측: 결제 최대 259 vs 리뷰 최대 34. 생값을 더하면 종전(sold DESC)과 같아진다.
    expect((sql.match(/mx\.(ms|mr|mv)/g) || []).length).toBe(3)
  })

  it('🔒 분모 0 을 막는다 — 신호가 전부 0 이어도 나눗셈이 살아야 한다', () => {
    expect((sql.match(/MAX\(mx\.\w+, 1\)/g) || []).length).toBe(3)
  })

  it('가중치 기본값은 3:2:1 (대표 확정)', () => {
    expect(POPULAR_WEIGHT_DEFAULTS).toEqual({ sold: 3, review: 2, view: 1 })
  })

  it('가중치는 어드민 조정 대상 — platform_settings 키를 갖는다', () => {
    expect(Object.values(POPULAR_WEIGHT_KEYS)).toEqual([
      'popular_weight_sold', 'popular_weight_review', 'popular_weight_view',
    ])
    expect(RULES).toContain('FROM platform_settings WHERE key IN')
  })
})

describe('② 정규화 분모는 후보군과 같은 조건으로 구한다', () => {
  it('조건을 한 번 만들어 본문과 분모에 재사용한다 — 베끼면 갈린다', () => {
    // 다른 조건으로 최대값을 구하면 화면에 없는 상품이 분모를 정해 점수가 왜곡된다.
    expect(RULES).toContain("const conds = async (a: 'p' | 'p2')")
    expect(RULES).toContain("await conds('p')")
    expect(RULES).toContain("await conds('p2')")
  })

  it('분모는 CROSS JOIN 한 번 — 신호마다 서브쿼리를 두면 같은 스캔을 세 번 한다', () => {
    // ⚠️ `/CROSS JOIN/` 로 세면 **이 취지를 적어 둔 주석**까지 잡힌다(방금 그렇게 짰다가 잡았다).
    //   코드 형태(`CROSS JOIN (`)만 센다.
    expect((RULES.match(/CROSS JOIN \(/g) || []).length).toBe(1)
    expect(RULES).toMatch(/MAX\(COALESCE\(p2\.sold_count,0\)\) ms/)
  })

  it('분모 서브쿼리 몫의 바인드를 함께 넣는다 — 빠지면 D1 바인딩 오류', () => {
    // 이 레포가 이미 당한 클래스: bind 누락이 .catch 에 삼켜져 조용한 no-op 이 된다.
    expect(RULES).toContain('binds.push(...cats)')
  })

  it('인기순일 때만 분모를 구한다 — 다른 정렬은 단일 컬럼이라 무의미', () => {
    expect(RULES).toMatch(/if \(source === 'popular'\)/)
  })
})

describe('③ 클릭 집계 — 없던 신호를 만든다', () => {
  it('비콘 엔드포인트가 있다', () => {
    expect(BEACON).toContain("app.post('/:id{[0-9]+}/view'")
    expect(BEACON).toContain('view_count = COALESCE(view_count,0) + 1')
  })

  it('🔒 GET 상세에서 세지 않는다 — 엣지 캐시 적중분이 핸들러에 안 온다', () => {
    // 거기서 세면 인기 없는 상품일수록 캐시가 식어 더 많이 세지는 역방향 편향이 된다.
    expect(BEACON).toContain('엣지 캐시')
  })

  it('🔒 남용 상한이 있다 — 세션 가드는 클라라 서버에도 상한이 필요하다', () => {
    expect(BEACON).toMatch(/rateLimit\(\{ action: 'product_view'/)
  })

  it('🔒 클라는 세션당 1회만 — 가드가 없으면 새로고침이 순위를 흔든다', () => {
    expect(HOOK).toContain('sessionStorage.getItem(key)')
    expect(HOOK).toContain('sessionStorage.setItem(key')
  })

  it('🔒 세션 저장이 막힌 브라우저에선 **보내지 않는다**(부풀리는 쪽으로 안 깨진다)', () => {
    const guard = HOOK.slice(HOOK.indexOf('} catch {'), HOOK.indexOf('api.post'))
    expect(guard).toContain('return')
  })
})

describe('④ 라벨이 실제 동작과 맞는다', () => {
  it('"많이 팔린 순" 이라고 쓰여 있지 않다 — 이제 세 신호 종합이다', () => {
    expect(LABELS).not.toContain('인기순 (많이 팔린 순)')
    expect(LABELS).toContain('결제·리뷰·클릭 종합')
  })
})
