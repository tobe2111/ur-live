/**
 * 🧾 상세 페이지가 다시 "자동 생성된 화면" 처럼 보이지 않게 (2026-08-30 대표 "AI 티 안나는 디자인으로")
 *
 * ## 무엇이 티였나 — 실물을 보고 뽑은 목록
 * 라이브 `/stays/:id` 와 `/group-buy/:id` 를 찍어 비교했더니 티의 정체는 취향이 아니라 **패턴 6개**였다:
 *   1. 번역투 제목 — "무엇을 기대하세요?"(What to expect). 한국 커머스에선 아무도 안 쓴다.
 *   2. 조립된 문구의 반복 — "강릉의 호텔 — 접근성 좋은 호텔 — …" (한 문장에 '호텔' 둘, 줄표 둘)
 *   3. 같은 정보 세 번 — 매장명이 제목 위·지도 핀·지도 아래에
 *   4. 장식 필 칩 — 세 낱말에 로즈 점 + 테두리 세 개
 *   5. 모든 블록이 같은 무게의 흰 라운드 카드 → 위계 소멸(시설 3분할 카드가 대표적)
 *   6. 라벨 앞 장식 이모지 (🎯 📋 🔑 🛡️)
 *
 * ## 이 테스트가 지키는 것
 * 위 6개 중 **문자열·마크업으로 관측 가능한 것**만 고정한다. 되돌아오면 여기서 빨간불이 난다.
 *
 * ## 이 테스트가 **못 막는 것** (과신 금지)
 * - 실제 렌더 결과·간격·대비. 카드를 없앴는지는 클래스 문자열로 보지만, 새 카드를 **다른 이름**으로
 *   다시 만들면 못 잡는다. 화면은 사람이 봐야 한다.
 * - 라이브 DB 에 이미 저장된 숙소 소개 문구. 시드 코드는 여기서 고정하지만, 기존 행은
 *   재시드(어드민) 전까지 옛 문장을 그대로 들고 있다.
 * - 새로 생기는 다른 상세 페이지. 파일 목록이 여기 하드코딩돼 있다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/** 주석은 판정에서 뺀다 — 설명 주석이 검사를 통과시키는 함정을 이 레포는 이미 여러 번 겪었다. */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')

const STAY = 'src/pages/StayDetailPage.tsx'
const GB = 'src/pages/GroupBuyDetailPage.tsx'
const SECTIONS = 'src/pages/stay-detail/StayInfoSections.tsx'
const FCFS = 'src/features/group-buy/FcfsApplyBlock.tsx'
const STAY_SEED = 'src/features/admin/api/admin-stays.routes.ts'

describe('번역투·조립 문구가 되돌아오지 않았다', () => {
  it('"무엇을 기대하세요?" 가 없다', () => {
    expect(code(read(GB)), 'What to expect 직역이 되살아났다').not.toContain('무엇을 기대')
  })

  it('숙소 소개 시드가 유형 이름을 두 번 말하지 않는다', () => {
    // `${지역}의 ${유형} — ${desc}` 조립 + desc 안에 유형 이름 → "강릉의 호텔 — 접근성 좋은 호텔 — …"
    const src = code(read(STAY_SEED))
    expect(src, '지역·유형 접두사 조립이 되살아났다').not.toMatch(/const desc = `\$\{spot\.\w+\}의 \$\{ty\.\w+\}/)
    // desc 안의 줄표(—)는 두 번째 절을 잇는 그 습관 자체다. 마침표로 끊어 쓴다.
    const descs = [...src.matchAll(/desc:\s*'([^']+)'/g)].map((m) => m[1])
    expect(descs.length, 'STAY_TYPES desc 를 못 읽었다 — 셀렉터가 낡았다').toBeGreaterThanOrEqual(5)
    for (const d of descs) expect(d, `조립 줄표가 남아 있다: ${d}`).not.toContain('—')
  })
})

describe('장식이 정보를 덮지 않는다', () => {
  it('딜 안내 칩이 로즈 점 필로 되돌아가지 않았다', () => {
    const src = code(read(GB))
    // 🩸 처음엔 `indexOf('gb-sec-info')` 로 창을 잡았는데, 그 문자열은 **상단 탭 목록에 먼저** 나온다.
    //    그래서 가드가 칩이 아니라 탭바를 검사하고 있었다 — 무엇을 주입해도 초록이었다(되돌려-검증에서 잡음).
    //    섹션은 `id="gb-sec-info"` 로만 앵커한다.
    const at = src.indexOf('id="gb-sec-info"')
    expect(at, '딜 안내 섹션을 못 찾았다 — 앵커가 낡았다').toBeGreaterThan(0)
    const infoSection = src.slice(at, src.indexOf('DealMenuList', at))
    expect(infoSection, '판정 창이 비었다 — 섹션 끝 앵커가 낡았다').toContain('즉시 교환권 발급')
    // 점(dot)을 원형으로 찍고 필 테두리를 두르던 그 마크업.
    expect(infoSection, '안내 칩에 필 테두리가 되살아났다').not.toContain('borderRadius: 99')
    expect(infoSection, '안내 칩에 로즈 점이 되살아났다').not.toContain("background: 'var(--gbd-accent)'")
  })

  it('추첨 응모 라벨 앞에 장식 이모지가 없다', () => {
    expect(code(read(FCFS)), '라벨 앞 장식 이모지가 되살아났다').not.toContain('🎯 추첨 응모')
  })

  it('숙소 안내가 이모지 머리를 단 카드 세 장으로 되돌아가지 않았다', () => {
    const src = code(read(STAY))
    expect(src, 'PolicyCard(이모지 머리 + 카드)가 되살아났다').not.toContain('PolicyCard')
    for (const e of ['📋', '🔑']) expect(src, `안내에 이모지 ${e} 가 되살아났다`).not.toContain(e)
  })

  it('시설이 3분할 카드로 되돌아가지 않았다', () => {
    const src = code(read(STAY))
    expect(src, '시설 인라인 흐름(AmenityFlow)이 사라졌다').toContain('<AmenityFlow')
    expect(src, '시설이 다시 grid 카드가 됐다').not.toMatch(/grid grid-cols-3 sm:grid-cols-4/)
  })
})

describe('같은 정보를 두 번 보여주지 않는다', () => {
  it('지도 아래 카드가 매장명을 다시 적지 않는다', () => {
    // 매장명은 제목 위 머천트 줄과 지도 핀에 이미 있다. 세 번째는 "채워 넣은" 티다.
    const src = code(read(GB))
    const loc = src.slice(src.indexOf('gb-sec-location'))
    const mapCard = loc.slice(0, loc.indexOf('길찾기'))
    expect(mapCard, '지도 아래 카드에 매장명이 되살아났다').not.toContain('fontWeight: 700, color: \'var(--gbd-ink)\', whiteSpace: \'nowrap\' }}>{detail.restaurant_name}')
  })

  it('숙소 유형 배지가 DB 원본값(영문)을 그대로 노출하지 않는다', () => {
    const src = code(read(STAY))
    expect(src, 'property_type 를 그대로 렌더한다 — 화면에 원본 데이터가 비친다')
      .not.toMatch(/rounded font-semibold">\{stay\.property_type\}/)
    expect(src, '한글 라벨 매핑이 사라졌다').toContain('propertyTypeLabel')
  })
})

describe('위계가 살아 있다', () => {
  it('섹션 제목이 본문과 같은 크기로 주저앉지 않았다', () => {
    // 예전엔 전부 `text-sm font-bold` — 제목인지 굵은 본문인지 구분이 안 됐다.
    expect(code(read(SECTIONS)), '섹션 제목 스펙(16px/800)이 바뀌었다').toContain('text-[16px] font-extrabold')
    const src = code(read(STAY))
    expect(src, '섹션 제목이 SectionTitle 밖으로 흩어졌다').toContain('<SectionTitle')
    expect(src, '옛 13px 굵은 제목이 되살아났다').not.toMatch(/<h2 className="text-sm font-bold/)
  })

  it('객실 가격이 로즈로 되돌아가지 않았다 — 로즈는 행동(CTA)에만', () => {
    const src = code(read(STAY))
    expect(src, '가격이 다시 브랜드 로즈다').not.toMatch(/font-extrabold text-brand[^"]*">₩\{formatNumber\(r\.total_price\)/)
  })
})
