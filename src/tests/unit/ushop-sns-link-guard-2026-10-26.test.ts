/**
 * 🔒 유어샵 SNS 칸은 그 플랫폼 주소·아이디만 받는다 (2026-10-26 대표
 *   *"일반 유어딜 유어샵에서도 링크 넣을 때 인스타그램이랑 유튜브 그런 것들도 되어야겠지?"*).
 * 종전 서버는 `https://` 로 시작하면 아무 주소나 받아, 인스타그램 이름표가 엉뚱한 사이트로 갈 수 있었다.
 * 판정 SSOT `shared/sns-link.ts` 를 서버 저장 · 화면 이름표 · 서버 첫 화면 · 편집 시트가 함께 쓴다.
 */
import { describe, it, expect } from 'vitest'
import { snsLinkStatus } from '@/shared/sns-link'
import { snsUrl } from '@/utils/sns-url'
import { readCode } from '../helpers/source-text'

describe('snsLinkStatus — 플랫폼별 판정', () => {
  it('아이디는 그 플랫폼 주소로 만든다', () => {
    expect(snsLinkStatus('instagram', '@urdeal')).toEqual({ kind: 'ok', url: 'https://instagram.com/urdeal' })
    expect(snsLinkStatus('youtube', 'urdeal')).toEqual({ kind: 'ok', url: 'https://youtube.com/@urdeal' })
    expect(snsLinkStatus('tiktok', 'a.b_c')).toEqual({ kind: 'ok', url: 'https://tiktok.com/@a.b_c' })
  })
  it('그 플랫폼 주소는 앞부분이 없어도·http 여도 받고 https 로 바꾼다', () => {
    expect(snsLinkStatus('instagram', 'instagram.com/urdeal')).toEqual({ kind: 'ok', url: 'https://instagram.com/urdeal' })
    expect(snsLinkStatus('youtube', 'https://youtu.be/abc')).toEqual({ kind: 'ok', url: 'https://youtu.be/abc' })
    expect(snsLinkStatus('youtube', 'http://m.youtube.com/@a')).toEqual({ kind: 'ok', url: 'https://m.youtube.com/@a' })
  })
  it('다른 사이트 · 위장 · 다른 플랫폼 · 실행 스킴 · 자격 끼워 넣기는 거절', () => {
    for (const bad of ['https://evil.com/x', 'evil.com', 'https://instagram.com.evil.io/x', 'https://evilinstagram.com/x',
      'https://youtube.com/@a', 'javascript:alert(1)', 'https://u:p@instagram.com/x', 'bit.ly/abc']) {
      expect(snsLinkStatus('instagram', bad).kind, bad).toBe('bad')
    }
  })
  it('빈 칸은 해제(경고 아님)', () => {
    expect(snsLinkStatus('tiktok', '  ')).toEqual({ kind: 'empty' })
  })
  it('snsUrl 은 거절된 값에 빈 문자열(이름표 안 그림)', () => {
    expect(snsUrl('instagram', 'https://evil.com')).toBe('')
    expect(snsUrl('instagram', '@abc')).toBe('https://instagram.com/abc')
  })
})

describe('배선 — 네 곳이 같은 판정을 쓴다', () => {
  it('서버 저장이 snsLinkStatus 로 거절한다(옛 "https 면 통과" 금지)', () => {
    const src = readCode('src/worker/routes/curator.routes.ts')
    expect(src).toMatch(/if \(v && snsLinkStatus\(platform, v\)\.kind !== 'ok'\)/)
    expect(src).not.toMatch(/isAllowedSns/)
  })
  it('화면 이름표는 판정된 href 가 있을 때만', () => {
    const src = readCode('src/pages/curator-page/CuratorHeader.tsx')
    expect(src).toMatch(/\{igHref && \(/)
    expect(src).not.toMatch(/\{curator\.instagram_url && \(/)
  })
  it('서버 첫 화면도 같은 판정으로 이름표 자리를 센다', () => {
    expect(readCode('src/worker/utils/curator-ssr-body.ts')).toMatch(/snsLinkStatus\('instagram', c\.instagram_url\)\.kind === 'ok'/)
  })
  it('편집 시트가 칸마다 경고하고 저장을 막는다', () => {
    const src = readCode('src/pages/user-profile/profile-edit/ProfileEditSheet.tsx')
    expect(src).toMatch(/snsLinkStatus\(key\.replace/)
    expect(src).toMatch(/disabled=\{SNS\.some/)
  })
})
