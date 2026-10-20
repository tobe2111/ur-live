/**
 * 🖼️ 배너 업로드 — 화면 안내와 실제 천장이 같은 말을 하는가 (2026-10-14, 대표 *"배너 업로드 문제도 해결해줘"*).
 *
 * 사고: 배너 이미지 업로드가 "최대 10MB" 라고 안내하면서 원본을 그대로 `/api/upload/image`(본문 천장 1MB)로
 *   보냈다 → 1MB 넘는 사진은 전부 413. 가드가 이 파일을 영상 사유로 통째 면제해 이미지 경로까지 빠졌다.
 *
 * ⚠️ 이 시험이 못 보는 것: 실제 압축 결과의 화질·크기(브라우저 캔버스 — jsdom 밖) · 서버가 실제로 받는지(라이브).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planBannerUpload, bannerTooLargeMessage } from '@/pages/admin/banners/banner-upload-plan'
import { HERO_MAX_EDGE, HERO_TARGET_MB } from '@/lib/prepare-upload'
import { UPLOAD_MAX_FILE_BYTES, BANNER_VIDEO_MAX_FILE_BYTES } from '@/shared/upload-limits'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import { stripComments } from '@/tests/helpers/source-text'

const MB = 1024 * 1024
const UI = stripComments(readFileSync('src/pages/admin/banners/BannerMediaUpload.tsx', 'utf8'))
const PREP = stripComments(readFileSync('src/lib/prepare-upload.ts', 'utf8'))

describe('① 계획 — 사진은 줄이고, GIF·영상은 정직하게', () => {
  it('큰 사진(JPG·PNG·WebP)은 거절이 아니라 압축이다', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(planBannerUpload({ type, size: 8 * MB }, 'image').action).toBe('compress')
    }
  })

  it('움직이는 GIF 는 압축하지 않는다 — 천장 안이면 그대로, 넘으면 영상으로 안내', () => {
    expect(planBannerUpload({ type: 'image/gif', size: 500_000 }, 'image').action).toBe('upload')
    const big = planBannerUpload({ type: 'image/gif', size: 3 * MB }, 'image')
    expect(big.action).toBe('reject')
    if (big.action === 'reject') expect(big.message).toMatch(/MP4/)
  })

  it('GIF 경계 — 천장과 같으면 통과, 1바이트 넘으면 거절', () => {
    expect(planBannerUpload({ type: 'image/gif', size: UPLOAD_MAX_FILE_BYTES }, 'image').action).toBe('upload')
    expect(planBannerUpload({ type: 'image/gif', size: UPLOAD_MAX_FILE_BYTES + 1 }, 'image').action).toBe('reject')
  })

  it('영상은 서버 카브아웃(10MB)과 같은 값으로 자른다', () => {
    expect(planBannerUpload({ type: 'video/mp4', size: BANNER_VIDEO_MAX_FILE_BYTES }, 'video').action).toBe('upload')
    expect(planBannerUpload({ type: 'video/mp4', size: BANNER_VIDEO_MAX_FILE_BYTES + 1 }, 'video').action).toBe('reject')
  })

  it('형식이 틀리면 거절한다 (이미지 칸에 영상 · 영상 칸에 이미지)', () => {
    expect(planBannerUpload({ type: 'video/mp4', size: 100 }, 'image').action).toBe('reject')
    expect(planBannerUpload({ type: 'image/png', size: 100 }, 'video').action).toBe('reject')
  })

  it('거절 문구가 비어 있지 않다', () => {
    expect(bannerTooLargeMessage('source').length).toBeGreaterThan(5)
    expect(bannerTooLargeMessage('compressed').length).toBeGreaterThan(5)
  })
})

describe('② 히어로 압축 값이 천장과 화면 둘 다에 맞다', () => {
  it('압축 목표가 파일 천장 아래다 (위면 압축해도 413)', () => {
    expect(HERO_TARGET_MB * MB).toBeLessThan(UPLOAD_MAX_FILE_BYTES)
  })

  it('압축 폭이 히어로 권장 폭과 같다 (줄이면 레티나에서 흐리다)', () => {
    expect(HERO_MAX_EDGE).toBe(BANNER_SLOT_SPECS.hero.recommendedWidth)
  })

  it('준비 헬퍼가 hero 옵션에서 그 두 값을 실제로 쓴다', () => {
    expect(PREP).toMatch(/opts\.hero[\s\S]{0,200}maxSizeMB:\s*HERO_TARGET_MB[\s\S]{0,60}maxWidthOrHeight:\s*HERO_MAX_EDGE/)
  })
})

describe('③ 배선 — 화면이 원본을 그대로 보내지 않는다', () => {
  it('압축 계획이면 hero 준비 헬퍼를 거친다', () => {
    expect(UI).toMatch(/plan\.action === 'compress'\s*\?\s*await prepareImageForUpload\(file, \{ hero: true \}\)/)
  })

  it('거절 계획은 업로드 전에 멈춘다', () => {
    const at = UI.indexOf("plan.action === 'reject'")
    expect(at).toBeGreaterThan(0)
    expect(UI.indexOf('api.post(', at)).toBeGreaterThan(at)
    expect(UI.slice(at, UI.indexOf('api.post(', at))).toMatch(/return\b/)
  })

  it('화면 안내가 거짓 "최대 10MB(이미지)" 로 돌아가지 않는다', () => {
    expect(UI).not.toMatch(/WebP · GIF · 최대 10MB/)
    expect(UI).toMatch(/자동으로 줄여/)
  })
})
