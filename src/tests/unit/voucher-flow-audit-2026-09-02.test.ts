/**
 * 🎟️ 이용권 등록 플로우 전수조사 (2026-09-02 — 대표 "이용권 등록 플로우 너가 전수조사 해봐. 지금 문제가 많네.")
 *
 * 라이브 D1 실측이 출발점이었다. 플랫폼 전체에 **매장은 정확히 1개**(id 14, 2026-08-26 등록)뿐이고
 * 그 매장의 상품은 **0개**였다 — 즉 대표가 겪은 것은 개별 버그가 아니라 **플로우가 끝까지 통한 적이
 * 없는 상태**였다. 아래 다섯 가지가 그 원인이고, 각각을 되돌리면 이 파일이 빨간불이 된다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 브라우저에서의 렌더·클릭·네트워크. 여기서 고정하는 것은
 *   "소스에 그 배선이 남아 있는가" 뿐이다. 최종 판정은 배포 후 실제 등록 1회.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 매장 등록 — 빈 이메일이 UNIQUE 슬롯을 잡아 두 번째부터 100% 실패했다', () => {
  const SRC = read('src/features/seller/api/seller-stores.routes.ts')

  /**
   * 라이브: `CREATE UNIQUE INDEX idx_sellers_email_unique ON sellers(email) WHERE email IS NOT NULL`.
   * `''` 는 NULL 이 **아니라서** 그 부분 인덱스에 들어간다 → 첫 매장이 슬롯을 차지하고 그 뒤는 전부
   * UNIQUE 위반 → catch → "매장 등록 중 오류가 발생했습니다". 실측: `email=''` 셀러가 정확히 1행.
   */
  it('sellers INSERT 가 email 을 빈 문자열로 넣지 않는다', () => {
    const insert = SRC.slice(SRC.indexOf("INSERT INTO sellers"))
    const values = insert.slice(0, insert.indexOf('`).bind'))
    expect(values, "VALUES 에 `''` 가 있으면 그게 email 자리다 — 부분 UNIQUE 를 다시 밟는다")
      .not.toMatch(/VALUES \(\?, ''/)
  })

  it('매장마다 고유한 주소를 만든다 (username 기반 — 충돌 불가)', () => {
    expect(SRC).toMatch(/const storeEmail = `\$\{username\}@store\.invalid`/)
    expect(SRC, '만든 값을 실제로 bind 해야 한다 — 선언만 하고 안 쓰면 아무것도 안 고쳐진다')
      .toMatch(/\.bind\(username, storeEmail,/)
  })

  it('`.invalid` 를 쓴다 — 실수로 발송될 수 없는 예약 TLD(RFC 6761)', () => {
    expect(SRC).toContain('@store.invalid')
    expect(SRC, '@ur-team.com 같은 실도메인을 쓰면 언젠가 그 주소로 메일이 나간다')
      .not.toMatch(/\$\{username\}@(?!store\.invalid)/)
  })
})

describe('② /support-contact 가 /:id 그림자에 가려 400 을 냈다', () => {
  const SRC = read('src/features/seller/api/seller-gb.routes.ts')

  /**
   * Hono 는 **등록 순서**로 매칭한다. `/:id` 가 먼저면 `/support-contact` 요청이 id="support-contact"
   * 로 잡히고 `intParam(...,0)` → 0 → 400 '잘못된 상품 ID'(대표 콘솔 신고). 경로 문자열이 다르므로
   * 라우트 중복 가드(`check-duplicate-routes`)는 이 그림자를 **못 본다** — 순서로만 지켜진다.
   */
  it('정적 경로가 /:id 보다 먼저 등록된다', () => {
    const staticAt = SRC.indexOf("app.get('/support-contact'")
    const paramAt = SRC.indexOf("app.get('/:id'")
    expect(staticAt, '/support-contact 핸들러가 사라졌다').toBeGreaterThan(-1)
    expect(paramAt, '/:id 핸들러가 사라졌다').toBeGreaterThan(-1)
    expect(staticAt, `정적 ${staticAt} 이 파라미터 ${paramAt} 뒤에 있으면 영원히 400 이다`)
      .toBeLessThan(paramAt)
  })
})

describe('③ 매장 게이트가 좌석만 봐서, 매장을 운영 중인 사람에게 등록을 요구했다', () => {
  const SRC = read('src/features/seller/api/seller-stores.routes.ts')

  /**
   * `store_ready` 는 `sellers.id`(= 지금 앉은 좌석) 한 행만 본다. 매장은 별도 `sellers` 행이고
   * 사람은 `seller_operators` 로 그 좌석에 접근한다 ⇒ 개인 좌석에 앉아 있으면 게이트가 닫혔다.
   * 실측: user 3 은 매장 14 의 운영자인데 좌석은 5(개인)라, 시킨 대로 등록해도 **같은 가게가
   * 두 번 등록될 뿐** 게이트는 계속 닫히는 막다른 길이었다.
   */
  it('/stores/context 가 사람 기준 매장 보유도 함께 본다', () => {
    const h = SRC.slice(SRC.indexOf("app.get('/stores/context'"))
    const body = h.slice(0, h.indexOf('\n})'))
    expect(body).toContain('listOperableStores')
    expect(body, 'store_ready 를 좌석 판정만으로 두면 이 사고가 그대로 재발한다')
      .toMatch(/store_ready:\s*data\.store_ready\s*\|\|\s*operableCount > 0/)
  })

  it('화면이 "등록" 대신 "선택" 을 말할 수 있게 개수를 함께 싣는다', () => {
    expect(SRC).toContain('operable_store_count')
  })

  it('게이트만 넓히고 권한은 넓히지 않는다 — 좌석 토큰은 여전히 canOperateStore 를 통과해야 한다', () => {
    const OPS = read('src/features/seller/api/seller-operators.routes.ts')
    const tok = OPS.slice(OPS.indexOf("app.post('/stores/:sellerId/token'"))
    expect(tok.slice(0, 2000)).toContain('canOperateStore')
  })
})

describe('③-b 매장이 하나뿐이면 선택 칩이 아예 안 보였다', () => {
  const SRC = read('src/pages/seller-meal-voucher/StoreStep.tsx')

  /**
   * 종전 조건 `stores.length >= 2` 는 "매장 1개 + 개인 좌석" 인 사람에게 칩을 0개로 만들었다 —
   * 자기 매장이 있는데 고를 수가 없고 화면은 "매장을 등록하세요" 만 반복했다(대표 실사례).
   */
  it('앉아 있지 않은 매장이 하나라도 있으면 칩을 보여준다', () => {
    expect(SRC, 'length>=2 로 되돌리면 매장 1개인 사람이 다시 갇힌다')
      .not.toMatch(/\{stores\.length >= 2 && \(/)
    expect(SRC).toMatch(/\{stores\.some\(s => s\.seller_id !== currentId\) && \(/)
  })

  it('이미 매장이 있으면 안내가 "등록" 이 아니라 "선택" 이다', () => {
    expect(SRC).toContain('hasOtherStore')
    expect(SRC).toContain('seller.mealVoucher.pickStoreHint')
  })
})

describe('④ 대시보드(화이트 고정) 안에서 dark: 유틸이 살아나 흰 글자가 됐다', () => {
  const CFG = read('tailwind.config.js')

  /**
   * 대표 신고: 매장 검색 결과의 가게 이름이 안 보였다. `KakaoMapPicker` 의
   * `text-gray-900 dark:text-white` 는 **그 자체로는 올바른 코드**다(소비자 화면에서도 쓰인다).
   * 문제는 화이트 고정 대시보드 안에서도 그 `dark:` 가 살아 있었다는 것 —
   * `check-dashboard-theme.sh` 는 `src/pages/Seller*` 만 보고, `.force-light-theme` 는
   * **입력 글자만** 지킨다. 그래서 둘 다 이 클래스를 못 막았다.
   */
  const variant = (CFG.match(/darkMode: \[[^\]]*\]/) || [''])[0]

  it('라이트 고정 래퍼 안에서는 dark: 유틸이 꺼진다', () => {
    for (const w of ['seller-light-theme', 'admin-light-theme', 'agency-light-theme', 'force-light-theme']) {
      expect(variant, `${w} 안에서 dark: 가 살아 있으면 흰 배경에 흰 글자가 난다`)
        .toContain(`:not(.${w} *)`)
    }
  })

  it('기존 .light-island 는 그대로 (2026-09-02 대표 확정 "다크에서도 패널은 흰색")', () => {
    expect(variant).toContain(':not(.light-island *)')
    expect(variant, '.dark 스코프 자체를 잃으면 소비자 다크모드가 통째로 죽는다')
      .toContain('&:is(.dark *)')
  })
})

describe('⑤ 판매 마감이 9시간 늦게 걸렸다 (datetime-local ↔ UTC)', () => {
  const PAGE = read('src/pages/SellerMealVoucherNewPage.tsx')
  const FORM = read('src/pages/seller-meal-voucher/voucher-form.ts')

  /**
   * `datetime-local` 값은 **타임존 없는 벽시계**다. 셀러는 KST 로 고르는데 서버는 UTC 로 읽는다
   * (워커 TZ=UTC · cron `group_buy_deadline < datetime('now')`). 게다가 기본값만 `toISOString()`
   * 이라 **한 칸 안에 UTC 와 KST 두 규약**이 섞여 있었다.
   * 라이브 실측상 마감이 들어간 셀러 이용권은 0건이라 이 수정은 순수히 앞으로에만 적용된다.
   */
  it('저장 직전 KST→UTC 로 한 번만 변환한다', () => {
    expect(PAGE).toMatch(/group_buy_deadline: kstInputToUTC\(form\.group_buy_deadline\)/)
  })

  it('기본값도 화면 규약(KST 벽시계)을 따른다', () => {
    expect(FORM, 'toISOString().slice(0,16) 을 칸에 그대로 넣으면 셀러에게 9시간 이르게 보인다')
      .not.toMatch(/return new Date\(Date\.now\(\) \+ 7 \* 24 \* 3600 \* 1000\)\.toISOString\(\)\.slice\(0, 16\)/)
    expect(FORM).toContain('utcToKstInput')
  })
})

describe('⑤-b 변환 함수가 실제로 9시간을 옮긴다 (문자열 검사 말고 계산)', () => {
  it('KST 벽시계 → UTC', async () => {
    const { kstInputToUTC, utcToKstInput } = await import('@/utils/date')
    expect(kstInputToUTC('2026-09-09T23:00')).toBe('2026-09-09 14:00:00')
    expect(kstInputToUTC('2026-01-01T08:30')).toBe('2025-12-31 23:30:00')
    expect(kstInputToUTC('')).toBe('')
    expect(kstInputToUTC(null)).toBe('')
  })

  it('UTC → KST 벽시계 (브라우저 TZ 와 무관해야 한다)', async () => {
    const { utcToKstInput } = await import('@/utils/date')
    expect(utcToKstInput('2026-09-09 14:00:00')).toBe('2026-09-09T23:00')
    expect(utcToKstInput('2025-12-31T23:30:00Z')).toBe('2026-01-01T08:30')
    expect(utcToKstInput('')).toBe('')
  })

  it('왕복하면 제자리 — 규약이 한 번만 적용된다', async () => {
    const { kstInputToUTC, utcToKstInput } = await import('@/utils/date')
    for (const v of ['2026-09-09T23:00', '2026-03-01T00:00', '2026-12-31T23:59']) {
      expect(utcToKstInput(kstInputToUTC(v))).toBe(v)
    }
  })
})

describe('⑥ 위저드가 없어진 카테고리 3종을 계속 내밀었다 — 고른 것과 다른 게 저장됐다', () => {
  const STEP = read('src/pages/seller-meal-voucher/VoucherInfoStep.tsx')
  const FORM = read('src/pages/seller-meal-voucher/voucher-form.ts')

  /**
   * health/pet/activity 는 2026-05-17 통합으로 **레거시**가 됐고 서버가 저장 직전
   * `canonicalCategory` 로 접어 넣는다(헬스→미용 · 반려/액티비티→기타). 그 정규화 자체는 옳다 —
   * 2026-08-22 에 **피드에 아예 안 뜨던 것**을 그렇게 고쳤다. 남은 문제는 화면이 없는 선택지를
   * 계속 보여줘, 셀러가 "헬스" 를 고르면 조용히 "미용" 으로 등록됐다는 것이다(에러 0).
   */
  it('선택지가 실제 4종뿐이다', () => {
    for (const legacy of ['health_voucher', 'pet_voucher', 'activity_voucher']) {
      expect(STEP, `${legacy} 는 저장 시 다른 값으로 접힌다 — 고를 수 있게 두면 안 된다`)
        .not.toContain(`'${legacy}' as const`)
    }
    for (const real of ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']) {
      expect(STEP, `${real} 선택지가 사라졌다`).toContain(`'${real}' as const`)
    }
  })

  it('위저드 타입이 플랫폼 SSOT 를 그대로 쓴다 (목록을 두 벌 갖지 않는다)', () => {
    expect(FORM).toContain("from '@/shared/constants/voucher-categories'")
    expect(FORM, '자체 유니온을 다시 세우면 SSOT 가 바뀔 때 또 갈린다')
      .not.toMatch(/export type VoucherCategory\s*=\s*\n?\s*\|/)
  })

  it('서버는 여전히 레거시를 접어 넣는다 (옛 드래프트·복사 유입 대비 — 이 안전판은 지운 게 아니다)', () => {
    const SRV = read('src/features/seller/api/seller-orders.routes.ts')
    expect(SRV).toContain('canonicalCategory(body.category)')
  })

  it('6개 언어에 기타 이용권 라벨이 있다', () => {
    for (const L of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = JSON.parse(read(`public/locales/${L}/translation.json`))
      expect(j.seller?.voucher?.categoryEtc, `${L} 에 categoryEtc 누락`).toBeTruthy()
      expect(j.seller?.voucher?.categoryEtcDesc, `${L} 에 categoryEtcDesc 누락`).toBeTruthy()
    }
  })
})

describe('③-c 승인 대기 매장을 세면 게이트만 열리고 좌석은 안 바뀐다 (막히는 것보다 나쁘다)', () => {
  const SRV = read('src/features/seller/api/seller-stores.routes.ts')
  const STEP = read('src/pages/seller-meal-voucher/StoreStep.tsx')

  /**
   * 신규 매장은 `status='pending'`(사람이 등록증을 보고 승인)이고 좌석 토큰은 `active|approved`
   * 에만 나온다. 승인 대기까지 세면 **게이트는 열리는데 좌석 전환은 거부** → 이용권이 개인 좌석으로
   * 등록된다. 그건 막히는 것보다 나쁘다 — 잘못된 매장 이름으로 팔린다.
   */
  it('서버 게이트가 앉을 수 있는 매장만 센다', () => {
    expect(SRV).toMatch(/status === 'active' \|\| \w+\.status === 'approved'/)
  })

  it('토큰 발급 조건과 같은 판정을 쓴다 (두 곳이 갈리면 이 사고가 재발한다)', () => {
    const OPS = read('src/features/seller/api/seller-operators.routes.ts')
    expect(OPS).toContain("seller.status !== 'active' && seller.status !== 'approved'")
  })

  it('화면도 승인 대기 매장을 고를 수 있는 것처럼 보여주지 않는다', () => {
    expect(STEP).toMatch(/const seatable = \(s: OperableStore\) =>/)
    expect(STEP, '고르라고 해 놓고 서버가 거부하면 안 된다')
      .toMatch(/if \(!seatable\(s\)\) \{/)
    expect(STEP).toContain('승인 대기')
  })
})
