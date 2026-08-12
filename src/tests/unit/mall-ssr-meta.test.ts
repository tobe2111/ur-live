/**
 * 🔴 몰 OG 메타 불변식 〔세션 ③-a, 대표 UX 기준 ②〕
 *
 * *"OG 메타가 곧 매대다. sitemap 과 동일하게 몰 스코프 확인 필수 — A몰 링크에 본진이나 B몰 정보가 뜨면 안 된다."*
 *
 * **sitemap 과 같은 클래스인 이유**: 잘못 나간 미리보기는 **카톡방에 박제**된다. 카카오 스크랩 캐시는
 * 오래 살고, 우리가 고쳐도 이미 뿌려진 대화방의 카드는 그대로다 — **회수 시점의 통제권이 없다.**
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 호출부가 이 함수를 **안 쓰고** 직접 메타를 만드는 경우(배선 시점의 문제 — 워커 배선 PR 에서 볼 것)
 *   - 카카오 스크랩 캐시 자체(우리 코드 밖)
 *   - `mall_id` 가 **잘못 스탬프된** 경우(등록 경로 → ③-b)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { buildMallMeta } from '@/worker/utils/mall-ssr-meta'

const origin = 'https://urdeal.kr'
const mall = { id: 3, name: '동네상회' }
const product = {
  id: 10, name: '수제 사과잼', image_url: 'https://cdn/x.jpg',
  gb_price: 7000, price: 10000, deadline: '2026-08-01 10:00:00', mall_id: 3,
}
const base = { mall, product, origin, pathname: '/my-shop/group-buy/10' }

describe('🔴 몰 스코프 — 불일치·불명이면 만들지 않는다 (fail-closed)', () => {
  it('다른 몰 상품이면 null — A몰 링크에 B몰 카드가 박히지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: 4 } })).toBeNull()
  })

  it('본진(1) 상품이 몰 링크에 실리지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: 1 } })).toBeNull()
  })

  it('mall_id 가 없으면 null — "아마 맞겠지"로 뿌리지 않는다', () => {
    // 컬럼 미적용·조회 누락 등으로 **모르는** 상태다. 모르면 기본 카드로 폴백하는 게 맞다.
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: null } })).toBeNull()
    expect(buildMallMeta({ ...base, product: { ...product, mall_id: undefined } })).toBeNull()
  })

  it('몰·상품이 없으면 null', () => {
    expect(buildMallMeta({ ...base, mall: null })).toBeNull()
    expect(buildMallMeta({ ...base, product: null })).toBeNull()
  })

  it('이름이 비면 null — 빈 카드를 뿌리지 않는다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, name: '  ' } })).toBeNull()
    expect(buildMallMeta({ ...base, mall: { id: 3, name: '' } })).toBeNull()
  })
})

describe('카드 내용 — 몰 이름·사진·공구가·마감일', () => {
  it('몰 이름이 **먼저** 온다 — 누구의 판인지가 먼저 읽혀야 한다', () => {
    const m = buildMallMeta(base)!
    expect(m.title.startsWith('동네상회')).toBe(true)
    expect(m.title).toContain('수제 사과잼')
  })

  it('공구가와 정가를 함께 — 할인 폭이 보여야 카드가 일한다', () => {
    const m = buildMallMeta(base)!
    expect(m.description).toContain('7,000원')
    expect(m.description).toContain('10,000원')
  })

  it('마감일은 KST 기준 — UTC-naive 타임스탬프를 로컬로 오해석하지 않는다', () => {
    // D1 `CURRENT_TIMESTAMP` 는 'YYYY-MM-DD HH:MM:SS'(UTC, Z 없음). 이 레포의 반복 사고 클래스.
    const m = buildMallMeta(base)!
    expect(m.description).toContain('8월 1일 마감')   // 2026-08-01 10:00Z → KST 19:00, 같은 날
  })

  it('UTC 늦은 시각은 KST 에서 다음 날 — 하루 밀림 방지', () => {
    const m = buildMallMeta({ ...base, product: { ...product, deadline: '2026-08-01 16:00:00' } })!
    expect(m.description).toContain('8월 2일 마감')   // 16:00Z + 9h = 익일 01:00 KST
  })

  it('공구가가 없으면 상시가만', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: null } })!
    expect(m.description).toContain('10,000원')
    expect(m.description).not.toContain('공구가')
  })

  it('공구가가 상시가보다 높으면 특가로 안 쓴다 — 가격을 올리는 방향 금지', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: 15000 } })!
    expect(m.description).not.toContain('15,000원')
  })

  it('가격·마감이 전부 없어도 카드는 성립한다', () => {
    const m = buildMallMeta({ ...base, product: { ...product, gb_price: null, price: null, deadline: null } })!
    expect(m.description).toContain('동네상회')
  })
})

describe('이미지·canonical', () => {
  it('절대 URL 은 그대로, 상대는 origin 접두', () => {
    expect(buildMallMeta(base)!.ogImage).toBe('https://cdn/x.jpg')
    expect(buildMallMeta({ ...base, product: { ...product, image_url: '/a.png' } })!.ogImage)
      .toBe('https://urdeal.kr/a.png')
  })

  it('이미지가 없으면 기본 OG — 깨진 카드보다 낫다', () => {
    expect(buildMallMeta({ ...base, product: { ...product, image_url: '' } })!.ogImage)
      .toContain('/og-image.svg')
  })

  it('canonical 은 요청 경로 그대로', () => {
    expect(buildMallMeta(base)!.canonical).toBe('https://urdeal.kr/my-shop/group-buy/10')
  })
})

/**
 * 🔴 **워커 MALL 슬롯의 배선 불변식** 〔세션 ③-a, 2026-08-01〕
 *
 * `buildMallMeta` 가 아무리 옳아도 **호출부가 틀리면 소용없다**(위 주석의 "못 막는 것" 1번).
 * 여기서 그 배선 자체를 값으로 고정한다. 지키는 것은 두 가지다:
 *
 * ① **핫패스** — 몰 매처는 `isMallLookupCandidate` 로 예약어·문법 밖을 먼저 잘라야 한다.
 *    안 그러면 **모든 미지 경로가 SSR self-fetch 를 유발**한다(콜드 D1 왕복 — 404 트래픽에 비용을 낸다).
 * ② **순서** — 몰 매처가 앞서면 `/u/:handle`·`/products/:id` 같은 기존 슬롯을 가로챈다.
 *
 * ⚠️ 이 테스트는 **텍스트 검사**다. 로직이 같은 뜻으로 리팩터되면 헛돌 수 있다 —
 *   그때는 이 테스트를 고치지 말고 **불변식이 여전히 성립하는지 먼저 확인**할 것.
 */
describe('🔴 워커 MALL 슬롯 배선', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/worker/index.ts'), 'utf8')

  it('몰 매처는 후보 필터를 통과한 세그먼트에만 붙는다', () => {
    // 🔴 **주석을 먼저 지운다.** 안 그러면 `if` 에서 필터를 빼도 위 설명 주석에 남은 이름 때문에
    //   초록이 뜬다 — 되돌려-검증에서 실제로 그랬다(이 레포의 `check-lock-table-symbols` 가
    //   경고한 것과 같은 함정: *"심볼이 주석에만 남아도 통과한다"*).
    const code = src.replace(/\/\/[^\n]*/g, '')
    const lines = code.split('\n')
    const i = lines.findIndex((l) => l.includes(`slot: 'MALL'`))
    expect(i, 'MALL 슬롯 배선이 사라졌다').toBeGreaterThan(-1)
    // 그 배선을 감싸는 가장 가까운 `if (` 조건문에 후보 필터가 있어야 한다.
    const guard = lines.slice(Math.max(0, i - 6), i).reverse().find((l) => l.includes('if ('))
    expect(guard, 'MALL 배선을 감싸는 조건문을 못 찾았다').toBeTruthy()
    expect(guard).toContain('isMallLookupCandidate')
  })

  it('몰 매처는 기존 슬롯(PRODUCT·DETAIL·SELLER·CURATOR)보다 **뒤**에 있다', () => {
    const at = (needle: string) => src.indexOf(needle)
    const mall = at(`slot: 'MALL'`)
    for (const s of [`slot: 'PRODUCT'`, `slot: 'DETAIL'`, `slot: 'SELLER'`, `slot: 'CURATOR'`]) {
      expect(at(s), `${s} 배선이 없다`).toBeGreaterThan(-1)
      expect(mall, `${s} 보다 앞서면 그 슬롯을 가로챈다`).toBeGreaterThan(at(s))
    }
  })

  it('payload 가 없으면 메타를 건드리지 않는다 — 카톡 캐시 박제 방지', () => {
    expect(src).toContain(`ssrSlot === 'MALL' && ssrPayload`)
  })
})

/**
 * 📣 2026-08-09 — **PRODUCT 슬롯의 buildMallMeta 배선** (이 파일 헤더가 "워커 배선 PR 에서 볼 것"
 * 이라 미뤄 둔 그 검사). 몰 상품 카드는 `/products/:id` 로 링크하므로 몰 링크 공유의 실제 표면은
 * PRODUCT 슬롯이다 — 여기 배선이 빠지면 buildMallMeta 는 도로 dead code 가 된다.
 */
describe('🔴 워커 PRODUCT 슬롯 — buildMallProductMeta 배선', () => {
  const worker = readFileSync(resolve(process.cwd(), 'src/worker/index.ts'), 'utf8').replace(/\/\/[^\n]*/g, '')
  const helper = readFileSync(resolve(process.cwd(), 'src/worker/utils/mall-ssr-meta.ts'), 'utf8')

  it('워커가 buildMallProductMeta 를 import 하고 실제로 호출한다', () => {
    // ⚠️ 2026-08-11 — 원래 `buildMallProductMeta } from './utils/mall-ssr-meta'` 라는
    //   **정확한 문자열**을 봤는데, 같은 모듈에서 심볼을 하나 더 import 하자
    //   (`{ buildMallProductMeta, buildMallProductPathMeta }`) 정상 변경이 빨강이 됐다.
    //   불변식은 *"그 모듈에서 이 심볼을 들여와 호출한다"* 이지 import 문 배열 순서가 아니다.
    //   ⇒ import 문을 찾아 **그 안에 심볼이 있는지**로 본다(느슨해지지 않는다 — 모듈 경로도 함께 고정).
    const imp = worker.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/utils\/mall-ssr-meta'/)
    expect(imp).not.toBeNull()
    expect(imp![1]).toContain('buildMallProductMeta')
    expect(worker).toContain('await buildMallProductMeta(')
  })

  it('몰 조회는 consumer_path=1 로 잠긴다 — 비공개 도매몰이 소비자 카드에 실리지 않는다', () => {
    expect(helper).toContain('COALESCE(consumer_path, 0) = 1')
  })

  it('null 이면 기본 상품 메타로 폴백한다(fail-closed) — 몰 판정이 상품 카드를 없애면 안 된다', () => {
    expect(worker).toMatch(/else \{\s*const pm = buildProductMeta\(/)
  })

  it('본진 상품(mall_id≤1)은 DB 를 아예 안 본다 — 핫패스 불변', () => {
    // 주석 제거 후 조건문 자체를 검사(주석에만 남는 함정 차단).
    const h = helper.replace(/\/\/[^\n]*/g, '')
    expect(h).toContain('pMallId <= 1) return null')
  })
})
