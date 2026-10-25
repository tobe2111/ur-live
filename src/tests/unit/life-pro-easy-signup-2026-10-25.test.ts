/**
 * 🚪 생활 업체 — 심사 중에도 견적 · 한 화면 가입 (2026-10-25 대표 *"1번은 해줘. 일단 생활 관련 업체는 가입 쉽게"*).
 *
 * 지키는 것:
 *  ① 심사 중(pending) 업체도 견적을 받고(매칭·알림·보관 요청) 보낸다 — 정지·반려만 막는다. 판정은 한 함수.
 *  ② 손님은 `사업자 인증` 표시로 심사를 마친 업체를 구분한다(서버 값과 화면 표시가 같은 규칙).
 *  ③ 가입은 매장 행을 만들기 **전에** 하는 일·지역·약관·번호를 거른다(반쪽 가입 방지) · 새 매장은 늘 pending.
 *  ④ 🔴 반대 방향: 제휴 업체 지정과 이용권 메인 노출은 여전히 승인된 매장만 — 이 변경이 거기까지 번지면 안 된다.
 *
 * ⚠️ 못 보는 것: 실제 카카오 로그인 → 좌석 진입(브라우저·세션) · 가짜 업체가 견적을 남발하는지(운영 지표).
 */
import { describe, expect, it } from 'vitest'
import { readCode } from '../helpers/source-text'
import { PRO_OPEN_STATUSES, PRO_OPEN_STATUS_SQL, proStatusOpen, proVerified } from '@/shared/home-service'
import { parseProBody } from '@/features/home-service/api/home-service-pro-profile'

const R = (p: string) => readCode(p)

describe('① 심사 중에도 견적 — 상태 판정 한 함수', () => {
  it('pending·approved·active 는 열고 정지·반려·모름은 막는다', () => {
    for (const s of ['pending', 'approved', 'active']) expect(proStatusOpen(s), s).toBe(true)
    for (const s of ['suspended', 'rejected', '', null, undefined, 'closed']) expect(proStatusOpen(s), String(s)).toBe(false)
  })
  it('SQL 목록과 함수 목록이 같다', () => {
    for (const s of PRO_OPEN_STATUSES) expect(PRO_OPEN_STATUS_SQL).toContain(`'${s}'`)
    expect(PRO_OPEN_STATUS_SQL.match(/'/g)!.length / 2).toBe(PRO_OPEN_STATUSES.length)
  })
  it('매칭·업체 수·보관 요청·견적 보내기가 모두 그 판정을 쓴다', () => {
    const db = R('src/features/home-service/api/home-service-db.ts')
    expect(db.match(/s\.status IN \$\{PRO_OPEN_STATUS_SQL\}/g)?.length).toBe(2)
    expect(R('src/features/home-service/api/home-service-notify.ts')).toMatch(/!proStatusOpen\(pro\.status\)/)
    const pro = R('src/features/home-service/api/home-service-pro.routes.ts')
    expect(pro).toMatch(/if \(!proStatusOpen\(seller\?\.status\)\)/)
    expect(pro).not.toMatch(/NOT_APPROVED/)
  })
})

describe('② 사업자 인증 표시', () => {
  it('승인·활성만 인증', () => {
    expect(proVerified('approved')).toBe(true)
    expect(proVerified('active')).toBe(true)
    expect(proVerified('pending')).toBe(false)
  })
  it('손님 견적 목록이 verified 를 싣고 화면이 그린다', () => {
    expect(R('src/features/home-service/api/home-service.routes.ts')).toMatch(/s\.status IN \('approved', 'active'\) THEN 1 ELSE 0 END AS verified/)
    expect(R('src/pages/life/LifeRequestDetailPage.tsx')).toMatch(/q\.verified \?[\s\S]{0,200}사업자 인증/)
  })
})

describe('③ 한 화면 가입', () => {
  it('하는 일·지역 검증', () => {
    expect(parseProBody({ categories: [], areas: [{ sido: '서울', sigungu: '' }] }).ok).toBe(false)
    expect(parseProBody({ categories: ['store_pest'], areas: [] }).ok).toBe(false)
    expect(parseProBody({ categories: ['store_pest'], areas: [{ sido: '서울', sigungu: '강남구' }], phone: '02-123' }).ok).toBe(false)
    const ok = parseProBody({ categories: ['store_pest', 'nope'], areas: [{ sido: '서울', sigungu: '강남구' }], phone: '010-1234-5678' })
    expect(ok.ok && ok.cats).toEqual(['store_pest'])
    expect(ok.ok && ok.phone).toBe('01012345678')
  })
  it('매장 행을 만들기 전에 거르고, 새 매장은 pending', () => {
    const s = R('src/features/home-service/api/home-service-pro-signup.ts')
    const ins = s.indexOf('INSERT INTO sellers')
    expect(ins).toBeGreaterThan(0)
    for (const guard of ['parseProBody(body)', 'isValidTermsVersion(', 'normalizeProName(']) {
      expect(s.indexOf(guard), guard).toBeGreaterThan(0)
      expect(s.indexOf(guard), guard).toBeLessThan(ins)
    }
    expect(s.slice(ins, ins + 300)).toMatch(/'store_owner', 'pending'/)
    expect(s).toMatch(/grantOperator\(DB, sid!, userId, userId, 'owner'\)/)
    // 이미 가게가 있으면 새로 만들지 않는다
    expect(s.indexOf('existingStore(DB, userId)')).toBeLessThan(ins)
  })
  it('라우트가 붙어 있고 랜딩이 이용권 가게 등록으로 보내지 않는다', () => {
    expect(R('src/features/home-service/api/home-service-pro.routes.ts')).toMatch(/\.post\('\/signup',[^\n]*proSignupHandler\)/)
    expect(R('src/pages/life/pro/ProLanding.tsx')).not.toMatch(/\/store\/new/)
    expect(R('src/pages/life/LifeProPage.tsx')).toMatch(/!hasToken && loggedIn \?[\s\S]{0,400}<ProSetupForm[^>]*signup/)
  })
})

describe('④ 반대 방향 — 다른 곳은 여전히 승인 매장만', () => {
  it('제휴 지정은 승인만', () => {
    expect(R('src/features/home-service/api/home-service-admin.routes.ts')).toMatch(/\['approved', 'active'\]\.includes\(String\(s\.status\)\)/)
  })
  it('제휴 업체 알림도 승인만', () => {
    expect(R('src/features/home-service/api/home-service-notify.ts')).toMatch(/WHERE s\.id = \? AND s\.status IN \('approved', 'active'\)/)
  })
})
