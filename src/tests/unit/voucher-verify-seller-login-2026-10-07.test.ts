/**
 * 🔑 **일반 카메라로 QR 을 찍고 들어온 사장님에게 로그인을 권한다** (2026-10-07)
 *
 * 대표: *"QR 인증을 사장님이 할 때 로그인이 안되어있으면 일반 카메라로 QR 인증 시 카카오 로그인을
 * 먼저 요청하는게 맞지 않을까?"*
 *
 * ## 무엇이 틀렸나
 * 손님 QR 은 `https://urdeal.kr/v/{code}` 를 담는다. 폰 기본 카메라로 찍으면 그 주소가 열린다.
 * 그 화면(`VoucherVerifyPage`)은 좌석이 있으면 초록 상자 + [사용 처리] 를 주지만, **없으면
 * 그 상자가 그냥 안 뜨고** `PIN 을 입력하세요` 칸만 남는다. 그 PIN 은 매장 확인코드
 * (`store_verify_pin`)이고 **대부분 매장이 설정을 안 해 뒀다.**
 * ⇒ 사장님은 *자기가 모르는 것을 요구하는 화면*을 보고 막히는데, 로그인하라는 말도 버튼도 없었다.
 *
 * ## ⚠️ 벽이 아니라 권유다
 * 이 화면은 **손님도 연다**(자기 QR 을 자기 폰으로 찍으면 같은 주소). 로그인 벽을 세우면 손님이
 * 자기 이용권을 못 본다. 그리고 **이미 로그인한 사람을 `/login` 으로 보내면 아무 일도 안 일어난다** —
 * 그 경우는 마이의 '내 가게' 로 보내 매장을 고르게 한다(없는 길로 보내지 않는다).
 *
 * ## ❌ 이 시험이 못 보는 것
 * 로그인 후 실제로 그 QR 화면으로 돌아오는지(`loginPathFromHere` 의 전수 가드가 따로 본다) ·
 * 좌석 발급 흐름.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/pages/VoucherVerifyPage.tsx')

describe('QR 로 들어온 사장님에게 로그인을 권한다', () => {
  it('① 좌석이 없을 때 안내가 뜬다', () => {
    expect(SRC).toMatch(/\{!isSeller && \(/)
    expect(SRC).toMatch(/voucher\.verify\.sellerAsk/)
  })

  it('② 🔒 벽이 아니다 — 이용권 정보와 손님 PIN 경로가 그대로 남아 있다', () => {
    // 손님이 자기 QR 을 찍었을 때 이 화면이 통째로 로그인으로 바뀌면 안 된다.
    expect(SRC).toMatch(/voucher\.verify\.enterPin/)
    expect(SRC).toMatch(/useVoucher\(\)/)
    // 조기 리다이렉트(화면 대신 로그인으로 보내기)가 생기면 안 된다.
    expect(SRC).not.toMatch(/navigate\(loginPathFromHere/)
    expect(SRC).not.toMatch(/<Navigate/)
  })

  it('③ 복귀 주소를 싣는다 — 로그인하고 홈으로 떨어지면 안 된다', () => {
    expect(SRC).toMatch(/loginPathFromHere\(\)/)
    expect(SRC).not.toMatch(/to="\/login"/)
  })

  it('④ 이미 로그인한 사람을 /login 으로 보내지 않는다 (아무 일도 안 일어난다)', () => {
    expect(SRC).toMatch(/const loggedIn = !!getUserIdSync\(\)/)
    expect(SRC).toMatch(/to=\{loggedIn \? '\/user\/profile' : loginPathFromHere\(\)\}/)
  })

  it('⑤ 좌석이 있으면 종전 그대로 — PIN 없이 사용 처리', () => {
    expect(SRC).toMatch(/\{isSeller && \(/)
    expect(SRC).toMatch(/useVoucherAsSeller/)
  })
})
