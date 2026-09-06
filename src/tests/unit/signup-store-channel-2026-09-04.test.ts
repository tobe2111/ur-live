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
 * ## 🌇 2026-09-05 — 판정 근거가 바뀌었다(에이전시 일몰)
 * 처음 판은 **에이전시 초대 코드** 유무로 갈랐다. 대표 지시로 에이전시가 통째로 일몰되면서
 * 그 코드를 **발급할 주체도 받아 줄 대시보드도** 사라졌다 — 아무도 켤 수 없는 스위치가 요금을
 * 가르게 두지 않는다. ⇒ 이 문은 **언제나 `direct`** 이고(카카오 user 세션 전용 = 본인이 자기 가게를
 * 올리는 자리), `brokered` 를 만들 수 있는 문은 **`/store/new` 하나만** 남았다.
 *
 * ## 이 테스트가 고정하는 것
 * ① 가입 폼이 채널을 **반드시 찍는다**(호출이 사라지면 조용히 5% 로 돌아간다)
 * ② 그 값은 `direct` 다 — 이 문에서 `brokered` 가 나오면 직접 입점 사장님이 5% 로 걷힌다
 * ③ `brokered` 의 유일한 출처인 `StoreRegisterModal` 의 **필수 선택 강제**가 살아 있다
 * ④ 가입 퍼널에 **에이전시 초대 코드가 되살아나지 않는다**(요금을 가르던 유령 스위치)
 *
 * ⚠️ **못 막는 것**: 실제 정산이 10% 로 잡히는지는 결제가 있어야 안다(머니 경로 — staging 실결제).
 *   여기서 고정하는 건 "가입이 채널을 남기는가" 와 "그 값을 무엇으로 정하는가" 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { channelFromSelfSignup } from '@/features/seller/api/seller-signup-meta'

const FUNNEL = 'src/features/seller/api/seller-registration.routes.ts'
const PAGE = 'src/pages/SellerRegisterSupplierPage.tsx'
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 본인 가입 문의 채널', () => {
  it('언제나 직접 입점 — 이 문으로는 중개 매장이 오지 않는다', () => {
    expect(channelFromSelfSignup()).toBe('direct')
  })
})

describe('② 가입 폼이 채널을 실제로 찍는다', () => {
  const src = strip(readFileSync(FUNNEL, 'utf8'))

  it('stampSignupStoreChannel 을 부른다', () => {
    expect(src, `${FUNNEL}: 호출이 사라지면 신규 매장이 조용히 미지정(=5%)으로 돌아간다`)
      .toMatch(/stampSignupStoreChannel\s*\(/)
  })

  it('이 문에서 brokered 를 찍지 않는다', () => {
    // 문자열 'brokered' 가 이 퍼널에 등장하면, 누군가 다시 "어떤 가입은 중개" 를 만든 것이다.
    // 그 판단은 `/store/new` 의 명시 질문이 할 일이지 가입 폼이 추측할 일이 아니다.
    expect(src, `${FUNNEL}: 가입 폼이 중개를 추측하면 직접 입점 사장님이 5% 로 걷힌다`)
      .not.toMatch(/brokered/)
  })
})

describe('③ 매장 등록 모달은 채널을 계속 강제한다', () => {
  const modal = readFileSync('src/components/seller/StoreRegisterModal.tsx', 'utf8')

  it('고르지 않으면 제출이 막힌다 — brokered 의 유일한 출처다', () => {
    // `!channel` 가드가 사라지면 채널 없는 매장이 다시 생긴다 — 이 폼이 원래 잘 하고 있던 부분이다.
    expect(strip(modal)).toMatch(/if\s*\(![\s\S]{0,40}!channel/)
  })
})

describe('④ 에이전시 초대 코드는 되살아나지 않는다', () => {
  it('가입 라우트가 agency_intro_code 를 읽지 않는다', () => {
    expect(strip(readFileSync(FUNNEL, 'utf8'))).not.toMatch(/agency_intro_code/)
  })

  it('가입 화면에 에이전시 코드 입력칸이 없다', () => {
    expect(strip(readFileSync(PAGE, 'utf8'))).not.toMatch(/agency_intro_code/)
  })
})
