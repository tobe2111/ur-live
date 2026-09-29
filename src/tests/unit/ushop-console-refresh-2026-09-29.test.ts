/**
 * 🎫 2026-09-29 (대표 *"아 왜이리 근데 세련된 느낌이 없지? 다크테마도 그렇고? 소개 콘솔도 페이지 너무 별로다"*
 *    → 시안 확정 *"개선안으로 하고 배고프다 뭐먹지?는 아예 빼기. 소개콘솔도 일단 변경은 해줘"*)
 *
 * ## 무엇이었나 (라이브 실측 · iPhone 13 390×844 · `urdeal.kr/u/jiwon1228`, 라이트·다크 렌더)
 *
 * | 자리 | 실측 | 왜 문제인가 |
 * |---|---|---|
 * | 맨 위 마퀴 띠 | `#000000` · 30px 풀블리드 | 팔레트에 없는 순수 검정(다크 바탕은 `#11141C`). 같은 문구가 세 번 반복해 흐른다 |
 * | 유어샵 카드 할인율 | **0개** | 실제 할인은 `21,700/26,000`·`35,100/41,000`·`209,000/272,000` = 17·14·23% |
 * | 순위 배지 | 사진 좌상단 흰 원 | 사진의 가장 좋은 자리를 표식이 덮는다 |
 * | 소개 콘솔 | 이모지 9 · 카드 테두리 · 강조색 3색 | 확정 디자인 시스템 정면 위반 |
 *
 * 🔑 **할인율이 0인 진짜 이유**는 오타가 아니라 **SSOT 미배선**이었다. `DealRow` 만 `priceDisplay`
 *    (`Math.max(선언값, 정가·판매가 계산값)`)를 안 거치고 `discountPct` 를 그대로 썼고, 서버
 *    `discount_rate` 가 0 으로 내려오면 `> 0` 이 거짓이라 배지가 통째로 사라졌다. **같은 상품이
 *    홈 카드에선 23% 로 떴다** — 화면마다 할인율이 다르면 버그가 아니라 거짓말이다.
 *
 * ## 이 시험이 지키는 것
 *   ① 유어샵 줄 카드가 **할인율 SSOT** 를 거친다(`DealRow` → `priceDisplay`).
 *   ② 순번이 **사진 밖**에 있다(`leading` 슬롯). 지우지는 않는다 — SNS 에서 "N번 사세요" 로 부르는 주소다.
 *   ③ `DealRow` 의 신규 슬롯 둘(`leading`·`thumbSize:'lg'`)이 **선택**이라 나머지 5개 화면이 안 바뀐다.
 *   ④ 소개 콘솔에 **이모지 0 · 카드 테두리 0 · 색깔 정보상자 0**.
 *   ⑤ 소개 콘솔이 마이와 **같은 목록 문법**(`GroupLabel`/`ListPlate`/`ListRow`)을 쓴다.
 *   ⑥ 영입 매장 줄에 **`공구 대행 등록` 버튼이 없다**(2026-09-29 대표 확정 — 물었더니 "아니").
 *
 * ## ⚠️ 이 시험이 **못** 하는 것
 *   - **픽셀은 못 잰다.** jsdom 엔 레이아웃이 없다 — "사진이 실제로 커 보이는가", "줄이 안 넘치는가"는
 *     브라우저 프레임 캡처가 판정한다(이 파일은 *클래스·배선이 붙어 있는가*까지).
 *   - 할인율이 **화면에 실제로 렌더되는지**는 서버 값에 달렸다. 여기서는 SSOT 를 거치는지만 본다.
 *   - 마퀴 제거의 짝(편집 칸 제거)은 `ushop-top-chrome-2026-09-28.test.ts` 가 본다(그 파일이
 *     원래 마퀴를 지키던 자리라, 지우지 않고 **불변식을 뒤집어 재조준**했다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const ROW = 'src/components/deal/DealRow.tsx'
const PIN = 'src/pages/curator-page/PinRow.tsx'
const CONSOLE = 'src/pages/CuratorEarningsPage.tsx'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const row = read(ROW)
const pin = read(PIN)
const console_ = read(CONSOLE)

describe('① 줄 카드가 할인율 SSOT 를 거친다', () => {
  it('측정이 비어 있지 않다', () => {
    // 0자면 통과가 아니라 고장이다 — 경로가 낡으면 아래 단언이 전부 무의미해진다.
    expect(row.length).toBeGreaterThan(1500)
    expect(console_.length).toBeGreaterThan(5000)
  })

  it('🔴 DealRow 가 priceDisplay 를 import 하고 **실제로 호출**한다', () => {
    expect(row).toContain("from '@/shared/price-display'")
    // import 만 남기고 호출을 지워도 통과하던 함정(2026-09-16 에 실제로 당했다) → 호출 형태로 앵커.
    expect(row, 'priceDisplay 호출').toMatch(/priceDisplay\(\{[^}]*original_price[^}]*discount_rate/)
  })

  it('🔴 할인율 렌더가 선언값(discountPct)이 아니라 SSOT 결과를 쓴다', () => {
    // 이게 핵심이다. `discountPct > 0` 로 되돌아가면 서버가 0 을 주는 상품에서 배지가 다시 사라진다.
    expect(row, 'SSOT 값으로 렌더').toMatch(/pd\.discount\s*>\s*0/)
    expect(row, '선언값 직접 게이트 금지').not.toMatch(/\{discountPct\s*>\s*0\s*&&/)
  })
})

describe('② 순번은 사진 밖에, 그러나 지우지 않는다', () => {
  it('🔴 PinRow 가 leading 슬롯을 쓰고 order 를 그린다', () => {
    expect(pin, 'leading 슬롯 사용').toMatch(/leading=\{/)
    expect(pin, '순번이 남아 있다 — SNS 에서 부르는 주소다').toContain('{order}')
  })

  it('🔴 순번이 사진 위 절대배치가 아니다', () => {
    // 종전: <span className="absolute top-1 left-1 … bg-white …">{order}</span>
    expect(pin, '사진 위 절대배치 배지 0개').not.toMatch(/absolute[^"]*top-1[^"]*left-1/)
  })

  it('썸네일을 키웠다 (76px)', () => {
    expect(pin).toMatch(/thumbSize="lg"/)
    expect(row, "'lg' 치수가 실제로 정의돼 있다").toContain('w-[76px] h-[76px]')
  })
})

describe('③ DealRow 의 새 슬롯은 선택 — 나머지 5개 화면이 안 바뀐다', () => {
  it('leading·thumbSize 가 옵셔널이다', () => {
    expect(row, 'leading 옵셔널').toMatch(/leading\?:\s*ReactNode/)
    expect(row, "thumbSize 에 'lg' 가 추가됐고 여전히 옵셔널").toMatch(/thumbSize\?:\s*'sm'\s*\|\s*'md'\s*\|\s*'lg'/)
  })

  it('leading 이 없으면 아무것도 안 그린다 (기본값 없음)', () => {
    // `leading = <무언가>` 로 기본값을 주면 5개 화면에 숫자 칸이 갑자기 생긴다.
    expect(row).not.toMatch(/leading\s*=\s*[^,)]/)
  })
})

describe('④ 소개 콘솔 — 확정 디자인 시스템', () => {
  it('🔴 이모지 0개', () => {
    const emoji = console_.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []
    expect(emoji, `남은 이모지: ${emoji.join(' ')}`).toHaveLength(0)
  })

  it('🔴 카드 테두리 0 (표면 규칙 ①)', () => {
    const borders = console_.match(/border border-(gray|line)[^"]*/g) || []
    expect(borders, `남은 테두리: ${borders.join(' | ')}`).toHaveLength(0)
  })

  it('🔴 색깔 정보상자 0 — 강조색은 브랜드 하나 (규칙 ②⑥)', () => {
    const tinted = console_.match(/\b(amber|emerald)-\d{2,3}/g) || []
    expect(tinted, `남은 색: ${tinted.join(' ')}`).toHaveLength(0)
  })

  it('요약은 한 판 — 주인공 숫자가 크다', () => {
    expect(console_, '34px 주인공 숫자').toContain('text-[34px]')
    expect(console_, '3열 균등 카드로 되돌아가지 않았다').not.toMatch(/grid-cols-3[^"]*"[\s\S]{0,400}card\.accent/)
  })
})

describe('⑤ 마이와 같은 목록 문법을 쓴다', () => {
  it('🔴 GroupLabel / ListPlate / ListRow 를 import 하고 렌더한다', () => {
    expect(console_).toContain("from './user-profile/list-grammar'")
    for (const tag of ['<GroupLabel>', '<ListPlate', '<ListRow']) {
      expect(console_, `${tag} 렌더`).toContain(tag)
    }
  })

  it('🔴 영입 매장 줄에 공구 대행 등록 버튼이 없다 (대표 확정 — 행 안으로)', () => {
    expect(console_, '목록 안 버튼 0개').not.toMatch(/>\s*공구 대행 등록\s*</)
    // 다만 그 동작 자체는 살아 있어야 한다 — 행을 누르면 모달이 열린다.
    expect(console_, '모달은 그대로').toContain('<ProxyProductModal')
  })
})
