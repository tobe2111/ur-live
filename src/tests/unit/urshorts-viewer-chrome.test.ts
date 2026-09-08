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
import { youTubeEmbedUrl, youTubePlayerVars } from '@/shared/urshorts'

const V = readCode('src/pages/VideosPage.tsx')

describe('깔끔하게 — 우리가 그리던 것 정리', () => {
  it('영상 번호(1 / 3)를 안 그린다', () => {
    expect(V, '카운터가 돌아왔다').not.toMatch(/\{idx \+ 1\} \/ \{items\.length\}/)
  })

  it('유튜브 아래쪽 컨트롤을 끄도록 요청한다 (API 경로·폴백 둘 다)', () => {
    expect(V, 'API 경로').toMatch(/youTubePlayerVars\(\{ autoplay: true, controls: false \}\)/)
    expect(V, '폴백 iframe').toMatch(/youTubeEmbedUrl\(cur\.video_id, \{ autoplay: true, controls: false \}\)/)
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

/**
 * 🔇 **자막** — 대표 2026-09-08 *"자막이 자동으로 나오는건 변경할 수 있어?"* → *"가장 이상적으로 하자"*.
 *
 * ## 왜 파라미터로는 못 끄나
 * 유튜브 문서에 있는 건 `cc_load_policy=1`(**켜라**)뿐이다. 0 은 문서 밖 값이라 무시될 수 있고,
 * iframe 안은 교차 출처라 CSS 로도 못 건드린다. ⇒ 확실한 길은 **재생기 객체를 쥐고**
 * `unloadModule('captions')` 을 부르는 것 하나뿐이다.
 *
 * ## 이 테스트가 못 막는 것
 * - `unloadModule` 이 실제로 자막을 지웠는지는 **유튜브가 정한다.** 여기서는 "부르는가 · 한 번만
 *   부르고 끝내지 않는가"까지만 고정한다. 최종 판정은 배포 후 눈으로.
 * - 탭 일시정지가 손에 자연스러운지(임계 12px·400ms)는 만져 봐야 안다.
 */
describe('🔇 자막을 확실히 끈다', () => {
  const P = readCode('src/pages/videos/youtube-player.ts')

  it('두 세대의 자막 모듈을 **둘 다** 내린다', () => {
    expect(P).toMatch(/CAPTION_MODULES = \['captions', 'cc'\]/)
    expect(P).toMatch(/player\.unloadModule\(m\)/)
  })

  it('한 번 끄고 끝내지 않는다 — 다음 영상이 오면 유튜브가 다시 싣는다', () => {
    expect(V, 'onReady 에서').toMatch(/onReady: \(e\) => \{[\s\S]{0,80}?killCaptions\(e\.target\)/)
    expect(V, '상태가 바뀔 때마다').toMatch(/onStateChange: \(e\) => \{\s*\n\s*killCaptions\(e\.target\)/)
  })

  it('URL 쪽에도 값싼 한 겹을 둔다 (무시될 수 있지만 공짜다)', () => {
    expect(youTubeEmbedUrl('abc')).toContain('cc_load_policy=0')
  })

  it('URL 과 API 가 **같은 값**을 쓴다 — 두 벌이면 반드시 갈라진다', () => {
    const vars = youTubePlayerVars({ autoplay: true, controls: false })
    const url = youTubeEmbedUrl('abc', { autoplay: true, controls: false })
    for (const [k, v] of Object.entries(vars)) expect(url, `${k} 가 URL 에 없다`).toContain(`${k}=${v}`)
    expect(V, 'API 경로가 SSOT 를 안 쓰고 손으로 적었다').toMatch(/youTubePlayerVars\(\{ autoplay: true, controls: false \}\)/)
  })
})

describe('👆 탭 일시정지를 우리가 돌려준다', () => {
  // 🩸 처음엔 층 안에서 `/togglePlay\(\)/` 하나만 봤다. **onClick 쪽 호출에 걸려** 터치 경로를
  //    통째로 지워도 초록이 떴다 — 되돌려-검증이 잡았다. 호출 **자리**를 각각 앵커한다.
  it('터치 탭이 재생/정지를 부른다 — 그리고 스와이프를 탭으로 오인하지 않는다', () => {
    expect(V).toMatch(/Math\.abs\(dy\) < 12 && Date\.now\(\) - touchAt\.current < 400\) togglePlay\(\)/)
  })

  it('마우스 클릭도 재생/정지를 부른다', () => {
    expect(V).toMatch(/onClick=\{\(\) => \{[\s\S]{0,240}?togglePlay\(\)/)
  })

  it('터치 뒤 합성 click 을 무시한다 — 안 막으면 탭 한 번에 두 번 토글된다', () => {
    expect(V).toMatch(/Date\.now\(\) - touchEndAt\.current < 600/)
  })

  it('멈춘 것이 보인다 — controls=0 이라 유튜브가 가운데 아이콘을 안 그린다', () => {
    expect(V).toMatch(/\{paused && \(/)
    expect(V, '표시가 탭을 가로채면 다시 못 튼다').toMatch(/pointer-events-none absolute inset-0 z-10 grid place-items-center/)
  })
})

/**
 * 🛟 **API 가 안 오면 예전 방식으로 튼다.**
 * 광고 차단기·네트워크로 `iframe_api` 가 막히면 이 화면이 통째로 **검게 죽는다.**
 * 그래서 로더는 절대 reject 하지 않고 `null` 을 주며, 뷰어는 그때 고정 iframe 으로 간다.
 */
describe('🛟 재생기가 못 와도 영상은 나온다', () => {
  const P = readCode('src/pages/videos/youtube-player.ts')

  it('로더는 실패를 던지지 않는다 — 실패도 타임아웃도 null 이다', () => {
    expect(P).toMatch(/setTimeout\(\(\) => finish\(null\), timeoutMs\)/)
    expect(P).toMatch(/s\.onerror = \(\) => \{ clearTimeout\(timer\); finish\(null\) \}/)
    expect(P, 'reject 를 쓰면 호출부가 터진다').not.toMatch(/\breject\b/)
  })

  it('한 번 타임아웃해도 나중에 도착한 API 를 쓸 수 있다 (window.YT 검사가 캐시보다 앞)', () => {
    expect(P.indexOf('if (window.YT?.Player)')).toBeLessThan(P.indexOf('if (pending) return pending'))
  })

  it('뷰어가 판정 전에는 안 그린다 — 먼저 그리면 재생기가 두 번 뜬다', () => {
    expect(V).toMatch(/if \(items === null \|\| apiState === 'loading'\)/)
  })
})

/**
 * 🔁 **끝나면 다시 튼다.** 쇼츠의 기본 동작이기도 하지만, 여기서는 **방어**다 —
 * 영상이 끝나면 유튜브가 끝 화면에 관련 영상을 깔고, 그걸 누른 사람은 우리 화면을 떠난다.
 * `rel=0` 은 추천을 같은 채널로 좁힐 뿐 끝 화면 자체를 없애지 못한다.
 */
describe('🔁 끝 화면으로 사람을 뺏기지 않는다', () => {
  it('영상이 끝나면 다시 재생한다', () => {
    expect(V).toMatch(/e\.data === \(st\?\.ENDED \?\? 0\)\) \{ try \{ e\.target\.playVideo\(\)/)
  })
})
