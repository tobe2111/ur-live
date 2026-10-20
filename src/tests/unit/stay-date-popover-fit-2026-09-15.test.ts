/**
 * 🏨 숙소 날짜 팝오버가 화면을 넘지 않는다 (2026-09-15)
 *
 * 대표 신고: *"PC로 봤을 때 날짜 선택 창? 이 잘려보여"* — 스크린샷에서 '적용하기' 가 화면 아래로 잘려 있었다.
 *
 * ## 왜 PC 에서만 났나 (이게 이 시험의 요지다)
 * 팝오버는 `absolute` 이고 세로 제한이 `max-h-[52vh] lg:max-h-none` 이라 **PC 에서만 풀려 있었다.**
 * 보통은 넘쳐도 페이지를 스크롤해 볼 수 있으니 괜찮은데, 이 팝오버의 부모 아사이드는
 * `lg:sticky lg:top-[116px]` 다 — sticky 는 뷰포트에 고정되므로 **패널이 스크롤을 따라와서 잘린 부분에
 * 영영 도달할 수 없다.** 즉 "넘치면 스크롤" 이라는 평소의 안전판이 이 자리에서만 없다.
 *
 * ## 이 시험이 **못** 막는 것
 * 실제 픽셀은 여기서 못 잰다(jsdom 에 레이아웃이 없다). 브라우저 하네스 실측으로 확인했다:
 *   수리본  vh 1000/865/760/640 → 전부 fits·적용하기 보임 (760·640 은 달력이 안에서 스크롤)
 *   종전코드 vh 760/640        → fits:false · 적용하기 **안 보임**  ← 되돌려-검증 빨간불
 *   모바일 430×860 최악 조건    → 렌더 높이 429px 로 **종전과 동일**(cap 447 이 내용보다 커서 무해)
 * 여기서 고정하는 것은 그 실측을 성립시킨 **배선**이다 — 측정·상한·스크롤 자리·바닥값 분기.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SRC = stripComments(readFileSync('src/pages/stay-detail/StayDateGuestPicker.tsx', 'utf-8'))
const PAGE = stripComments(readFileSync('src/pages/StayDetailPage.tsx', 'utf-8'))

describe('날짜 팝오버 — 화면에 맞춘다', () => {
  it('① 부모 아사이드가 sticky 다 — 이 전제가 깨지면 이 수리의 이유도 달라진다', () => {
    // sticky 가 아니게 되면 넘쳐도 페이지 스크롤로 닿으므로, 그때는 상한을 다시 판단해야 한다.
    expect(PAGE).toMatch(/lg:sticky lg:top-\[116px\]/)
  })

  it('② PC 에서 세로 제한을 푸는 `lg:max-h-none` 이 없다 (이게 직접 원인이었다)', () => {
    expect(SRC).not.toContain('lg:max-h-none')
  })

  it('③ 트리거 아래 남은 공간을 **실제로 재서** 상한으로 쓴다', () => {
    // ⚠️ 이름 등장만 보면 안 된다 — 측정을 지워도 상수 선언·주석에 이름이 남는다.
    //    실제로 rect 를 읽어 state 에 넣는 그 한 줄을 앵커로 삼는다.
    expect(SRC).toMatch(/getBoundingClientRect\(\)\.bottom/)
    expect(SRC).toMatch(/setPopMax\(Math\.max\(/)
    // 고정 vh 로 때우면 카드 높이(각주 유무)와 뷰포트 변화를 못 따라간다
    expect(SRC).toMatch(/visualViewport\?\.height \?\? window\.innerHeight/)
  })

  it('④ 두 팝오버(날짜·인원) 모두 그 상한을 쓴다', () => {
    const applied = SRC.match(/style=\{popMax \? \{ maxHeight: popMax \} : undefined\}/g) || []
    expect(applied).toHaveLength(2)
  })

  it('⑤ 달력만 안에서 스크롤하고 헤더·푸터는 남는다 — 잘려서 못 누르던 게 그 푸터다', () => {
    expect(SRC).toMatch(/className="absolute[^"]*flex flex-col[^"]*"/)
    expect(SRC).toMatch(/grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0 overflow-y-auto/)
    // '적용하기' 가 든 줄은 줄어들면 안 된다
    expect(SRC).toMatch(/className="shrink-0 flex items-center justify-between gap-3 mt-3/)
  })

  it('⑥ 바닥값이 화면폭에 따라 갈린다 — 모바일을 종전보다 짧게 만들지 않는다', () => {
    // 모바일은 흐름 안이라 넘쳐도 스크롤로 닿는다. PC 규칙(260px)을 그대로 쓰면 카드가 화면
    // 아래쪽일 때 팝오버가 **종전(52vh)보다 짧아진다** — 고치려던 것과 반대다.
    expect(SRC).toMatch(/isDesktop\(\) \? MIN_POPOVER_H : Math\.round\(vh \* 0\.52\)/)
    expect(SRC).toMatch(/matchMedia\('\(min-width: 1024px\)'\)/)
  })

  it('⑦ 열려 있는 동안만 재고, 스크롤마다 강제 레이아웃을 돌리지 않는다', () => {
    // 이 레포가 이미 당한 클래스 — dep 없는 effect 가 매 렌더 레이아웃을 읽어 홈 부팅을 1.1초 먹었다.
    expect(SRC).toMatch(/if \(open === 'none'\) \{ setPopMax\(null\); return \}/)
    expect(SRC).toMatch(/requestAnimationFrame\(measure\)/)
    expect(SRC).toMatch(/removeEventListener\('scroll', schedule, true\)/)
    expect(SRC).toMatch(/cancelAnimationFrame\(frame\)/)
  })
})
