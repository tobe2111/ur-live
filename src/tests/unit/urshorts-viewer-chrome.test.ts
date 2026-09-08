/**
 * 🎬 유어쇼츠 뷰어(`/videos`) chrome — 대표 2026-09-08
 *
 * > "마우스 위아래 스크롤이나 스마트폰으로도 위아래 스와이프 되게끔 되나?
 * >  3/3 이런거 안나오면 좋겠어 지금 번잡해. 안보이게도 가능한가? 깔끔하게?"
 * > "이용권 카드도 붙혀지면 번잡해지지 않나? 확인해봐"
 *
 * ## 🔴 스와이프가 "코드는 있는데 안 되던" 이유
 * `onTouchStart/End` 가 **래퍼 div** 에 붙어 있었는데, iframe 이 `absolute inset-0` 로 화면을
 * 꽉 덮는다. 교차 출처 iframe 은 터치·휠을 자기가 먹고 부모에게 안 넘긴다 — 그래서 우리
 * 핸들러까지 이벤트가 **한 번도** 오지 않았다. 에러가 없어서 "왜 안 넘어가지" 로만 보인다.
 * ⇒ iframe **위에** 투명 층(z-10)을 깔고 거기서 받는다.
 *
 * ## 🔴 아래쪽이 겹치던 문제 (대표가 먼저 알아챘다)
 * 실측(스크린샷 DPR 1.5, 액자 430×608 CSS): 유튜브 진행 바 56px · 시간 85px ·
 * Shorts 로고 18px(아래에서). 구매 바는 `bottom-2.5` + 높이 ~66px = **10~76px** 이라
 * 로고·링크를 덮고 진행 바에 닿는다. 이용권을 붙이는 순간 세 겹이 쌓인다.
 * ⇒ `controls=0` 으로 유튜브 아래쪽 컨트롤을 안 그리게 요청한다.
 *
 * ## 이 테스트가 못 막는 것
 * - 유튜브가 `controls=0` 을 어떻게 해석하는지(상단 아이콘이 남는지)는 **유튜브가 정한다.**
 *   배포 후 눈으로 봐야 한다. 여기서는 "파라미터를 보냈는가"까지만 고정한다.
 * - 제스처가 실제 기기에서 자연스러운지(임계값 60px·쿨다운 450ms)는 손으로 만져 봐야 안다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { youTubeEmbedUrl } from '@/shared/urshorts'

const V = readCode('src/pages/VideosPage.tsx')

describe('깔끔하게 — 우리가 그리던 것 정리', () => {
  it('영상 번호(1 / 3)를 안 그린다', () => {
    expect(V, '카운터가 돌아왔다').not.toMatch(/\{idx \+ 1\} \/ \{items\.length\}/)
  })

  it('유튜브 아래쪽 컨트롤을 끄도록 요청한다', () => {
    expect(V).toMatch(/youTubeEmbedUrl\(cur\.video_id, \{ autoplay: true, controls: false \}\)/)
  })

  it('빌더가 controls=0 을 싣는다 — 그리고 기본값은 건드리지 않는다', () => {
    expect(youTubeEmbedUrl('abc', { controls: false })).toContain('controls=0')
    expect(youTubeEmbedUrl('abc')).not.toContain('controls=')
    expect(youTubeEmbedUrl('abc', { controls: true })).not.toContain('controls=')
  })
})

describe('🔴 제스처는 iframe 위에서 받는다', () => {
  it('제스처 층이 있고 iframe 보다 위다', () => {
    expect(V, '투명 층이 없다').toMatch(/className="absolute inset-0 z-10"/)
    // iframe 은 z 지정이 없어 기본 스택 — 뒤에 오는 z-10 층이 위에 온다.
    expect(V.indexOf('<iframe')).toBeLessThan(V.indexOf('absolute inset-0 z-10'))
  })

  it('그 층이 터치와 휠을 둘 다 받는다', () => {
    const layer = V.slice(V.indexOf('className="absolute inset-0 z-10"'))
    expect(layer, '스와이프').toMatch(/onTouchStart=/)
    expect(layer, '스와이프 끝').toMatch(/onTouchEnd=/)
    expect(layer, '마우스 휠').toMatch(/onWheel=/)
  })

  it('래퍼에는 터치 핸들러를 남기지 않는다 (거기선 이벤트가 안 온다)', () => {
    const wrapper = V.slice(V.indexOf('relative min-h-[100dvh]'), V.indexOf('<iframe'))
    expect(wrapper, '래퍼에 핸들러가 되살아났다').not.toMatch(/onTouch/)
  })

  it('휠에 쿨다운이 있다 — 없으면 한 번 굴려서 끝까지 넘어간다', () => {
    expect(V).toMatch(/wheelAt/)
    expect(V).toMatch(/now - wheelAt\.current </)
  })
})

describe('🔒 층 위에 남아야 하는 것', () => {
  it('닫기 버튼과 구매 바는 제스처 층보다 위다(z-20)', () => {
    expect(V, '닫기').toMatch(/absolute left-3 top-3 z-20/)
    expect(V, '구매 바').toMatch(/absolute inset-x-2\.5 bottom-2\.5 z-20/)
  })

  it('살 게 없으면 구매 바는 여전히 안 그린다', () => {
    expect(V).toMatch(/\{cur && cur\.product_id \?/)
  })
})
