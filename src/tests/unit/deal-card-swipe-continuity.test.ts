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
    expect(MEDIA).toMatch(/opacity: i === painted \? \(waiting \? 0\.8 : 1\) : 0/)
    expect(MEDIA, '옛 즉시 전환이 남아 있다 — 클릭 순간 빈 칸').not.toMatch(/opacity: i === shown \? 1 : 0/)
    // 🩸 2026-09-06: 어둡게만 하는 건 신호가 아니다(대표 "이전 사진과 똑같이 나온다").
    //   받는 중인 것을 **흐림**으로 알린다 — 밝은 사진에서도 0ms 에 읽힌다.
    expect(MEDIA, '받는 중 표시(블러)가 사라졌다 — 직전 사진이 선명해 안 넘어간 것으로 보인다')
      .toMatch(/filter: i === painted && waiting \? 'blur\(10px\)' : 'blur\(0px\)'/)
    expect(MEDIA, 'waiting 판정이 사라졌다').toMatch(/const waiting = painted !== shown/)
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
    // ⏱️ 2026-09-06: 화면에 **닿기 전**부터 받는다. 받는 장수는 그대로(카드당 1장) — 시점만 앞당겼다.
    //   되돌아가면 스크롤해서 만난 카드를 바로 넘길 때 4~5초를 정면으로 맞는다(4G 실측).
    expect(body, '관측 여백이 사라졌다 — 카드가 화면에 다 들어온 뒤에야 받기 시작한다').toMatch(/rootMargin: '400px'/)
    expect(body, 'idle 대기가 다시 길어졌다').toMatch(/timeout: 800/)
    // 👁️ 머문 카드만 받는다 — 스쳐 지나간 카드는 타이머가 취소돼 한 장도 안 받는다.
    //   이게 빠지면 "일찍 받기"의 트래픽 비용(+27% 실측)이 빠른 스크롤에서도 그대로 나간다.
    expect(body, '머문-시간 게이트가 사라졌다 — 스쳐 간 카드까지 받는다').toMatch(/setTimeout\([\s\S]{0,400}?DWELL_MS\)/)
    expect(body, '화면을 벗어날 때 예약을 취소하지 않는다').toMatch(/clearTimeout\(dwell\)/)
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
