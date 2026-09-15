/**
 * 🪟 공구 상세 테두리 걷기 — 안 3 (2026-09-15 대표 확정 *"안 3으로 해줘"*)
 *
 * 시안: `docs/design/gb-detail-borders-2026-09.md` · https://claude.ai/code/artifact/MKZoqK18KDURPm1X6o9uPg
 *
 * ## 이 시험의 요지 — **15곳을 다 걷는 게 아니다**
 * 전수로 세어 보니 성격이 셋이었고, 규칙 ①(카드 테두리 0)이 금지하는 건 **첫 줄뿐**이다:
 *
 * | 성격 | 곳 | 처방 |
 * |---|---|---|
 * | 카드를 두르는 테두리 | 4 | **걷는다** (안 3: 채우지 않는다. 단 PC 구매 박스만 안 2=들림) |
 * | 구분선(헤어라인) | 7 | **그대로** — `--rule` 이 존재하는 이유다 |
 * | outline 컨트롤 | 4 | 남기되 토큰을 `--gbd-line2`(카드선) → `--rule-strong`(outline 전용) |
 *
 * ⚠️ 그래서 이 시험은 "테두리가 0인가" 를 묻지 않는다. **없어야 할 것이 없고, 있어야 할 것이 있는가**를 묻는다.
 * 구분선까지 걷는 회귀가 이 시험에 걸린다(그게 더 흔한 과잉교정이다).
 *
 * ## 이 시험이 **못** 막는 것
 * 걷어낸 화면이 실제로 나아 보이는지. 그건 눈으로 봐야 한다(시안 아티팩트가 그 자리다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const DETAIL = stripComments(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf-8'))
const BOX = stripComments(readFileSync('src/pages/group-buy/DealPurchaseBox.tsx', 'utf-8'))
const MENU = stripComments(readFileSync('src/pages/group-buy/DealMenuList.tsx', 'utf-8'))
const USAGE = stripComments(readFileSync('src/pages/group-buy/UsageGuide.tsx', 'utf-8'))
const BAR = stripComments(readFileSync('src/pages/group-buy/DealBottomBar.tsx', 'utf-8'))

describe('걷어낸 것 — 카드를 두르던 테두리 4곳', () => {
  it('① 매장 위치: 지도 상자와 주소 줄이 한 상자를 이루지 않는다', () => {
    // 종전: 지도 `border … borderBottom:none` + 주소 `border … borderTop:none` 으로 상자 한 개.
    expect(DETAIL).not.toMatch(/borderRadius: '14px 14px 0 0'/)
    expect(DETAIL).not.toMatch(/borderRadius: '0 0 14px 14px'/)
    expect(DETAIL).toMatch(/<div style=\{\{ borderRadius: 14, overflow: 'hidden' \}\}>/)
  })

  it('② 주소 줄이 섹션 본문 여백에 맞는다 (좌우 패딩 0)', () => {
    // 상자를 없앴으니 안쪽 패딩도 없어야 다른 섹션과 왼쪽이 맞는다.
    expect(DETAIL).toMatch(/gap: 11, padding: '13px 0 0' \}\}>/)
  })

  it('③ 내 공구 CTA 는 테두리 대신 옅은 면', () => {
    expect(DETAIL).toMatch(/padding: '13px 14px', background: 'var\(--gbd-chip\)', borderRadius: 14/)
  })

  it('④ PC 히어로에 lg 테두리가 없다', () => {
    expect(DETAIL).toContain('className="relative lg:rounded-2xl lg:overflow-hidden"')
    expect(DETAIL).not.toMatch(/lg:border lg:border-gray-100/)
  })

  it('⑤ PC 구매 박스만 예외 — 들림(안 2). 그림자는 **토큰**이어야 한다', () => {
    expect(BOX).toMatch(/borderRadius: 18, padding: 18, background: 'var\(--gbd-card\)', boxShadow: 'var\(--lift\)'/)
    // 🔑 하드코딩 그림자는 테마를 모른다 — 다크는 `--lift: none` 이라 꺼져야 한다.
    expect(BOX).not.toMatch(/boxShadow: '0 6px 24px/)
    expect(BOX).not.toMatch(/border: '1px solid var\(--gbd-line2\)', borderRadius: 18/)
  })
})

describe('남긴 것 — 구분선 7곳 (과잉교정 차단)', () => {
  // 규칙 ①은 **카드 테두리**를 금지한다. 카드 안 구분선은 `--rule` 이 존재하는 이유다.
  it('하단 바 위 구분선', () => {
    expect(BAR).toMatch(/borderTop: '1px solid var\(--gbd-line2\)'/)
  })
  it('메뉴 행 구분선 2곳', () => {
    expect((MENU.match(/1px solid var\(--gbd-line2\)/g) || []).length).toBe(2)
  })
  it('이용 안내 행 구분선 4개소 (표 행 2 + 접기 트리거 위·아래)', () => {
    // ⚠️ `grep -c` 는 **줄** 수라 한 줄에 둘 있는 경우를 놓친다(첫 판에 2로 썼다가 틀렸다).
    expect((USAGE.match(/1px solid var\(--gbd-line2\)/g) || []).length).toBe(4)
  })
  it('PC 구매 박스 안 구분선', () => {
    expect(BOX).toMatch(/borderTop: '1px solid var\(--gbd-line2\)'/)
  })
  it('전화번호 밑줄', () => {
    expect(DETAIL).toMatch(/borderBottom: '1px solid var\(--gbd-line2\)'/)
  })
})

describe('바꾼 것 — outline 컨트롤은 전용 토큰을 쓴다', () => {
  it('수량 −/+ · 셀러 방문 · 길찾기 넷 다 `--rule-strong`', () => {
    // `--gbd-line2`(=`--line`, 카드선)가 아니라 체계가 outline 버튼·칩용으로 정의한 값.
    const strong = (DETAIL.match(/1px solid var\(--rule-strong\)/g) || []).length
    expect(strong).toBe(4)
  })

  it('상세에 카드선을 쓰는 테두리는 전화번호 밑줄 하나뿐이다', () => {
    const left = (DETAIL.match(/1px solid var\(--gbd-line2\)/g) || []).length
    expect(left).toBe(1)
  })
})
