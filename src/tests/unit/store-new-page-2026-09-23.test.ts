import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

/**
 * 🏪 매장 등록 화면(`/store/new`) — 안 B(PC 2단) 계약 (2026-09-23).
 *
 * 대표 신고 *"페이지가 불친절해 … 매장 이용권 판매 등록하기 라던지, 그런 내용이 있어야"* →
 * 시안 3안 중 **"안 B로 하자"**.
 *
 * 고치기 전: 이 페이지는 82줄이었고 화면은 `StoreRegisterModal` 한 장이었다.
 * `fixed inset-0 bg-black/40` 오버레이 위 512px 카드가 곧장 1단계 검색창을 띄운다.
 * 무엇을 등록하는지·얼마가 드는지·몇 단계인지 어디에도 없었다.
 *
 * 여기서 고정하는 것 다섯:
 *   ① 페이지가 **무엇을 등록하는 곳인지** 말한다(제목 + 한 문장 + 할 수 있는 것 3 + 사실 3).
 *   ② PC 에서 **2단**이다 — 2026-09-21 액자 해제로 생긴 빈 폭을 쓰는 것이 안 B 의 요지다.
 *   ③ 이 자리에 **검은 오버레이가 없다**. 이건 미관이 아니라 방어다(아래 ⑤ 참조).
 *   ④ 부품을 **포크하지 않는다** — 4단계 문구·검증·업로드는 대시보드와 한 벌이어야 한다.
 *   ⑤ 2026-09-07 수리 둘(`force-light-theme` · `dismissOnBackdrop={false}`)이 살아 있다.
 *
 * 🩸 **렌더해 보고서야 잡은 것 둘**(소스만 봤으면 둘 다 놓쳤다):
 *   ⓐ 폰에서 카드 아래 24px 이 **하단 네비(고정 57px) 밑으로 잘렸다** — `main` 이 이미
 *      `padding-bottom:56px` 로 그 자리를 예약하는데 페이지가 `h-[100dvh]` 를 또 얹었다.
 *      ⇒ 페이지는 높이를 정하지 않고(`min-h`), 카드가 자기 `max-h` 로 바운드한다.
 *   ⓑ **✕ 가 두 개**였다(페이지 하나, 카드 1단계 하나). page 변형은 1단계 ✕ 를 안 그린다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 실제 픽셀. jsdom 엔 레이아웃이 없다. 위 ⓐⓑ 는 브라우저
 *    실측이 잡았고(1440/390 렌더), 여기서는 그 처방이 소스에 남아 있는지만 잠근다.
 */

const visible = (p: string) => stripComments(readFileSync(p, 'utf8'))
const PAGE = 'src/pages/StoreClaimPage.tsx'
const MODAL = 'src/components/seller/StoreRegisterModal.tsx'

describe('① 페이지가 무엇을 등록하는 곳인지 말한다', () => {
  it('제목이 "매장 이용권 판매 등록" 이다', () => {
    const s = visible(PAGE)
    expect(s).toMatch(/매장 이용권[\s\S]{0,80}판매 등록/)
  })

  it('이용권이 어떻게 팔리는지 한 문장으로 설명한다', () => {
    expect(visible(PAGE)).toContain('할인가로 이용권을 미리 삽니다')
  })

  it('등록하면 할 수 있는 것 셋이 있다', () => {
    const s = visible(PAGE)
    for (const t of ['이용권을 올립니다', '주문과 정산을 한 곳에서 봅니다', '소개 코드를 받습니다']) {
      expect(s).toContain(t)
    }
  })

  /**
   * 🔁 2026-10-10 재조준 — 여기 `'사진 1장'` 을 요구했는데, 등록증은 2026-09-21 부터 **선택**이다.
   *   그 문구가 필수처럼 읽혀 사장님이 등록증 없이는 못 하는 줄 알았다(가입 흐름 점검 문제 6).
   *   지키는 것은 그대로 *"비용·준비물·단계 수를 말한다"* 이고, 준비물은 **선택이라고** 말해야 맞다.
   */
  it('비용·준비물·단계 수를 숫자로 말한다 (등록증은 선택이라고)', () => {
    const s = visible(PAGE)
    expect(s).toContain('0원')
    // 🔁 2026-11-03: 단계 수는 손으로 적지 않는다 — 위저드가 내보내는 값을 쓴다(운영 방식 단계가 스위치로 빠졌다).
    expect(s).toMatch(/\$\{STORE_REGISTER_STEP_COUNT\}단계/)
    expect(s, '등록증이 필수처럼 읽힌다 — 2026-09-21 부터 선택이다').not.toContain('사진 1장')
    expect(s).toMatch(/사업자등록증[\s\S]{0,40}(선택|나중에)/)
  })

  it('🔴 수수료율을 숫자로 약속하지 않는다', () => {
    // 채널별 요율(직접 10% / 중개 5%)을 라이브 실측하지 않았다. 틀린 숫자는 사장님에게 한 약속이 된다.
    // "팔릴 때만 수수료가 나갑니다" 류는 요율이 무엇이든 참이라 안전하다.
    expect(visible(PAGE)).not.toMatch(/수수료[\s\S]{0,40}\d+\s*%/)
  })
})

describe('② PC 에서 2단으로 편다 (안 B 의 요지)', () => {
  it('lg 에서 [설명 / 카드] 2열 그리드다', () => {
    const s = visible(PAGE)
    expect(s).toMatch(/lg:grid\b/)
    expect(s).toMatch(/lg:grid-cols-\[minmax\(0,1fr\)_460px\]/)
  })

  it('한 벌의 마크업이 두 폭을 모두 담당한다 (PC 전용 페이지를 따로 만들지 않는다)', () => {
    // 두 벌이 되면 문구가 갈린다. 폰/PC 차이는 반응형 클래스로만.
    expect(visible(PAGE)).not.toMatch(/StoreClaimPagePc|PcStoreClaim/)
  })
})

describe('③ 이 자리에 검은 오버레이가 없다', () => {
  it('페이지가 variant="page" 로 렌더한다', () => {
    expect(visible(PAGE)).toMatch(/variant="page"/)
  })

  it('page 변형의 바깥 틀에 fixed inset-0 · bg-black 이 없다', () => {
    const s = visible(MODAL)
    const at = s.indexOf('const shellCls')
    expect(at).toBeGreaterThan(-1)
    // asPage 쪽 값(삼항의 참 가지)만 본다 — 거짓 가지는 오버레이 그대로여야 맞다.
    const truthy = s.slice(at, at + 260).split('?')[1]?.split(':')[0] ?? ''
    expect(truthy).not.toContain('fixed inset-0')
    expect(truthy).not.toContain('bg-black')
  })

  it('overlay 변형은 종전 오버레이를 그대로 쓴다 (대시보드 무회귀)', () => {
    expect(visible(MODAL)).toContain('fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4')
  })
})

describe('④ 부품을 포크하지 않는다', () => {
  it('페이지가 공용 StoreRegisterModal 을 쓴다', () => {
    expect(visible(PAGE)).toMatch(/<StoreRegisterModal\b/)
  })

  it('4단계 질문이 모달 한 곳에만 있다', () => {
    // 페이지가 단계 문구를 스스로 갖기 시작하면 그날부터 두 벌이 갈린다.
    expect(visible(PAGE)).not.toContain('내 매장을 찾아주세요')
    expect(visible(MODAL)).toContain('내 매장을 찾아주세요')
  })
})

describe('⑤ 2026-09-07 수리 둘이 살아 있다', () => {
  it('루트에 force-light-theme 이 있다 (다크에서 입력 글자 1.09:1 사고)', () => {
    expect(visible(PAGE)).toContain('force-light-theme')
  })

  it('dismissOnBackdrop={false} 가 남아 있다 (바깥 클릭이 폼을 날리던 사고)', () => {
    // page 에는 배경이 없어 구조적으로 못 닫히지만, variant 를 되돌리는 날 이 한 줄이 다시 막는다.
    expect(visible(PAGE)).toContain('dismissOnBackdrop={false}')
  })

  it('모달 패널이 light-island 를 유지한다 (모든 호출부를 덮는 방어)', () => {
    const s = visible(MODAL)
    expect(s.match(/light-island/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

describe('⑥ 렌더 실측이 잡은 결함의 처방 (2026-11-03 재조준 — 폰 전체 화면 위저드)', () => {
  /**
   * 🔁 2026-11-03 (대표 *"플로우가 이상적이지 않고 UI 도 별로야"*): 2026-09-23 처방은 하단 탭이 **있는** 전제였다
   *   ("main 이 56px 를 예약하니 100dvh 를 얹으면 잘린다"). 그 전제 때문에 [다음] 버튼이 첫 화면 밖·탭 뒤에 있었다.
   *   이제 `/store/new` 는 탭을 숨기는 전체 화면이고, 그래서 페이지가 화면 높이를 잡아 버튼을 늘 바닥에 둔다.
   */
  it('ⓐ /store/new 는 소비자 하단 탭을 숨긴다 — 그래서 페이지가 화면 높이를 잡아도 잘리지 않는다', async () => {
    const { consumerChromeHiddenByPath } = await import('@/lib/consumer-chrome')
    expect(consumerChromeHiddenByPath('/store/new')).toBe(true)
    expect(consumerChromeHiddenByPath('/store/find')).toBe(false) // 정확히 그 주소만
    expect(visible(PAGE)).toMatch(/\bh-dvh\b/)
  })

  it('ⓐ 카드가 높이를 바운드한다 (지도 단계가 0px 로 접히지 않게) — 폰은 남은 높이 전부, PC 는 고정 상한', () => {
    const s = visible(MODAL)
    const at = s.indexOf('const panelCls')
    const truthy = s.slice(at, at + 320).split('?')[1]?.split(':')[0] ?? ''
    expect(truthy).toMatch(/flex-1 min-h-0/)
    expect(s.slice(at, at + 320)).toMatch(/lg:h-\[min\(\d+px,\d+dvh\)\]/) // ':' 로 자른 truthy 에는 lg: 가 잘려 안 보인다
    // 바깥 틀도 flex 여야 flex-1 이 먹는다(첫 렌더에서 버튼이 바닥에 안 붙은 원인).
    expect(s).toMatch(/\? 'w-full flex-1 min-h-0 flex flex-col lg:block'/)
  })

  it('ⓑ 닫기 버튼은 하나 — 위저드 머리의 ✕/← 가 맡고 페이지는 따로 두지 않는다', () => {
    expect(visible(PAGE)).not.toMatch(/aria-label="닫기"/)
    expect(visible(MODAL)).toMatch(/aria-label=\{step === 0 \? '닫기' : '이전 단계'\}/)
  })

  it('ⓒ 페이지 설명은 ① 단계 머리에만 — 2~3단계에서 같은 설명이 화면 절반을 차지하지 않게', () => {
    expect(visible(MODAL)).toContain('{asPage && step === 0 && lead}')
  })
})
