/**
 * 🎫 유어샵 본문 **s3 밀도형** — 2열 격자·섹션 3개 → 칩 + 정렬 + 한 줄 목록
 * (대표 확정 2026-09-28 · 11라운드 37안 · 후속 지시 *"2단계 진행해줘. 끝까지해줘"*)
 *
 * ## 왜 바꿨나 (라이브 실측)
 * 유어샵은 **3곳 · 핀 8개 · 최다 5개**다. 2열 격자는 그 수에서 첫 화면에 1.5개만 보여 줬고
 * 헤더 chrome 이 화면의 76%를 먹었다. 줄로 내리면 같은 화면에 3~4개가 들어온다.
 *
 * ## 이 시험이 지키는 것 (넷)
 *   ① **줄 카드를 새로 그리지 않는다** — `components/deal/DealRow` 가 2026-09-03 에 만들어진 줄 SSOT.
 *      그 전엔 화면마다 따로 그려 같은 딜이 자리마다 다른 그림이었다.
 *   ② 🔴 **순번은 주인 순서다** — 정렬을 바꿔도 안 변한다. SNS 에서 *"3번 이용권 사세요"* 로 부르는
 *      **주소**이기 때문이다(2026-08-31 대표). 화면 순서(map 인덱스)로 매기면 할인율순으로 들어온
 *      손님에게 3번이 다른 상품을 가리키고 — **소개비가 엉뚱한 상품으로 샌다.** 돈이 새는 쪽으로 깨지는
 *      유일한 항목이라 이 파일에서 제일 센 단언이 여기 있다.
 *   ③ **리뷰 0 이면 별점 줄을 통째로 뺀다** — 라이브 실측(2026-09-27): 유어샵 핀 8개는 전부 데모·
 *      플랫폼 상품이라 별점이 미리 채워져 있고 **실제 사업자 상품 2개만 리뷰 0**. 빈 별 다섯을 그리면
 *      데모는 화려하고 진짜 매장만 "0점" 으로 보인다.
 *   ④ **정렬은 보기만 바꾼다** — `position`(주인 순서)을 서버에 다시 쓰지 않는다.
 *
 * ## 이 시험이 **못** 하는 것
 *   - 밀도가 실제로 좋아졌는지(첫 화면에 몇 개 들어오는지)는 못 잰다 — jsdom 엔 레이아웃이 없다.
 *     그건 브라우저 프레임 캡처가 판정한다.
 *   - `DealRow` 안쪽 생김새는 그 부품의 시험이 지킨다(여기선 "쓰고 있는가" 까지).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const PAGE = 'src/pages/CuratorPage.tsx'
const ROW = 'src/pages/curator-page/PinRow.tsx'

const page = stripComments(readCode(PAGE))
const row = stripComments(readCode(ROW))

describe('① 줄 카드는 DealRow SSOT 를 쓴다', () => {
  it('PinRow 가 DealRow 를 import 하고 렌더한다', () => {
    expect(row).toContain("from '@/components/deal/DealRow'")
    expect(row, 'JSX 로 실제 렌더(=import 만 남는 것 차단)').toMatch(/<DealRow\b/)
  })

  it('격자 시절 부품이 본문에서 사라졌다', () => {
    // 2열 격자를 그리던 것들 — 되살아나면 같은 딜이 유어샵에서만 다른 그림이 된다.
    expect(page, '홈 피드 카드').not.toMatch(/<GroupBuyFeedCard\b/)
    expect(page, '유어샵 전용 격자').not.toMatch(/<PinGrid\b/)
    expect(page, '유어샵 전용 카드').not.toMatch(/<PinCard\b/)
    expect(page, '2열 격자 클래스').not.toMatch(/grid-cols-2/)
  })

  it('목록이 PinRow 로만 그려진다', () => {
    expect(page).toMatch(/<PinRow\b/)
  })
})

describe('② 🔴 순번 배지 = 주인 순서(정렬과 무관)', () => {
  it('order 는 주인 순서 맵에서 나온다 — map 인덱스가 아니다', () => {
    // 주인 순서의 정의: `homePins`(딜 → 교환권 → 상품, 2026-08-27 대표 확정 순서) 안의 자리.
    expect(page).toMatch(/const orderOf = useMemo\(\(\) => new Map\(homePins\.map\(\(p, i\) => \[p\.id, i\]\)\)/)
    expect(page).toMatch(/order=\{\(orderOf\.get\(pin\.id\) \?\? 0\) \+ 1\}/)
  })

  it('보이는 목록의 인덱스를 번호로 쓰지 않는다', () => {
    // 이 한 줄이 이 파일의 존재 이유다. `visiblePins.map((pin, i) => … order={i + 1})` 가
    // 들어오면 할인율순 손님에게 3번이 다른 상품을 가리킨다.
    expect(page, 'visiblePins.map 이 인덱스를 받지 않는다').not.toMatch(/visiblePins\.map\(\([^)]*,\s*\w+\)/)
    expect(page, 'order 에 인덱스 변수를 넘기지 않는다').not.toMatch(/order=\{\s*(i|idx|index)\b/)
  })

  it('PinRow 는 order 를 prop 으로만 받는다(스스로 세지 않는다)', () => {
    expect(row).toMatch(/order:\s*number/)
    expect(row).toMatch(/\{order\}/)
    expect(row, '부품이 자기 순서를 지어내지 않는다').not.toMatch(/order\s*=\s*(index|idx|i)\b/)
  })
})

describe('③ 리뷰 0 이면 별점 줄이 없다', () => {
  it('review_count 가 0 이면 meta 를 만들지 않는다', () => {
    expect(row).toMatch(/const reviews = Number\(pin\.review_count\) \|\| 0/)
    // 삼항의 거짓 가지가 `undefined` 여야 DealRow 가 그 줄 자체를 안 그린다.
    expect(row).toMatch(/const meta = reviews > 0 \?[\s\S]*?:\s*undefined/)
  })

  it('StarRating 은 그 조건 안에서만 쓰인다', () => {
    const cond = row.slice(row.indexOf('const meta = reviews > 0'), row.indexOf(': undefined'))
    expect(cond, '조건부 블록 안에 별점이 있다').toContain('<StarRating')
    // 조건 밖에 또 그리면 0 리뷰 상품에 빈 별이 되돌아온다.
    const outside = row.replace(cond, '')
    expect(outside).not.toContain('<StarRating')
  })
})

describe('④ 정렬은 보기만 바꾼다', () => {
  it('세 가지 정렬이 있고 기본은 주인 순서', () => {
    expect(page).toMatch(/type PinSort = 'curated' \| 'discount' \| 'price_low'/)
    expect(page).toMatch(/useState<PinSort>\('curated'\)/)
  })

  it('주인 순서일 땐 배열을 복사조차 하지 않는다(원본 순서 보존)', () => {
    expect(page).toMatch(/if \(sort === 'curated'\) return list/)
    // 정렬은 반드시 사본에만 — homePins 를 제자리 정렬하면 순번 맵까지 흔들린다.
    expect(page).toMatch(/const copy = \[\.\.\.list\]/)
    expect(page, 'homePins 를 제자리 정렬 금지').not.toMatch(/homePins\.sort\(/)
  })

  it('정렬이 주인 순서(position)를 서버에 다시 쓰지 않는다', () => {
    const sortBlock = page.slice(page.indexOf('const visiblePins'), page.indexOf('const visiblePins') + 900)
    expect(sortBlock).not.toMatch(/position/)
    expect(sortBlock).not.toMatch(/api\.(patch|post|put)/)
  })
})

describe('⑤ 목적지는 귀속 경로', () => {
  it('상세로 직행하지 않는다 — /u/:handle/p/:productId', () => {
    // 그 경로가 클릭을 기록하고 소개비 귀속을 붙인다. 화면은 같은데 귀속만 조용히 사라지는 클래스.
    expect(row).toMatch(/to=\{`\/u\/\$\{handle\}\/p\/\$\{pin\.product_id\}`\}/)
    expect(row).not.toMatch(/`\/group-buy\/|`\/products\//)
  })
})

describe('⑤-2 같은 숫자를 두 번 말하지 않는다 (렌더 실측으로 잡은 것)', () => {
  // 🩸 첫 렌더에서 160px 안에 "6" 이 **세 번** 있었다: 헤더 `담은 이용권 6` · 칩 `전체 6` · 목록 `6개`.
  //   칩 게이트를 연 것이 이번 단계이므로 그 중복도 이번 단계가 만든 것이다.
  //   (2026-09-01 지갑에서 고친 것과 같은 자리 — 요약 줄이 말한 걸 섹션 헤더가 다시 말하던 것.)
  it('개인 유어샵 헤더에 핀 개수를 넘기지 않는다(칩이 말한다)', () => {
    const call = page.slice(page.indexOf('<CuratorHeader'), page.indexOf('<UShopQrCard'))
    expect(call.length, '헤더 호출 구간을 실제로 잘랐다').toBeGreaterThan(40)
    expect(call).not.toMatch(/counts=/)
  })

  it('목록 개수는 검색이 더 걸렀을 때만 적는다', () => {
    expect(page).toMatch(/\{query\.trim\(\) && \([\s\S]{0,260}visiblePins\.length/)
  })
})

describe('⑤-3 줄에 찜 하트를 달지 않는다', () => {
  // `WishlistHeart` 는 `.ur-appear`(기본 opacity:0, `.group:hover` 에서만 나타남)라 **사진 위**를
  // 전제로 만들어졌다. `DealRow` 루트엔 `group` 이 없어 PC 에선 영영 안 보이고 폰에서만 보인다 —
  // 기기마다 다른 기능이 된다. 확정 시안(s3)의 줄에도, DealRow 를 쓰는 다른 화면에도 하트는 없다.
  it('PinRow 가 WishlistHeart 를 쓰지 않는다', () => {
    expect(row).not.toContain('WishlistHeart')
  })
})

describe('⑥ 검사 대상이 비지 않았다', () => {
  it('두 소스가 실제로 읽혔다', () => {
    // 경로가 낡아 빈 문자열이 되면 위 not.toMatch 들이 전부 공짜로 통과한다.
    expect(page.length).toBeGreaterThan(5000)
    expect(row.length).toBeGreaterThan(800)
  })
})
