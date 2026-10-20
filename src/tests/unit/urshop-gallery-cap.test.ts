import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// 🩸 2026-08-27: 자체 codeOnly 가 라인 주석 속 `/*` 에 걸려 파일 절반을 삼켰다 — 이 가드가
//   바로 그걸 잡아냈다(capped 4 → 1). 공용 스캐너로 통일.
import { stripComments as codeOnly } from '../helpers/source-text'
import { sliceCardGallery, capRowGalleries, CARD_GALLERY_MAX } from '@/features/group-buy/api/card-gallery'

/**
 * 🖼️ 2026-08-27 — 유어샵 카드 갤러리 (대표 "일단 그렇게 하자").
 *
 * ## 트래픽이 1원칙이다
 * `products.images` 를 **원본 그대로** 목록에 실으면 상품 하나가 5~8장을 끌고 온다.
 * 그 페이로드는 KV 캐시와 SSR 주입에도 그대로 올라탄다. 그래서 **서버에서** 자른다.
 * (실측 2026-08-27: 활성 상품 중 images 보유 356개 · 평균 282B · 최대 1,252B.)
 *
 * ## 🔑 반환 지점이 셋이다
 * `findAll` 은 본 쿼리 + 폴백 2개로 돌아온다. 한 곳만 자르면 **폴백을 탄 요청에서 원본 전량이
 * 나가고**, 에러가 없어 아무도 모른다. 세 곳이 같은 함수를 지나는지 여기서 고정한다.
 *
 * ## 못 막는 것
 *   - 실제 응답 크기(배포 후 curl 로 실측해야 한다).
 *   - 카드가 그 장수를 실제로 렌더하는지(DealCardMedia 의 몫 — `deal-card-gallery.test.ts`).
 */
const REPO = 'src/features/products/repositories/ProductRepository.ts'
const read = (f: string) => readFileSync(f, 'utf-8')

describe('자르기 규칙 (SSOT)', () => {
  it(`커버를 빼고 최대 ${CARD_GALLERY_MAX}장`, () => {
    const raw = JSON.stringify(['cover.jpg', 'a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'])
    expect(sliceCardGallery(raw, 'cover.jpg')).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })
  it('값이 없거나 깨졌으면 빈 배열 (카드는 커버만으로 정상)', () => {
    expect(sliceCardGallery(null, 'x')).toEqual([])
    expect(sliceCardGallery('not-json', 'x')).toEqual([])
    expect(sliceCardGallery('{"a":1}', 'x')).toEqual([])
  })
})

describe('목록 쿼리 — 세 반환 지점이 모두 잘린다', () => {
  const src = read(REPO)
  it('images 를 SELECT 한다', () => {
    const i = src.indexOf('const baseCols = [')
    expect(i, 'baseCols 가 사라졌다').toBeGreaterThan(-1)
    expect(src.slice(i, src.indexOf('];', i))).toContain("'images'")
  })
  it('자르기 함수가 실제로 자른다 (몸통이 비면 빨강)', () => {
    // 🩸 이 검사는 **주입 검증이 만들어 냈다.** 처음엔 자르는 함수가 ProductRepository 안의
    //   비-export 지역 함수라, 배선(호출 4곳)만 볼 수 있었다 → 몸통을 `return r` 로 비워도 초록.
    //   ⇒ SSOT 로 끌어올려 동작 자체를 고정한다. 배선 검사만으로는 "가드가 실패할 수 없다".
    const rows = [
      { id: 1, image_url: 'c.jpg', images: JSON.stringify(['c.jpg', '1.jpg', '2.jpg', '3.jpg', '4.jpg']) },
      { id: 2, image_url: 'x.jpg' }, // images 없음 → 손대지 않는다
    ]
    const out = capRowGalleries(rows) as Array<Record<string, unknown>>
    expect(out[0].images, '커버를 뺀 3장이어야 한다').toEqual(['1.jpg', '2.jpg', '3.jpg'])
    expect('images' in out[1], 'images 가 없던 행에 없던 필드를 만들지 않는다').toBe(false)
  })
  it('SSOT 로 자른다 (자체 숫자를 쓰지 않는다)', () => {
    expect(src, '자르기 SSOT 를 안 쓰면 규칙이 화면마다 갈린다').toContain('capRowGalleries')
    // 같은 카드가 화면마다 다른 장수를 받으면 안 된다 — 로컬 상수 금지.
    expect(codeOnly(src), '갤러리 장수를 여기서 따로 정하면 홈 카드와 갈린다')
      .not.toMatch(/slice\(0,\s*\d+\)/)
  })
  it('상품을 돌려주는 반환 지점이 전부 capGalleries 를 지난다', () => {
    // 🔑 이 가드가 실제로 일했다: 처음엔 `findAll` 셋만 고쳤는데, 검사가 **FTS 검색**도
    //   원본 갤러리를 싣고 있음을 찾아냈다(상세 컬럼 목록을 쓴다).
    //   ⚠️ 상품이 아닌 쿼리(`getPopularSearches` — search_logs)는 제외한다. 안 그러면
    //     의미 없는 자르기를 강요하고, 그런 요구는 결국 무시된다.
    const code = codeOnly(src)
    const productReturns = code.split('\n').filter((ln, i, all) => {
      if (!/return\s+[A-Za-z]*\.?results\s*\|\|\s*\[\]/.test(ln)) return false
      // 앞쪽 40줄 안에 `FROM products` 가 있으면 상품 쿼리로 본다.
      return all.slice(Math.max(0, i - 40), i).some(l => /FROM\s+products/.test(l))
    })
    expect(productReturns, '자르기를 안 거치는 상품 반환 지점이 남았다 — 그 경로만 원본 전량이 나간다')
      .toEqual([])
    const capped = (code.match(/capGalleries\(/g) || []).length
    // findAll 본 쿼리 + 폴백 2 + FTS 1 = **호출 4곳**.
    // (정의부는 `capGalleries<T>(` 라 이 정규식에 안 걸린다 — 처음에 5로 잡았다가 가드가 바로잡았다.)
    expect(capped, 'findAll 3곳 + FTS 1곳 = 호출 4곳').toBeGreaterThanOrEqual(4)
  })
})
