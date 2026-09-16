/**
 * 📸 **이용권 사진 — 자리 정리 + 여러 장** (2026-09-03 대표 시안 승인 *"응응 그렇게 하자. 상한도 두고"*).
 *
 * 두 가지를 고정한다:
 *   ① 사진 넣는 자리 — 상시 URL 칸과 안내 일러스트를 없애고 **지도 / 내 파일** 둘만 위에.
 *      단 카카오맵은 공개 API 가 장소 사진을 안 줘서 붙여넣기가 유일한 길이라, **그 버튼을 누른
 *      사람에게만** 칸이 열린다(대표 확인 1안).
 *   ② 사진 여러 장 — 등록·수정·서버 저장이 **한 벌로** 움직인다. 하나라도 빠지면 사진이 조용히 사라진다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 업로드(R2)와 화면 렌더. 여기서 고정하는 것은 **모델과 배선**이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { emptyVoucherForm, withPhotos } from '@/pages/seller-meal-voucher/voucher-form'

const SECTION = readFileSync('src/pages/seller-meal-voucher/VoucherPhotoSection.tsx', 'utf8')
const STEP = readFileSync('src/pages/seller-meal-voucher/VoucherInfoStep.tsx', 'utf8')
const EDITOR = readFileSync('src/components/seller/PhotoGalleryEditor.tsx', 'utf8')
const NEWPAGE = readFileSync('src/pages/SellerMealVoucherNewPage.tsx', 'utf8')
const EDITPAGE = readFileSync('src/pages/SellerProductEditPage.tsx', 'utf8')
const ROUTES = readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf8')
/** 주석 제거본 — 없앤 것을 *설명하는 주석*까지 세면 가짜 빨강이 된다(오늘 여러 번 겪었다). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 사진 자리 — 지도와 내 파일만 위에', () => {
  it('🔒 상시 이미지 URL 입력칸이 없다 (대표: "이미지 URL 넣는건 없어도 될 것 같고")', () => {
    // 종전엔 `value={form.image_url}` 인 input 이 항상 떠 있었다.
    expect(code(SECTION)).not.toMatch(/value=\{form\.image_url\}/)
    expect(code(STEP)).not.toMatch(/value=\{form\.image_url\}/)
  })

  it('🔒 안내 일러스트가 없다 (대표: "이미지처럼 안내는 필요없어")', () => {
    expect(code(STEP)).not.toContain('SellerVoucherPhotoGuide')
    expect(code(SECTION)).not.toContain('SellerVoucherPhotoGuide')
  })

  it('두 진입점이 있다 — 지도에서 가져오기 / 내 파일에서', () => {
    expect(SECTION).toContain('fromMapShort')
    expect(EDITOR).toContain('pickFile')
  })

  it('지도 프리셋·추천 그리드는 누른 뒤에만 — 첫 화면을 층으로 채우지 않는다', () => {
    expect(code(SECTION)).toMatch(/mapOpen &&/)
    expect(code(SECTION)).toMatch(/setMapOpen\(open\)/)
  })
})

describe('② 카카오맵 — 붙여넣기는 그 버튼을 누른 사람에게만', () => {
  it('기본값은 닫힘', () => {
    expect(SECTION).toMatch(/useState\(false\)[\s\S]{0,80}pasteOpen|const \[pasteOpen, setPasteOpen\] = useState\(false\)/)
  })

  it('🔒 카카오맵 링크를 누르면 열린다 — 안 열리면 그 사진 경로가 통째로 끊긴다', () => {
    const anchor = SECTION.slice(SECTION.indexOf('form.kakao_place_url &&'), SECTION.indexOf('openKakaoPlace'))
    expect(anchor).toContain('setPasteOpen(true)')
  })

  it('붙여넣기 칸은 pasteOpen 뒤에만 그린다', () => {
    expect(code(SECTION)).toMatch(/\{pasteOpen &&/)
  })
})

describe('③ 여러 장 — 모델', () => {
  it('폼이 사진 목록을 갖는다', () => {
    expect(emptyVoucherForm().images).toEqual([])
  })

  it('🔒 옛 데이터(대표 1장)를 목록으로 접어 넣는다 — 안 하면 한 번 손댈 때 원래 사진이 사라진다', () => {
    const old = { ...emptyVoucherForm(), image_url: 'https://x/a.jpg', images: [] }
    expect(withPhotos(old).images).toEqual(['https://x/a.jpg'])
  })

  it('이미 목록이 있으면 손대지 않는다', () => {
    const cur = { ...emptyVoucherForm(), image_url: 'https://x/a.jpg', images: ['https://x/b.jpg'] }
    expect(withPhotos(cur).images).toEqual(['https://x/b.jpg'])
  })

  it('사진 없는 폼은 빈 목록', () => {
    expect(withPhotos({ ...emptyVoucherForm() }).images).toEqual([])
  })
})

describe('④ 상한 — 대표 "상한도 두고"', () => {
  it('편집기가 5장에서 막는다', () => {
    expect(EDITOR).toContain('export const PHOTO_MAX = 5')
    expect(EDITOR).toMatch(/photos\.length >= max/)
  })

  it('서버도 길이를 막는다 — 클라 상한만 믿지 않는다', () => {
    expect(ROUTES).toMatch(/writeProductText\(db, productId, 'images'/)
    expect(readFileSync('src/features/seller/api/product-field-writers.ts', 'utf8')).toMatch(/val\.length > 100000/)
  })
})

describe('⑤ 배선 — 등록·수정·서버가 한 벌로 움직인다', () => {
  it('등록이 사진 목록을 보낸다', () => {
    expect(NEWPAGE).toMatch(/images: form\.images\.length \? JSON\.stringify\(form\.images\) : null/)
  })

  it('🔒 수정도 보낸다 — 여기가 빠지면 한 번 저장할 때마다 추가 사진이 사라진다', () => {
    expect(EDITPAGE).toMatch(/images: formData\.photos\.length \? JSON\.stringify\(formData\.photos\) : null/)
  })

  it('🔒 첫 장이 대표(image_url)와 같은 값이다 — 어긋나면 화면마다 다른 사진이 뜬다', () => {
    expect(SECTION).toMatch(/update\('image_url', capped\[0\] \|\| ''\)/)
    expect(EDITPAGE).toMatch(/image_url: formData\.photos\[0\] \|\| formData\.image_url/)
  })

  it('서버가 등록·수정 양쪽에서 저장한다', () => {
    expect((ROUTES.match(/'images'/g) || []).length).toBeGreaterThanOrEqual(1)
    expect(ROUTES).toMatch(/\['long_description', 50000\], \['detail_images', 100000\], \['images', 100000\]/)
  })
})
