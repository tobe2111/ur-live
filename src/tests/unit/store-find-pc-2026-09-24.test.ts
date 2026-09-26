import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

/**
 * 🙋 내 가게 찾기(`/store/find`) — PC 2단 계약 (2026-09-24).
 *
 * 대표 *"나머지는 다 해줘"* 로 착수. 형제 `/store/new`(안 B, 09-23)와 **같은 모양**으로 맞춘 것이다.
 *
 * 고치기 전: 이 페이지는 `max-w-lg`(512px) 한 칸이었다. 2026-09-21 에 PC 액자를 벗기면서
 * (`pc-fullbleed.ts` 의 `/store/find`) 1440px 이 열렸는데 페이지가 그 폭을 안 썼다 —
 * `/store/new` 가 겪은 것과 같은 클래스다(액자를 벗긴 것이 문제가 아니라 놓을 것을 안 만든 것).
 *
 * 여기서 고정하는 것 넷:
 *   ① PC 에서 [설명 / 찾기·신청] **2열**이다. 폭 토큰은 `/store/new` 와 같은 값을 쓴다.
 *   ② **폰 화면은 늘리지 않는다** — 설명·단계·사실은 `lg:` 에서만 보인다.
 *      09-23 교훈: 폰에 설명을 다 펴면 정작 입력 칸이 첫 화면에서 사라진다.
 *   ③ 제목이 **한 층에만** 있다 — 폰은 sticky 헤더, PC 는 h1(헤더는 `lg:hidden`).
 *   ④ 이 화면이 **"바로 됩니다" 라고 말하지 않는다.** 번호 일치는 증명이 아니고 등록증은 사람이 본다
 *      (파일 머리말의 규약 · 2026-08-26 에 번호만으로 자동 승인되던 경로를 이미 한 번 막았다).
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀. jsdom 엔 레이아웃이 없다. 2열이 실제로 두 칸으로
 *    떨어지는지, 폰에서 아래가 하단 네비에 잘리지 않는지는 **브라우저 렌더**가 판정한다
 *    (1440/390 실측은 PR 본문에 기록).
 */

const visible = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PAGE = 'src/pages/StoreOwnerClaimPage.tsx'
const SIBLING = 'src/pages/StoreClaimPage.tsx'

describe('① PC 2단 — 형제 /store/new 와 같은 폭 토큰', () => {
  it('lg 에서 [설명 / 액션] 2열 그리드다', () => {
    const s = visible(PAGE)
    expect(s).toMatch(/lg:grid\b/)
    expect(s).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_460px\]/)
  })

  it('두 형제 페이지가 같은 그리드·같은 바깥 폭을 쓴다 (한 벌로 읽히게)', () => {
    // 🔑 값을 두 곳에 손으로 적어 두면 갈린다 — 갈리는 순간 두 문이 다른 제품처럼 보인다.
    //    SSOT 로 뽑을 만큼 크지 않으므로 **대조로** 묶는다(한쪽을 바꾸면 여기서 빨간불).
    for (const token of ['lg:grid-cols-[minmax(0,1fr)_460px]', 'max-w-[1180px]']) {
      expect(visible(PAGE), `${PAGE} 에 ${token}`).toContain(token)
      expect(visible(SIBLING), `${SIBLING} 에 ${token}`).toContain(token)
    }
  })

  it('PC 왼쪽 칸이 진행 단계 셋과 사실 셋을 그린다', () => {
    const s = visible(PAGE)
    expect(s).toMatch(/const STEPS = \[/)
    expect(s).toMatch(/const FACTS = \[/)
    for (const t of ['가게를 찾습니다', '사업자등록증을 확인합니다', '소유자로 등록해 드립니다']) {
      expect(s).toContain(t)
    }
    for (const t of ['등록증 1장', '사람이 확인', '이력 그대로']) expect(s).toContain(t)
  })
})

describe('② 폰 화면을 늘리지 않는다 (09-23 교훈)', () => {
  it('단계·사실 블록이 lg 전용이다', () => {
    const s = visible(PAGE)
    // STEPS 를 그리는 <ol> 과 FACTS 를 그리는 div 가 둘 다 hidden lg:flex 여야 한다.
    expect(s).toMatch(/className="hidden lg:flex[^"]*"[\s\S]{0,200}STEPS\.map/)
    expect(s).toMatch(/className="hidden lg:flex[^"]*"[\s\S]{0,200}FACTS\.map/)
  })

  it('페이지가 뷰포트 높이를 잡지 않는다 (하단 네비에 잘린다)', () => {
    // ⚠️ `\b` 로는 못 쓴다 — `min-h-[100dvh]` 의 `-h` 앞에서도 경계가 성립해 정답까지 잡는다
    //    (09-23 에 `/store/new` 테스트에서 실제로 잡혔다).
    const s = visible(PAGE)
    expect(s).not.toMatch(/(?<!min-)h-\[100dvh\]/)
    expect(s).toMatch(/min-h-\[100dvh\]/)
  })
})

describe('③ 제목이 한 층에만 있다', () => {
  it('sticky 헤더는 폰 전용이고, PC 제목은 h1 이다', () => {
    const s = visible(PAGE)
    expect(s).toMatch(/className="lg:hidden sticky top-0/)
    expect(s).toMatch(/<h1 className="hidden lg:block/)
  })

  it('뒤로 가기가 두 폭 모두에 있다 (PC 에서 헤더를 숨겼으므로)', () => {
    const s = visible(PAGE)
    // 헤더 안의 것 + PC 전용 것 = 둘.
    expect((s.match(/aria-label="뒤로"/g) || []).length).toBe(2)
    expect(s).toMatch(/className="hidden lg:flex[^"]*"[\s\S]{0,120}ChevronLeft/)
  })
})

describe('④ 심사를 숨기지 않는다 (2026-08-26 자동승인 차단의 연장)', () => {
  it('"바로" 된다고 약속하지 않는다', () => {
    const s = visible(PAGE)
    // 이 화면의 기존 문구는 오히려 반대를 말한다 — 그 문장이 살아 있어야 한다.
    expect(s).toContain('바로 넘겨드릴 수 없어요')
    expect(s).toMatch(/사람이 직접 봅니다|사람이 확인/)
  })

  it('force-light-theme 이 살아 있다 (다크에서 입력 글자가 안 보이던 사고)', () => {
    expect(visible(PAGE)).toContain('force-light-theme')
  })

  it('이 경로가 PC 액자 해제 목록에 실제로 있다 (2단의 전제)', () => {
    // 액자(430px) 안이면 2열이 펴질 자리가 없다 — 전제가 사라지면 이 PR 이 무의미해진다.
    expect(visible('src/shared/pc-fullbleed.ts')).toContain("'/store/find'")
  })
})
