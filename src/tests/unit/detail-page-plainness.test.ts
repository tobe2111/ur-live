/**
 * 🧾 상세 페이지가 다시 "자동 생성된 화면" 처럼 보이지 않게 (2026-08-30 대표 "AI 티 안나는 디자인으로")
 *
 * ## 무엇이 티였나 — 실물을 보고 뽑은 목록
 * 라이브 `/stays/:id` 와 `/group-buy/:id` 를 찍어 비교했더니 티의 정체는 취향이 아니라 **패턴 6개**였다:
 *   1. 번역투 제목 — "무엇을 기대하세요?"(What to expect). 한국 커머스에선 아무도 안 쓴다.
 *   2. 조립된 문구의 반복 — "강릉의 호텔 — 접근성 좋은 호텔 — …" (한 문장에 '호텔' 둘, 줄표 둘)
 *   3. 같은 정보 세 번 — 매장명이 제목 위·지도 핀·지도 아래에
 *   4. 장식 필 칩 — 세 낱말에 로즈 점 + 테두리 세 개
 *      (2026-09-01 정정: 흔적은 **테두리 pill** 이다. 테두리 없는 로즈 점 하나는 시스템 전체의
 *       활성·불릿 장치라 허용 — docs/design/anti-slop-direction-2026-09.md ①. 대표 "PR A 부터")
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
const STAY_HEAL = 'src/features/admin/api/admin-stays/heal-stay-descriptions.ts'
const ADMIN = 'src/pages/AdminDongnedealImportPage.tsx'
const ADMIN_SEED = 'src/pages/admin-dongnedeal-import/seedStayDemos.ts'

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

  it('이미 저장된 옛 문장을 고치는 백필이 있다 (신규만 고치면 라이브는 안 바뀐다)', () => {
    // 🩸 실제로 났던 일(2026-08-31): 조립을 없앤 건 **INSERT 경로뿐**이었다. 배포 후에도 라이브
    //   숙소 상세엔 "강릉의 호텔 — 접근성 좋은 호텔 — …" 이 그대로 떠 있었고, 그때 대표에게
    //   "재시드하면 됩니다" 라고 답했는데 **그것도 틀렸다** — 재시드의 치유 블록은 좌표·이름·가격만
    //   건드리고 문구는 손대지 않는다. 즉 시드 문구를 고쳐도 **이미 있는 줄은 영영 그대로**다.
    // ⇒ 문구를 바꾸는 일은 시드 수정 + 백필이 한 쌍이어야 한다. 그 쌍을 여기서 고정한다.
    // ⚠️ 백필 본문은 파일 크기 래칫 때문에 헬퍼로 빠졌다(2026-08-31). 라우트만 읽으면
    //   이 검사는 코드가 옮겨진 순간 빨강이 된다 — 실제로 그렇게 걸렸다. 두 파일을 함께 본다.
    const src = code(read(STAY_SEED)) + '\n' + code(read(STAY_HEAL))
    // 호출부가 살아 있는지도 본다 — 헬퍼만 있고 아무도 안 부르면 백필은 없는 것과 같다.
    expect(code(read(STAY_SEED)), '시드가 문구 백필을 호출하지 않는다').toMatch(/healStayDescriptions\(/)
    // 대상 선별: 데모 슬러그 한정 + 줄표 보유(조립문의 지문). 둘 중 하나라도 빠지면 안 된다 —
    //   슬러그 한정이 빠지면 관리자 수기 문구를 덮고, 줄표 조건이 빠지면 멱등이 깨진다.
    const sel = src.match(/SELECT[^`]*demo-stay-%'[^`]*description LIKE '%—%'/)
    expect(sel, '옛 문장(줄표) 백필 대상 쿼리가 없다 — 신규만 고쳐진 상태다').toBeTruthy()
    // 실제로 쓰는지: description 을 UPDATE 하는 문장이 있어야 한다(조회만 하고 끝나면 무의미).
    expect(src, 'description 을 갱신하지 않는다 — 조회만 하고 있다')
      .toMatch(/UPDATE products SET description = \?/)
    // 관측 가능해야 한다: 카운터를 계산만 하고 응답에서 버리면 "돌았는데 0건" 을 구분할 수 없다
    //   (같은 파일의 amenityHealed 가 실제로 그 상태였다).
    expect(src, '백필 건수가 응답에 안 실린다 — 돌았는지 알 수 없다').toMatch(/data:\s*\{[^}]*descHealed/)
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
    // 점(dot)을 원형으로 찍고 필 테두리를 두르던 그 마크업 — 흔적은 **테두리 pill** 이다.
    expect(infoSection, '안내 칩에 필 테두리가 되살아났다').not.toContain('borderRadius: 99')
    expect(infoSection, '안내 항목에 테두리(칩)가 되살아났다').not.toMatch(/\bborder:\s*['"`]/)
    // 2026-09-01: 로즈 점은 **불릿으로만** 산다 — 한 줄에 하나(세로 스택). 점을 가로로 늘어놓은 칩 행은 옛 마크업이다.
    if (infoSection.includes("var(--gbd-accent)")) {
      expect(infoSection, '로즈 점이 있는데 세로 불릿이 아니다 — 칩 행으로 되돌아갔다').toContain("flexDirection: 'column'")
    }
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


describe('백필 결과가 화면까지 닿는다', () => {
  it('어드민 토스트가 소개 문구 교체 건수를 읽는다', () => {
    // 🩸 2026-08-31 대표 "재시드 버튼이 어딨어?" — 버튼을 찾은 뒤에도 문제가 하나 더 있었다.
    //   서버가 `descHealed` 를 보내는데 **화면이 그 값을 안 읽었다.** 누르면 뭔가는 되는데
    //   무엇이 몇 개 됐는지 알 수 없다 = 판정이 불가능하다. 이 세션 내내 고쳐 온 그 클래스가
    //   마지막에 UI 쪽에서 한 번 더 나왔다(서버만 고치면 절반이다).
    // ⚠️ 호출 본문은 파일 크기 래칫 때문에 헬퍼로 빠졌다(2026-08-31). 페이지만 읽으면 코드가
    //   옮겨진 순간 빨강이 된다 — 실제로 그렇게 걸렸다(이 테스트 파일에서 두 번째다). 함께 본다.
    const src = code(read(ADMIN)) + '\n' + code(read(ADMIN_SEED))
    expect(src, '응답의 descHealed 를 안 읽는다 — 서버만 고치고 화면은 그대로다')
      .toMatch(/d\.descHealed/)
    expect(src, '읽어만 두고 문구에 안 쓴다 — 값이 화면까지 못 간다')
      .toMatch(/소개 문구 \$\{[\w.]*descHealed\}/i)
    // 헬퍼만 있고 페이지가 안 부르면 없는 것과 같다.
    expect(code(read(ADMIN)), '페이지가 숙소 시드 헬퍼를 안 부른다').toMatch(/seedStayDemos\(/)
    expect(code(read(ADMIN)), '요약 문구를 토스트에 안 싣는다').toMatch(/staySeedHealNote\(/)
  })
})
