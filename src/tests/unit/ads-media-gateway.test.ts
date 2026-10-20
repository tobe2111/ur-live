import { describe, it, expect } from 'vitest'
import { mediaStatus, generateImage, generateVoice, submitVideo } from '@/features/marketing/api/media-gateway'
import type { Env } from '@/worker/types/env'

/**
 * 🆕 2026-07-02 유어애즈 미디어 게이트웨이 — 킬스위치/키 게이팅 잠금.
 *   불변식: ① ADS_MEDIA_ENABLED!=='true' → DISABLED(외부 호출·DB 미접근) ② 켜져도 키 없으면 NOT_CONFIGURED.
 *   (실 provider 호출은 egress 차단으로 미검증 — 게이트 앞단만 검증.)
 */
// DB/네트워크 접근 시 throw 하는 트랩 — 게이트에 막히면 절대 여기 도달 안 함.
const trapDB = new Proxy({}, { get() { throw new Error('DB touched — 게이트 실패') } }) as unknown as D1Database
const env = (flags: Record<string, string | undefined>): Env => ({ DB: trapDB, ...flags }) as unknown as Env

describe('mediaStatus', () => {
  it('킬스위치 OFF면 전부 null(키 있어도)', () => {
    const s = mediaStatus(env({ OPENAI_API_KEY: 'x', ELEVENLABS_API_KEY: 'y', REPLICATE_API_TOKEN: 'z' }))
    expect(s).toEqual({ enabled: false, image: null, voice: null, video: null })
  })
  it('킬스위치 ON + 키별 provider 반영', () => {
    const s = mediaStatus(env({ ADS_MEDIA_ENABLED: 'true', OPENAI_API_KEY: 'x', REPLICATE_API_TOKEN: 'z' }))
    expect(s.enabled).toBe(true); expect(s.image).toBe('openai'); expect(s.voice).toBeNull(); expect(s.video).toBe('replicate')
  })
  it('video provider 선호(ADS_VIDEO_PROVIDER=heygen)', () => {
    expect(mediaStatus(env({ ADS_MEDIA_ENABLED: 'true', ADS_VIDEO_PROVIDER: 'heygen', HEYGEN_API_KEY: 'h', REPLICATE_API_TOKEN: 'r' })).video).toBe('heygen')
  })
})

describe('게이트 앞단(트랩 DB — 미접근 증명)', () => {
  it('킬스위치 OFF → DISABLED (DB/네트워크 미접근)', async () => {
    expect((await generateImage(env({ OPENAI_API_KEY: 'x' }), 1, '고양이')).error).toBe('DISABLED')
    expect((await generateVoice(env({ ELEVENLABS_API_KEY: 'y' }), 1, '안녕')).error).toBe('DISABLED')
    expect((await submitVideo(env({ REPLICATE_API_TOKEN: 'z' }), 1, '숏폼')).error).toBe('DISABLED')
  })
  it('킬스위치 ON + 키 없음 → NOT_CONFIGURED (DB/네트워크 미접근)', async () => {
    expect((await generateImage(env({ ADS_MEDIA_ENABLED: 'true' }), 1, '고양이')).error).toBe('NOT_CONFIGURED')
    expect((await generateVoice(env({ ADS_MEDIA_ENABLED: 'true' }), 1, '안녕')).error).toBe('NOT_CONFIGURED')
    expect((await submitVideo(env({ ADS_MEDIA_ENABLED: 'true' }), 1, '숏폼')).error).toBe('NOT_CONFIGURED')
  })
  it('빈 입력은 게이트 전에 거부', async () => {
    expect((await generateImage(env({ ADS_MEDIA_ENABLED: 'true', OPENAI_API_KEY: 'x' }), 1, '  ')).ok).toBe(false)
  })
})
