/**
 * 💸 **할인율은 SSOT 한 곳에서만 나온다** (2026-10-14 — 대표 *"또 개선할 것을 찾아줘"* → *"고쳐줘 영구적으로"*)
 *
 * ## 실제로 깨져 있던 것 (라이브 실측)
 * 유어샵 `/u/jiwon1228` 의 **'할인율순'이 아무 일도 하지 않았다**. 브라우저로 직접 조작해 쟀다:
 *
 *     고른 정렬          결과 순서
 *     할인율순           23% · 14% · 17% · 11%   → 그대로 🔴 (기대 23·17·14·11)
 *     낮은 가격순(대조군) 21,700 → 31,000 → 35,100 → 209,000   ✅ 정상
 *
 * 원인은 `CuratorPage` 가 `discount_rate` **생값**으로 정렬한 것이다. 그 컬럼은
 * **KT 기프티콘 카탈로그 동기화만** 채우고(`cron/kt-alpha-catalog-sync.ts`), 이용권·동네딜은
 * 정가(`original_price`)와 판매가(`price`)로 할인을 표현한다 — **라이브 상품 600건을 전수
 * 샘플한 결과 전부 0** 이었다. 그래서 카드에 보이는 23%·17% 는 SSOT `priceDisplay()`
 * (= `Math.max(선언값, 계산값)`)가 만든 값인데 **정렬은 0 끼리 비교**하고 있었다.
 * 보이는 숫자와 정렬이 서로 다른 출처였고, **에러가 안 나서 아무도 신고하지 않는다.**
 *
 * ## 왜 가드가 필요한가 — 이 레포가 이미 네 번 당했다
 *   · 2026-08-19 대표 *"할인율도 나타나야 할 것 같다"* → `??` 가 0 을 채택해 배지가 안 뜸 → SSOT 신설
 *   · 2026-09-03 서버 정렬 정의와 클라 `discountOf` 가 갈려 "인기순" 이 인기순이 아니었다
 *   · 2026-09-09 지도 행이 자체 계산 → `RestaurantRow` 를 SSOT 로
 *   · 2026-09-29 `DealRow` 가 `discountPct` 를 그대로 써 유어샵 배지가 **0개**
 * 매번 *그 자리*만 고쳤다. 사본은 계속 다시 생긴다 ⇒ **규칙 자체를 한 곳에 가둔다.**
 *
 * ## 이 가드가 보는 것
 *   ① 소비자 화면에 할인율 **계산식 사본**이 없다 (`(1 - price/original)` · `(original-price)/original`)
 *   ② 소비자 화면이 `discount_rate` 를 **정렬·비교·산술**에 쓰지 않는다 (전달·타입 선언은 허용 —
 *      받는 부품이 SSOT 로 다시 계산한다)
 *   ③ 배선 — 깨져 있던 자리들이 실제로 `priceDisplay` 를 지난다
 *   ④ **반대 방향**: SSOT 가 `max(선언값, 계산값)` 규칙을 유지하는가 (진짜 함수를 돌려서)
 *
 * ## 이 가드가 **못 보는 것** (과신 금지)
 *   · 서버 정렬(`group-buy-public.routes` 의 `MAX(COALESCE(discount_rate,0), 계산값)`) — SQL 은 범위 밖
 *   · 어드민 화면 — `AdminKtAlphaPage` 는 그 컬럼이 실제로 채워지는 **유일한 자리**라 생값이 맞다
 *   · 할인율이 *보기 좋은지* — 그건 렌더해서 눈으로 봐야 한다
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { priceDisplay } from '../../shared/price-display'
import { readCode } from '../helpers/source-text'

/** 소비자 화면 소스 전수(어드민·셀러 대시보드·테스트 제외). */
function consumerFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'src/pages/*.tsx', 'src/pages/**/*.tsx', 'src/components/*.tsx', 'src/components/**/*.tsx'], {
    encoding: 'utf8',
  })
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !/\.test\.tsx?$/.test(p))
    // 어드민·셀러·에이전시·도매는 소비자 표면이 아니다(별도 체계).
    .filter((p) => !/\/(admin|seller|agency|wholesale|supplier)[-/]|\/Admin|\/Seller|\/Agency|\/Wholesale|\/Supplier/.test(p))
}

describe('💸 할인율 SSOT (2026-10-14)', () => {
  const files = consumerFiles()

  it('검사 대상이 비어 있지 않다 — 0건이면 통과가 아니라 고장', () => {
    // 🩸 glob 함정: `src/pages/**/*.tsx` 의 `**` 는 디렉터리를 최소 하나 요구해서 최상위 파일을
    //   통째로 놓친다(2026-09-29 에 734개가 그렇게 눈멀었다). 그래서 위에서 두 패턴을 다 준다.
    expect(files.length, '소비자 화면 파일을 못 읽었다 — glob 이 낡았다').toBeGreaterThan(150)
    expect(files.some((p) => !p.includes('/')), 'src/pages 최상위 파일이 빠졌다').toBe(false)
    expect(files.some((p) => p.split('/').length === 3), 'src/pages/Foo.tsx 같은 최상위 화면이 빠졌다').toBe(true)
  })

  it('① 할인율 계산식 사본이 0개 — 규칙은 priceDisplay 안에만 있다', () => {
    // `(1 - x.price / x.original_price)` · `((x.original_price - x.price) / x.original_price)`
    const COPY = [
      /1\s*-\s*[\w.?]*\bprice\b[^)\n]{0,20}\/\s*[\w.?]*original_price/,
      /original_price[^)\n]{0,20}-\s*[\w.?]*\bprice\b[^)\n]{0,20}\)\s*\/\s*[\w.?]*original_price/,
    ]
    const hits: string[] = []
    for (const f of files) {
      const code = readCode(f) // 주석 제거본 — 설명에 적힌 식은 세지 않는다
      for (const line of code.split('\n')) {
        if (COPY.some((re) => re.test(line))) hits.push(`${f}: ${line.trim().slice(0, 90)}`)
      }
    }
    expect(hits, `할인율 계산식을 직접 쓴 자리:\n${hits.join('\n')}`).toEqual([])
  })

  it('② discount_rate 를 정렬·비교·산술에 쓰지 않는다 (전달·타입 선언은 허용)', () => {
    const hits: string[] = []
    let seen = 0
    for (const f of files) {
      const code = readCode(f)
      for (const line of code.split('\n')) {
        // 🩸 `avg_discount_rate`·`computed_discount_rate` 는 **서버가 계산해 내려주는 다른 필드**다.
        //   단어 경계 없이 찾으면 그 둘이 걸려 거짓 빨간불이 난다(첫 판에서 실제로 났다).
        if (!/(^|[^\w])discount_rate\b/.test(line)) continue
        seen++
        const t = line.trim()
        // 허용: 타입 선언 · 객체 리터럴 전달 · prop 전달 · priceDisplay 인자.
        //   ⚠️ prop 전달이 안전한 이유는 **받는 부품이 SSOT 로 다시 계산하기 때문**이다
        //   (`DealRow`·`product-header`). 그래서 ③-2 가 "정가를 함께 넘기는가" 를 따로 본다 —
        //   정가 없이 넘기면 SSOT 도 계산할 수 없어 배지가 영영 안 뜬다(지갑에서 실제로 그랬다).
        const isDecl = /discount_rate\??\s*:\s*(number|string|boolean)/.test(t)
        const isPass =
          /\bdiscount_rate\??\s*:/.test(t) ||        // 객체 키 · 타입 멤버
          /\bdiscount_rate=\{/.test(t) ||            // JSX 속성 이름
          /\w+=\{[^}]*\bdiscount_rate\b/.test(t) || // 다른 prop 으로 값 전달
          /^\s*discount_rate,?\s*$/.test(t)          // 구조분해·인자 목록
        const toSsot = t.includes('priceDisplay(')
        if (isDecl || isPass || toSsot) continue
        // 금지: 비교·산술·삼항 — 라이브에서 전부 0 인 컬럼으로 **판단**하는 자리.
        hits.push(`${f}: ${t.slice(0, 90)}`)
      }
    }
    expect(seen, 'discount_rate 가 한 줄도 안 잡혔다 — 스캔이 헛돈다').toBeGreaterThan(8)
    expect(hits, `discount_rate 생값을 계산에 쓴 자리:\n${hits.join('\n')}`).toEqual([])
  })

  it('③ 깨져 있던 네 자리가 SSOT 를 지난다', () => {
    const wired: Array<[string, string]> = [
      ['src/pages/CuratorPage.tsx', "sort((a, b) => priceDisplay(b).discount - priceDisplay(a).discount)"],
      ['src/pages/BrowsePage.tsx', "result.sort((a, b) => priceDisplay(b).discount - priceDisplay(a).discount)"],
      ['src/pages/GroupBuyDetailPage.tsx', 'discount_pct: priceDisplay('],
      ['src/pages/SearchPage.tsx', 'priceDisplay(p).price'],
    ]
    for (const [f, anchor] of wired) {
      expect(readCode(f), `${f} 가 SSOT 를 안 지난다`).toContain(anchor)
    }
    // 🔴 반대 방향 — 검색이 판매가를 한 번 더 깎던 함수가 되살아나지 않는다.
    expect(readCode('src/pages/SearchPage.tsx')).not.toMatch(/price\s*\*\s*\(\s*1\s*-\s*\w*[Dd]iscount/)
  })

  it('③-2 지갑 "이 매장의 다른 이용권" 이 정가를 함께 넘긴다', () => {
    // 정가가 없으면 SSOT 도 계산할 수 없다 — 배지가 `discount_rate`(라이브 전부 0) 하나에 걸린다.
    const code = readCode('src/pages/my-vouchers/SameStoreDeals.tsx')
    expect(code, 'DealRow 에 originalPrice 를 안 넘긴다 — 배지가 영영 안 뜬다').toContain('originalPrice={d.original_price')
    expect(code, 'DealLite 가 original_price 를 안 받는다').toMatch(/original_price\?:\s*number/)
  })

  it('④ SSOT 규칙은 max(선언값, 계산값) — 진짜 함수를 돌려서 본다', () => {
    // 라이브가 정확히 이 모양이다: 선언 0 + 정가 > 판매가.
    expect(priceDisplay({ price: 31000, original_price: 35000, discount_rate: 0 }).discount).toBe(11)
    // 선언값이 더 크면 선언값(2026-08-19 규칙).
    expect(priceDisplay({ price: 31000, original_price: 35000, discount_rate: 40 }).discount).toBe(40)
    // 🩸 **max 와 `선언 || 계산` 을 가르는 유일한 경우** — 선언값이 계산값보다 **작을 때**.
    //   첫 판에는 이 줄이 없어서, SSOT 를 `declared || computed` 로 바꿔도 시험이 **통과**했다
    //   (주입이 잡았다). 위 두 줄은 선언 0 · 선언 40 이라 둘 다 같은 답을 낸다.
    //   그리고 이것이 `GroupBuyFeed`·`TimedealCard` 의 사본이 실제로 틀렸던 그 경우다.
    expect(priceDisplay({ price: 31000, original_price: 35000, discount_rate: 5 }).discount).toBe(11)
    // 정가가 없으면 0 — 지어내지 않는다.
    expect(priceDisplay({ price: 31000, original_price: 0, discount_rate: 0 }).discount).toBe(0)
    // 판매가가 정가보다 비싸면 취소선 없음(음수 할인 금지).
    expect(priceDisplay({ price: 40000, original_price: 35000 }).showOriginal).toBe(false)
    // `price` 는 **파는 값 그대로** — 검색이 여기서 한 번 더 깎고 있었다.
    expect(priceDisplay({ price: 7500, original_price: 14500, discount_rate: 0 }).price).toBe(7500)
  })
})
