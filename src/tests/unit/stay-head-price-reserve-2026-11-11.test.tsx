/**
 * 📐 숙소 상세 머리의 가격 줄 자리 예약 (2026-11-11 — 라이브 CLS 0.03~0.045).
 *   rAF 추적: 객실 조회가 끝나면 머리가 73 → 141px 로 커지며 '팔기' 줄·구역 탭·날짜 카드가 68px 내려갔다.
 *   ⇒ 첫 조회가 끝나기 전엔 가격 줄 높이(mt-3 12 + h-14 56 = 68px)를 비워 둔다.
 * ⚠️ 못 보는 것: 실제 픽셀(라이브로 잰다) · 매진이라 가격이 끝내 없는 숙소(조회 뒤 68px 접힌다 — 드물다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import StayHeadCard from '@/pages/stay-detail/StayHeadCard'
import { STAY_HEAD } from '@/shared/stay-head'

const stay = { property_type: 'pension', star_rating: null, address: '', region_sido: '강원', region_sigungu: '속초시', avg_rating: 0, review_count: 0 }
const html = (minPrice: number | null, pricePending: boolean) => renderToStaticMarkup(<StayHeadCard stay={stay} name="숙소" minPrice={minPrice} priceLabel="1박 총액" pricePending={pricePending} />)
const RESERVE = `<div class="${STAY_HEAD.pricePending}" aria-hidden="true"></div>`

describe('가격 줄 자리 예약', () => {
  it('조회 전 · 가격 모름 → 자리만(68px = mt-3 + h-14)', () => {
    expect(STAY_HEAD.pricePending).toBe('mt-3 h-14')
    const h = html(null, true)
    expect(h).toContain(RESERVE); expect(h).not.toContain('원~')
  })
  it('가격이 오면 그 자리에 가격 — 예약은 없다(겹쳐 그리지 않는다)', () => {
    const h = html(89000, false)
    expect(h).toContain('89,000원~'); expect(h).not.toContain(RESERVE)
    expect(html(89000, true)).not.toContain(RESERVE)
  })
  it('조회가 끝났는데 가격이 없으면(매진) 자리도 접는다', () => {
    const h = html(null, false)
    expect(h).not.toContain(RESERVE); expect(h).not.toContain('원~')
  })
  it('화면이 첫 조회 완료를 알려 준다', () => {
    const page = readFileSync('src/pages/StayDetailPage.tsx', 'utf8')
    expect(page).toContain('const [roomsTried, setRoomsTried] = useState(false)')
    expect(page).toContain('.finally(() => { setRoomsLoading(false); setRoomsTried(true) })')
    expect(page).toContain('pricePending={!roomsTried} />')
  })
  it('가격 줄의 실제 모양이 예약 높이의 근거와 같다(mt-3 · 13px 라벨 · 24px 가격)', () => {
    const card = readFileSync('src/pages/stay-detail/StayHeadCard.tsx', 'utf8')
    expect(card).toContain('<div className="mt-3">\n          <div className="text-[13px] text-gray-500 dark:text-gray-400">{priceLabel}</div>\n          <div className="text-[24px] font-bold')
  })
})
