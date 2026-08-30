import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

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
 */
describe('숙소 상세 갤러리 — 다른 상세와 같은 풀블리드', () => {
  it('두 상세가 같은 갤러리 컴포넌트를 쓴다 (한쪽만 고쳐지지 않게)', () => {
    expect(read(STAY)).toMatch(/<DetailGallery\b/)
    expect(read(GB)).toMatch(/<DetailGallery\b/)
  })

  it('갤러리가 본문 여백 래퍼를 모바일에서 빠져나간다', () => {
    const s = read(STAY)
    const i = s.indexOf('<DetailGallery')
    expect(i).toBeGreaterThan(-1)
    // 갤러리를 감싼 div 는 그 바로 앞에 있다.
    const wrapper = s.lastIndexOf('<div className=', i)
    const cls = s.slice(wrapper, i)
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
    const s = read(STAY)
    const i = s.indexOf('<DetailGallery')
    const parent = s.lastIndexOf('lg:grid lg:grid-cols-', i)
    expect(parent).toBeGreaterThan(-1)
    const parentCls = s.slice(s.lastIndexOf('<div className="', parent), parent)
    expect(parentCls, '부모 패딩이 px-4 py-5 가 아니다 — 갤러리의 음수 마진도 같이 고쳐라').toMatch(/px-4 py-5/)
  })
})
