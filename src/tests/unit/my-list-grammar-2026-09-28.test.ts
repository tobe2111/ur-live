import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🧾 마이의 **목록 문법이 한 벌**인지 (2026-09-28 — 대표 *"페이지 디자인 및 UI 퀄리티가 너무 허술해"*).
 *
 * ## 무엇이 잘못됐었나 (렌더 실측 — `visual-preview --route=/user/profile --stores=1`)
 * 한 화면에 목록이 **셋**인데 문법이 전부 갈려 있었다:
 *   - 판매(`매일`·`가끔`): 그룹 라벨이 판 **밖** 12px 회색 · 그룹마다 판 따로 · 행 제목 14px bold
 *   - 손님(`내가 산 것`): 그룹 라벨이 판 **안** 10px · 세 그룹이 **한 판**(13행) · 행 제목 13px medium
 *   - 바로가기(`내 바로가기`): **테두리 있는 판**(규칙 ① *"카드 테두리 0"* 위반) · 행 13px · 설명 11px
 *     · 화살표만 `text-gray-300` 으로 흐림
 * 정본은 대표가 확정한 '전체 4'(`AllToolsSheet`)와 판매 묶음 쪽이고, CLAUDE.md 🎫 표면 규칙 ⑦
 * (*"판 위 작은 회색 그룹 라벨 · 행은 [라벨 왼쪽 · 값 오른쪽]"*)이 그것을 글로 못 박아 뒀다.
 *
 * ⇒ 부품을 `list-grammar.tsx` 하나로 만들고 둘이 그것을 쓴다. 이 시험은 **다시 두 벌이 되는 것**을 막는다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 실제 픽셀. jsdom 에 레이아웃이 없어 "판이 셋으로 보이는가" 는 여기서 판정 못 한다 —
 *   조판을 바꿀 때는 위 하네스 명령으로 **그림을 볼 것**.
 * - 제3의 화면이 또 자기 목록 문법을 만드는 것(여기서 보는 건 마이의 두 파일뿐이다).
 */
const read = (f: string) => codeOnly(readFileSync(f, 'utf-8'))
const GRAMMAR = read('src/pages/user-profile/list-grammar.tsx')
const SHOP = read('src/pages/user-profile/ShoppingGroup.tsx')
const SELLER = read('src/pages/user-profile/SellerSection.tsx')
const ROLE = read('src/pages/user-profile/RoleCtaGrid.tsx')

describe('마이 목록 문법 — 판매와 손님이 같은 부품을 쓴다', () => {
  it('세 목록이 `list-grammar` 에서 행·라벨을 가져온다 (각자 손으로 그리지 않는다)', () => {
    for (const [name, src] of [['ShoppingGroup', SHOP], ['RoleCtaGrid', ROLE]] as const) {
      expect(src, `${name} 이 ListRow 를 안 쓴다`).toMatch(/import \{[^}]*\bListRow\b[^}]*\} from '\.\/list-grammar'/)
      expect(src, `${name} 이 GroupLabel 을 안 쓴다`).toMatch(/import \{[^}]*\bGroupLabel\b[^}]*\} from '\.\/list-grammar'/)
    }
    expect(SELLER).toMatch(/import \{[^}]*\bListRow as ToolRow\b[^}]*\} from '\.\/list-grammar'/)
    expect(SELLER).toMatch(/import \{[^}]*\bGroupLabel\b[^}]*\} from '\.\/list-grammar'/)
    // 옛 로컬 정의가 되살아나면 그 순간 문법이 두 벌이 된다.
    expect(SELLER).not.toMatch(/function (ToolRow|GroupLabel)\(/)
  })

  it('🔴 목록 판에 테두리가 없다 (표면 규칙 ① — 흰 판은 들림 한 값으로 선다)', () => {
    for (const [name, src] of [['ShoppingGroup', SHOP], ['RoleCtaGrid', ROLE]] as const) {
      expect(src, `${name} 에 테두리 판이 남아 있다`).not.toMatch(/rounded-2xl bg-surface border /)
    }
  })

  it('🔴 손님·바로가기 목록이 행 마크업을 손으로 그리지 않는다 (ListRow 가 그 줄이다)', () => {
    expect(SHOP, '손님 목록에 직접 만든 버튼이 있다 — 문법이 또 갈린다').not.toContain('<button')
    expect(ROLE, '바로가기 목록에 직접 만든 링크 줄이 있다').not.toContain('<Link')
    // 옛 문법의 흔적: 판 안 10px 라벨 · 13px/11px 행 글자.
    for (const [name, src] of [['ShoppingGroup', SHOP], ['RoleCtaGrid', ROLE]] as const) {
      for (const px of ['text-[10px]', 'text-[11px]', 'text-[13px]']) {
        expect(src, `${name} 에 옛 글자 크기 ${px} 가 남아 있다`).not.toContain(px)
      }
    }
  })

  it('🔴 그룹 라벨은 판 **밖** 위다 — 라벨이 판 안으로 들어가면 훑을 단위가 사라진다', () => {
    const iLabel = SHOP.indexOf('<GroupLabel>')
    const iPlate = SHOP.indexOf('<ListPlate>')
    expect(iLabel, 'GroupLabel 을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(iPlate, 'ListPlate 를 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(iLabel, '라벨이 판보다 뒤에 있다 = 판 안이다').toBeLessThan(iPlate)
    const plate = SHOP.slice(iPlate, SHOP.indexOf('</ListPlate>'))
    expect(plate).not.toContain('GroupLabel')
  })

  it('🔴 그룹마다 판이 따로다 — 세 그룹을 한 판에 담지 않는다', () => {
    // 판이 `groups.map` 안에 있어야 그룹 수만큼 그려진다. 밖에 있으면 다시 한 덩어리다.
    const iMap = SHOP.indexOf('groups.map(')
    expect(iMap, 'groups.map 을 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(-1)
    expect(SHOP.indexOf('<ListPlate>')).toBeGreaterThan(iMap)
    // 그룹은 셋(이용권·자산 / 관심 / 주문·배송) — 데이터에서 센다(손으로 적으면 낡는다).
    const keys = [...SHOP.matchAll(/^\s{6}key: '([^']+)',$/gm)].map(m => m[1])
    expect(keys.length, '그룹을 못 셌다 — 이 검사가 헛돌고 있다').toBeGreaterThanOrEqual(3)
  })

  it('🔴 판 클래스가 두 구역에서 같다 (한쪽만 바뀌면 다시 갈린다)', () => {
    const m = GRAMMAR.match(/export const LIST_PLATE_CLS = '([^']+)'/)
    expect(m, 'LIST_PLATE_CLS 를 못 찾았다 — 이 검사가 헛돌고 있다').toBeTruthy()
    // SellerSection 은 아직 문자열로 갖고 있다(그 파일의 판 개수를 세는 기존 가드의 앵커라 남겼다).
    expect(SELLER, `판매 쪽 판이 '${m![1]}' 과 다르다`).toContain(m![1])
  })

  it('🔢 0 은 회색이고, 모르는 값은 아예 안 그린다', () => {
    // 굵은 잉크로 0 을 쓰면 화면이 "당신은 0" 이라고 알리는 꼴이 된다(09-01 잔액 슬래브와 같은 판단).
    expect(GRAMMAR).toMatch(/count > 0[\s\S]{0,80}text-gray-400/)
    // `undefined`/`null` = 아직 모르는 것. 0 으로 바꿔 그리면 거짓말이 된다(09-16 잔액 카드 교훈).
    expect(GRAMMAR).toContain('count != null')
    expect(GRAMMAR).not.toMatch(/count \?\? 0/)
  })
})
