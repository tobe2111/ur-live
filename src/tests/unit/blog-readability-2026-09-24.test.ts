/**
 * 📝 **블로그 가독성 + 커버** — 2026-09-24 대표 문서 ②.
 *
 * ## 무엇이 문제였나 (실측)
 * 대표: *"너무 가독성이 떨어진다"* · *"사진 필요함  여기도 가독성이 떨어진다"*.
 *   ① **사진**: 카드에 이미지 자리(`CoverImg`)는 있는데 **발행 글 5개 전부 `thumbnail_url` null**
 *      이라 전부 폴백으로 떨어졌고, 그 폴백이 **이모지 스티커 + 그라디언트**였다 —
 *      코레일톡 디자인 SSOT 가 금지하는 둘(이모지 0 · 그라디언트 0)을 정확히 쓰고 있었다.
 *   ② **가독성**: 상세가 `[목차 220 | 본문 | 사이드 260]` 3열이라 1280px 에서 본문 칸이 약 760px.
 *      15px 한글이면 한 줄에 95자 가까이 들어간다(편한 길이는 40~50자).
 *
 * ## 고친 것
 *   · 커버 폴백 → 우리 카테고리 아이콘 + 팔레트 단색 면(이모지·그라디언트 0)
 *   · 본문 16.5px / 줄간격 1.85 **+ 본문 폭 `max-w-[46rem]`** — **둘은 짝이다**(하나만 하면 반쪽)
 *
 * ## 이 시험이 **못 하는 것**
 * "읽기 편한가"를 판정하지 못한다. 폰트 크기·폭 클래스와 금지 요소의 유무만 본다.
 * 그리고 **진짜 사진은 코드가 아니라 내용이다** — 어드민(`/admin/blog`)에 썸네일 업로더가
 * 이미 있으므로 채우는 것은 운영의 일이다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const COVER = 'src/features/blog/BlogCover.tsx'
const MD = 'src/features/blog/BlogMarkdown.tsx'
const DETAIL = 'src/pages/BlogDetailPage.tsx'
const ADMIN = 'src/pages/AdminBlogPage.tsx'

describe('블로그 커버 폴백이 디자인 SSOT 를 지킨다', () => {
  const cover = readCode(COVER)

  it('이모지가 없다', () => {
    // 코레일톡 SSOT 표면 규칙 ⑥ — 이모지 0. 폴백이 목록 전체를 덮고 있었으므로 영향이 컸다.
    expect(cover).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u)
  })

  it('그라디언트가 없다', () => {
    expect(cover).not.toMatch(/bg-gradient-to-|from-[a-z]+-\d{2,3}/)
  })

  it('우리 아이콘 세트를 쓴다', () => {
    expect(cover).toContain("@/components/icons/category-icons")
    expect(cover).toContain('CATEGORY_PALETTE')
  })

  it('사진이 있으면 폴백은 물러난다 — 커버는 사진의 대체재가 아니다', () => {
    expect(cover).toMatch(/if \(post\.thumbnail_url\)/)
  })

  it('사진을 넣는 길이 이미 있다 — 어드민 썸네일 업로더', () => {
    // 이게 없으면 "사진 필요함"은 운영이 아니라 개발 과제가 된다. 있으므로 채우는 일이다.
    expect(readCode(ADMIN)).toContain('thumbnail_url')
  })
})

describe('본문 가독성 — 글자 크기와 폭은 짝이다', () => {
  it('본문 글자가 16.5px 다', () => {
    const md = readCode(MD)
    expect(md).toContain('text-[16.5px]')
    expect(md, '15px 본문이 남아 있다').not.toMatch(/text-\[15px\][^\n]*leading-/)
  })

  it('본문 폭이 묶여 있다', () => {
    // 폭을 안 묶으면 글자만 키운 꼴이라 한 줄이 여전히 길다(3열 레이아웃의 가운데 칸 760px).
    expect(readCode(DETAIL)).toMatch(/max-w-\[46rem\][\s\S]{0,200}<BlogMarkdown/)
  })
})
