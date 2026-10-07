/**
 * 🧬 주입 — **QR 로 들어온 사장님에게 로그인을 권한다** (2026-10-07 대표 제안)
 *
 * 되돌리면 사장님이 *자기가 모르는 확인코드*를 요구하는 화면에서 막힌다 — 손님 줄 앞에서,
 * 로그인하라는 말 한 줄도 없이. 에러가 안 나므로 그 자리에서 할 수 있는 게 없다.
 */
const SRC = 'src/pages/VoucherVerifyPage.tsx'
const T = 'src/tests/unit/voucher-verify-seller-login-2026-10-07.test.ts'

export default [
  {
    name: 'QR로그인권유 — 안내를 없앤다 (종전 동작)',
    file: SRC,
    find: "                  {t('voucher.verify.sellerAsk', { defaultValue: '이 매장의 사장님이신가요?' })}",
    replace: '                  {null}',
    test: T,
    why:
      '정확히 종전 동작이다. 좌석이 없으면 `PIN 을 입력하세요` 칸만 남고, 그 PIN 은 매장 확인코드라 ' +
      '대부분 매장이 설정을 안 해 뒀다 — 사장님이 할 수 있는 일이 없는 화면이 된다.',
  },
  {
    name: 'QR로그인권유 — 복귀 주소를 안 싣는다',
    file: SRC,
    find: "                  to={loggedIn ? '/user/profile' : loginPathFromHere()}",
    replace: '                  to={loggedIn ? \'/user/profile\' : \'/login\'}',
    test: T,
    why:
      '로그인은 성공하고 **홈으로 떨어진다**. 그 QR 은 손님 폰에 있으므로 사장님은 다시 찍어야 하고, ' +
      '그 사이 손님은 서 있다. 2026-10-01 에 이 레포가 59곳을 전수로 고친 그 클래스다.',
  },
  {
    name: 'QR로그인권유 — 이미 로그인한 사람도 /login 으로 보낸다',
    file: SRC,
    find: '  const loggedIn = !!getUserIdSync()',
    replace: '  const loggedIn = false',
    test: T,
    why:
      '소비자로 로그인했지만 좌석이 없는 사장님을 `/login` 으로 보내면 **아무 일도 안 일어난다** ' +
      '(이미 로그인돼 있다). 버튼이 고장난 것처럼 보이는, 가장 나쁜 종류의 조용한 실패다.',
  },
  {
    name: 'QR로그인권유 — 권유를 벽으로 만든다',
    file: SRC,
    find: '  return (\n    <div className="min-h-screen bg-white dark:bg-[#11141C] flex items-center justify-center px-5">',
    replace: '  if (!isSeller) return <Navigate to={loginPathFromHere()} replace />\n  return (\n    <div className="min-h-screen bg-white dark:bg-[#11141C] flex items-center justify-center px-5">',
    test: T,
    why:
      '"사장님 전용 화면" 으로 보이지만 **이 주소는 손님도 연다**(자기 QR 을 자기 폰으로 찍으면 같은 ' +
      '주소다). 벽을 세우면 손님이 자기 이용권을 못 보고, 로그인해도 볼 것이 없다.',
  },
]
