/**
 * 🏨 **숙소 탭 큐레이션 + 이곳과 비슷한 스테이** — 2026-09-24 대표 문서 ④⑥.
 *
 * ## 무엇을 요구받았나
 * ④ *"최대 5만원 쿠폰으로 떠나는 남쪽여행"* 같은 **제목 + 가로 캐러셀**, *"클릭하고 싶은 멘트로 변경"*,
 *    *"숙소 사진 크게 넣기"* — `/stays` 에는 큐레이션 섹션이 **0개**였다.
 * ⑥ *"숙소소개 아래에 이곳과 비슷한 스테이 있었으면 좋겠음"* — 숙소 상세엔 추천이 없었다.
 *
 * ## ⚠️ 여기서 제일 중요한 것: 카드를 새로 만들지 않는다
 * 2026-09-03 대표 지시 *"여기 UI도 통일화 해야지"* 로 숙소 목록을 홈과 같은 `GroupBuyFeedCard` 로
 * 통일했다(당시 **네 번째** 카드 세대였다). "사진 크게" 를 새 카드로 풀면 다섯 번째가 생긴다.
 * ⇒ 카드는 그대로, **폭만** 키운다. 이 시험이 그 결정을 지킨다.
 *
 * ## 이 시험이 **못 하는 것**
 * jsdom 은 레이아웃이 없어 "사진이 실제로 커졌는가"를 못 잰다. 폭 클래스가 그리드보다 큰지
 * (문자열)만 본다. 실제 크기는 브라우저 판정이다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildStayCurations } from '@/pages/stays/StayCurations'
import type { StaySearchItem } from '@/hooks/queries/useStaysSearch'

const CUR = 'src/pages/stays/StayCurations.tsx'
const SIM = 'src/pages/stay-detail/SimilarStays.tsx'
const LIST = 'src/pages/StaysSearchPage.tsx'
const DETAIL = 'src/pages/StayDetailPage.tsx'

const stay = (o: Partial<StaySearchItem>): StaySearchItem => ({ id: Math.random(), name: 'x', ...o } as StaySearchItem)

describe('큐레이션 줄은 데이터에서 참인 것만 말한다', () => {
  it('제목이 약속한 조건을 실제로 만족하는 것만 담는다', () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) => stay({ id: i + 1, price_from: 90000, region_sido: '경북' })),
      ...Array.from({ length: 3 }, (_, i) => stay({ id: i + 10, price_from: 200000, region_sido: '강원' })),
    ]
    const rows = buildStayCurations(items)
    const under = rows.find(r => r.key === 'under-100k')
    expect(under, '10만원 아래 줄이 없다').toBeTruthy()
    // 제목이 "10만원 아래"인데 10만원 이상이 섞이면 그건 거짓말이다.
    expect(under!.items.every(s => (s.price_from as number) < 100000)).toBe(true)
    const gw = rows.find(r => r.key === 'gangwon')
    expect(gw!.items.every(s => s.region_sido === '강원')).toBe(true)
  })

  it('3장이 못 차면 그 줄은 스스로 사라진다', () => {
    const rows = buildStayCurations([stay({ id: 1, price_from: 50000 }), stay({ id: 2, price_from: 50000 })])
    expect(rows).toEqual([])
  })

  it('한 줄이 끝없이 길어지지 않는다', () => {
    const many = Array.from({ length: 40 }, (_, i) => stay({ id: i + 1, price_from: 50000 }))
    expect(buildStayCurations(many)[0].items.length).toBeLessThanOrEqual(10)
  })

  it('빈 목록에서도 안 터진다', () => {
    expect(buildStayCurations([])).toEqual([])
  })
})

describe('카드는 한 벌이다 (2026-09-03 통일 결정 승계)', () => {
  it('큐레이션도 홈과 같은 GroupBuyFeedCard 를 쓴다', () => {
    expect(readCode(CUR)).toMatch(/<GroupBuyFeedCard\b/)
  })

  it('캐러셀 구현이 하나뿐이다 — 비슷한 스테이도 같은 부품을 쓴다', () => {
    // 두 벌이 되면 폭·간격·스냅이 갈린다(이 레포가 카드에서 네 번 겪은 클래스).
    expect(readCode(SIM)).toMatch(/<StayCardRow\b/)
    expect(readCode(SIM), '비슷한 스테이가 카드를 직접 그린다(두 벌째)').not.toMatch(/<GroupBuyFeedCard\b/)
  })

  it('캐러셀 한 장이 4열 그리드보다 넓다 — "사진 크게"의 실체', () => {
    // 그리드는 lg:grid-cols-4(≈25%). 캐러셀은 모바일 68% · lg 28%.
    expect(readCode(CUR)).toContain('w-[68%]')
    expect(readCode(LIST)).toContain('lg:grid-cols-4')
  })
})

describe('배선', () => {
  it('큐레이션은 아무 조건도 안 건 기본 진입에서만 뜬다', () => {
    const code = readCode(LIST)
    expect(code).toMatch(/const curated = !filters\.region && !filters\.property_type/)
    expect(code).toMatch(/\{curated && <StayCurations\b/)
  })

  it('비슷한 스테이는 화면에 들어오기 전엔 요청하지 않는다', () => {
    const code = readCode(SIM)
    expect(code).toContain('IntersectionObserver')
    expect(code).toMatch(/if \(!inView/)
  })

  it('비슷한 스테이는 자기 자신을 추천하지 않는다', () => {
    expect(readCode(SIM)).toMatch(/filter\(s => s\.id !== stayId\)/)
  })

  it('숙소 상세가 두 부품을 쓴다', () => {
    const code = readCode(DETAIL)
    expect(code).toMatch(/<SimilarStays\b/)
  })

  it('⑥ 자리 — 숙소 소개 **바로 아래**, 객실 선택보다 앞 (2026-09-26 대표 확정)', () => {
    /* 처음엔 페이지 맨 아래에 뒀다("객실 선택이 밀린다"는 이유로). 대표가 문서 그대로를 택해
       소개 직후로 옮겼다. 자리는 **결정 사항**이므로 조용히 되돌아가지 못하게 순서를 고정한다.
       ⚠️ 이 시험이 못 하는 것: 실제 픽셀 순서(jsdom 에 레이아웃이 없다)와 "이 자리가 전환율에
       좋은가". 여기서 고정하는 것은 **소스 순서**뿐이다. */
    const code = readCode(DETAIL)
    const intro = code.indexOf('<SectionTitle>숙소 소개</SectionTitle>')
    const sim = code.indexOf('<SimilarStays')
    const rooms = code.indexOf('객실 선택')
    const reviews = code.indexOf('<StayReviews')
    expect(intro, '숙소 소개 섹션을 못 찾았다(앵커가 낡았다)').toBeGreaterThan(-1)
    expect(sim, '비슷한 스테이가 숙소 소개보다 앞에 있다').toBeGreaterThan(intro)
    expect(sim, '비슷한 스테이가 객실 선택 뒤로 내려갔다 — 대표 확정 자리가 아니다').toBeLessThan(rooms)
    expect(sim, '비슷한 스테이가 후기 뒤(옛 자리)로 되돌아갔다').toBeLessThan(reviews)
    /* 소개가 없는 숙소에도 떠야 한다 — 조건 블록(`{stay.description_full && (…)}`) 안에 들어가면
       같이 사라진다. 🩸 첫 판은 `description_full && \([\s\S]{0,400}?<SimilarStays` 로 봤는데
       `[\s\S]` 가 블록의 닫는 `)}` 를 넘어가 **정상 코드에 빨간불**을 냈다. 중첩 여부는 문자
       거리로 못 잰다 ⇒ **들여쓰기**로 본다(형제 섹션과 같은 8칸 = 조건 블록 밖). */
    expect(code, '비슷한 스테이가 소개 조건 블록 안으로 들어갔다(소개 없는 숙소에서 사라진다)')
      .toMatch(/^ {8}<SimilarStays\b/m)
    expect(code).toMatch(/<StayPolicyInfo\b/)
    // 추출한 표가 페이지에 다시 인라인되면 두 벌이 갈린다.
    expect(code, '이용 안내 표가 페이지에 되살아났다').not.toContain('<SectionTitle>이용 안내</SectionTitle>')
  })
})
