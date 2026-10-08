/**
 * 🧬 주입 — **QR 인증 화면** (2026-10-07 로그인 권유 · 2026-10-08 시안 다섯 상황)
 *
 * 되돌리면: 사장님이 모르는 확인코드 화면에서 막히거나(권유 없음), 성공했는데 실패처럼 보이거나(✕ 화면),
 * 다른 매장 사장님이 누를 수 없는 버튼을 누르고 403 을 받는다. 셋 다 에러가 안 나서 아무도 신고하지 않는다.
 */
const SRC = 'src/pages/VoucherVerifyPage.tsx'
const PUB = 'src/features/group-buy/api/group-buy-public.routes.ts'
const T = 'src/tests/unit/voucher-verify-seller-login-2026-10-07.test.ts'

export default [
  {
    name: 'QR로그인권유 — 복귀 주소를 안 싣는다',
    file: SRC,
    find: "<Link to={loggedIn ? '/user/profile' : loginPathFromHere()}",
    replace: "<Link to={loggedIn ? '/user/profile' : '/login'}",
    test: T,
    why: '로그인은 성공하고 **홈으로 떨어진다**. 그 QR 은 손님 폰에 있어 사장님은 다시 찍어야 한다.',
  },
  {
    name: 'QR로그인권유 — 이미 로그인한 사람도 /login 으로 보낸다',
    file: SRC,
    find: '  const loggedIn = !!getUserIdSync()',
    replace: '  const loggedIn = false',
    test: T,
    why: '이미 로그인한 사람을 `/login` 으로 보내면 **아무 일도 안 일어난다** — 버튼이 고장난 것처럼 보인다.',
  },
  {
    name: 'QR인증 — 처리 성공을 다시 "이미 사용됨" 으로 덮는다 (종전 결함)',
    file: SRC,
    find: '      if (res.data.success) finish()\n      else setError(res.data.error || t(\'voucher.verify.processingError\', { defaultValue: \'처리 중 오류가 발생했어요\' }))\n    } catch (err: unknown) {\n      const e = err as { response?: { data?: { error?: string } } }\n      setError(e.response?.data?.error || t(\'voucher.verify.processingError\', { defaultValue: \'처리 중 오류가 발생했어요\' }))\n    } finally {\n      setVerifying(false)\n    }\n  }\n\n  async function redeemWithStoreCode',
    replace: '      if (res.data.success) setVoucher(v => v ? { ...v, status: \'used\' } : v)\n      else setError(res.data.error || t(\'voucher.verify.processingError\', { defaultValue: \'처리 중 오류가 발생했어요\' }))\n    } catch (err: unknown) {\n      const e = err as { response?: { data?: { error?: string } } }\n      setError(e.response?.data?.error || t(\'voucher.verify.processingError\', { defaultValue: \'처리 중 오류가 발생했어요\' }))\n    } finally {\n      setVerifying(false)\n    }\n  }\n\n  async function redeemWithStoreCode',
    test: T,
    why: '정확히 종전 결함이다 — 사장님이 처리에 **성공해도** ✕ 와 "이미 사용된 이용권" 이 떠 실패처럼 보인다.',
  },
  {
    name: 'QR인증 — 다른 매장 사장님에게도 처리 버튼',
    file: SRC,
    find: "  if (opts.isSeller) return 'other-store'",
    replace: "  if (opts.isSeller) return 'redeem'",
    test: T,
    why: '종전 동작 — 좌석만 있으면 어느 매장이든 버튼이 뜨고, 누르면 403 이다.',
  },
  {
    name: 'QR인증 — 조회에 좌석 토큰을 안 싣는다',
    file: SRC,
    find: '`/api/vouchers/verify/${parsedCode}`, isSeller',
    replace: '`/api/vouchers/verify/${parsedCode}`, false',
    test: T,
    why: '토큰이 없으면 서버가 늘 can_redeem=false 를 준다 — 우리 매장 사장님도 "다른 매장" 화면을 본다.',
  },
  {
    name: 'QR인증 — 서버 판정이 매장을 안 본다',
    file: PUB,
    find: "(u.type === 'seller' && voucher.product_seller_id != null && Number(voucher.product_seller_id) === Number(u.id))",
    replace: "(u.type === 'seller')",
    test: T,
    why: '아무 매장 사장님에게나 처리 버튼이 뜬다. 실제 처리는 403 으로 막히니 보안 사고는 아니지만 화면이 거짓말을 한다.',
  },
]
