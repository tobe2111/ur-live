/**
 * 🎫 2026-09-03 — PC 홈 히어로 컨트롤 위계 (대표 확정 "3 · 흰 면 · 한 단계 작게")
 *
 * 배경(대표 신고 "여기 버튼들도 시안 받아볼 수 있을까? 지금 AI 느낌 나서"): 히어로 색면 위에
 * 같은 무게의 반투명 알약이 **넷**이었다 — [전국 ⌄][현 위치로 설정][지도에서 가까운 딜 보기 →]
 * [사진 속 딜 보기 →]. 넷 다 테두리 알약, 셋이 연속으로 위치 아이콘, 화살표 둘, 브랜드 블루 0.
 * "AI 느낌"의 정체는 색이 아니라 **위계 부재**였다: 무엇을 먼저 누르라는 신호가 없다.
 *
 * 확정안:
 *   ① 위치는 **한 알약 안 두 칸**(지역 고르기 | 현 위치) — 하나의 일을 알약 둘로 쪼개지 않는다.
 *   ② 그 알약은 **흰 면**(잉크/사진 위에서 반투명 유리는 형태가 흐려진다) + 그림자 없음.
 *   ③ 높이는 주 버튼보다 **한 단계 낮다**(32 < 38) — 흰 칩은 "지금 어디를 보는가" 표지판,
 *      블루는 "여기를 눌러라" 행동. 같은 높이면 가장 밝은 흰 덩어리가 주 행동을 이긴다.
 *   ④ 주 행동은 **브랜드 블루 면** 하나뿐이고 화살표를 달지 않는다(면 자체가 행동을 말한다).
 *   ⑤ "사진 속 딜 보기"는 컨트롤 행에서 빠져 **사진 위 오른쪽 아래**로 — 사진에 대한 말이니
 *      사진 위에 있어야 하고, 컨트롤 행에서 주 행동과 경쟁하지 않는다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 렌더 픽셀(폰트 로딩·사진 밝기에 따른 대비)과 `panel`/`title`
 *   tone 의 시각. 여기서 고정하는 것은 **소스가 선언한 위계**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const BAR = readFileSync('src/pages/pc-home/PcHomeLocationBar.tsx', 'utf8')
const HERO = readFileSync('src/components/home/HomeHeroDefault.tsx', 'utf8')

describe('PC 홈 히어로 컨트롤 위계 (2026-09-03 대표 확정)', () => {
  it('① 히어로 tone 의 위치 컨트롤은 한 알약 안 두 칸이다 (칩 둘로 쪼개지 않는다)', () => {
    // 감싼 컨테이너가 hero 일 때 하나의 알약: items-stretch + rounded-full + overflow-hidden.
    expect(BAR).toMatch(/hero\s*\n?\s*\?\s*'inline-flex items-stretch h-8 rounded-full overflow-hidden bg-white/)
    // 두 칸을 가르는 실선이 있어야 "다른 일"임이 보인다.
    expect(BAR).toMatch(/\{hero && <span className="w-px [^"]*bg-\[rgb\(22_24_28\/0\.13\)\]"/)
  })

  it('② 흰 면이다 — 반투명 유리 칩(bg-white/10 류)으로 되돌아가지 않는다', () => {
    const heroContainer = BAR.match(/hero\s*\n?\s*\?\s*'inline-flex items-stretch[^']*'/)?.[0] || ''
    expect(heroContainer).toContain('bg-white')
    expect(heroContainer).not.toMatch(/bg-white\/\d/)
    expect(heroContainer).not.toContain('backdrop-blur')
    // 그림자를 달면 표지판이 아니라 또 하나의 떠 있는 물체가 된다.
    expect(heroContainer).not.toContain('shadow')
  })

  it('③ 흰 칩(32)이 블루 주 버튼(38)보다 한 단계 낮다', () => {
    expect(BAR).toMatch(/inline-flex items-stretch h-8 rounded-full/)   // 32px
    expect(HERO).toMatch(/h-\[38px\][^"]*bg-brand/)                      // 38px
  })

  it('④ 주 행동은 브랜드 블루 면 하나이고 화살표를 달지 않는다', () => {
    const primary = HERO.match(/className="inline-flex items-center shrink-0 h-\[38px\][^"]*"/)?.[0] || ''
    expect(primary).toContain('bg-brand')
    expect(primary).toContain('text-white')
    // 고스트/테두리 알약으로 되돌아가면 위계가 다시 평평해진다.
    expect(primary).not.toContain('border')
    // 화살표 아이콘·글리프 금지(면 자체가 행동이다).
    expect(HERO).not.toContain('ArrowRight')
    expect(HERO).not.toContain('지도에서 가까운 딜 보기')
  })

  it('⑤ "사진 속 딜 보기"는 컨트롤 행이 아니라 사진 위 오른쪽 아래에 있다', () => {
    /* 🩸 2026-09-03: 이 검사는 처음에 `right-5` 를 **문자 그대로** 박아 놨다가, 같은 날 사진을
       매대 폭에 맞추면서 스스로 깨졌다. 좌표 literal 은 계약이 아니다 — 계약은 "사진 위 우하단"이고,
       그건 ⓐ 사진 위 절대배치 ⓑ 오른쪽 끝이 **사진과 같은 자**(그래야 사진 밖으로 안 나간다) 둘이다. */
    const link = HERO.match(/className="absolute z-20 bottom-3 [^"]*"/)?.[0]
    expect(link, '사진 위 절대배치 링크가 있어야 한다').toBeTruthy()
    // 사진과 같은 컨테이너 정렬을 써야 한다 — 안 그러면 넓은 화면에서 사진 밖에 뜬다.
    expect(link).toMatch(/right-\[calc\(max\(0px,\(100vw-1440px\)\/2\)/)
    expect(HERO).toContain('사진 속 딜 보기 →')
    // 사진이 없거나 사진 목적지가 지도와 같으면(주 버튼과 중복) 렌더하지 않는다.
    expect(HERO).toMatch(/hasMedia && photoHref !== '\/map'/)
  })

  it('⑥ panel / title tone 은 이번 변경에 안 딸려갔다 (모바일 홈·흰 패널 회귀 방지)', () => {
    // title tone(모바일 홈 상단)의 큰 지역명 트리거가 그대로 있어야 한다.
    expect(BAR).toContain("text-[22px] font-black tracking-[-0.02em]")
    // panel tone 의 테두리 칩 규약 유지.
    expect(BAR).toMatch(/rounded-xl border transition-colors \$\{chip\}/)
    // 라벨 문자열은 소스에 남는다 — aria-label 과 panel tone 이 함께 쓴다.
    expect(BAR).toContain('현 위치로 설정')
  })
})
