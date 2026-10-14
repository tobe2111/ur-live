/**
 * 🔒 공개 셀러 페이로드에 **요율·정산·커미션을 싣지 않는다** (2026-10-14, 대표 "계속 진행해").
 *
 * ## 실측 (라이브, **인증 0** — id 순회만으로)
 *
 *     /api/sellers/14/public   홍대돈까스   commission_rate=5    business_number=4790902930
 *     /api/sellers/20/public   청룡갈비     commission_rate=5
 *     /api/sellers/26/public   달빛한스푼   commission_rate=10   ← 같은 서비스에서 2배
 *
 * 그리고 이 응답은 `__SSR_INITIAL_SELLER__` 로 **서빙 HTML 에 박혀** `/s/*`·`/profile/*` 에서
 * 크롤러까지 받았다. **소비자 화면은 그 값을 한 번도 읽지 않는다** — 전수로 세니 걸리는 것은
 * 상품의 `referral_commission_rate`(다른 필드)이거나 셀러 **본인** 정산 화면(인증됨)이다.
 *
 * ## 왜 결함인가
 *
 * 매장별 요율은 **내부 상거래 조건**이다. 대외 랜딩 `/about`(sitemap 제출·색인 대상)이
 * *"어드민에서 셀러별 commission_rate 개별 조정 (협상 여지)"* 라고 알려 주는데, 남의 요율까지
 * 조회되면 그게 바로 협상 근거가 된다(5% 매장이 10% 를 보거나 그 반대).
 *
 * 🔴 CLAUDE.md 는 AI 블로그 초안에 *"운영 정보 차단 — 수수료율·정산·커미션을 아예 넣지 않는다"* 를
 *   강제한다. **같은 기준을 공개 API 에도 적용한다** — 종전엔 같은 정보에 두 가지 기준이었다.
 *
 * ## ✅ 남기는 것
 *
 * `business_number`·`ceo_name`·`business_address` 는 **통신판매업자 표기 의무** 정보이고 유어샵
 * 사업자정보 섹션이 실제로 쓴다. 같이 지우면 표기 의무를 깨뜨리므로 **반대 방향도 잠근다**.
 *
 * ## ⚠️ 이 가드가 못 보는 것
 *
 * - KV 캐시(300s)에 남은 **옛 응답**은 잠시 더 그 필드를 내보낸다(배포 후 5분).
 * - 다른 공개 엔드포인트. 이 시험은 공개 셀러 페이로드 한 자리만 본다.
 * - 라이브에서 실제로 사라졌는지는 **배포 후 실측**만이 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'

const SRC = 'src/worker/utils/seller-public-payload.ts'

/**
 * `SELLER_PUBLIC_COLS` 배열 **안의** 이름만 뽑는다.
 *
 * 🩸 전체 파일을 `includes` 로 보면 안 된다 — `ceo_name` 은 같은 파일의 **다른 블록**
 *   (`seller_business_info` enrich)에도 있어서, SELECT 줄을 지워도 문자열이 남아 주입이
 *   **헛돌았다**(2026-10-14 실제로 그랬다). 지키려는 단위는 **공개 SELECT 목록**이다.
 */
function publicSelectNames(): string[] {
  const code = readCode(SRC)
  const i = code.indexOf('SELLER_PUBLIC_COLS')
  const j = code.indexOf('];', i)
  expect(i, 'SELECT 목록을 못 찾았다').toBeGreaterThan(-1)
  expect(j, 'SELECT 목록의 끝을 못 찾았다').toBeGreaterThan(i)
  return [...code.slice(i, j).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((m) => m[0])
}

/** 공개 응답에 들어가면 안 되는 내부 상거래 조건의 이름들. */
const FORBIDDEN = [
  'commission_rate',
  'settlement_cycle',
  'payout_',
  'fee_rate',
  'platform_fee',
  'margin_',
]

describe('🔒 공개 셀러 페이로드에 내부 상거래 조건이 없다', () => {
  it('① 측정 대상이 비어 있지 않다 (0건이면 통과가 아니라 고장)', () => {
    const code = readCode(SRC)
    expect(code.length, '소스를 못 읽었다').toBeGreaterThan(2000)
    // SELECT 목록이 실제로 거기 있어야 이 시험이 뭔가를 본다.
    expect(code).toMatch(/SELLER_PUBLIC_COLS[\s\S]{0,200}\{ expr: 's\.id' \}/)
  })

  it('② 요율·정산·커미션 이름이 **실행되는 줄**에 하나도 없다', () => {
    const code = readCode(SRC)   // 🔑 주석 제거본 — 제거 사유를 적은 주석이 거짓 빨간불을 내지 않게.
    for (const name of FORBIDDEN) {
      expect(code.includes(name), `공개 셀러 페이로드에 ${name} 가 있다`).toBe(false)
    }
  })

  it('③ 반대 방향 — 통신판매업자 표기 의무 정보는 **공개 SELECT 목록에** 남아 있다', () => {
    const names = publicSelectNames()
    expect(names.length, 'SELECT 목록에서 이름을 하나도 못 뽑았다').toBeGreaterThan(20)
    for (const keep of ['business_number', 'business_address', 'representative_name', 'business_name']) {
      expect(names.includes(keep), `표기 의무 정보 ${keep} 가 공개 SELECT 에서 사라졌다`).toBe(true)
    }
  })

  it('③-2 반대 방향 — 유어샵이 그리는 값도 공개 SELECT 목록에 남아 있다', () => {
    const names = publicSelectNames()
    for (const keep of ['profile_image', 'bio', 'banner_url', 'follower_count', 'sns_instagram', 'brand_color']) {
      expect(names.includes(keep), `화면이 쓰는 ${keep} 가 공개 SELECT 에서 사라졌다`).toBe(true)
    }
  })

  it('④ 제거 사유가 그 자리에 남아 있다 (다음 세션이 되살리지 않게)', () => {
    // 🔴 주석을 **원문**에서 본다 — 이 단언만 주석 제거본을 쓰면 안 된다.
    const raw = readRaw(SRC)
    expect(raw).toMatch(/일부러 뺐다/)
    expect(raw).toMatch(/되살리지 말 것/)
  })
})
