import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🔠📐 마이의 **타입 스케일 여섯 단계 + 4px 격자** (2026-09-28 — 대표 *"디자인, ui 모두 별로야.
 *   대기업수준이 필요해"*).
 *
 * ## 무엇이 잘못됐었나 (세어 본 값)
 * 마이 한 화면에 글자 크기가 **17단계**였다:
 *   `9 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 15 · 16 · 17 · 18 · 25 · 28 · 30px`
 * 그리고 간격에 **반쪽 값이 115건**(`mt-0.5`=2px · `px-3.5`=14px · `py-3.5`=14px · `mb-1.5`=6px …).
 * 12 와 12.5 와 13 이 한 화면에 같이 있으면 **어느 두 줄도 서로 동의하지 않는다** — 개별 결함이
 * 아니라 그것 자체가 "덜 만든 화면" 의 인상을 만든다. 대기업 앱은 대개 5~6단계로 끝낸다.
 *
 * ## 정본
 * | px | 자리 |
 * |---|---|
 * | **28** | 큰 숫자(오늘 매출 · KPI) — 규칙 ③ *숫자가 주인공* |
 * | **24** | 큰 제목(다른 표면). 🔁 2026-09-30 부터 **마이의 구역 제목은 17** 이다 — 대표가 같은 것을 두 번 지적했다(규칙 ⑦). |
 * | **17** | 사람 이름 · 시트 제목 · 중간 숫자 |
 * | **15** | 목록 행 제목 · 블록 라벨 · 주 버튼 |
 * | **13** | 설명 · 보조 문장 |
 * | **12** | 그룹 라벨 · 미세 라벨 (**바닥** — 이보다 작은 글자를 새로 만들지 않는다) |
 *
 * 간격은 **4의 배수**만 쓴다. 예외는 **음수 광학 보정**(`-mt-0.5` 같은 아이콘 미세 정렬)뿐이다 —
 * 그건 리듬이 아니라 한 요소를 눈으로 맞추는 일이라 격자 밖이 맞다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **인라인 style·CSS 파일의 크기값**. 여기서 보는 건 Tailwind 임의값 토큰뿐이다.
 * - 크기는 맞는데 **자리가 틀린** 경우(설명을 15 로, 제목을 13 으로). 그건 그림으로만 보인다 —
 *   `node scripts/visual-preview.mjs --route=/user/profile --stores=1`.
 * - 마이 밖 화면. 범위를 넓히려면 `SURFACES` 에 폴더를 더한다.
 */
const SURFACES = [
  'src/pages/UserProfilePage.tsx',
  ...readdirSync('src/pages/user-profile').filter(f => f.endsWith('.tsx')).map(f => `src/pages/user-profile/${f}`),
  ...readdirSync('src/pages/user-profile/seller-section').filter(f => f.endsWith('.tsx')).map(f => `src/pages/user-profile/seller-section/${f}`),
]
const SCALE = new Set(['12px', '13px', '15px', '17px', '24px', '28px'])
const read = (f: string) => codeOnly(readFileSync(f, 'utf-8'))

describe('마이 — 타입 스케일 여섯 단계', () => {
  it('🔠 `text-[Npx]` 는 28/24/17/15/13/12 뿐이다', () => {
    const bad: string[] = []
    let seen = 0
    for (const f of SURFACES) {
      for (const m of read(f).matchAll(/text-\[([0-9.]+px)\]/g)) {
        seen++
        if (!SCALE.has(m[1])) bad.push(`${f.split('/').pop()}: ${m[1]}`)
      }
    }
    expect(seen, '크기 토큰을 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(100)
    expect(bad, `스케일 밖 크기: ${[...new Set(bad)].join(' · ')}`).toEqual([])
  })

  it('🔠 tailwind 기본 단계(text-sm/lg/xs/…)를 섞지 않는다 — 두 체계가 되면 스케일이 무의미해진다', () => {
    const bad: string[] = []
    for (const f of SURFACES) {
      // ⚠️ `text-sm` 만 보고 `dark:text-sm` 을 놓치지 않도록 변형 접두사까지 허용해 찾는다.
      for (const m of read(f).matchAll(/(?:^|[\s"'`:])((?:[a-z-]+:)*text-(?:xs|sm|base|lg|xl|[2-9]xl))\b/g)) {
        bad.push(`${f.split('/').pop()}: ${m[1]}`)
      }
    }
    expect(bad, `기본 단계 사용: ${[...new Set(bad)].join(' · ')}`).toEqual([])
  })
})

describe('마이 — 간격은 4px 격자', () => {
  it('📐 반쪽 간격(`*-0.5`·`*-1.5`·`*-2.5`·`*-3.5`)이 없다 (음수 광학 보정은 예외)', () => {
    const bad: string[] = []
    let seen = 0
    for (const f of SURFACES) {
      const src = read(f)
      for (const m of src.matchAll(/(?:^|[\s"'`:])((?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|gap-x|gap-y|space-x|space-y)-\d+)(?![\w.-])/g)) seen++
      // 음수(`-mt-0.5`)는 앞 글자가 `-` 라 아래 패턴에 안 걸린다 — 의도한 예외다.
      for (const m of src.matchAll(/(?:^|[\s"'`:])((?:[a-z-]+:)*(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|gap|gap-x|gap-y|space-x|space-y)-\d+\.5)(?![\w-])/g)) {
        bad.push(`${f.split('/').pop()}: ${m[1]}`)
      }
    }
    expect(seen, '간격 토큰을 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(100)
    expect(bad, `격자 밖 간격: ${[...new Set(bad)].join(' · ')}`).toEqual([])
  })
})

describe('마이 — 강조색 면은 하나 (표면 규칙 ②)', () => {
  it('🎨 오늘 카드가 파란 밴드를 도로 쓰지 않는다 — 바로 아래 파란 사용처리 면과 둘이 된다', () => {
    const seller = read('src/pages/user-profile/SellerSection.tsx')
    expect(seller, '오늘 카드가 TicketCard(파란 밴드)로 돌아갔다').not.toContain('<TicketCard')
    // 사용처리 = 이 화면의 **유일한** 브랜드 면. 사라지면 강조가 아예 없어진다.
    expect(seller).toMatch(/bg-brand text-white[\s\S]{0,400}이용권 사용처리/)
  })

  /**
   * 🔁 2026-09-29 재조준(안 C) — 딜 잔액이 **별도 카드**(`TeamPointsCard`)에서 상단 **숫자 한 줄**로
   * 옮겨갔다. 09-28 의 결함("어디에도 안 속한 채 떠 있는 44px 바")은 그 줄 안에 들어가면서
   * 구조적으로 사라진다. 지금 지킬 것은 **그 줄이 다시 카드로 떨어져 나가지 않는 것**이다.
   */
  it('🏷️ 딜 잔액이 고아 카드로 다시 떨어져 나가지 않는다', () => {
    const stats = read('src/pages/user-profile/MyStats.tsx')
    // 구분선으로 나눈 한 줄 — 판(`shadow-lift`)이 되는 순간 다시 떠 있는 카드가 된다.
    expect(stats).toMatch(/flex items-start divide-x divide-rule/)
    expect(stats, '숫자 줄이 다시 판이 됐다').not.toContain('shadow-lift')
    expect(stats).toContain('label="내 딜"')
  })
})
