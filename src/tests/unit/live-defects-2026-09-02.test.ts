/**
 * 🔍 대표가 라이브에서 찍어 보낸 결함 3건 (2026-09-02)
 *
 * 셋 다 **에러가 나긴 나는데 엉뚱한 에러**라 원인을 찾기 어려웠던 클래스다.
 * 정적 검사로 막을 수 있는 부분만 여기서 고정한다 — 실제 응답은 배포 후 curl 이 유일한 판정.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 정적 경로가 /:param 그림자에 가려 죽는다 (라이브 실측 3곳)', () => {
  /**
   * 대표 스크린샷: `/my-stays` 가 "예약 내역을 불러오지 못했어요".
   * 실측하니 `GET /api/group-buy/stays/my-bookings` → **400 "Invalid productId"** 였다.
   * 로그인과 무관하게 항상 깨져 있었다 — 위쪽 `/stays/:productId` 가 먼저 등록돼 있었기 때문이다.
   * 같은 스캔에서 `/api/curator/recommendations` 도 404("큐레이터를 찾을 수 없습니다")로 죽어 있었다.
   */
  const ORDER = [
    ['src/features/group-buy/api/stays-public.routes.ts', "staysPublicRoutes.get('/stays/my-bookings'", "staysPublicRoutes.get('/stays/:productId'"],
    ['src/worker/routes/curator.routes.ts', "curatorRoutes.get('/recommendations'", "curatorRoutes.get('/:handle'"],
    ['src/features/seller/api/seller-gb.routes.ts', "app.get('/support-contact'", "app.get('/:id'"],
  ] as const

  for (const [file, staticRoute, paramRoute] of ORDER) {
    it(`${file.split('/').pop()}: 정적 경로가 먼저 등록된다`, () => {
      const s = read(file)
      const a = s.indexOf(staticRoute)
      const b = s.indexOf(paramRoute)
      expect(a, `${staticRoute} 가 사라졌다`).toBeGreaterThan(-1)
      expect(b, `${paramRoute} 가 사라졌다`).toBeGreaterThan(-1)
      expect(a, `정적(${a})이 파라미터(${b}) 뒤에 있으면 그 경로는 절대 안 불린다`).toBeLessThan(b)
    })
  }

  it('영구 가드가 실제로 돌고 통과한다 (전 레포)', () => {
    const out = execSync('node scripts/check-route-shadowing.mjs', { encoding: 'utf8' })
    expect(out).toContain('그림자에 가린 정적 경로 0건')
  })

  it('정규식 제약 파라미터는 그림자가 아니다 (라이브 200 실측)', () => {
    // `/sellers/:id{[0-9]+}` 는 숫자만 받으므로 `/sellers/unlinked` 를 안 가린다.
    const g = read('scripts/check-route-shadowing.mjs')
    expect(g, '제약을 무시하면 멀쩡한 라우트에 빨간불이 뜬다(오탐으로 가드가 꺼진다)')
      .toMatch(/isOpenParam[\s\S]{0,120}includes\('\{'\)/)
  })

  it('측정 대상이 0이면 통과가 아니라 실패다 (헛도는 가드 방지)', () => {
    expect(read('scripts/check-route-shadowing.mjs')).toMatch(/scanned < \d+[\s\S]{0,200}process\.exit\(1\)/)
  })
})

describe('② 주문내역 종류 탭이 이용권을 "공구" 라 불렀다', () => {
  const TAB = read('src/components/mypage/OrdersTab.tsx')

  /**
   * 대표: *"주문내역에 이용권이 떠야하잖아"*. 분류(`getOrderKind`)는 맞았다 —
   * voucher 카테고리 상품이 `groupbuy` 로 잘 갈렸다. 틀린 건 **라벨**이었다:
   * 2026-06-27 명칭 SSOT 가 "공구권 → 이용권" 으로 정한 바로 그 종류인데 옛 이름이 남아 있었다.
   */
  it('탭 라벨이 이용권이다', () => {
    expect(TAB).toMatch(/kindGroupbuy'[^)]*defaultValue: '이용권'/)
    expect(TAB, '이 칸을 다시 "공구" 라 부르면 명칭 SSOT 와 어긋난다')
      .not.toMatch(/kindGroupbuy'[^)]*defaultValue: '공구'/)
  })

  it('빈 상태 문구도 이용권이다', () => {
    expect(TAB).toMatch(/emptyGroupbuyTitle'[^)]*defaultValue: '이용권 구매 내역이 없습니다'/)
  })

  it('내부 키(groupbuy)는 그대로 — 코드 식별자는 명칭 규칙 대상이 아니다', () => {
    expect(TAB).toContain("key: 'groupbuy'")
    expect(read('src/shared/order-type.ts')).toContain("OrderKind = 'product' | 'voucher' | 'groupbuy'")
  })

  it('6개 언어에 라벨이 있다', () => {
    for (const L of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(read(`public/locales/${L}/translation.json`))
      expect(j.ordersTab?.kindGroupbuy, `${L} kindGroupbuy 누락`).toBeTruthy()
      expect(j.ordersTab?.useInMyGifticons, `${L} useInMyGifticons 누락`).toBeTruthy()
    }
    expect(JSON.parse(read('public/locales/ko/translation.json')).ordersTab.kindGroupbuy).toBe('이용권')
  })
})

describe('②-b 지갑이 둘로 갈렸는데 주문내역 링크는 하나였다', () => {
  const TAB = read('src/components/mypage/OrdersTab.tsx')

  /**
   * 2026-08-31 대표 지시로 `/my-vouchers` 는 **이용권 전용**이 되고 교환권(문자로 오는 기프티콘)은
   * `/my-gifticons` 로 갔다. 그런데 주문내역은 두 종류를 똑같이 `/my-vouchers` 로 보내고 있었다
   * → **교환권을 산 사람이 자기 교환권이 없는 지갑에 도착**했다(빈 화면 = 원인 불명).
   */
  it('교환권은 /my-gifticons, 이용권은 /my-vouchers 로 간다', () => {
    expect(TAB).toMatch(/to=\{kind === 'voucher' \? '\/my-gifticons' : '\/my-vouchers'\}/)
    expect(TAB, '두 종류를 한 곳으로 보내면 한쪽은 반드시 빈 지갑에 도착한다')
      .not.toMatch(/<Link\s+to="\/my-vouchers"/)
  })

  it('안내 문구도 종류에 맞게 갈린다', () => {
    expect(TAB).toContain('useInMyGifticons')
    expect(TAB).toMatch(/useInMyVouchers'[^)]*defaultValue: "'내 이용권'에서 사용하세요"/)
  })

  it('두 지갑 라우트가 실제로 존재한다', () => {
    const APP = read('src/App.tsx')
    expect(APP).toContain('path="/my-vouchers"')
    expect(APP).toContain('path="/my-gifticons"')
  })
})
