/**
 * 📤 사진 업로드는 전부 공용 준비 헬퍼를 지난다 (2026-10-14, 대표 *"나머지 문제들도 다 해결해줘"*).
 *
 * 사고 클래스(세 번째): 업로드 자리마다 **압축 전 크기**로 자르는 가드(5MB · 10MB)를 따로 갖고 있었다.
 *   ① 폰 사진(4~12MB)은 압축하면 올라가는데 그 가드가 먼저 거절했고 ② 압축 **뒤** 천장(1MB) 검사가 없어
 *   줄여도 넘는 사진은 미들웨어의 "요청 본문이 너무 큽니다"를 받았다 ③ 화면마다 "최대 10MB"·"5MB 이하"를
 *   제각각 적었다(실제 천장은 1MB). 2026-10-11 에 세 자리, 10-14 오전에 배너, 오후에 나머지 여섯을 고쳤다.
 *
 * ⚠️ 못 보는 것: 실제 압축 화질(브라우저 캔버스) · 문서(등록증) 경로 — 그건 `compressForDocument` + 2.2MB
 *   카브아웃으로 따로 지킨다(`upload-body-limit-2026-10-11.test.ts`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '@/tests/helpers/source-text'
import { SIZE_TARGET_CAP_MB, uploadTooLargeMessage, UploadTooLargeError } from '@/lib/prepare-upload'
import { UPLOAD_MAX_FILE_BYTES } from '@/shared/upload-limits'
import { BANNER_MAX_UPLOAD_MB } from '@/shared/constants/home-showcase'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))

/** 사진(문서 아님)을 올리는 자리 — 전부 준비 헬퍼를 지나야 한다. */
const PHOTO_SITES = [
  'src/components/ImageUpload.tsx',
  'src/components/upload/ImageUpload.tsx',
  'src/pages/product-detail/ProductReviews.tsx',
  'src/pages/seller-store-info/ImageField.tsx',
  'src/components/seller/PhotoGalleryEditor.tsx',
  'src/pages/SellerProfileEditPage.tsx',
  'src/pages/admin/banners/BannerMediaUpload.tsx',
  'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx',
  'src/pages/my-vouchers/ReviewBonusButton.tsx',
  'src/pages/SellerProspectsPage.tsx',
]

describe('① 사진 업로드 자리는 전부 준비 헬퍼를 지난다', () => {
  for (const p of PHOTO_SITES) {
    const src = code(p)
    it(`${p.split('/').slice(-2).join('/')} — prepareImageForUpload 를 부른다`, () => {
      expect(src).toMatch(/prepareImageForUpload\(/)
    })
    it(`${p.split('/').slice(-2).join('/')} — 압축 전 크기로 자르지 않는다`, () => {
      expect(src).not.toMatch(/\b(file|f)\.size\s*>\s*\d+\s*\*\s*1024\s*\*\s*1024/)
    })
    it(`${p.split('/').slice(-2).join('/')} — 압축기를 직접 부르지 않는다(천장 검사를 건너뛴다)`, () => {
      expect(src).not.toMatch(/\bcompressFor(Upload|Thumbnail)\(/)
    })
    it(`${p.split('/').slice(-2).join('/')} — 천장 초과를 우리 문구로 안내한다`, () => {
      expect(src).toMatch(/UploadTooLargeError/)
    })
  }
})

describe('② 화면 안내가 실제 천장과 다른 말을 하지 않는다', () => {
  const LIES = /최대\s*10MB|10MB\s*이하|\(max 10MB\)|5MB\s*이하만/
  for (const p of PHOTO_SITES.concat(['src/components/seller/StoreRegisterModal.tsx', 'src/pages/AdminBannersPage.tsx'])) {
    it(`${p.split('/').pop()} — 사진에 "10MB/5MB 이하" 를 적지 않는다(영상 안내는 예외)`, () => {
      const lines = code(p).split('\n').filter(l => LIES.test(l) && !/MP4|WebM|영상/.test(l))
      expect(lines).toEqual([])
    })
  }

  it('6개 언어의 사진 안내(imageFormatHint)에 "10MB" 가 없다 — 로케일 값이 코드 기본값을 이긴다', () => {
    for (const l of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(readFileSync(`public/locales/${l}/translation.json`, 'utf8'))
      expect(j.common.imageFormatHint, l).not.toMatch(/10\s*(MB|Mo)/)
    }
  })

  it('배너 용량 안내는 고를 수 있는 원본 크기(SSOT)에서 나온다', () => {
    expect(BANNER_MAX_UPLOAD_MB).toBe(25)
  })
})

describe('③ 준비 헬퍼 자체', () => {
  it('자리별 목표를 천장 아래로 눌러 담는다', () => {
    expect(SIZE_TARGET_CAP_MB * 1024 * 1024).toBeLessThan(UPLOAD_MAX_FILE_BYTES)
    expect(code('src/lib/prepare-upload.ts')).toMatch(/Math\.min\(opts\.size!\.maxSizeMB,\s*SIZE_TARGET_CAP_MB\)/)
  })

  it('천장 안 GIF 는 그대로 둔다(움직임 보존) — 압축기 전에 돌려준다', () => {
    const s = code('src/lib/prepare-upload.ts')
    const gif = s.indexOf("file.type === 'image/gif' && fitsApiBodyLimit(file.size)) return file")
    expect(gif).toBeGreaterThan(0)
    expect(gif).toBeLessThan(s.indexOf("await import('./image-compress')"))
  })

  it('안내 문구가 원인별로 다르다', () => {
    expect(uploadTooLargeMessage(new UploadTooLargeError('source', 1))).toMatch(/25MB/)
    expect(uploadTooLargeMessage(new UploadTooLargeError('compressed', 1))).not.toMatch(/25MB/)
  })
})
