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
    expect(s).toMatch(/\$\{STEP_TOTAL\}단계/)
    expect(s).toMatch(/const STEP_TOTAL = 2\b/) // 🔁 2026-11-03 대표 확정 4화면 — 질문 화면은 둘(찾기 · 이 가게로 등록)
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
  it('page 변형의 바깥 틀에 fixed inset-0 · bg-black 이 없다 (대시보드가 쓰는 모달의 page 가지)', () => {
    const s = visible(MODAL)
    const at = s.indexOf('const shellCls')
    expect(at).toBeGreaterThan(-1)
    const truthy = s.slice(at, at + 260).split('?')[1]?.split(':')[0] ?? ''
    expect(truthy).not.toContain('fixed inset-0')
    expect(truthy).not.toContain('bg-black')
  })

  it('overlay 변형은 종전 오버레이를 그대로 쓴다 (대시보드 무회귀)', () => {
    expect(visible(MODAL)).toContain('fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4')
  })
})

/**
 * 🔁 2026-11-03 재조준 — 대표 *"플로우가 이상적이지 않고 UI 도 별로야"* → 4화면 시안 확정(*"시안대로 해줘"*).
 * 종전 ④⑤ 는 "페이지가 공용 모달을 쓴다 · force-light-theme · dismissOnBackdrop" 를 고정했다. 그 셋은 모두
 * **모달이 곧 페이지였던 구조**의 방어였고, 새 흐름은 모달을 안 쓰고 다크를 따른다(대표 *"다크모드에서도 다크로"*).
 * 지키려던 뜻은 이렇게 옮겨 간다:
 *   - 서버 계약 한 벌 — 등록 API·409 분기·약관 버전은 모달과 **같은 것**을 부른다(아래 ④).
 *   - 다크에서 흰 바탕 위 흰 글자 0 — 바탕이 테마를 따르므로 입력칸에 흰 바탕을 깔지 않는다(`store-register-wizard`).
 *   - 바깥을 눌러 폼이 날아가지 않는다 — 오버레이 자체가 없다(`store-claim` ③).
 */
describe('④ 4화면 흐름이 종전 서버 계약을 그대로 쓴다', () => {
  const CONFIRM = 'src/pages/store-new/StoreConfirmStep.tsx'
  it('등록 API · 약관 버전 · 소개자 귀속 · 409 분기', () => {
    const s = visible(CONFIRM)
    expect(s).toContain("api.post('/api/seller/stores'")
    expect(s).toContain('terms_agreed_version: TERMS_CURRENT_VERSION')
    expect(s).toContain('referrer_user_id: readStoreReferrer() || undefined')
    expect(s).toMatch(/status === 409[\s\S]{0,80}STORE_EXISTS/)
    expect(s, '개인 중개 등록은 닫혀 있다 — 이 문은 direct 만').toContain("channel: 'direct'")
  })

  it('약관 동의는 버튼 아래 안내문으로 받는다 (대표 확정 "시안대로")', () => {
    const s = visible(CONFIRM)
    expect(s).toContain('누르면 판매자 이용약관에 동의')
    expect(s).toContain('/terms/seller')
  })

  it('허위 등록 경고가 약관에 실제로 있는 조치만 말한다', () => {
    const s = visible(CONFIRM)
    expect(s).toContain('승인이 거절되거나 취소돼요')
    expect(s, '약관에 없는 제재를 약속한다').not.toMatch(/정지|영구|법적 조치|고발/)
    // 근거가 약관에 살아 있어야 경고가 거짓말이 안 된다.
    expect(readFileSync('src/pages/terms/seller-terms-content.ts', 'utf8')).toContain('허위 정보가 확인되면 승인을 거절·취소')
  })

  it('첫 이용권은 판매 기간 제한이 없다 (대표 확정)', () => {
    const s = visible('src/pages/store-new/FirstVoucherPage.tsx')
    expect(s).toContain('group_buy_deadline: null')
    expect(s).toContain("api.post('/api/seller/products'")
    expect(s).toContain('voucherMinPriceError(kind, priceN)')
  })
})

describe('⑤ 수리들이 살아 있다', () => {
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

  // ⓒ(페이지 설명은 ① 단계 머리에만)은 2026-11-04 걷었다 — /store/new 가 이 모달을 쓰지 않고 자기 단계 화면
  //   (`store-new/StoreFindStep` 등)을 갖게 되어 `lead` 자리가 죽은 코드가 됐다(첫 화면 예산 회수).
})
