import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { STAY_HEAD, STAY_GRID } from '@/shared/stay-head'

const STAY = 'src/pages/StayDetailPage.tsx'
const GB = 'src/pages/GroupBuyDetailPage.tsx'
const read = (p: string) => fs.readFileSync(p, 'utf8')

/**
 * 📱 숙소 상세 사진은 다른 상세와 **같이** 풀블리드여야 한다
 *   (2026-08-30 대표 — "숙소 상세페이지의 사진만 여백이 있어").
 *
 * **무엇이 문제였나**: 숙소는 갤러리를 본문과 같은 `px-4 py-5` 래퍼 **안**에 두고 있었다.
 * 같은 `DetailGallery` 를 쓰는데도 모바일에서 사진만 들여쓰기가 됐다.
 * 라이브 실측(390px): 공구 `x[0..390] top=0` ↔ 숙소 `x[16..374] top=20`.
 *
 * 🔁 **숙소는 상세 개선에서 반복적으로 빠진다.** 2026-08-19 에도 같은 이유로 고쳤고
 *   (그때 대표: *"이런 개선은 다른 카테고리와 함께 개선이 되어야 해"*), 그 수리가 제목·갤러리는
 *   맞췄지만 **바깥 여백은 못 맞췄다.** 그래서 이 테스트가 있다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 픽셀은 안 잰다(소스 모양만). 좌표 회귀는 브라우저 실측이
 *    유일한 판정이다 — 수리 시 로컬 빌드에 라이브 API 를 물려 `x[0..390] top=0` 를 확인했다.
 *
 * 🔀 **2026-10-12 재조준**: 서버 첫 화면(`stay-detail-ssr-body`)이 생기면서 치수 클래스가
 *    `shared/stay-head.ts`(SSOT)로 옮겨갔다 — 화면과 워커가 **같은 상수**를 쓴다. 지키려던 불변식은
 *    그대로이므로(음수 마진 ↔ 부모 패딩이 짝이다 · 사진 아래 제목에 위 여백이 있다) **앵커만** 옮긴다.
 *    페이지가 그 상수를 실제로 쓰는지도 함께 본다 — SSOT 가 맞아도 페이지가 우회하면 소용없다.
 */
describe('숙소 상세 갤러리 — 다른 상세와 같은 풀블리드', () => {
  it('두 상세가 같은 갤러리 컴포넌트를 쓴다 (한쪽만 고쳐지지 않게)', () => {
    expect(read(STAY)).toMatch(/<DetailGallery\b/)
    expect(read(GB)).toMatch(/<DetailGallery\b/)
  })

  it('사진 바로 아래 제목 블록에 위 여백이 있다', () => {
    // 🩸 2026-08-30 대표 "사진이랑 밑에 몇성급 글자 사이의 여백이 부족해".
    //    풀블리드로 만들면서 갤러리가 화면 끝까지 붙었는데, 바로 뒤 제목 블록에는 위 여백이
    //    **원래 없었다**(카드 안에 있을 땐 갤러리 자신의 여백이 대신해 줘 안 보이던 문제다).
    //    실측(390px): 사진 아래 2px → `mt-5` 적용 후 22px.
    //
    // 🩸🩸 이 검사는 처음 짰을 때 **헛돌았다**(되돌려-검증에서 잡음). 두 가지가 겹쳤다:
    //    ① 앵커를 `indexOf('lg:hidden">')` 로 잡았는데 그건 **뒤로가기 버튼**에 먼저 걸린다.
    //    ② 정규식 `\bmt-5\b` 가 갤러리의 **음수** 마진 `-mt-5` 에도 매치된다(`-` 앞이 단어경계).
    //    ⇒ 배지 라벨(`propertyTypeLabel`)로 그 블록을 직접 앵커하고, 음수는 명시적으로 배제한다.
    //    ⚠️ 이 검사는 클래스만 본다 — 실제 픽셀은 브라우저로 재야 한다.
    // 🔀 클래스는 SSOT 에 있다. 페이지가 그걸 쓰는지도 같이 본다(우회하면 SSOT 가 맞아도 소용없다).
    expect(read(STAY), '제목 블록이 SSOT 를 안 쓴다').toContain('className={STAY_HEAD.titleBlock}')
    expect(STAY_HEAD.titleBlock, '모바일 전용 표식이 사라졌다').toContain('lg:hidden')
    expect(STAY_HEAD.titleBlock, '사진 바로 아래 제목 블록에 위 여백이 없다 — 사진과 배지가 붙는다')
      .toMatch(/(^|\s)mt-5\b/)
  })

  it('갤러리가 본문 여백 래퍼를 모바일에서 빠져나간다', () => {
    const s = read(STAY)
    expect(s.indexOf('<DetailGallery')).toBeGreaterThan(-1)
    expect(s, '갤러리 래퍼가 SSOT 를 안 쓴다').toContain('className={STAY_HEAD.heroWrap}')
    const cls = STAY_HEAD.heroWrap
    expect(cls, '갤러리 래퍼에 음수 마진이 없다 — 사진만 들여쓰기된다').toMatch(/-mx-4/)
    expect(cls, '상단 여백도 빠져나가야 한다').toMatch(/-mt-5/)
    // PC 에서는 되돌린다 — 좌측 컬럼 안 카드로 떠 있어야 한다.
    expect(cls).toMatch(/lg:mx-0/)
    expect(cls).toMatch(/lg:mt-0/)
  })

  /**
   * 음수 마진은 **부모의 패딩과 짝**이다. 부모 패딩이 바뀌면 이 값도 같이 바뀌어야 하는데,
   * 그걸 잊으면 사진이 반대로 화면을 삐져나간다(가로 스크롤). 그래서 짝을 고정한다.
   */
  it('음수 마진이 부모 패딩과 정확히 짝이다 (px-4/py-5 ↔ -mx-4/-mt-5)', () => {
    expect(read(STAY), '본문 그리드가 SSOT 를 안 쓴다').toContain('className={STAY_GRID}')
    expect(STAY_GRID, '부모 패딩이 px-4 py-5 가 아니다 — 갤러리의 음수 마진도 같이 고쳐라').toMatch(/px-4 py-5/)
    expect(STAY_GRID, '2열 그리드가 사라졌다').toMatch(/lg:grid lg:grid-cols-/)
    // 🔑 짝: 패딩 `px-4 py-5` ↔ 음수 `-mx-4 -mt-5`. 한쪽만 바꾸면 사진이 화면을 삐져나간다.
    expect(STAY_HEAD.gridPad).toBe('px-4 py-5')
  })
})
