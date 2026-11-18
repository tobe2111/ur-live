import { describe, it, expect } from 'vitest'
import { inferSourceFromEnv } from '@/lib/acquisition'

/**
 * 📣 2026-11-18 — 인스타 프로필 링크가 `https://urdeal.kr/`(?src=ig 없음)였고 API 로 못 바꾼다.
 * 그래서 인스타·스레드 인앱 브라우저로 들어온 방문을 링크 표시 없이도 'ig'·'threads' 로 센다.
 *
 * 고정하는 것: ① 인스타 앱 UA → ig ② 스레드 앱 UA → threads(인스타 낱말이 섞여도) ③ referrer 로도
 * 판정 ④ 일반 브라우저·다른 사이트 referrer 는 null(출처를 지어내지 않는다).
 * 못 막는 것: 앱이 UA·referrer 를 바꾸면 놓친다. 그때는 판정이 null 로 떨어질 뿐 틀린 출처를 쓰진 않는다.
 */
const IG_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_0; ko_KR)'
const THREADS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BarcelonaApp 360.0 Instagram'
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

describe('inferSourceFromEnv — 링크 표시 없는 SNS 유입', () => {
  it('① 인스타 인앱 브라우저는 ig', () => {
    expect(inferSourceFromEnv(IG_UA, '')).toBe('ig')
  })
  it('② 스레드 인앱 브라우저는 threads (인스타 낱말이 섞여도)', () => {
    expect(inferSourceFromEnv(THREADS_UA, '')).toBe('threads')
  })
  it('③ referrer 로도 판정한다', () => {
    expect(inferSourceFromEnv(SAFARI, 'https://l.instagram.com/?u=https%3A%2F%2Furdeal.kr%2F')).toBe('ig')
    expect(inferSourceFromEnv(SAFARI, 'https://www.threads.net/@urdeal_official')).toBe('threads')
  })
  it('④ 일반 브라우저·다른 사이트는 null', () => {
    expect(inferSourceFromEnv(SAFARI, '')).toBeNull()
    expect(inferSourceFromEnv(SAFARI, 'https://www.google.com/')).toBeNull()
    expect(inferSourceFromEnv(SAFARI, 'https://notinstagram.com.evil.example/')).toBeNull()
    expect(inferSourceFromEnv('', 'not a url')).toBeNull()
  })
})
