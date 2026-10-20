import { describe, it, expect } from 'vitest'
import { sanitizeLeadHandle, deriveNaverCafeHandle, looksLikeHostOrScheme } from '@/features/marketing/api/influencer-handle'

/**
 * 🚧 저장 직전 핸들 정규화 — **손상 핸들이 다시 만들어지지 못하게** 고정한다.
 *
 *   2026-07-28 에 손상 핸들 12,357건(네이버 블로거의 44%)을 복구했다(#822). 당시 원인은
 *   "이미 고쳐진 파서"로 정리됐지만, 2026-07-29 에 **생성 경로가 아직 열려 있음**을 코드로 재현했다.
 *   아래 케이스는 전부 그 재현을 그대로 옮긴 것이다 — 회귀하면 여기서 빨강이 뜬다.
 *
 *   ⚠️ 이 테스트가 못 막는 것: 파서(`influencer-discovery.ts`)가 handle 을 어떻게 뽑는지 자체는
 *   검사하지 않는다. 저장 지점의 방어만 고정한다(그게 모든 리드가 지나는 유일한 관문이라 그렇다).
 */
describe('sanitizeLeadHandle — 손상 핸들 생성 차단', () => {
  it('정상 네이버 블로그 id 는 그대로 둔다', () => {
    expect(sanitizeLeadHandle('naver_blog', { handle: 'zq333', channel_id: 'https://blog.naver.com/zq333', url: 'https://blog.naver.com/zq333' })).toBe('zq333')
  })

  it('블로그 파서가 남긴 스킴 조각을 채널 URL 에서 되살린다', () => {
    // 파서가 'https:' 를 남겨도 channel_id 로 복구 — 버리지 않는다.
    expect(sanitizeLeadHandle('naver_blog', { handle: 'https:', channel_id: 'https://blog.naver.com/zq333' })).toBe('zq333')
  })

  it('외부 블로그(티스토리 등)는 네이버 핸들이 없으므로 null', () => {
    // 네이버 블로그 검색은 외부 블로그도 돌려준다 — 추측해서 채우지 않는다.
    expect(sanitizeLeadHandle('naver_blog', { handle: 'https:', channel_id: 'https://someblog.tistory.com/12' })).toBeNull()
  })

  it('카페 파서에 블로그 URL 이 들어와도 호스트를 핸들로 쓰지 않는다 (12,357건 손상과 같은 문자열)', () => {
    expect(sanitizeLeadHandle('naver_cafe', { handle: 'blog.naver.com', channel_id: 'https://blog.naver.com/zq333' })).toBeNull()
  })

  it('카페 파서에 외부 URL 이 들어오면 호스트가 아니라 null', () => {
    expect(sanitizeLeadHandle('naver_cafe', { handle: 'someblog.tistory.com', channel_id: 'https://someblog.tistory.com/12' })).toBeNull()
  })

  it('정상 카페 id 는 살린다', () => {
    expect(deriveNaverCafeHandle({ handle: '', channel_id: 'https://cafe.naver.com/mycafe' })).toBe('mycafe')
    expect(sanitizeLeadHandle('naver_cafe', { handle: 'mycafe', channel_id: 'https://cafe.naver.com/mycafe' })).toBe('mycafe')
  })

  it('유튜브 핸들의 마침표는 손상이 아니다 — 지우면 안 된다', () => {
    // YouTube @핸들은 마침표를 허용한다. "점이 있으면 호스트"로 보면 정상 핸들이 날아간다.
    expect(sanitizeLeadHandle('youtube', { handle: '@foo.bar', channel_id: 'UC123' })).toBe('@foo.bar')
    expect(looksLikeHostOrScheme('@foo.bar')).toBe(false)
  })

  it('호스트/스킴 판정은 좁게 — 도메인 꼴과 경로/스킴만', () => {
    expect(looksLikeHostOrScheme('https:')).toBe(true)
    expect(looksLikeHostOrScheme('blog.naver.com')).toBe(true)
    expect(looksLikeHostOrScheme('www.example.co')).toBe(true)
    expect(looksLikeHostOrScheme('blog.naver.com/zq333')).toBe(true)
    expect(looksLikeHostOrScheme('zq333')).toBe(false)
    expect(looksLikeHostOrScheme('')).toBe(false)
  })

  it('빈 핸들은 null (빈 문자열로 저장하지 않는다)', () => {
    expect(sanitizeLeadHandle('youtube', { handle: '', channel_id: 'UC123' })).toBeNull()
    expect(sanitizeLeadHandle('youtube', { handle: null, channel_id: 'UC123' })).toBeNull()
  })
})
