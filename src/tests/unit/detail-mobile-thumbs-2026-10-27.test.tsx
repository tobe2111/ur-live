/**
 * 🖼️ 2026-10-27 (대표 "이용권 상세페이지도 그루폰처럼 … 사진 하나밖에 안 보여 · 클릭하면 그루폰처럼") —
 *   모바일 큰 사진 아래 썸네일 2칸 + 누르면 전체 화면(번호 표시 · 큰 화살표).
 *   서버 첫 화면과 React 가 **같은 칸·같은 사진 주소**를 그려야 마운트 때 제목이 안 밀린다.
 * 못 보는 것: 실제 픽셀 높이(jsdom 에 레이아웃이 없다 — 클래스·비율 문자열로 대조).
 */
import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import DetailGallery from '@/pages/group-buy/DetailGallery'
import { buildDetailFirstScreen, mobileThumbRowHtml } from '@/worker/utils/detail-ssr-body'
import { buildStayDetailFirstScreen } from '@/worker/utils/stay-detail-ssr-body'
import { readCode } from '../helpers/source-text'
import { detailMobileThumbUrl, showMobileThumbs, DETAIL_MOBILE_THUMB_ROW_CLS } from '@/shared/detail-hero-image'

const IMGS = ['https://t1.kakaocdn.net/a.jpg', 'https://t1.kakaocdn.net/b.jpg', 'https://t1.kakaocdn.net/c.jpg', 'https://t1.kakaocdn.net/d.jpg']

describe('모바일 썸네일 2칸', () => {
  it('3장 이상일 때만 편다', () => {
    expect(showMobileThumbs(2)).toBe(false)
    expect(showMobileThumbs(3)).toBe(true)
    expect(mobileThumbRowHtml(IMGS.slice(0, 2))).toBe('')
  })
  it('서버 첫 화면이 같은 줄을 그린다', () => {
    const html = buildDetailFirstScreen(JSON.stringify({ data: { name: '가게 이용권', images: JSON.stringify(IMGS), image_url: IMGS[0] } }), '<div>loader</div>')
    expect(html).toContain(DETAIL_MOBILE_THUMB_ROW_CLS)
    expect(html).toContain(detailMobileThumbUrl(IMGS[1]).replace(/&/g, '&amp;'))
    expect(html).toContain(detailMobileThumbUrl(IMGS[2]).replace(/&/g, '&amp;'))
  })
  it('React 가 같은 클래스·같은 주소로 2칸을 그리고, 남은 장수를 표시한다', () => {
    const { container } = render(<DetailGallery images={IMGS} alt="가게" />)
    const row = container.querySelector(`div.${DETAIL_MOBILE_THUMB_ROW_CLS.split(' ').join('.')}`)
    expect(row).not.toBeNull()
    const btns = row!.querySelectorAll('button')
    expect(btns.length).toBe(2)
    expect((btns[0] as HTMLElement).style.backgroundImage).toContain(detailMobileThumbUrl(IMGS[1]))
    expect(btns[1].textContent).toBe('+1')
  })
  // 🔁 2026-11-02 대표 확정 ②A: 작은 사진은 **큰 사진을 그 사진으로 옮기고**, 다음 두 장으로 따라 바뀐다.
  //   크게 보기는 마지막 칸(+N)에서 열린다.
  it('작은 사진을 누르면 아래 두 칸이 그다음 두 장으로 따라 바뀐다', () => {
    render(<DetailGallery images={IMGS} alt="가게" />)
    expect(screen.getByLabelText('사진 2 보기')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('사진 2 보기'))
    expect(screen.getByLabelText('사진 3 보기'), '다음 두 장(3·4)으로 안 바뀌었다').toBeTruthy()
    expect(screen.queryByLabelText('사진 2 보기'), '지금 큰 사진이 아래에 또 나온다').toBeNull()
  })
  it('마지막 칸(+N)을 누르면 가운데 팝업이 열리고 "n / 전체" 를 보여 준다', () => {
    render(<DetailGallery images={IMGS} alt="가게" />)
    fireEvent.click(screen.getByLabelText('전체 사진 4장 크게 보기'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('3 / 4')).toBeTruthy()
    fireEvent.click(screen.getAllByLabelText('4번째 사진')[0])
    expect(screen.getByText('4 / 4')).toBeTruthy()
  })
})

describe('앱이 뜨기 전에도 넘길 수 있다 (2026-10-27 "로딩 지나니까 넘어가")', () => {
  it('이용권 서버 첫 화면이 모든 장을 슬라이드로 그리고, 둘째부터는 lazy', () => {
    const html = buildDetailFirstScreen(JSON.stringify({ data: { name: '가게 이용권', images: JSON.stringify(IMGS), image_url: IMGS[0] } }), '<div>loader</div>')
    const slides = html.match(/scroll-snap-align:center/g) || []
    expect(slides.length).toBe(IMGS.length)
    expect((html.match(/loading="lazy"/g) || []).length).toBe(IMGS.length - 1)
  })
  it('숙소 서버 첫 화면도 같은 함수로 같은 개수를 그린다', () => {
    expect(readCode('src/worker/utils/stay-detail-ssr-body.ts')).toMatch(/restSlidesHtml\(images,/)
    const html = buildStayDetailFirstScreen(JSON.stringify({ data: { product: { name: '숙소', images: JSON.stringify(IMGS), image_url: IMGS[0] }, rooms: [] } }), '<div>loader</div>')
    expect(html).not.toBe('')
    expect((html.match(/scroll-snap-align:center/g) || []).length).toBe(IMGS.length)
  })
})
