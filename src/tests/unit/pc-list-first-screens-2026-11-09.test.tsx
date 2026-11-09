/**
 * 🖥️ PC 첫 화면 둘 — 교환권 목록(`/vouchers`) · 유어샵(`/u/:handle`) (2026-11-09 대표 승인).
 *
 * 라이브 실측(1440px·4G·CPU 4배): PC 교환권 첫 글자 2.27s · PC 유어샵 2.19s — 둘 다 로더-먼저만 걸려 있었다(폰 첫 화면은 PC 에서 걷어낸다/안 그린다).
 * 지키는 것:
 *   ① 교환권 PC 클래스(`VOUCHERS_PC_FS`)는 React 원본 소스의 className 과 한 글자도 안 다르다(VouchersPage·VoucherCard·TopChromeReserve·DealBalanceCard·GifticonBoxEntry·sort-menu)
 *   ② 교환권 PC 본문 = [상단 네비 높이] + 2열[레일 | 본문: 브랜드 줄 자리 · 머리 줄 · 카드 격자] · 가드는 로그인 흔적만(넓은 화면 조건 없음) · 로더는 아래
 *   ③ 유어샵: PC 면 상단 네비 높이 예약이 맨 앞, 폰·크롤러 본문은 종전과 **byte-동일**
 *   ④ 워커: 두 분기 모두 UA 가 조건이 아니라 빌더 선택/인자 · `firstScreenApplies` PC 가지에 둘이 있다
 * ⚠️ 못 보는 것: 마운트 때 픽셀 이동(배포 뒤 PC 뷰포트 CLS 실측) · 레일의 카테고리 목록(서버는 모른다 — 레일 폭 안에서만 자란다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildVouchersPcFirstScreen, buildVouchersFirstScreen, vouchersPcFirstScreenGuardScript } from '@/worker/utils/vouchers-first-screen'
import { buildCuratorFirstScreen } from '@/worker/utils/curator-ssr-body'
import { VOUCHERS_PC_FS, VOUCHERS_PC_COPY, VOUCHERS_PC_CARDS, VOUCHERS_PC_ABOVE_FOLD, VOUCHERS_PC_IMG_W } from '@/shared/vouchers-pc-first-screen'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'
import { firstScreenApplies } from '@/worker/utils/css-first-boot'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const PAGE = src('src/pages/VouchersPage.tsx'), CARD = src('src/pages/vouchers/shared.tsx'), TOP = src('src/pages/vouchers/TopChromeReserve.tsx')
const BAL = src('src/pages/vouchers/DealBalanceCard.tsx'), GIFT = src('src/pages/vouchers/GifticonBoxEntry.tsx'), SORT = src('src/components/ui/sort-menu.tsx')
const has = (source: string, v: string) => source.includes(`"${v}"`) || source.includes(`'${v}'`) || source.includes(`\`${v}\``) || source.includes(v)

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `아메리카노 ${i + 1}`, price: 1500 + i * 100, original_price: 2000 + i * 100, discount_rate: 0, image_url: `https://bizimg.giftishow.com/g${i}.jpg`, brand_name: '컴포즈커피', sold_count: 408 + i, dominant_color: '#AABBCC' }))
const seed = (n = 20) => JSON.stringify({ success: true, data: rows(n) })
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

describe('① 교환권 PC 클래스 = React 원본', () => {
  it.each([
    ['page', PAGE], ['grid', PAGE], ['rail', PAGE], ['head', PAGE], ['h2', PAGE], ['h2Count', PAGE], ['cards', PAGE],
    ['card', CARD], ['cardImgBox', CARD], ['cardImg', CARD], ['cardBody', CARD], ['cardBrand', CARD], ['cardName', CARD], ['cardPriceRow', CARD], ['cardDiscount', CARD], ['cardPrice', CARD], ['cardUnit', CARD], ['cardStrike', CARD], ['cardSold', CARD],
    ['brandWrap', TOP], ['brandTitle', TOP], ['brandRow', TOP], ['brandChip', TOP], ['brandTile', TOP], ['brandLabel', TOP],
    ['balanceText', BAL], ['balanceCta', BAL], ['giftRow', GIFT], ['giftIcon', GIFT], ['giftLabel', GIFT], ['giftChev', GIFT], ['sortWrap', SORT], ['sortBtn', SORT],
  ] as const)('%s', (k, source) => { expect(has(source, VOUCHERS_PC_FS[k]), `${k}: "${VOUCHERS_PC_FS[k]}"`).toBe(true) })
  it('compact 잔액 버튼 클래스 = DealBalanceCard 의 템플릿(compact 가지) · h1 문구 · 사진 폭·sizes · 문구', () => {
    expect(BAL).toContain("rounded-xl active:scale-[0.99] transition-transform ${compact ? 'px-3 py-2' : 'h-11 px-4'}")
    expect(VOUCHERS_PC_FS.balanceBtn).toBe('w-full flex items-center justify-between gap-2 rounded-xl active:scale-[0.99] transition-transform px-3 py-2')
    expect(PAGE).toContain("'교환권'} — 인기 브랜드 기프티콘을 딜로 즉시 구매")
    expect(CARD).toContain(`width: ${VOUCHERS_PC_IMG_W}, format: 'auto'`); expect(CARD).toContain('sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"')
    expect(PAGE).toContain('aboveFold={idx < 8}'); expect(VOUCHERS_PC_ABOVE_FOLD).toBe(8)
    expect(BAL).toContain(VOUCHERS_PC_COPY.balance); expect(GIFT).toContain(`defaultValue: '${VOUCHERS_PC_COPY.gift}'`)
  })
})

describe('② 교환권 PC 본문', () => {
  const html = buildVouchersPcFirstScreen(seed(20), LOADER, 'n', '커피/음료')
  const d = document.createElement('div'); d.innerHTML = html
  const root = d.querySelector('#ur-first-screen')!
  it('[상단 네비 높이] → 2열 그리드(레일 | main) → 카드 10장(앞 8장 eager, 사진 low) → 로더 아래 · 로그인 가드만', () => {
    const page = root.firstElementChild!
    expect(page.getAttribute('class')).toBe(VOUCHERS_PC_FS.page)
    const kids = Array.from(page.children)
    expect(kids[0].tagName).toBe('H1'); expect(kids[0].textContent).toBe(VOUCHERS_PC_FS.h1Text)
    expect(kids[1].getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(kids[2].getAttribute('class')).toBe(VOUCHERS_PC_FS.grid)
    expect(kids[2].children[0].tagName).toBe('ASIDE'); expect(kids[2].children[0].getAttribute('class')).toBe(VOUCHERS_PC_FS.rail)
    expect(kids[2].children[1].tagName).toBe('MAIN')
    const cards = root.querySelectorAll(`.${'ur-cv-card'}`)
    expect(cards.length).toBe(VOUCHERS_PC_CARDS)
    const imgs = Array.from(root.querySelectorAll('img'))
    expect(imgs.filter((i) => i.getAttribute('loading') === 'eager').length).toBe(VOUCHERS_PC_ABOVE_FOLD)
    expect(imgs.every((i) => i.getAttribute('fetchpriority') === 'low')).toBe(true)
    expect(root.textContent).toContain('커피/음료 교환권'); expect(root.textContent).toContain('20+')
    expect(root.textContent).toContain(VOUCHERS_PC_COPY.sort)
    expect(html).toContain('min-height:34dvh'); expect(html.indexOf('LOADER')).toBeGreaterThan(html.indexOf('</div>'))
    const guard = vouchersPcFirstScreenGuardScript('n')
    expect(html).toContain(guard); expect(guard).toContain("s.getItem('user_id')||s.getItem('userId')"); expect(guard).not.toContain('min-width')
  })
  it('빈 시드·깨진 시드는 \'\'(로더 폴백) · 카드 가격 줄에 할인·취소선', () => {
    expect(buildVouchersPcFirstScreen('{"success":true,"data":[]}', LOADER, 'n')).toBe('')
    expect(buildVouchersPcFirstScreen('nope', LOADER, 'n')).toBe('')
    expect(html).toContain(`class="${VOUCHERS_PC_FS.cardStrike}"`)
  })
})

describe('③ 유어샵 PC 네비 예약 · 폰 byte-동일', () => {
  const curator = JSON.stringify({ success: true, curator: { handle: 'jiwon', name: '정지원', bio: '전국 맛집' }, pins: [{ id: 1, product: { id: 2919, name: '소금빵 5개', price: 12400, original_price: 14000, image_url: 'https://media.ur-team.com/u.jpg', restaurant_name: '엔트로피' } }] })
  it('PC 본문은 네비 예약이 맨 앞, 폰 본문은 종전 그대로(기본값)', () => {
    const phone = buildCuratorFirstScreen(curator, LOADER)
    const pc = buildCuratorFirstScreen(curator, LOADER, false)
    expect(phone).toBe(buildCuratorFirstScreen(curator, LOADER, true))
    expect(phone).not.toContain(PC_HOME_FS.topnavRow1)
    if (pc) { // 시드 모양이 빌더 조건을 못 채우면 ''(그때는 이 가지가 아니라 아래 소스 검사가 지킨다)
      const d = document.createElement('div'); d.innerHTML = pc
      expect(d.querySelector('#ur-first-screen')!.firstElementChild!.getAttribute('class')).toBe(PC_HOME_FS.topnav)
      expect(pc.replace(/<div class="[^"]*hidden md:block[^"]*">.*?<\/div><\/div>/, '')).toBe(phone.replace(/<div id="ur-first-screen"/, '<div id="ur-first-screen"'))
    }
    expect(src('src/worker/utils/curator-ssr-body.ts')).toContain("(isMobile ? '' : `<div class=\"${PC_HOME_FS.topnav}\">")
  })
})

describe('④ 워커 배선 · PC CSS 자격', () => {
  const w = src('src/worker/index.ts')
  it('교환권: UA 는 빌더 선택 · 유어샵: UA 는 빌더 인자', () => {
    expect(w).toContain("url.pathname === '/vouchers') { const vouchersFirst = (shouldRenderMobileFirstScreen(c.req.header('user-agent')) ? buildVouchersFirstScreen : buildVouchersPcFirstScreen)(")
    expect(w).toContain("buildCuratorFirstScreen(ssrPayload, urdealLoaderHtml, shouldRenderMobileFirstScreen(c.req.header('user-agent')))")
    expect(w).not.toMatch(/\/\^\\\/u\\\/\[A-Za-z0-9_-\]\{1,40\}\\\/\?\$\/\.test\(url\.pathname\) && shouldRenderMobileFirstScreen/)
  })
  it('firstScreenApplies(PC): /vouchers · /u/:handle 는 자격, /u/me · /search 는 아님', () => {
    expect(firstScreenApplies('/vouchers', PC)).toBe(true); expect(firstScreenApplies('/u/jiwon', PC)).toBe(true)
    expect(firstScreenApplies('/u/me', PC)).toBe(false); expect(firstScreenApplies('/search', PC)).toBe(false)
  })
  it('폰 교환권 본문은 종전 그대로(PC 클래스 없음)', () => {
    const m = buildVouchersFirstScreen(seed(20), LOADER, 'n', '커피/음료')
    expect(m).not.toContain(VOUCHERS_PC_FS.grid); expect(m).not.toContain(PC_HOME_FS.topnavRow1)
  })
})
