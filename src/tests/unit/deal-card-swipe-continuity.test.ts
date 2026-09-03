/**
 * 🎞️ 카드 사진 넘김 — 빈 칸 없이, 보이는 카드는 다음 한 장을 미리 (2026-09-02 대표 "여기도 사진 좌우 불러오는 데 시간이 걸려").
 *
 * ## 무엇이 느렸나
 * 카드 캐러셀은 "본 장면만 받는다"(트래픽 보호, 08-19)라 다음 장은 hover/touch 뒤에야 받기 시작한다. PC 에서
 * hover→화살표 클릭이 0.3초인데 외부 CDN 콜드 리사이즈는 0.3~2초라, 클릭 순간 **이전 사진이 사라지고 회색 칸**이
 * 그 시간만큼 보였다. 늦는 것보다 *늦는 동안 아무것도 안 보이는 것*이 체감이다.
 *
 * ## 이 테스트가 지키는 것
 *   1. 그려진 장면(`painted`)만 보인다 — 새 장면이 도착하기 전엔 직전 장면이 남는다(빈 칸 0).
 *   2. 화면에 들어온 카드는 커버 로드 뒤 idle 에 다음 **한 장**만 미리 받는다(전량 X · 화면 밖 X).
 *   3. 트래픽 보호 1원칙(`seen` 밖 `<img>` 미생성)은 그대로다.
 *
 * ## 못 막는 것
 *   - 실제 브라우저의 idle 타이밍·교차 애니메이션. 배포 후 홈에서 화살표를 눌러 회색 칸이 안 뜨는지 눈으로.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const code = (p: string) =>
  readFileSync(p, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const MEDIA = code('src/components/deal/DealCardMedia.tsx')

describe('① 빈 칸 없는 넘김', () => {
  it('opacity 가 shown 이 아니라 painted(로드 완료 장면) 를 따른다', () => {
    expect(MEDIA).toMatch(/const painted = loaded\.has\(shown\) \? shown : paintedRef\.current/)
    expect(MEDIA).toMatch(/opacity: i === painted \? \(painted === shown \? 1 : 0\.65\) : 0/)
    expect(MEDIA, '옛 즉시 전환이 남아 있다 — 클릭 순간 빈 칸').not.toMatch(/opacity: i === shown \? 1 : 0/)
  })
  it('onLoad 가 loaded 집합을 채우고, 직전 장면은 로드 완료 뒤에만 painted 가 바뀐다', () => {
    expect(MEDIA).toMatch(/setLoaded\(\(prev\) => \(prev\.has\(i\) \? prev : new Set\(prev\)\.add\(i\)\)\)/)
    expect(MEDIA).toMatch(/useEffect\(\(\) => \{ if \(loaded\.has\(shown\)\) paintedRef\.current = shown \}, \[loaded, shown\]\)/)
    expect(MEDIA, '옛 imperative opacity 세팅이 남아 state 와 싸운다').not.toMatch(/el\.style\.opacity = /)
  })
})

describe('② 보이는 카드는 다음 한 장을 idle 에 미리', () => {
  it('IntersectionObserver(60%) + 커버 로드 뒤 + idle 에 prefetchNext 한 번', () => {
    const at = MEDIA.indexOf('const idleDone = useRef(false)')
    expect(at).toBeGreaterThan(0)
    const body = MEDIA.slice(at, at + 1200)
    expect(body).toMatch(/if \(!multi \|\| !coverLoaded \|\| idleDone\.current\) return/)
    expect(body).toMatch(/new IntersectionObserver\(/)
    expect(body).toMatch(/threshold: 0\.6/)
    expect(body).toMatch(/requestIdleCallback\(run/)
    expect(body).toMatch(/const run = \(\) => prefetchNext\(\)/)
    expect(MEDIA).toMatch(/const coverLoaded = loaded\.has\(0\)/)
  })
  it('prefetchNext 는 여전히 "바로 다음 한 장"만 seen 에 넣는다 (전량 프리페치 아님)', () => {
    const at = MEDIA.indexOf('const prefetchNext = useCallback(')
    const body = MEDIA.slice(at, at + 500)
    expect(body).toMatch(/const next = list\[\(at \+ 1\) % list\.length\]/)
    expect(body).not.toMatch(/for \(const/)
  })
})

describe('③ 트래픽 보호 불변', () => {
  it('seen 밖 장면은 <img> 를 만들지 않는다', () => {
    expect(MEDIA).toMatch(/if \(!seen\.has\(i\)\) return null/)
  })
})
