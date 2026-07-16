import { describe, it, expect } from 'vitest'
import { storyboardToBody, type Storyboard } from '@/features/social-media/api/social-video'
import { videoRenderEnabled, videoRenderProvider, videoRenderStatus } from '@/features/social-media/api/social-video-render'
import type { Env } from '@/worker/types/env'

/**
 * 🆕 2026-07-15 소셜 자동화 — 릴스/쇼츠 영상 순수 로직 잠금.
 *   ① 스토리보드→본문(대본) 요약 ② 렌더 게이트/provider 판정(키/킬스위치 없으면 OFF).
 */
const sb: Storyboard = {
  title: '점심값 아끼는 법',
  description: '식사 이용권으로 점심값 아끼기',
  hashtags: ['이용권', '직장인'],
  scenes: [
    { narration: '오늘 점심 뭐 먹지?', onScreenText: '점심 고민', visualDirection: '식당 앞', durationSec: 4 },
    { narration: '이용권으로 미리 할인가에 샀어요', onScreenText: '미리 할인', visualDirection: '앱 화면', durationSec: 6 },
  ],
}

describe('storyboardToBody', () => {
  it('설명 + 번호 매긴 대본 포함', () => {
    const body = storyboardToBody(sb)
    expect(body).toContain('식사 이용권으로 점심값 아끼기')
    expect(body).toContain('[대본]')
    expect(body).toContain('1. 오늘 점심 뭐 먹지?')
    expect(body).toContain('(자막: 점심 고민)')
    expect(body).toContain('2. 이용권으로 미리 할인가에 샀어요')
  })
})

describe('영상 렌더 게이트/provider 판정', () => {
  const base = { DB: {} } as unknown as Env
  it('킬스위치 OFF 면 렌더 비활성', () => {
    expect(videoRenderEnabled({ ...base } as Env)).toBe(false)
    expect(videoRenderEnabled({ ...base, SOCIAL_VIDEO_ENABLED: 'true' } as unknown as Env)).toBe(true)
  })
  it('키 없으면 provider null', () => {
    expect(videoRenderProvider({ ...base, SOCIAL_VIDEO_ENABLED: 'true' } as unknown as Env)).toBeNull()
    expect(videoRenderProvider({ ...base, SOCIAL_VIDEO_RENDER_KEY: 'k' } as unknown as Env)).toBe('creatomate')
  })
  it('status: 킬스위치 OFF 면 provider 숨김', () => {
    const off = videoRenderStatus({ ...base, SOCIAL_VIDEO_RENDER_KEY: 'k' } as unknown as Env)
    expect(off).toEqual({ enabled: false, provider: null })
    const on = videoRenderStatus({ ...base, SOCIAL_VIDEO_ENABLED: 'true', SOCIAL_VIDEO_RENDER_KEY: 'k' } as unknown as Env)
    expect(on).toEqual({ enabled: true, provider: 'creatomate' })
  })
})
