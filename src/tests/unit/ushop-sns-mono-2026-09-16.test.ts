/**
 * 🎨 유어샵 헤더 SNS 링크는 **잉크 한 색 글리프** (2026-09-16 — 대표 *"로고 너무 촌스러운데..??"*)
 *
 * 종전엔 브랜드 색 타일 셋이었다: 순수 빨강 `#FF0000` · 3-stop 인스타 그라디언트 · 검정 `#1D1F29`.
 * 바로 아래 '유어샵 편집' 블루 버튼까지 치면 **한 화면에 색 면이 넷**이라
 * 🎫 표면 규칙 ②("강조색 하나, 자리 셋")를 정면으로 어겼고, 인스타 타일은 ⑥("그라디언트 0")도 어겼다.
 * 그리고 순수 원색 빨강은 그 자체로 2015년쯤의 인상을 만든다.
 *
 * ⇒ 타일을 없애고 `currentColor` 글리프로. 링크는 자랑거리가 아니라 링크다 —
 *   화면의 유일한 색 면은 '유어샵 편집' 버튼 하나로 돌아온다(2026-09-02 안3 의 원래 규칙).
 *
 * ## 이 시험이 **못** 하는 것
 * "촌스러운가" 는 못 잰다. 규칙 위반(브랜드 색 면·그라디언트)이 **되돌아오는 것**만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

const SRC = readCode('src/pages/curator-page/CuratorHeader.tsx')
// SNS 블록만 본다 — 파일 전체를 보면 남의 색까지 걸린다.
// 🔧 2026-09-28 끝 마커 수리: 'SNS 편집' 은 e3 재작성(편집이 /u/me/manage 로 나감)으로 **사라졌다**.
//   `sliceFrom` 은 끝 마커가 없으면 maxLen 폴백이라, 슬라이스가 버튼 줄까지 삼켜 "SNS 자리"라는
//   범위 자체가 헐거워져 있었다. `snsLinks` 상수는 `<header` 바로 앞에서 끝난다.
const SNS = sliceFrom(SRC, "aria-label=\"YouTube\"", '<header', 3000)

describe('① 브랜드 색 면이 없다', () => {
  it('세 타일의 배경색이 사라졌다', () => {
    expect(SRC, '유튜브 순수 빨강').not.toMatch(/#FF0000/i)
    expect(SRC, '인스타 그라디언트').not.toMatch(/linear-gradient/)
    expect(SNS, 'SNS 자리에 색 면 없음').not.toMatch(/\bbg-\[#/)
  })

  it('세 링크 다 currentColor 로 그린다', () => {
    // 색을 바깥 className 이 정하므로 테마·hover 를 저절로 따라간다.
    expect(SNS.match(/currentColor/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(SNS, 'svg 안에 흰색 박기 금지').not.toMatch(/(fill|stroke)="#fff"/)
  })
})

/**
 * 🔀 2026-10-07 재조준 (대표 확정 **안 C** — 공유·관리 버튼 위계).
 *   종전엔 세 링크의 className 을 **문자열로 세 번** 적어 두고 "셋이 글자 하나까지 같은가" 를
 *   물었다. 안 C 가 그 모양을 상수 `iconBtnCls` 하나로 모았고(공유 버튼도 같은 상수를 쓴다)
 *   ⇒ **같음이 구조가 됐으므로** 질문을 "같은 문자열인가" → "같은 상수를 쓰는가" 로 옮긴다.
 *   지키려던 것(한 줄로 읽히는 같은 치수·같은 잉크 · 터치 영역 36px)은 그대로다.
 */
describe('② 세 링크가 같은 모양을 공유한다', () => {
  it('같은 치수·같은 잉크 — 상수 한 벌', () => {
    const decl = SRC.match(/const iconBtnCls = '([^']+)'/)
    expect(decl, 'iconBtnCls 선언').not.toBeNull()
    expect(decl![1], '36px 원 + 회색 잉크').toMatch(/w-9 h-9 rounded-full[\s\S]*text-gray-500 dark:text-gray-400/)
    // 셋이 **같은 상수**를 쓴다 — 문자열을 다시 적는 순간 갈린다.
    expect((SNS.match(/className=\{iconBtnCls\}/g) ?? []).length, '유튜브·인스타·틱톡 셋').toBe(3)
    expect(SNS, 'SNS 자리에 손으로 적은 치수 금지').not.toMatch(/className="w-9 h-9/)
  })

  it('공유 버튼도 SNS 와 같은 모양이다 (안 C)', () => {
    // 안 C 의 핵심: 한 줄에 모양은 **하나**, 채운 면도 **하나**(관리)뿐이다.
    const row = sliceFrom(SRC, 'onClick={onCopyLink}', '</div>', 900)
    expect(row, '공유가 같은 상수를 쓴다').toMatch(/className=\{iconBtnCls\}/)
    expect(row, '테두리 친 알약으로 되돌아가지 않는다').not.toMatch(/border-rule-strong/)
  })

  it('탭 영역이 34px 보다 줄지 않았다', () => {
    // 타일을 없애면서 터치 영역까지 없애면 접근성 회귀다 — 36px 원으로 오히려 키웠다.
    expect(SRC).toMatch(/const iconBtnCls = 'w-9 h-9/)
    expect(SRC).not.toMatch(/w-\[34px\]/)
  })
})

describe('③ SNS 는 자기 줄을 갖지 않는다', () => {
  // 🔧 2026-09-28 재조준(대표 확정 **상단 1안**): 종전 제목은 *"왼쪽 선이 위 줄과 맞는다"* 였다.
  //   그 전제는 **SNS 가 자기 줄을 갖는다**는 것이었고(그래서 `-ml-2` 로 왼쪽을 당겨 이름 줄과 선을 맞췄다),
  //   대표가 그 줄 자체를 없애라고 했다(*"SNS 로고도 말이야"* — 아이콘 둘을 위해 36px + 여백 = 48px).
  //   이제 SNS 는 이름 줄의 오른쪽 버튼 묶음에 들어가 **오른쪽 정렬**이라 맞출 왼쪽 선이 없다.
  //   ⇒ 지키려던 것(있으면 줄 맞고, 없으면 아무것도 안 그린다)을 새 구조의 말로 옮긴다.
  //      크기는 36px 그대로다 — 줄을 없앤 것이 높이를 줄인 것이고, 아이콘을 줄여서가 아니다
  //      (실측: 32px 로 줄여도 헤더 높이 92px 불변 · 얻는 건 이름 칸 12px).
  it('SNS 가 하나도 없으면 아무것도 그리지 않는다', () => {
    expect(SRC, 'hasSns 로 조건부').toMatch(/const snsLinks = hasSns \?/)
    expect(SRC, '없으면 null').toMatch(/\) : null/)
  })

  it('SNS 전용 줄이 되살아나지 않았다', () => {
    // 이 한 줄이 곧 48px 이다(아이콘 36 + pb-3 12).
    expect(SRC).not.toMatch(/-ml-2 px-4 pb-3/)
  })

  it('당김이 버튼 묶음으로 번지지 않는다', () => {
    // 버튼 묶음(ml-3)은 오른쪽 정렬이라 당기면 오히려 어긋난다.
    expect(SRC).not.toMatch(/ml-3 flex items-center gap-1\.5 shrink-0[^"]*-ml-2/)
  })
})
