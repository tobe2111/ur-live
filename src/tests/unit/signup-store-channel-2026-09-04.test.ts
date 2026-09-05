/**
 * 🏪 **매장 채널은 가입 시점에 정해진다** (2026-09-04 대표).
 *
 * 대표: *"아니 처음에 가입할 때 선택을 하잖아 직접 사장님인지 중개사인지, 그때 정해지면 되는거 아니야?"*
 *
 * 맞다. 그런데 매장이 생기는 문이 **둘**인데 한쪽만 그 질문을 하고 있었다:
 *   · `/store/new` → `POST /api/seller/stores` — "③ 누가 운영하나요?" **필수** ✅
 *   · `/seller/register/supplier` → `POST /register-from-user` — 질문 **없음** ❌
 *
 * 채널이 비면 `channelPlatformRate` 가 `undefined` → **중개(5%)로 폴백**한다. 즉 초대 링크로 들어온
 * 직접 입점 사장님이 **영원히 5%** 로 걷히고, 에러도 경고도 없다(라이브 실측: 8곳 중 7곳 미지정).
 *
 * ## 이 테스트가 고정하는 것
 * ① 가입 폼이 채널을 **반드시 찍는다**(호출이 사라지면 조용히 5% 로 돌아간다)
 * ② 판정은 **추측이 아니라 이미 아는 값** — 에이전시 초대 코드 유무
 * ③ 소개자(인플루언서) 초대는 **direct** — 소개자는 데려오기만 하고 운영하지 않는다.
 *    brokered 로 찍으면 그 사람의 영입 2%(직접 매장 10% 안에서 나간다)가 통째로 사라진다.
 *
 * ⚠️ **못 막는 것**: 실제 정산이 10% 로 잡히는지는 결제가 있어야 안다(머니 경로 — staging 실결제).
 *   여기서 고정하는 건 "가입이 채널을 남기는가" 와 "그 값을 무엇으로 정하는가" 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { channelFromSignup } from '@/features/seller/api/seller-signup-meta'

const FUNNEL = 'src/features/seller/api/seller-registration.routes.ts'
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 판정은 이미 아는 값으로', () => {
  it('에이전시가 데려왔으면 중개', () => {
    expect(channelFromSignup(7)).toBe('brokered')
  })

  it('에이전시 코드가 없으면 직접 — 소개자 초대도 여기 해당한다', () => {
    for (const v of [null, undefined, 0]) expect(channelFromSignup(v)).toBe('direct')
  })

  it('두 값뿐 — 제3의 상태를 만들지 않는다', () => {
    expect(new Set([channelFromSignup(1), channelFromSignup(null)])).toEqual(new Set(['direct', 'brokered']))
  })
})

describe('② 가입 폼이 채널을 실제로 찍는다', () => {
  const src = strip(readFileSync(FUNNEL, 'utf8'))

  it('stampSignupStoreChannel 을 부른다', () => {
    expect(src, `${FUNNEL}: 호출이 사라지면 신규 매장이 조용히 미지정(=5%)으로 돌아간다`)
      .toMatch(/stampSignupStoreChannel\s*\(/)
  })

  it('에이전시 판정값을 넘긴다 — 상수를 박지 않는다', () => {
    const call = src.match(/stampSignupStoreChannel\s*\([^)]*\)/)?.[0] ?? ''
    expect(call, `${FUNNEL}: 채널을 고정값으로 넘기면 대행사 매장까지 10% 가 된다\n${call}`)
      .toContain('introducedAgencyId')
    expect(call).not.toMatch(/'(direct|brokered)'/)
  })
})

describe('③ 매장 등록 모달은 채널을 계속 강제한다', () => {
  const modal = readFileSync('src/components/seller/StoreRegisterModal.tsx', 'utf8')

  it('고르지 않으면 제출이 막힌다', () => {
    // `!channel` 가드가 사라지면 채널 없는 매장이 다시 생긴다 — 이 폼이 원래 잘 하고 있던 부분이다.
    expect(strip(modal)).toMatch(/if\s*\(![\s\S]{0,40}!channel/)
  })
})
