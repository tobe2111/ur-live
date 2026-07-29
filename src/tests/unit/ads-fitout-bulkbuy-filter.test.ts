/**
 * 🏗️ '공동구매' 두 가지 뜻 가르기 — 입주 시공업체 ↔ 공구 셀러.
 *
 * ## 라이브 실측 (2026-07-29) — 실제 문구 그대로
 * 대표 지시로 공동구매 축을 열고 나서 그 카테고리 205명을 열어 보니, 문자열은 똑같이 "공동구매"인데
 * **아파트 입주 공동구매**(단지 단위 시공/자재 계약) 업체가 섞여 있었다:
 * ```
 *   'LX Z:IN 인테리어 광주남구점 …공식대리점'  → LX창호 공동구매 행사 (7/30~8/5)
 *   '팔도방충망님의 블로그'                    → 블랙스텐망 공동구매 시공 후기
 *   '베니시모 휴앤홈 가구'                     → 입주예정자협의회 심사 거쳐 공동구매 제휴업체 선정
 * ```
 * 우리가 찾는 것은 **자기 팔로워에게 직접 파는 사람**이다. 이들은 정반대 축(B2B 시공)이고
 * 성격상 업체 DB(파트너풀)의 대상이다.
 *
 * ## 왜 지금 박는가
 * 같은 날 공동구매 키워드 41개의 대기줄을 풀었다("공동구매"·"최저가 공구"·"특가 공구"…).
 * 그 키워드가 돌기 시작하면 이 부류가 **대량으로** 들어온다 — 필터를 나중에 고치면 이미 섞인 뒤다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 소개글이 비어 신호가 아예 없는 행(실측 205명 중 139명).
 *    그건 필터가 아니라 **측정**의 문제라 여기서 해결하지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { classifyCategory, isFitoutBulkBuy, shouldClearCategory } from '@/features/marketing/api/influencer-classify'

describe('isFitoutBulkBuy — 입주 시공업체 신호', () => {
  // 🔒 라이브에서 실제로 잘못 잡힌 문구들. 문구를 바꾸지 말 것 — 이게 이 가드의 존재 이유다.
  const 업체 = [
    'LX Z:IN 인테리어 광주남구점 LX 하우시스 공식대리점 리모델링 LX창호공동구매 행사',
    '팔도방충망님의 블로그 [아산방충망]블랙스텐망 공동구매 시공 후기',
    '베니시모 휴앤홈 가구 입주예정자협의회(입예협)의 까다로운 심사를 거쳐 공동구매 제휴업체로 선정',
    '연아건축 ALC건축 토목 설계 공동구매기획전 9평 이상 주택',
    '청소레시피 반포 래미안 트리니원 특별 공동구매 패키지 입주 청소',
  ]
  for (const t of 업체) {
    it(`업체로 판정: ${t.slice(0, 22)}…`, () => {
      expect(isFitoutBulkBuy(t)).toBe(true)
      expect(classifyCategory(t, '')).not.toBe('공동구매')
    })
  }

  it('빈 문자열에 throw 하지 않는다', () => {
    expect(isFitoutBulkBuy('')).toBe(false)
    expect(isFitoutBulkBuy(null as unknown as string)).toBe(false)
  })
})

describe('진짜 공구 셀러는 그대로 통과한다 — 오탐이 더 비싸다', () => {
  const 셀러 = [
    '따뜻한식탁 블로그 반찬 공구 오픈합니다 공구 일정 안내',
    'DODO FAMILY 육아용품 공구 진행 중 공구 링크 참고하세요',
    '이지픽라이브 쇼핑라이브 진행 · 라이브 커머스 전문',
    '뷰티 공구 셀러입니다 인스타 공구 진행자',
    '맘카페 공구 공지 — 간식 공구 마감 임박',
  ]
  for (const t of 셀러) {
    it(`공동구매로 남는다: ${t.slice(0, 22)}…`, () => {
      expect(isFitoutBulkBuy(t)).toBe(false)
      expect(classifyCategory(t, '')).toBe('공동구매')
    })
  }

  it('🔒 겸업 보호 — 인테리어 블로거가 "공구 오픈"을 하면 셀러로 남는다', () => {
    // 업체 신호(리모델링)와 셀러 신호(공구 오픈)가 함께 있으면 **셀러 우선**.
    // 리빙 인플루언서가 실제로 이렇게 쓴다 — 여기서 잘못 자르면 원하는 사람을 버리게 된다.
    const t = '집꾸미기 블로그 · 셀프 리모델링 후기 · 이번주 리빙 공구 오픈합니다'
    expect(isFitoutBulkBuy(t)).toBe(false)
    expect(classifyCategory(t, '')).toBe('공동구매')
  })
})

describe('다른 카테고리는 영향받지 않는다', () => {
  it('업체 문구라도 공동구매가 아니면 원래 카테고리를 유지한다', () => {
    // 가드는 공동구매 규칙에만 걸린다 — 인테리어 업체가 리빙으로 잡히는 건 정상이다.
    expect(classifyCategory('LX 창호 시공 전문 리모델링 인테리어 집꾸미기', '')).toBe('리빙')
  })
  it('맛집·뷰티 등 기존 판정 불변', () => {
    expect(classifyCategory('동네 맛집 먹방 채널', '')).toBe('맛집')
    expect(classifyCategory('데일리 메이크업 뷰티 채널', '')).toBe('뷰티')
  })
})

/**
 * 🧹 **옛 규칙으로 굳은 값을 지운다** — 재분류의 사각지대(2026-07-29 실측).
 *
 * 재분류는 `classifyCategory` 가 값을 주면 덮고 **`null` 이면 그대로 둔다.** 그래서 새 가드를
 * 만들어도 "다른 규칙에도 안 걸리는" 행은 옛 값이 **영구히 굳는다.**
 * 실측: 입주 시공업체 27명에 가드를 적용해 보니 **6명만 교정되고 21명이 공동구매로 남았다.**
 * ("측정하면 점진 교정된다"는 내 앞선 설명이 이 실측으로 틀렸음이 드러났다.)
 *
 * ⚠️ 이 규칙을 **넓히지 말 것**: "현재 규칙이 그 값을 거부한다는 걸 아는" 조합만 지운다.
 *    모르는 값을 지우면 사람이 손으로 고친 분류까지 날아간다.
 */
describe('shouldClearCategory — 굳은 값 청소', () => {
  it('입주업체인데 공동구매로 굳어 있으면 지운다', () => {
    expect(shouldClearCategory('공동구매', '팔도방충망님의 블로그', '블랙스텐망 공동구매 시공 후기')).toBe(true)
    expect(shouldClearCategory('공동구매', '연아건축', 'ALC건축 토목 설계 공동구매기획전')).toBe(true)
  })
  it('진짜 공구 셀러의 공동구매는 지키다', () => {
    expect(shouldClearCategory('공동구매', '따뜻한식탁', '반찬 공구 오픈 · 공구 일정 안내')).toBe(false)
  })
  it('분류불가 토큰(자동/일반)은 종전대로 지운다 — 기존 동작 불변', () => {
    for (const v of ['자동', '일반']) expect(shouldClearCategory(v, '아무개', '')).toBe(true)
    // 빈 문자열은 **이미 비어 있어 지울 게 없다**(기존 코드도 `r.category &&` 로 걸렀다).
    //   처음엔 여기도 true 로 썼다가 테스트가 잡았다 — NON_CATEGORIES 에 '' 가 있다고 해서
    //   '지워야 하는 값'인 것은 아니다(그 집합은 '카테고리로 안 치는 값'의 목록이다).
    expect(shouldClearCategory('', '아무개', '')).toBe(false)
  })
  it('다른 카테고리는 안 건드린다 — 넓히면 수동 분류가 날아간다', () => {
    expect(shouldClearCategory('맛집', '팔도방충망', '창호 시공 후기')).toBe(false)
    expect(shouldClearCategory('리빙', 'LX 인테리어 공식대리점', '리모델링')).toBe(false)
    expect(shouldClearCategory(null, '아무개', '')).toBe(false)
    expect(shouldClearCategory(undefined, '아무개', '')).toBe(false)
  })
})

describe('🚧 배선 — 재분류가 실제로 그 판단을 쓰는가', () => {
  it('runReclassifyPool 이 shouldClearCategory 로 청소한다', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('src/features/marketing/api/influencer-performance.ts', 'utf8')
    // 순수함수만 만들고 배선을 안 하면 21명은 그대로 굳어 있는다 — 조용히 아무 일도 안 일어난다.
    expect(src).toMatch(/!byContent && shouldClearCategory\(r\.category, r\.name, r\.description\)/)
  })
})
