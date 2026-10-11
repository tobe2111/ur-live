/**
 * 🔗 **소개 링크 유효기간 24시간 · 마지막 링크 우선** (2026-10-11 대표 *"유효기간 24시간으로 해줘. 7일말고.
 * 그리고 마지막 링크를 우선으로 해줘."*)
 *
 * 지키는 것
 * - 링크로 들어온 **시각부터 24시간** 지나면 소개자가 붙지 않는다(저장소·헤더·체크아웃 모두 같은 판정).
 * - 2026-10-11 이전 7일로 저장된 값도 24시간 규칙으로 다시 판정한다.
 * - 새 링크가 옛 링크를 덮는다. `?seller=`(매장 공유)와 `?ref=`(딜·유어샵)가 섞이면 **나중에 연 쪽**이 결제 `ref` 다.
 * - 지난 값은 요청 직전에 쿠키까지 지운다(서버가 쿠키를 폴백으로 읽는다).
 *
 * ⚠️ 못 막는 것: 브라우저가 바뀌면(카톡 인앱 → 사파리, 다른 폰) 값이 없다 — 링크 방식의 공통 한계.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import {
  readAffiliateRef, writeAffiliateRef, pruneExpiredAffiliateRef, AFFILIATE_REF_TTL_MS, REFERRAL_TTL_HOURS,
} from '@/utils/affiliate-ref-store'
import { getPurchaseRef } from '@/lib/seller-tracking'
import { stripComments } from '../helpers/source-text'
import { CURATOR_DEFAULTS } from '@/shared/constants/policy'

const H = 60 * 60 * 1000
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  document.cookie = 'affiliate_ref=; path=/; max-age=0'
})

describe('⏳ 24시간', () => {
  it('유효기간은 정확히 24시간', () => {
    expect(AFFILIATE_REF_TTL_MS).toBe(24 * H)
  })
  it('23시간 뒤엔 살아 있고 25시간 뒤엔 없다', () => {
    const t0 = 1_800_000_000_000
    writeAffiliateRef('77', t0)
    expect(readAffiliateRef(t0 + 23 * H)?.ref).toBe('77')
    expect(readAffiliateRef(t0 + 25 * H)).toBeNull()
  })
  it('🔴 7일로 저장돼 있던 옛 값도 24시간 규칙으로 판정한다', () => {
    const t0 = 1_800_000_000_000
    localStorage.setItem('affiliate_ref', '55')
    localStorage.setItem('affiliate_ref_expires', String(t0 + 7 * 24 * H)) // 옛 방식: _at 없음
    expect(readAffiliateRef(t0 + 2 * H)?.ref).toBe('55')
    expect(readAffiliateRef(t0 + 2 * 24 * H), '옛 값이 7일을 그대로 누리면 안 된다').toBeNull()
  })
  it('쿠키도 24시간', () => {
    writeAffiliateRef('77')
    expect(document.cookie).toContain('affiliate_ref=77')
    const src = readFileSync('src/utils/affiliate-ref-store.ts', 'utf8')
    expect(src).toMatch(/max-age=\$\{Math\.floor\(AFFILIATE_REF_TTL_MS \/ 1000\)\}/)
  })
  it('지난 값은 정리된다(쿠키 포함) · 살아 있는 값은 안 건드린다', () => {
    const t0 = Date.now() - 30 * H
    writeAffiliateRef('77', t0)
    pruneExpiredAffiliateRef()
    expect(localStorage.getItem('affiliate_ref')).toBeNull()
    expect(document.cookie).not.toContain('affiliate_ref=77')
    writeAffiliateRef('88')
    pruneExpiredAffiliateRef()
    expect(localStorage.getItem('affiliate_ref')).toBe('88')
  })
})

describe('🔁 마지막 링크 우선', () => {
  it('새 ?ref= 가 옛 ?ref= 를 덮는다', () => {
    writeAffiliateRef('11', Date.now() - 2 * H)
    writeAffiliateRef('22')
    expect(readAffiliateRef()?.ref).toBe('22')
  })
  it('🔴 ?seller= 를 먼저 열고 딜 링크로 들어왔으면 딜 링크가 이긴다', () => {
    sessionStorage.setItem('ur_tracking_seller_v1', JSON.stringify({ seller_id: '9', saved_at: Date.now() - H }))
    writeAffiliateRef('22')
    expect(getPurchaseRef()).toBe('22')
  })
  it('딜 링크를 먼저 열고 ?seller= 로 들어왔으면 ?seller= 가 이긴다', () => {
    writeAffiliateRef('22', Date.now() - H)
    sessionStorage.setItem('ur_tracking_seller_v1', JSON.stringify({ seller_id: '9', saved_at: Date.now() }))
    expect(getPurchaseRef()).toBe('9')
  })
  it('하나만 있으면 그것 · 둘 다 지났으면 null', () => {
    writeAffiliateRef('22')
    expect(getPurchaseRef()).toBe('22')
    localStorage.clear()
    expect(getPurchaseRef()).toBeNull()
  })
})

describe('🔌 읽는 곳이 전부 같은 판정을 쓴다 (두 벌 금지)', () => {
  const S = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('요청 헤더(lib/api)', () => {
    const s = S('src/lib/api.ts')
    expect(s).toMatch(/pruneExpiredAffiliateRef\(\);\s*const refRaw = readAffiliateRef\(\)\?\.ref;/)
    expect(s).not.toMatch(/affiliate_ref_expires/)
  })
  it('이용권·교환권·쇼핑 상세 세 화면이 결제 ref 를 같은 함수에서 받는다', () => {
    for (const f of ['src/pages/GroupBuyDetailPage.tsx', 'src/pages/VoucherDetailPage.tsx', 'src/pages/ProductDetailPage.tsx']) {
      const s = S(f)
      expect(s, f).toMatch(/getPurchaseRef/)
      expect(s, `${f}: 매장 링크만 보던 옛 이름이 남아 있다`).not.toMatch(/getTrackedSellerId/)
    }
    expect(S('src/pages/GroupBuyDetailPage.tsx').match(/getPurchaseRef/g)?.length, '딜 결제·카드 결제 두 경로').toBeGreaterThanOrEqual(2)
  })
  it('체크아웃 · 담기 판정 · 적립 · 저장', () => {
    expect(S('src/pages/checkout/useBeforePayment.ts')).not.toMatch(/affiliate_ref_expires/)
    const t = S('src/utils/affiliate-track.ts')
    expect(t).not.toMatch(/affiliate_ref_expires|7 \* 24 \* 60 \* 60/)
    expect(t).toMatch(/writeAffiliateRef\(ref\)/)
  })
  it('엔트리 경로는 정책 파일을 끌어오지 않는다 · 정책 파일은 같은 값을 다시 내보낸다', () => {
    // lib/api.ts(엔트리)가 이 파일을 import 한다. policy.ts 를 거치면 app-constants 청크가
    // 통째로 첫 페인트에 실린다(check-critical-chunks 가 2026-10-11 에 잡았다).
    const src = readFileSync('src/utils/affiliate-ref-store.ts', 'utf8')
    const imports = src.split('\n').filter((l) => /^import\s/.test(l))
    // 엔트리(app-utils)가 읽는 파일이라 다른 청크를 import 하면 첫 페인트가 늘거나(policy) 청크 순환으로
    // 부팅 TDZ 크래시가 난다(shared/utils — 2026-10-11 실측, 모든 화면 빈칸). import 0개를 고정한다.
    expect(imports, '이 파일은 아무것도 import 하지 않는다').toEqual([])
    expect(CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS).toBe(REFERRAL_TTL_HOURS)
    expect(REFERRAL_TTL_HOURS).toBe(24)
  })
})
