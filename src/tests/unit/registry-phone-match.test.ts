/**
 * ☎️ **전화번호로 원부 이메일 잇기** — 계약 (2026-08-03 대표 질문에서 신설).
 *
 * ## 왜 되는가
 * 통신판매업 신고는 **상호·전화·이메일을 함께** 공시한다 — 그래서 `commerce` 원부에만 이메일이
 * 20,378건이고(다른 소스 전부 합쳐 152건) 그 행들은 전화도 함께 갖는다. 외부 호출 0회로 이어 붙는다.
 *
 * ## 이름 매칭이 못 잡던 것
 * `"○○커피"` ↔ `"주식회사 ○○커피"` ↔ `"○○커피 강남점"` — 상호는 흔들리고 전화번호는 안 흔들린다.
 *
 * ## 🛡️ 이 시험이 제일 신경 쓰는 것: **오매칭 금지**
 * 잘못 붙은 이메일은 **반송·스팸신고**가 되고 도메인 평판은 되돌리기 어렵다.
 * 그래서 대표번호(1588 등)와 모호한 다중 매칭은 **반드시** 걸러야 한다.
 *
 * ## ⚠️ 못 보는 것
 * - 실제 D1 조인(여기선 순수 판정만). 라이브 판정은 이식 스냅샷의 skip 사유 분포로.
 */
import { describe, it, expect } from 'vitest'
import { normalizePhoneKey, isSharedLine, phoneMatchKey, pickRegistryContact, SHARED_LINE_PREFIXES } from '@/features/marketing/api/registry-phone-match'

describe('정규화 — 매칭 키로 쓸 수 있는 것만', () => {
  it('구분자가 달라도 같은 키가 된다 — 이게 이름 매칭보다 강한 이유다', () => {
    for (const v of ['02-1234-5678', '0212345678', '02 1234 5678', '(02)1234-5678']) {
      expect(normalizePhoneKey(v)).toBe('0212345678')
    }
  })

  it('🔒 짧거나 긴 값은 버린다 — 내선·쓰레기값이 키가 되면 엉뚱한 곳끼리 이어진다', () => {
    expect(normalizePhoneKey('1234')).toBeNull()
    expect(normalizePhoneKey('12345678')).toBeNull()      // 8자리
    expect(normalizePhoneKey('0212345678901')).toBeNull() // 13자리
    expect(normalizePhoneKey(null)).toBeNull()
    expect(normalizePhoneKey('전화없음')).toBeNull()
  })
})

describe('🛡️ 대표번호 차단 — 한 번호에 매장 수백 개', () => {
  it('🔒 알려진 대표번호 접두는 전부 매칭 키에서 제외된다', () => {
    for (const p of SHARED_LINE_PREFIXES) {
      const num = `${p}${'1234567'.slice(0, 11 - p.length)}`
      expect(isSharedLine(num), `${p} 가 대표번호로 안 걸린다`).toBe(true)
      expect(phoneMatchKey(num), `${p} 로 매칭하면 본사 이메일이 남의 매장에 붙는다`).toBeNull()
    }
  })

  it('일반 번호는 통과한다 — 다 막으면 이 기능이 없는 것과 같다', () => {
    expect(phoneMatchKey('02-1234-5678')).toBe('0212345678')
    expect(phoneMatchKey('010-9876-5432')).toBe('01098765432')
    expect(phoneMatchKey('031-777-8888')).toBe('0317778888')
  })
})

describe('🛡️ 모호하면 버린다 — 잘못된 이메일은 반송·스팸신고가 된다', () => {
  it('🔒 같은 번호에 **다른 이메일**이 둘 이상이면 버린다', () => {
    const r = pickRegistryContact([
      { phone: '0212345678', email: 'a@x.com', website: null },
      { phone: '0212345678', email: 'b@y.com', website: null },
    ])
    expect(r).toEqual({ skip: 'ambiguous_phone' })
  })

  it('여러 행이어도 이메일이 **하나로 같으면** 통과 — 지점이 여럿이어도 대표 주소는 하나일 수 있다', () => {
    const r = pickRegistryContact([
      { phone: '0212345678', email: 'A@X.com', website: 'http://x.com' },
      { phone: '0212345678', email: 'a@x.com', website: null },
    ])
    expect(r).toEqual({ email: 'a@x.com', website: 'http://x.com' })
  })

  it('이메일은 **소문자로 정규화**된다 — 대소문자만 다른 걸 다른 주소로 세면 늘 ambiguous 가 된다', () => {
    const r = pickRegistryContact([{ phone: '1', email: '  Foo@Bar.COM ', website: null }])
    expect(r).toEqual({ email: 'foo@bar.com', website: null })
  })

  it('원부 행이 없거나 비어 있으면 사유를 남기고 버린다 — 조용한 0건 금지', () => {
    expect(pickRegistryContact([])).toEqual({ skip: 'no_registry_row' })
    expect(pickRegistryContact([{ phone: '1', email: null, website: null }])).toEqual({ skip: 'registry_row_empty' })
  })

  it('🔒 이메일이 없어도 **홈페이지**만 있으면 값이다 — 크롤 관문이 생긴다', () => {
    expect(pickRegistryContact([{ phone: '1', email: null, website: 'http://a.co' }])).toEqual({ email: null, website: 'http://a.co' })
  })
})
