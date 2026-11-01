/**
 * 🖼️🔎 2026-10-12 (대표 *"모두 다 진행해줘"*) — 두 불변식.
 *
 * ## ① 상품 사진의 `alt` 은 비어 있지 않다
 * 라이브 실측(Googlebot UA): sitemap 은 상품 사진을 **`image:image` 로 359건 제출**하는데
 * `/u/:handle` 진열 **4장 전부** `alt=""` 였다 — *"이 사진을 색인해 달라"* 고 하면서 **그게
 * 무엇인지는 안 말하는** 상태다. 구글 이미지의 1순위 텍스트 신호가 `alt` 이고, 음식·딜 사진이라
 * 이미지 검색은 실제 유입 채널이다.
 *
 * 🔴 **장식 이미지의 `alt=""` 는 맞는 값이다**(마스코트가 그 예) — 비우는 것 자체가 결함이 아니다.
 * 그래서 이 가드는 *"모든 img 에 alt"* 가 아니라 **"상품 사진은 제목에서 파생한다"** 를 본다.
 *
 * ## ② 교환권 상세(`/vouchers/:id`)는 noindex 이고, 그 근거가 기록돼 있다
 * 2026-07-07 대표 결정이었는데 **근거가 어디에도 없었다**(서버는 "클라 대칭", 클라는 주석 없음).
 * 2026-10-12 에 D1 으로 재서 결정이 옳음을 확인했고(활성 2,260건 중 **할인 보유 195건 = 8.6%**,
 * 즉 91%가 정가 → 같은 SKU·같은 설명·우리만의 가격조차 없음 = thin/duplicate) 숫자를 코드에 남겼다.
 * 이 가드는 **양쪽(클라·서버)이 함께** noindex 임을 고정한다 — 한쪽만이면 신호가 갈린다.
 *
 * ## 못 보는 것
 * - `alt` 문구가 **좋은지**(사람이 읽어야 한다) · 구글 이미지가 실제로 색인하는지(외부 판정)
 * - 교환권 색인을 켤 가치가 생겼는지 — 그건 **숫자를 다시 재서 대표가 결정**할 일이다
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'

const read = (f: string) => readFileSync(f, 'utf-8')
const code = (f: string) => stripComments(read(f))

describe('🖼️ ① 상품 사진의 alt 은 제목에서 파생된다', () => {
  it('DealRow — 평범한 문자열 제목이면 alt 로 쓴다(ReactNode 면 장식으로 비운다)', () => {
    const c = code('src/components/deal/DealRow.tsx')
    expect(c).toMatch(/const autoAlt = typeof title === 'string' \? title : ''/)
    expect(c, '파생값을 계산만 하고 안 쓰면 아무것도 안 바뀐다').toMatch(/alt=\{autoAlt\}/)
    expect(c, '빈 alt 로 되돌아갔다').not.toMatch(/src=\{cfImage\(imageUrl[\s\S]{0,80}?alt=""/)
  })

  it('유어샵 진열 — React 와 워커 첫 화면이 **같은 값**을 쓴다', () => {
    // 두 벌이 갈리면 마운트 때 alt 이 바뀌는데 화면은 안 깨진다(가드가 둘을 함께 본다).
    expect(code('src/pages/curator-page/PinRow.tsx')).toMatch(/alt=\{pin\.product_name \|\| ''\}/)
    expect(code('src/worker/utils/curator-ssr-body.ts'))
      .toMatch(/alt="\$\{escAttr\(pin\.product_name \|\| ''\)\}"/)
  })

  it('워커 첫 화면의 alt 은 **이스케이프**를 지난다 (상품명은 셀러-제어 값이다)', () => {
    const c = code('src/worker/utils/curator-ssr-body.ts')
    expect(c, 'escAttr 없이 넣으면 상품명이 속성을 탈출한다').not.toMatch(/alt="\$\{pin\.product_name/)
  })

  it('장식 이미지는 계속 비어 있다 (반대 방향 — 마스코트에 상품명을 넣지 않는다)', () => {
    // 🩸 2026-10-12: 첫 판이 **헛돌았다**. ⓐ 마스코트는 `curator-ssr-body` 가 아니라 **워커의 정적
    //   로더**(`worker/index.ts`)에 있고 ⓑ 앵커를 `udal-loader`(하이픈·소문자)로 썼는데 소스는
    //   `UDAL_LOADER_SRC` 라, 그 정규식이 실제로 집은 것은 **설명 주석 한 줄**이었다 → 부정 단언이
    //   매치할 수 없어 무조건 통과. 주입이 잡았다. ⇒ 주석을 걷어낸 코드에서 **그 img 태그**를 앵커한다.
    const c = code('src/worker/index.ts')
    expect(c, '마스코트 img 자체가 사라졌다(= 이 단언이 지킬 대상이 없다)')
      .toMatch(/UDAL_LOADER_SRC\}"(?:\$\{loaderImgPriorityAttr\(cssFirst\)\})?\s+alt=""\s+aria-hidden="true"/) // 2026-10-20 우선순위 속성 보간 허용
    expect(c, '마스코트에 설명을 붙이면 스크린리더가 장식을 읽는다')
      .not.toMatch(/UDAL_LOADER_SRC\}"[^>]{0,80}alt="[^"]+"/)
  })
})

describe('🔎 ② 교환권 상세 noindex — 양쪽이 함께, 근거와 함께', () => {
  it('클라가 noindex 를 선언한다', () => {
    expect(code('src/pages/VoucherDetailPage.tsx'))
      .toMatch(/url=\{`\/vouchers\/\$\{product\.id\}`\}\s+noindex/)
  })

  it('서버도 같은 판정을 한다 (한쪽만이면 신호가 갈린다)', () => {
    const c = code('src/worker/utils/detail-ssr-meta.ts')
    expect(c).toMatch(/const isVoucher = pathname\.startsWith\('\/vouchers\/'\)/)
    // 그 분기가 **noindex 와 빈 JSON-LD 를 함께** 돌려준다 — 색인 말라면서 리치결과를 달라고 하지 않는다.
    expect(c).toMatch(/if \(isVoucher\) \{[\s\S]{0,600}?noindex: true/)
    expect(c).toMatch(/if \(isVoucher\) \{[\s\S]{0,600}?jsonLd: ''/)
  })

  it('근거가 **숫자와 함께** 기록돼 있다 (이유 없이 뒤집히지 못하게)', () => {
    const raw = read('src/pages/VoucherDetailPage.tsx')
    expect(raw, '활성 건수가 사라졌다').toContain('2,260')
    // 🔴 비율은 **각각** 단언한다. 첫 판이 `/195건|8.6%|91%/` 묶음이었는데, 측정표를 통째로 지워도
    //    아래 산문의 `91% 가 할인이 없다` 가 통과시켰다(주입이 잡았다) — 묶음은 가장 약한 항만큼만 센다.
    expect(raw, '할인 보유 건수가 사라졌다').toContain('195건')
    expect(raw, '할인 비율(이 결정의 핵심 근거)이 사라졌다').toContain('8.6%')
    expect(raw, '왜 thin 인지가 사라졌다').toMatch(/thin|duplicate|같은 SKU/)
  })

  it('sitemap 은 교환권 상세를 제출하지 않는다 (색인 말라면서 제출하지 않는다)', () => {
    const c = code('src/worker/routes/sitemap.routes.ts')
    expect(c, '교환권을 제외하는 조건이 사라졌다').toMatch(/COALESCE\(deal_only,\s*0\)\s*=\s*0/)
  })
})
