/**
 * 🏪 `/store/new` 매장 등록 — 대표 신고 2건의 회귀 가드 (2026-09-07)
 *
 * 대표가 PC 다크모드에서 `/store/new` 를 열고 두 가지를 신고했다:
 *   ① *"글자도 지금 흰색이라 보이지 않아"* — 검색창에 친 글자가 안 보였다.
 *   ② *"흰 섹션 바깥쪽을 클릭하니까 페이지가 꺼져"* — 폼을 채우다 배경을 누르면 화면을 떠났다.
 *
 * ① 은 이 레포가 **세 번째** 당한 클래스다(2026-09-03 지도 검색창과 같은 원인). 모달 패널이
 *   `bg-white` 뿐이라 늘 흰데, 안쪽 입력은 `dark:text-white` 를 갖고 있고 전역 `.dark input`
 *   (특이도 0,5,1)이 `text-gray-900`(0,1,0)을 이긴다 ⇒ **클래스 유틸로는 못 이긴다.**
 *   유일한 처방이 `light-island`(tailwind darkMode variant 가 안쪽 `dark:` 를 통째로 끈다).
 *   ⚠️ `light-fixed` 는 가드 면제용 **주석**이라 런타임엔 아무 일도 안 한다 — 그걸로 착각하지 말 것.
 *
 * ② 는 같은 컴포넌트라도 **겹쳐 뜬 것과 페이지인 것의 닫기 의미가 다르다**는 문제다.
 *   대시보드에선 뒤에 목록이 보이니 바깥 클릭 닫기가 맞지만, `/store/new` 는 모달이 곧 페이지라
 *   배경 뒤에 아무것도 없다.
 *
 * ⚠️ 이 가드가 **못 보는 것**: 실제 렌더 후의 대비(그건 `check-dark-contrast.mjs` 가 브라우저로 잰다)와
 *   `light-island` 가 없는 다른 늘-흰 표면. 여기서 고정하는 것은 이 두 파일의 배선뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const MODAL = 'src/components/seller/StoreRegisterModal.tsx'
const PAGE = 'src/pages/StoreClaimPage.tsx'
const read = (p: string) => readFileSync(p, 'utf-8')

describe('/store/new 매장 등록 — 2026-09-07 대표 신고 회귀 가드', () => {
  it('① 늘-흰 패널에 light-island 가 실제 className 으로 붙어 있다 (주석 아님)', () => {
    // 🩸 **주석을 먼저 걷는다.** 지키려는 것은 *"주석에만 남아도 통과"* 를 막는 것이었는데, 그건
    //   리터럴 속성을 요구하는 것이 아니라 **주석을 제거하는 것**으로 지켜진다(아래 재조준 참조).
    const s = stripComments(read(MODAL))
    // 패널 = `bg-white` 를 가진 그 div 의 클래스 문자열. 같은 요소에 light-island 가 있어야 안쪽 `dark:` 가 꺼진다.
    // 🩸 2026-09-07 (병합): 이 파일에 늘-흰 패널이 **둘**이 됐다(등록 폼 + 409 안내 화면).
    //   원래 `.find()` 로 **첫 하나만** 봤는데, 그러면 나중에 추가된 패널은 보호 없이 지나간다 —
    //   실제로 409 화면이 light-island 없이 들어왔다. ⇒ 전부 검사한다.
    // 🩸 2026-09-23 재조준: 여기 원래 `className="…"` **리터럴 속성**을 요구했는데, 그날 안 B(PC 2단)가
    //   패널 클래스를 `panelCls` 변수로 옮기자(overlay ↔ page 두 벌) 빨간불이 났다. **방어가 사라진 게
    //   아니라 자리를 옮긴 것**이었다 — 리터럴 속성은 이 불변식의 *한 가지 구현*이지 불변식 자체가 아니다.
    //   ⇒ 판정을 "리터럴 속성인가" → **"그 문자열이 실제로 className 에 닿는가"** 로 바꾼다.
    //   (패널이 넷으로 늘었다: 등록 폼 × {overlay, page} · 409 안내 × {overlay, page}.)
    const panels = s.split('\n').filter(l => l.includes('bg-white') && (l.includes('sm:max-w-lg') || l.includes('rounded-2xl shadow-lift')))
    expect(panels.length, `${MODAL} 의 흰 패널을 못 찾았다 — 앵커가 낡았다`).toBeGreaterThanOrEqual(4)
    for (const panel of panels) {
      expect(panel, '흰 패널에 light-island 가 없다 — 다크에서 흰 글자가 된다').toContain('light-island')
      // 클래스 문자열(따옴표 안)이어야 한다 — 맨 코드에 떠 있는 토큰은 런타임에 아무 일도 안 한다.
      expect(panel).toMatch(/['"`][^'"`]*\blight-island\b/)
    }
    // 🔌 그리고 그 문자열이 **실제로 className 에 배선**돼 있어야 한다. 변수만 두고 안 쓰면 조용히 무효다.
    expect(s, 'panelCls 가 className 에 안 닿는다').toMatch(/className=\{panelCls\}/)
    expect(s, '409 안내 패널이 className 에 안 닿는다').toMatch(/className=\{asPage[\s\S]{0,200}light-island/)
  })

  it('② 배경 클릭 닫기가 dismissOnBackdrop 로 통제된다', () => {
    const s = read(MODAL)
    expect(s, 'dismissOnBackdrop prop 이 없다').toContain('dismissOnBackdrop')
    // 배경 div 의 onClick 이 무조건 onClose 면 안 된다 — 플래그를 거쳐야 한다.
    // 배경도 둘이다(폼 · 409 안내) — 하나만 보면 나머지가 조용히 새 사고를 낸다.
    const backdrops: number[] = []
    for (let i = s.indexOf('fixed inset-0 z-[10500]'); i >= 0; i = s.indexOf('fixed inset-0 z-[10500]', i + 1)) backdrops.push(i)
    expect(backdrops.length, '배경 div 앵커가 낡았다').toBeGreaterThan(0)
    for (const backdrop of backdrops) {
      const near = s.slice(backdrop, backdrop + 400)
      expect(near, '배경 onClick 이 플래그를 안 거치고 바로 onClose 를 부른다')
        .not.toMatch(/onClick=\{onClose\}/)
      expect(near).toContain('dismissOnBackdrop')
    }
  })

  it('③ /store/new 는 배경 클릭으로 안 닫힌다 (모달이 곧 페이지)', () => {
    // 🩸 2026-09-23: 여기 원래 `read(PAGE)`(주석 포함)였다. 같은 날 안 B 작업이 이 페이지 주석에
    //   *"`dismissOnBackdrop={false}` 를 남겨 둔다"* 라고 **설명을 적자**, prop 을 통째로 지워도
    //   그 주석 때문에 초록이 떴다 — 주입 러너가 잡았다. 설명을 잘 적을수록 가드가 헐거워지는
    //   구조였던 것이다. ⇒ 주석을 걷고 본다(이 레포가 반복해 온 "주석에만 남아도 통과" 클래스).
    const s = stripComments(read(PAGE))
    expect(s, '페이지가 dismissOnBackdrop={false} 를 안 넘긴다').toContain('dismissOnBackdrop={false}')
  })

  it('④ ✕ 로 나갈 때 이력이 없으면 홈으로 (navigate(-1) 단독 금지)', () => {
    const s = read(PAGE)
    // 직접 주소로 열리는 페이지라 `-1` 만으로는 갈 곳이 없을 수 있다.
    expect(s, 'onClose 가 navigate(-1) 단독이다 — 직접 진입 시 갈 곳이 없다')
      .not.toContain('onClose={() => navigate(-1)}')
    expect(s, '이력 없음 폴백이 없다').toMatch(/history\.state|history\.length/)
    expect(s).toMatch(/navigate\('\/'/)
  })
})
