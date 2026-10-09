/**
 * 🦦 유달이 새 자리 6곳 — 대표 확정 시안 "좋다 모두 해줘" (2026-10-09)
 *
 * ① 이용권 사용 직후 "어떠셨어요?" · ② 이용권 공유 카드 · ③ 지갑 만료 임박 한 줄 · ④ 첫 이용권 축하 ·
 * ⑤ 알림함·내 유어샵 빈 화면.
 *
 * 여기서 지키는 것들은 전부 **에러 없이 조용히 틀어진다** — 카드가 깨진 XML 이어도 응답은 200 이고,
 * 축하가 매번 떠도 화면은 멀쩡하다. 그래서 기계가 잰다.
 *
 * 🩸 ②를 만들다 **기존 유어샵 공유 카드가 깨진 XML** 이었다는 걸 찾았다(라이브 실측 2026-10-09):
 *   `font-family="${OG_FONT}"` 인데 OG_FONT 안에 큰따옴표가 있어 속성이 끊겼다 —
 *   `font-family=""Apple SD Gothic Neo"…"`. 엄격한 렌더러는 그 카드를 통째로 못 굽는다.
 *   그래서 이 파일은 카드를 **실제 XML 파서**에 넣어 본다(문자열 모양 검사로는 이걸 못 잡았다).
 *
 * ⚠️ 못 하는 것: 카카오가 실제로 어떻게 굽는지 · 화면이 보기 좋은지(브라우저 렌더로 눈 확인).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { generatePassCardSVG } from '@/worker/utils/og-pass-card'
import { generateCuratorSVG } from '@/worker/utils/og-curator-card'
import { buildDetailMeta, PASS_OG_VERSION } from '@/worker/utils/detail-ssr-meta'
import { passShareCardUrl } from '@/shared/pass-share-card'
import { pickExpiring } from '@/pages/my-vouchers/ExpiryNotice'
import { URGENT_DAYS } from '@/pages/my-vouchers/WalletRow'
import FirstVoucherSheet from '@/pages/my-vouchers/FirstVoucherSheet'
import type { Voucher } from '@/pages/my-vouchers/types'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')
const t = (_k: string, o?: Record<string, unknown>) => String(o?.defaultValue ?? _k)

function parsesAsXml(svg: string): boolean {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  return doc.getElementsByTagName('parsererror').length === 0
}

const PHOTO = 'data:image/jpeg;base64,AAAA'

describe('② 이용권 공유 카드', () => {
  it('사진이 있든 없든 올바른 XML 이다 (기존 유어샵 카드가 이걸로 깨져 있었다)', () => {
    expect(parsesAsXml(generatePassCardSVG({ name: '망원 브런치', restaurant_name: '망원' }, PHOTO))).toBe(true)
    expect(parsesAsXml(generatePassCardSVG({ name: '이름 <&> "따옴표"', restaurant_name: "가게's" }, null))).toBe(true)
  })

  it('유어샵 카드도 올바른 XML 이다 (font-family 따옴표 수리)', () => {
    // 두 갈래(사진 0장 = 가운데 신원 / 사진 있음 = 위 신원 + 타일 줄)가 각자 글자를 그린다 — 둘 다 넣어 본다.
    const c = { id: 1, handle: 'a', name: '지원', bio: '소개', profile_image: null }
    expect(parsesAsXml(generateCuratorSVG(c, null, []))).toBe(true)
    expect(parsesAsXml(generateCuratorSVG(c, null, [PHOTO, PHOTO]))).toBe(true)
  })

  it('바깥 그림 참조가 0 이다 — 사진·유달이 모두 data URI', () => {
    const svg = generatePassCardSVG({ name: 'x', restaurant_name: null }, PHOTO)
    const hrefs = [...svg.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs.length).toBe(2)
    for (const h of hrefs) expect(h.startsWith('data:image/')).toBe(true)
    expect(hrefs.some((h) => h.startsWith('data:image/png'))).toBe(true) // 유달이(투명 배경)
  })

  it('카드 위에 가격·할인율을 쓰지 않는다 (가격 옆 유달이 금지)', () => {
    const svg = generatePassCardSVG({ name: '망원 브런치', restaurant_name: '망원' }, PHOTO)
    expect(svg).not.toMatch(/원<|%\s*할인|할인</)
  })

  it('이용권 상세의 og:image 는 공유 카드이고, JSON-LD 는 상품 사진을 유지한다', () => {
    const payload = JSON.stringify({ data: { id: 2888, name: '치즈돈가스', restaurant_name: '홍대돈까스', price: 9000, image_url: 'https://img.example.com/a.jpg', group_buy_status: 'active' } })
    const m = buildDetailMeta(payload, 'https://urdeal.kr', '/pass/2888')
    expect(m?.ogImage).toBe(`https://urdeal.kr/api/og/group-buy/2888?v=${PASS_OG_VERSION}`)
    expect(m?.jsonLd).toContain('https://img.example.com/a.jpg')
  })

  it('상세 페이지의 카카오 공유 버튼(모바일·PC 둘 다)도 같은 판 번호의 카드 주소를 보낸다', () => {
    const page = stripComments(R('pages/GroupBuyDetailPage.tsx'))
    expect(page.match(/passShareCardUrl\(productId\)/g)?.length).toBe(2)
    expect(page).not.toMatch(/[iI]mageUrl=\{`[^`]*\/api\/og\/group-buy\//)
    expect(passShareCardUrl(7)).toBe(`https://urdeal.kr/api/og/group-buy/7?v=${PASS_OG_VERSION}`)
    expect(passShareCardUrl(7)).toMatch(/\?v=\d+$/)
  })

  it('라우트가 카드를 새 생성기 + 인라인 사진으로 그린다', () => {
    const src = stripComments(R('worker/routes/og-image.routes.ts'))
    expect(src).toMatch(/generatePassCardSVG\(product,\s*photoUri\)/)
    expect(src).toMatch(/inlineImage\(product\.image_url/)
  })

  it('사진을 못 박으면 사진 없는 판이 아니라 사진 원본으로 보낸다 (라이브에서 상품 사진이 빠졌던 것)', () => {
    const src = stripComments(R('worker/routes/og-image.routes.ts'))
    expect(src).toMatch(/if \(!photoUri && photoAbs\) return c\.redirect\(photoAbs, 302\)/)
    expect(src.indexOf('c.redirect(photoAbs')).toBeLessThan(src.indexOf('generatePassCardSVG(product, photoUri)'))
  })
})

const V = (over: Partial<Voucher>): Voucher => ({ id: 1, code: 'c', status: 'unused', product_name: '브런치', ...over } as Voucher)
const inDays = (d: number) => new Date(Date.now() + d * 86400000 - 60000).toISOString()

describe('③ 지갑 만료 임박 한 줄', () => {
  it('접힌 줄의 빨강과 같은 기준(URGENT_DAYS)으로 고른다', () => {
    const items = [V({ id: 1, expires_at: inDays(URGENT_DAYS) }), V({ id: 2, expires_at: inDays(URGENT_DAYS + 2) }), V({ id: 3, expires_at: null as unknown as string })]
    expect(pickExpiring(items).map((v) => v.id)).toEqual([1])
  })

  it('사용·만료된 이용권은 고르지 않는다', () => {
    expect(pickExpiring([V({ status: 'used', expires_at: inDays(1) })])).toEqual([])
  })

  it('지갑이 그 한 줄을 그리고, 누르면 같은 QR 이 열린다', () => {
    const page = stripComments(R('pages/MyVouchersPage.tsx'))
    expect(page).toMatch(/<ExpiryNotice items=\{unusedItems\} t=\{t\} onOpen=\{setQrVoucher\} \/>/)
    expect(stripComments(R('pages/my-vouchers/WalletRow.tsx'))).toMatch(/d <= URGENT_DAYS/)
  })
})

describe('④ 첫 이용권 축하 — 딱 한 번', () => {
  beforeEach(() => localStorage.clear())

  it('지갑에 1장뿐이면 뜨고, 다시 열면 안 뜬다', () => {
    const one = [V({})]
    const { unmount } = render(<FirstVoucherSheet items={one} t={t} />)
    expect(screen.getByText('첫 이용권이에요!')).toBeTruthy()
    unmount()
    render(<FirstVoucherSheet items={one} t={t} />)
    expect(screen.queryByText('첫 이용권이에요!')).toBeNull()
  })

  it('이미 여러 장 가진 사람에게는 "첫" 이라고 하지 않는다', () => {
    render(<FirstVoucherSheet items={[V({ id: 1 }), V({ id: 2 })]} t={t} />)
    expect(screen.queryByText('첫 이용권이에요!')).toBeNull()
  })

  it('지갑이 로딩·오류가 아닐 때만 판정한다', () => {
    expect(stripComments(R('pages/MyVouchersPage.tsx'))).toMatch(/!loading && !isError && <FirstVoucherSheet items=\{shownVouchers\}/)
  })
})

describe('① 사용 직후 "어떠셨어요?"', () => {
  const modal = () => stripComments(R('components/voucher/VoucherRedeemModal.tsx'))

  it('직원 확인 시간(취소 가능 시간)이 끝난 뒤에만 뜬다', () => {
    expect(modal()).toMatch(/cancelLeft === 0 && productId \? <RedeemReviewCard productId=\{productId\} \/>/)
  })

  it('소비자 지갑이 상품 id 를 넘긴다 (안 넘기면 카드가 영영 안 뜬다)', () => {
    expect(stripComments(R('pages/my-vouchers/QRModal.tsx'))).toMatch(/productId=\{voucher\.product_id\}/)
  })

  it('리뷰 폼을 두 벌 만들지 않는다 — 상품 상세의 같은 폼을 연다', () => {
    const card = stripComments(R('components/voucher/RedeemReviewCard.tsx'))
    expect(card).toMatch(/m\.ReviewForm/)
    expect(card).toMatch(/<ReviewForm productId=\{productId\} initialOpen initialRating=\{picked\}/)
  })
})

describe('⑤ 빈 화면', () => {
  it('알림함이 비면 유달이와 할 일 하나를 보여준다', () => {
    const src = stripComments(R('pages/NotificationsPage.tsx'))
    expect(src).toMatch(/<Udal mood="notFound"/)
    expect(src).toMatch(/notifications\.emptyCta/)
  })

  it('내 유어샵이 비면 유달이가 회색 타일을 대신한다', () => {
    const src = stripComments(R('pages/curator-page/EmptyUrShop.tsx'))
    expect(src).toMatch(/<Udal mood="empty"/)
    expect(src).not.toMatch(/rgba\(255,86,52/)
  })
})
