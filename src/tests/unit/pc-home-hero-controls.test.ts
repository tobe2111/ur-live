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
 *   ⑤ (2026-09-06 갱신) 그 안내는 사라지고 **사진 자체가 링크**가 됐다. 사진에 대한 말이니
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

  /**
   * 🖼️ 2026-09-06 (대표 — "히어로 속 이미지 부분은 클릭이 되게 · 사진 속 딜 보기 문구는 없애줘"):
   *   **사진 자체가 링크**가 되면서 안내 문구는 사라졌다. 계약이 바뀐 것이지 약해진 게 아니다 —
   *   종전 계약(사진 위 절대배치 · 사진과 같은 자 · 갈 곳 없으면 미렌더)은 그대로 유지하고,
   *   여기에 **사진 전체를 덮는가** 와 **문구가 되살아나지 않는가** 를 더한다.
   */
  it('⑤ 사진 자체가 링크다 (안내 문구 없이)', () => {
    const link = HERO.match(/<Link\n\s+to=\{photoHref\}[\s\S]*?\/>/)?.[0]
    expect(link, '사진 위 절대배치 링크가 있어야 한다').toBeTruthy()
    // 사진과 **같은 자** — 폭·오른쪽 여백이 사진 div 와 같아야 사진 밖으로 안 나가고 덜 덮지도 않는다.
    expect(link).toMatch(/inset-y-0 w-\[46%\] lg:w-\[54%\]/)
    expect(link).toMatch(/right-\[calc\(max\(0px,\(100vw-1440px\)\/2\)\+1\.5rem\)\]/)
    expect(link).toMatch(/lg:right-\[calc\(max\(0px,\(100vw-1440px\)\/2\)\+2rem\)\]/)
    // 콘텐츠 층(z-10)이 사진 위까지 덮으므로 그보다 위여야 클릭이 통한다.
    expect(link).toMatch(/z-20/)
    // 사진이 md 부터만 보이므로 링크도 같은 중단점 — 모바일에 보이지 않는 링크를 두지 않는다.
    expect(link).toMatch(/hidden md:block/)
    // 사진에는 alt 가 없다(장식) → 링크가 이름을 갖는다.
    expect(link).toMatch(/aria-label=/)
    /* 안내 문구는 되살아나지 않는다 — 사진이 곧 그 딜이면 설명이 필요 없다.
       🩸 주석을 지운 소스로 본다. 처음엔 원문으로 검사했다가 **경위를 설명하는 내 주석**이 그 문구를
          담고 있어 빨간불이 났다. 이 레포가 이미 두 번 기록한 함정인데 세 번째로 밟았다. */
    const HERO_CODE = HERO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(HERO_CODE).not.toContain('사진 속 딜 보기')
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
