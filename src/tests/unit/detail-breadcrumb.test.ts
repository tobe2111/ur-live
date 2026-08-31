/**
 * 🧭 상세 빵부스러기 — 안 눌리는 경로를 넣지 않는다
 *
 * 2026-08-30 대표: *"그루폰처럼 이용권 사진 위에 카테고리바 같이 저렇게 우리도 유사하게 하자.
 * 숙소 이용권도 마찬가지고."*
 *
 * ## 무엇을 지키나
 * 빵부스러기의 값은 **길이라는 것**에 있다. 목적지가 없으면 장식이고, 장식이면 없느니만 못하다.
 * 이 레포는 정확히 그걸로 데였다 — `/stays` 의 카테고리 칩이 죽은 링크여서 2026-07-20 에 고쳤고,
 * `/meal-vouchers` 는 구조적으로 영구 0건이라 별칭으로 접었다(consumer-redirects.ts 주석).
 * ⇒ 크럼의 목적지가 **App.tsx 에 실재하는 라우트**인지 소스를 읽어 대조한다.
 *
 * 그리고 빵부스러기가 카테고리를 말하기 시작했으므로, 사진 위/아래에 같은 말을 하던 배지는
 * 중복이 됐다. 그 중복이 되살아나는 것도 여기서 막는다(대표가 "AI 티" 로 지적한 바로 그 패턴).
 *
 * ## 이 테스트가 **못 막는 것**
 * - 목적지 페이지가 그 쿼리를 **실제로 필터링하는지**. `/?category=meal_voucher` 를 PC 홈과
 *   모바일 홈이 둘 다 읽는 것은 수리 당시 소스로 확인했지만, 그 소비 코드가 사라져도 여기선
 *   라우트 존재만 보므로 통과한다. (홈의 `?category` 소비는 두 홈 컴포넌트가 각자 갖고 있다.)
 * - 실제 렌더·간격. 화면은 사람이 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석은 판정에서 뺀다 — 설명 주석이 검사를 통과시키는 함정을 이 레포는 반복해 겪었다. */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')

const BC = 'src/components/deal/DetailBreadcrumb.tsx'
const GB = 'src/pages/GroupBuyDetailPage.tsx'
const STAY = 'src/pages/StayDetailPage.tsx'
const APP = 'src/App.tsx'

/** App.tsx 의 `<Route path="...">` 전부. */
function declaredRoutes(): Set<string> {
  const src = read(APP)
  return new Set([...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]))
}

describe('두 상세가 빵부스러기를 갖는다', () => {
  it('이용권 상세와 숙소 상세 둘 다 렌더한다 — 한쪽만 고쳐지지 않게', () => {
    for (const f of [GB, STAY]) {
      expect(code(read(f)), `${f}: 빵부스러기가 없다`).toMatch(/<DetailBreadcrumb\b/)
    }
  })

  it('숙소는 3단, 이용권은 2단 — 없는 중간 단계를 지어내지 않는다', () => {
    const src = code(read(BC))
    // 이용권: 홈 + 카테고리. 숙소: 홈 + /stays + 유형(현재 위치).
    expect(src, 'voucherCrumbs 가 사라졌다').toContain('export function voucherCrumbs')
    expect(src, 'stayCrumbs 가 사라졌다').toContain('export function stayCrumbs')
    expect(src, '숙소 중간 단계(/stays)가 사라졌다').toContain("to: '/stays'")
  })
})

describe('크럼의 목적지가 실재한다 (죽은 링크 금지)', () => {
  it('링크가 App.tsx 의 라우트를 가리킨다', () => {
    const routes = declaredRoutes()
    expect(routes.size, 'App.tsx 에서 라우트를 못 읽었다 — 셀렉터가 낡았다').toBeGreaterThan(20)
    const src = code(read(BC))
    const tos = [...src.matchAll(/to:\s*[`'"]([^`'"$]*)/g)].map((m) => m[1])
    expect(tos.length, '크럼 목적지를 못 읽었다 — 셀렉터가 낡았다').toBeGreaterThanOrEqual(3)
    for (const t of tos) {
      const pathOnly = t.split('?')[0] || '/'
      expect(routes.has(pathOnly), `크럼이 없는 라우트를 가리킨다: ${t}`).toBe(true)
    }
  })

  it('카테고리 라벨이 명칭 SSOT 에서 온다 — 자체 라벨 맵 금지', () => {
    const src = code(read(BC))
    expect(src, '라벨을 SSOT 대신 직접 적고 있다').toContain('getVoucherShortLabel')
    // '뷰티'/'숙박'/'액티비티' 는 폐기 어휘(SSOT = 미용/숙소/기타).
    for (const w of ['뷰티', '숙박', '액티비티', '식사권'])
      expect(src, `폐기 어휘 '${w}' 가 들어왔다`).not.toContain(w)
  })
})

describe('빵부스러기가 말한 것을 배지가 또 말하지 않는다', () => {
  it('이용권 사진 위 카테고리 칩이 되살아나지 않았다', () => {
    // 그 칩은 자체 라벨 맵('뷰티'/'숙박'/'액티비티')까지 들고 있어 명칭 SSOT 와도 어긋나 있었다.
    const src = code(read(GB))
    expect(src, '사진 위 카테고리 칩(자체 라벨 맵)이 되살아났다').not.toMatch(/beauty_voucher:\s*'뷰티'/)
  })

  it('숙소 유형 배지가 되살아나지 않았다', () => {
    const src = code(read(STAY))
    expect(src, '유형 배지가 되살아났다 — 빵부스러기 마지막 칸과 같은 말이다')
      .not.toMatch(/rounded font-semibold">\{propertyTypeLabel/)
  })
})
