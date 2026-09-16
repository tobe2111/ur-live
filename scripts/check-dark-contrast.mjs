#!/usr/bin/env node
/**
 * 🌓 다크 모드에서 **밝은 표면 위 밝은 글자**를 실제 렌더로 찾는다 (2026-09-03 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   대표 신고: 지도 검색창(`urdeal.kr/map?q=부산`)에 친 글자가 **흰 배경 위에 흰색**이라 안 보였다.
 *   원인은 오타가 아니라 구조였다 — 전역 규칙 `.dark input:not(...)`(특이도 0,5,1)이
 *   `text-gray-900`(0,1,0)을 **언제나** 이긴다. 즉 코드는 맞게 썼는데 CSS 가 조용히 뒤집는다.
 *
 *   그리고 이 사고는 **점점 늘어날 수밖에 없는 구조**였다. 2026-09-02 에 지도 위 UI·홈 패널·티켓
 *   카드를 "테마와 무관하게 늘 흰 면"으로 바꿨는데, 전역 다크 규칙은 여전히
 *   "앱이 다크면 표면도 어둡다"를 전제한다. 늘 밝은 표면을 늘릴수록 어긋나는 자리가 늘어난다.
 *   대표가 정확히 그걸 짚었다: *"이런 경우 지금 많은 것 같은데 전수조사 필요해"*.
 *
 * ■ 왜 grep 이 아니라 렌더인가
 *   같은 className 안에 밝은 분기와 어두운 분기가 함께 있어(`panel ? A : B`) 문자열 검사로는
 *   구분이 안 된다. 실제로 이 사고를 grep 으로 찾으려다 **0건**이 나왔다(그 파일의 다른 분기에
 *   `dark:text-` 가 있어서 통과). 특이도 싸움의 승자는 브라우저만 안다 → 렌더해서 잰다.
 *
 * ■ 무엇을 재나
 *   다크 모드로 페이지를 띄우고, 보이는 모든 텍스트 노드에 대해
 *   **실제 글자색(getComputedStyle) vs 실제 뒤 배경색**(투명하면 조상을 타고 올라가 찾는다)의
 *   WCAG 대비를 계산해 3.0 미만이면 신고한다. 배경이 밝은데(휘도 0.5+) 글자도 밝은 경우만 —
 *   즉 "밝은 위 밝음". 어두운 위 어두움은 별개 문제라 여기서 안 본다.
 *
 * ■ 어디서 도는가
 *   `.github/workflows/dark-contrast.yml`(브라우저 필요 — 이 클래스를 건드리는 PR + 손으로 실행)
 *   + `audit-gate.sh`(dist/client 가 있을 때만). **`verify.yml` PR 게이트에는 넣지 않는다** —
 *   `render-smoke.yml` 주석이 정한 판단이다: 브라우저 검사는 느리고 환경에 민감해서, 간헐 실패가
 *   머지를 막으면 결국 가드를 꺼 버리게 된다.
 *
 * ■ 한계 (과신 금지)
 *   - 사진/그라디언트 위 글자는 배경색을 못 재서 건너뛴다(마스크·이미지는 계산 밖).
 *   - **경로 목록이 곧 범위다** — 목록에 없는 화면은 안 본다.
 *     ⚠️ 로그인 뒤 화면은 못 보는 게 아니다: `auth: 'user'` 가 localStorage 를 시드해 그린다.
 *     2026-09-07 에 `/store/new` 가 흰 판 위 흰 글자로 배포된 것은 못 넣어서가 아니라
 *     **안 넣어서**였다. 새 소비자 화면을 만들면 여기 한 줄 추가할 것.
 *   - 서버 데이터가 있어야 그려지는 화면(주문 상세 등)은 빈 상태만 재게 된다.
 *   - 포커스·호버·입력중 상태는 기본 상태만 잰다. 그래서 입력요소는 **값을 넣어** 잰다.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')

if (!fs.existsSync(DIST)) {
  console.log('⏭️  dark-contrast: dist/client 없음 — `npm run build` 후 실행 (skip)')
  process.exit(0)
}

/** 검사할 소비자 경로. 다크가 켜질 수 있는 화면만(대시보드는 라이트 고정이라 제외). */
/**
 * 🩸 2026-09-16 — **머니 화면들이 자기 "빈 상태"만 재고 있었다.**
 *
 *   경로별 측정 검사를 새로 넣자마자 드러났다: `/cart` 4개 · `/checkout` 3개 · `/payment/success` 4개.
 *   실제로 그려지던 것은 각각 *"장바구니가 비어있습니다"* · *"장바구니가 비어있습니다. 다시 시도"* ·
 *   *"결제 승인 실패 — 결제 정보가 유효하지 않습니다"* 였다. 즉 바로 위 주석이 **"여기서 글자가
 *   안 보이면 사람이 돈을 잘못 낸다"** 고 적어 둔 그 화면들이, 존재한 이래 한 번도
 *   **상품·금액·결제 버튼**을 그린 적이 없다.
 *
 *   ⚠️ localStorage 로는 못 고친다 — 장바구니는 `GET /api/cart`, 결제 완료는
 *      `POST /api/payments/confirm` 이 진실이다. 그래서 **그 두 응답만** 가짜로 돌려준다.
 *
 *   🔒 이것은 **표시용 픽스처**이지 결제 로직이 아니다. 잠긴 파일(`payment.routes`·`toss-gateway`)은
 *      한 글자도 안 건드리고, 여기서 만든 숫자는 화면에 글자를 그리게 하는 용도뿐이다
 *      (실제 청구액의 진실은 언제나 서버의 `/confirm` 재검증이다).
 */
const CART_ITEM = (over) => ({
  id: 1, product_id: 2846, product_name: '테스트 이용권 (치즈돈가스)', quantity: 1,
  price_snapshot: 12900, price: 12900, original_price: 18000, discount_rate: 28,
  product_image: '', seller_id: 1, seller_name: '테스트 매장', category: 'meal_voucher',
  product_is_active: 1, product_stock: 99, shipping_fee: 0, ...over,
})
const CART_API = {
  '/api/cart': { success: true, data: { items: [CART_ITEM({}), CART_ITEM({ id: 2, product_id: 2847, product_name: '테스트 이용권 (아메리카노)', price_snapshot: 3200, original_price: 4500, discount_rate: 29 })], summary: { total: 16100 } } },
}
const PAY_CONFIRM_API = {
  '/api/payments/confirm': {
    success: true,
    data: {
      orderId: 'GB-1-1700000000000', orderName: '테스트 이용권', totalAmount: 12900,
      method: '카드', status: 'DONE', approvedAt: '2026-09-16T02:00:00+09:00',
      card: { company: '신한', number: '123456******1234', installmentPlanMonths: 0 },
      receipt: { url: 'https://dashboard.tosspayments.com/receipt/guard' },
    },
  },
}

const ROUTES = [
  // 지도 — 이번 사고가 난 자리
  { route: '/map?q=부산', name: '지도', fill: true },
  { route: '/map?q=부산', name: '지도(필터 시트)', fill: true, open: '[data-testid="open-filter"]' },
  { route: '/map', name: '지도(PC 패널)', pc: true, fill: true },
  // 홈 — 히어로가 사진 위 흰 글자라 픽셀 패스가 꼭 필요한 자리
  { route: '/', name: '홈(모바일)', fill: true },
  { route: '/', name: '홈(PC)', pc: true, fill: true },
  // 목록·카탈로그
  { route: '/vouchers', name: '교환권', fill: true },
  { route: '/vouchers', name: '교환권(PC)', pc: true, fill: true },
  { route: '/browse', name: '쇼핑', fill: true },
  { route: '/search', name: '검색', fill: true },
  { route: '/group-buy', name: '동네딜', fill: true },
  { route: '/stays', name: '숙소', fill: true },
  { route: '/blog', name: '블로그', fill: true },
  // 상세
  { route: '/group-buy/2846', name: '이용권 상세', fill: true },
  { route: '/group-buy/2846', name: '이용권 상세(PC)', pc: true, fill: true },
  // 유어샵
  { route: '/u/jiwon1228', name: '유어샵', fill: true },
  { route: '/u/jiwon1228', name: '유어샵(PC)', pc: true, fill: true },
  // 로그인 후 내 화면
  { route: '/user/profile', name: '마이', auth: 'user', fill: true },
  { route: '/user/profile', name: '마이(PC)', pc: true, auth: 'user', fill: true },
  { route: '/my-vouchers', name: '지갑', auth: 'user', fill: true },
  { route: '/my-orders', name: '주문내역', auth: 'user', fill: true },
  { route: '/cart', name: '장바구니', auth: 'user', fill: true, api: CART_API },
  { route: '/notifications', name: '알림', auth: 'user', fill: true },
  { route: '/wishlist', name: '찜', auth: 'user', fill: true },
  { route: '/my-deal-history', name: '딜 내역', auth: 'user', fill: true },
  // 대외·정적
  { route: '/about', name: '소개', fill: true },
  { route: '/faq', name: 'FAQ', fill: true },
  { route: '/login', name: '로그인', fill: true },
  /**
   * 🩸 2026-09-16 — **입점 랜딩이 이 목록에 없어서** 다크에서 제목이 통째로 안 보이는 채
   *   배포됐다(대표 캡처: `bg-warm` 다크 #11141C 위 `text-ink` #16181C = 1.05:1).
   *   원인은 `text-ink` 가 tailwind 에 **고정 hex** 로 박혀 배경만 테마를 따라간 것인데,
   *   그 클래스를 쓰는 화면이 사실상 이 랜딩뿐이라 **다른 경로를 아무리 돌아도 안 잡힌다.**
   *   ⇒ 경로 목록이 곧 이 가드의 범위다. PC 도 함께 — 액자를 벗은 별도 레이아웃이다.
   */
  { route: '/partners', name: '입점 랜딩', fill: true },
  { route: '/partners', name: '입점 랜딩(PC)', pc: true, fill: true },

  /**
   * 🩸 2026-09-07 — **입력을 받는 화면**을 채운다. 이번에 `/store/new` 의 검색창이 다크에서
   *   흰 판 위 흰 글자(실측 1.00:1)로 배포됐는데 이 가드는 그 경로를 안 돌고 있었다.
   *
   *   ⚠️ 그날 나는 "로그인 필요 페이지는 이 목록에 못 넣는다"고 적었는데 **틀렸다** — 위의
   *      `auth: 'user'` 8건이 이미 그렇게 돌고 있다. 못 넣은 게 아니라 **안 넣었을 뿐**이다.
   *
   *   그리고 입력 화면이 이 클래스의 진앙이다: 전역 `.dark input`(특이도 0,5,1)이 요소의
   *   `text-gray-900`(0,1,0)을 언제나 이기므로, 늘 흰 표면 위 입력은 클래스 유틸로 못 이긴다.
   *   `fill: true` 가 값을 채워 재는 이유도 그것이다(빈 칸이면 placeholder 만 재게 된다).
   */
  { route: '/store/new', name: '매장 등록', auth: 'user', fill: true },
  { route: '/store/new', name: '매장 등록(PC)', pc: true, auth: 'user', fill: true },
  { route: '/account/settings', name: '계정 설정', auth: 'user', fill: true },
  { route: '/mypage/addresses', name: '배송지', auth: 'user', fill: true },
  { route: '/community-group-buy/new', name: '동네 공구 제안', auth: 'user', fill: true },
  { route: '/register', name: '가입', fill: true },
  { route: '/join', name: '가입 선택', fill: true },
  { route: '/u/me/add', name: '유어샵 담기', auth: 'user', fill: true },

  /**
   * 💳 머니 화면 — 여기서 글자가 안 보이면 사람이 **돈을 잘못 낸다.** 위의 목록·상세보다
   *   실패 비용이 크므로 흔들림을 감수하고 넣는다.
   */
  { route: '/checkout', name: '결제', auth: 'user', fill: true, api: CART_API },
  { route: '/points/charge', name: '딜 충전', auth: 'user', fill: true },
  {
    route: '/payment/success?paymentKey=tviva_guard_20260916&orderId=GB-1-1700000000000&amount=12900',
    name: '결제 완료', auth: 'user', fill: true, api: PAY_CONFIRM_API,
  },
  { route: '/my-coupons', name: '쿠폰', auth: 'user', fill: true },

  /**
   * 🩸 2026-09-16 — **이 목록이 죽은 화면을 재고 살아 있는 결제 화면을 안 보고 있었다.**
   *
   *   `docs/FEATURE_STATUS.md` 와 대조해 보니 위 목록의 `/points/charge` 는 `TOPUP_DISABLED`
   *   (2026-07-18 서비스 전체 종료)이고 `/community-group-buy/new` 는 `COMMUNITY_PROPOSAL_HIDDEN`
   *   이다. 그 둘은 재고 있는데, **이용권을 카드로 사는 유일한 화면 `/pay/widget` 은 목록에 없었다**
   *   (실측: 이 파일에서 `pay/widget` 매치 0건). 바로 위 주석이 *"여기서 글자가 안 보이면 사람이
   *   돈을 잘못 낸다"* 고 적어 둔 그 자리다.
   *
   *   그리고 그 화면은 이 가드가 가장 조심하라고 적은 **구조**를 정확히 갖고 있다 —
   *   `TossWidgetPayPage:290` 의 `light-island`(다크에서도 흰 섬). 2026-09-03 audit log 가
   *   *"전역 `.dark input` 이 위젯 이메일 칸을 흰 글자로 덮는 것 차단"* 을 그 클래스의 존재 이유로
   *   적었는데, **그 방어는 한 번도 측정된 적이 없다.**
   *
   *   ⚠️ 꺼진 둘은 **지우지 않았다** — 종료가 뒤집히면 커버리지가 조용히 사라진다. 다만 다음
   *      세션은 이 목록을 늘릴 때 `FEATURE_STATUS.md` 를 먼저 볼 것("코드에 있다 ≠ 살아 있다").
   *
   *   ⚠️ `/pay/widget` 은 Toss SDK 가 외부에서 로드돼야 위젯이 뜬다. 이 환경에서 못 뜨면
   *      **에러 상태**가 되고 위젯 상자는 `hidden` 이라 안 재진다. 그래도 **우리 chrome**
   *      (요약 카드·금액·CTA·에러 상자)은 그려지고, 2026-09-03 에 다크 대응을 새로 넣은 게
   *      바로 그 부분이다. 즉 SDK 없이도 잴 값이 있다.
   */
  {
    route: '/pay/widget?orderId=GB-1-1700000000000&amount=12900&orderName=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%9D%B4%EC%9A%A9%EA%B6%8C&clientKey=test_ck_guard&merchant=%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EB%A7%A4%EC%9E%A5&origAmount=18000&qty=1',
    name: '카드결제(이용권)', auth: 'user', fill: true,
  },
  { route: '/payment/fail?code=PAY_PROCESS_CANCELED&message=%EC%82%AC%EC%9A%A9%EC%9E%90%EA%B0%80%20%EC%B7%A8%EC%86%8C&orderId=GB-1-1700000000000', name: '결제 실패', fill: true },
  { route: '/group-buy/confirm-payment?productId=2846&qty=1', name: '결제 확인', auth: 'user', fill: true },

  /**
   * 🕯️ 2026-09-16 (b) — **입력을 가진 소비자 화면 중 아직 한 번도 안 재 본 것들.**
   *
   * 전수로 세어 보니 소비자 입력 22개가 이 목록 밖에 있었다. 전역 `.dark input`(0,5,1)이
   * 요소의 `text-gray-900`(0,1,0)을 **언제나** 이기므로, 안 재는 입력은 "괜찮다"가 아니라
   * **모른다**가 맞다.
   *
   * ⚠️ `/mypage/addresses` 는 이미 목록에 있었지만 **폼이 모달 뒤**라 9개가 통째로 안 재지고 있었다
   *   — 경로가 목록에 있다고 그 화면의 입력이 재진 것이 아니다. 그래서 같은 경로를 `open` 과 함께
   *   한 줄 더 둔다(리스트 화면은 기존 줄이 계속 잰다).
   */
  { route: '/mypage/addresses', name: '배송지(추가 폼)', auth: 'user', fill: true, open: '[data-testid="address-add"]' },
  { route: '/influencer/settlement', name: '정산 신청', auth: 'user', fill: true },
  { route: '/influencer/discover', name: '소개 찾기', auth: 'user', fill: true },
  { route: '/vouchers/2192', name: '교환권 상세', fill: true },
  { route: '/v/GUARD-TEST-CODE', name: '교환권 확인', fill: true },
  { route: '/store/stats/2846', name: '매장 통계', auth: 'user', fill: true },

  /**
   * 🚫 **이 하네스에서는 못 여는 입력** — 지우지 말고 여기 적어 둔다(다음 세션이 같은 조사를
   *   처음부터 다시 하지 않도록). 전부 "안 고쳐도 된다"가 아니라 **"여기서 못 잰다"** 이다.
   *
   *   · `checkout/NewAddressFormModal`(5) — 배송지 고르기 모달을 **먼저** 열어야 나온다.
   *     `open` 이 이제 배열을 받으므로 두 트리거에 `data-testid` 만 붙이면 열린다(다음 조각).
   *   · `my-orders/CancelOrderModal`(2) · `ReturnRequestModal`(2) — 주문 카드의 버튼에서 열리는데
   *     이 하네스엔 워커가 없어 주문이 0건이다. `/api/orders` 스텁을 만들면 열린다(다음 조각).
   *   · `restaurant-map/SuggestionModal`(1) — **회색 지도 핀**을 눌러야 열린다. 카카오 지도 SDK 가
   *     외부 로드라 이 환경에선 핀 자체가 없다 — 스텁으로 못 만든다.
   *   · `components/KakaoMapPicker`(1) — 쓰는 곳이 셀러 대시보드 4곳(라이트 고정 = 범위 밖) +
   *     `UserGroupBuyCreatePage`(`HOSTING_HIDDEN` 으로 꺼진 `/host/new`)뿐이다.
   */
]

const PORT = 8790

// dist/client 정적 서버 (visual-preview 와 같은 방식 — SPA 폴백)
const server = (await import('node:http')).createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(DIST, url)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  const ext = path.extname(file)
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

let chromium
try { ({ chromium } = await import('playwright')) } catch {
  console.log('⏭️  dark-contrast: playwright 없음 (skip)')
  server.close(); process.exit(0)
}
let exe = process.env.PW_CHROMIUM || ''
if (!exe) {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  try {
    const dir = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop()
    if (dir) {
      for (const c of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = path.join(base, dir, c)
        if (fs.existsSync(p)) { exe = p; break }
      }
    }
  } catch { /* 없으면 기본 탐색 */ }
}
/* 🛡️ 브라우저 바이너리가 없으면(설치 안 한 CI·로컬) **인프라 이유로 빨간불을 내지 않는다** —
   그러면 사람들이 가드를 꺼 버린다(`render-smoke.yml` 이 같은 이유로 PR 게이트가 아니다).
   대신 **크게 소리내고** 건너뛴다. 조용히 통과하면 "돌고 있다"고 착각하게 되는데, 그게 이 레포가
   반복해 당한 '헛도는 가드'다. 실제로 돌리려면 `npx playwright install chromium`. */
let browser
try {
  browser = await chromium.launch(exe ? { executablePath: exe } : {})
} catch (e) {
  console.log('⏭️  dark-contrast: chromium 을 못 띄웠다 — **검사하지 않았다**(통과가 아니다).')
  console.log(`   ${String(e).split('\n')[0]}`)
  console.log('   실행하려면: npx playwright install --with-deps chromium')
  server.close()
  process.exit(0)
}

/** 브라우저 안에서 도는 측정기 — 보이는 텍스트마다 글자색/배경색을 실제로 읽는다. */
const MEASURE = () => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  /* 뒤 배경: 투명하면 조상을 타고 올라간다.
     사진/그라디언트를 만나면 **포기하지 않고** 'PIXEL' 을 돌려준다 — 바깥에서 글자를 잠깐 투명하게
     만들고 그 자리를 스크린샷으로 찍어 진짜 픽셀을 잰다. 2026-09-03 1차판은 여기서 continue 해서
     **사진 위 흰 글자를 통째로 못 봤다**(우리 히어로가 정확히 그 형태다 — 가장 위험한 자리를
     검사에서 빼 놓고 "0건" 을 보고하고 있었던 셈). */
  const bgOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return 'PIXEL'
      const c = parse(s.backgroundColor)
      if (c && c.a >= 0.85) return c
      n = n.parentElement
    }
    const c = parse(getComputedStyle(document.body).backgroundColor)
    return c && c.a >= 0.85 ? c : 'PIXEL'
  }
  const out = []
  const seen = new Set()
  const pixelQueue = []
  let measured = 0
  for (const el of document.querySelectorAll('body *')) {
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'svg', 'path', 'noscript'].includes(tag)) continue
    /* 🩸 2026-09-16: **비활성 컨트롤은 건너뛴다.** WCAG 1.4.3 이 비활성 UI 요소를 명시적으로
       면제한다("Incidental — inactive user interface components"), 그리고 이 레포의 비활성 CTA 는
       `bg-gray-300 text-white`(1.5:1) 라 넣으면 **모든 폼 화면이 영구 빨간불**이 된다.
       ⚠️ 그건 "고칠 수 없는 빨강"이고, 그러면 사람들이 가드를 꺼 버린다 — 이 레포가 반복해 당한 길.
       ⚠️ 이 면제가 못 보는 것: *비활성처럼 보이지만 실제로는 활성*인 컨트롤(disabled 속성 없이
          색만 회색). 그건 여전히 잡힌다(속성으로만 면제한다). */
    if (el.disabled === true || el.getAttribute('aria-disabled') === 'true' || el.closest('[disabled],[aria-disabled="true"]')) continue
    const isField = ['input', 'textarea', 'select'].includes(tag)
    /* 🩸 2026-09-07: `<input type="checkbox">` 는 값이 없어도 `el.value === 'on'` 이다.
       그 'on' 은 **화면에 그려지지 않는다** — 글자로 세면 읽을 것 없는 요소를 신고하게 된다.
       값이 실제로 보이는 타입만 텍스트로 취급한다. */
    const NON_TEXT_INPUT = new Set(['checkbox', 'radio', 'hidden', 'range', 'color', 'file', 'button', 'submit', 'reset', 'image'])
    const fieldShowsValue = isField && !(tag === 'input' && NON_TEXT_INPUT.has((el.getAttribute('type') || 'text').toLowerCase()))
    // 텍스트를 직접 갖고 있는 요소만(부모 중복 방지)
    const own = isField
      ? (fieldShowsValue ? (el.value || el.getAttribute('value') || '') : '')
      : Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ')
    if (!own.trim()) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.15) continue
    const fg = parse(s.webkitTextFillColor && s.webkitTextFillColor !== 'currentcolor' ? s.webkitTextFillColor : s.color)
    if (!fg || fg.a < 0.35) continue
    const key = `${tag}|${own.slice(0, 40)}|${Math.round(r.top)}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = {
      tag, isField,
      text: own.slice(0, 46),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    }
    const bg = bgOf(el)
    if (bg === 'PIXEL') {
      // 사진/그라디언트 위 — 바깥에서 픽셀로 잰다. 여기서 재는 척하고 넘기면 안 된다.
      el.setAttribute('data-dc-pixel', String(pixelQueue.length))
      pixelQueue.push({ ...info, fgRaw: fg })
      continue
    }
    measured++
    const cr = ratio(fg, bg)
    // 두 방향 다 본다: 밝은 위 밝음(이번 사고) · 어두운 위 어두움(같은 클래스의 반대 방향).
    if (cr >= 3.0) continue
    out.push({
      ...info,
      dir: lum(bg) >= 0.5 ? '밝은 표면 위 밝은 글자' : '어두운 표면 위 어두운 글자',
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: Math.round(cr * 100) / 100,
    })
  }
  return { rows: out, measured, pixelQueue }
}

/** 사진/그라디언트 위 글자를 **잠깐 투명하게** 만든다 — 그래야 그 자리의 배경 픽셀이 찍힌다. */
const HIDE_PIXEL_TEXT = () => {
  for (const el of document.querySelectorAll('[data-dc-pixel]')) {
    el.style.setProperty('color', 'transparent', 'important')
    el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important')
    el.style.setProperty('text-shadow', 'none', 'important')
  }
}

/** 한 요소만 **지금 상태 그대로**(호버·포커스가 걸린 채) 잰다. */
const MEASURE_ONE = (sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const s = getComputedStyle(el)
  const fg = parse(s.webkitTextFillColor && s.webkitTextFillColor !== 'currentcolor' ? s.webkitTextFillColor : s.color)
  if (!fg || fg.a < 0.35) return null
  let n = el, bg = null
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null // 사진 위는 픽셀 패스가 맡는다
    const c = parse(cs.backgroundColor)
    if (c && c.a >= 0.85) { bg = c; break }
    n = n.parentElement
  }
  if (!bg) bg = parse(getComputedStyle(document.body).backgroundColor)
  if (!bg || bg.a < 0.85) return null
  const cr = ratio(fg, bg)
  const own = Array.from(el.childNodes).filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ')
  if (cr >= 3.0) return { bad: null }
  return {
    bad: {
      tag: el.tagName.toLowerCase(),
      text: (own || el.getAttribute('aria-label') || '').slice(0, 46),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      dir: lum(bg) >= 0.5 ? '밝은 표면 위 밝은 글자' : '어두운 표면 위 어두운 글자',
      fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: Math.round(cr * 100) / 100,
    },
  }
}

/* PNG 픽셀 읽기 — 의존성을 새로 들이지 않으려고 chromium 자신에게 디코딩을 시킨다
   (sharp/pngjs 를 추가하면 이 가드 하나 때문에 설치가 무거워진다). */
const SHOTDIR = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'dc-'))
const shotPage = await (await browser.newContext()).newPage()
const readPng = async (file) => {
  const b64 = fs.readFileSync(file).toString('base64')
  return await shotPage.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    return { w: c.width, h: c.height, data: Array.from(d.data) }
  }, b64)
}
const relLum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
/** 스크린샷에서 그 사각형의 평균 색 — 글자를 지운 상태로 찍었으니 이게 뒤 배경이다. */
const avgRect = (png, rect) => {
  const sx = Math.max(0, Math.round(rect.x)), sy = Math.max(0, Math.round(rect.y))
  const ex = Math.min(png.w, Math.round(rect.x + rect.w)), ey = Math.min(png.h, Math.round(rect.y + rect.h))
  if (ex <= sx || ey <= sy) return null
  let r = 0, g = 0, b = 0, n = 0
  for (let y = sy; y < ey; y += 2) {
    for (let x = sx; x < ex; x += 2) {
      const i = (y * png.w + x) * 4
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++
    }
  }
  return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : null
}

/**
 * 시트/모달을 **열어야 잰다** — 닫힌 화면만 보면 "0건"이 거짓 안심이 된다.
 * `open` 은 선택자 하나 또는 **차례로 누를 배열**(2단 깊이: 배송지 고르기 → 새 배송지).
 * 🔑 첫 판과 재시도가 **같은 함수**를 쓴다 — 두 벌이면 언젠가 갈린다.
 */
async function openSteps(page, R) {
  if (!R.open) return
  for (const sel of (Array.isArray(R.open) ? R.open : [R.open])) {
    await page.click(sel, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(900)
  }
}

/** 한 경로가 이보다 적게 그렸으면 "안 그려졌다" 로 본다(재시도 후에도 그러면 실패). */
const EMPTY_FLOOR = 5

/** 입력요소 채우기 — **한 벌만 둔다.** 첫 판과 재시도가 서로 다르게 채우면 판정이 갈린다. */
const FILL_INPUTS = () => {
  for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea')) {
    if (!el.value) {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set
      setter?.call(el, '부산')
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
}

const findings = []
let measured = 0
/** 경로별 측정 개수 — 아래 '경로가 통째로 안 그려졌다' 검사에 쓴다. */
const perRoute = []
for (const R of ROUTES) {
  const ctx = await browser.newContext({
    viewport: { width: R.pc ? 1440 : 430, height: 1400 },
    colorScheme: 'dark',
  })
  await ctx.route('**/*', (r) => {
    const u = r.request().url()
    if (!u.startsWith(`http://127.0.0.1:${PORT}`)) return r.abort()
    /* 🩸 API 스텁 — 정적 서버는 `/api/*` 에도 index.html 을 돌려주므로, 화면은 JSON 파싱에
       실패해 **빈 상태/에러 카드**로 떨어진다. 그래서 위 머니 화면들이 자기 에러만 재고 있었다.
       선언된 경로만 가짜 JSON 으로 채운다(나머지는 종전 그대로). */
    const p = new URL(u).pathname
    const body = R.api && R.api[p]
    if (body) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    return r.continue()
  })
  await ctx.addInitScript(() => { try { localStorage.setItem('ur_theme_mode_v1', 'dark') } catch { /* private */ } })
  if (R.auth === 'user') {
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('user_id', '1'); localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_handle', 'preview'); localStorage.setItem('user_name', '정지원')
      } catch { /* private */ }
    })
  }
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${PORT}${R.route}`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(3500)
  // 시트/모달은 열어야 잰다 — 닫힌 화면만 보면 "0건"이 거짓 안심이 된다.
  await openSteps(page, R)
  // 입력요소는 **값이 있을 때** 글자색이 보인다 — 비어 있으면 placeholder 만 재게 된다.
  if (R.fill) { await page.evaluate(FILL_INPUTS).catch(() => {}); await page.waitForTimeout(600) }
  let res = await page.evaluate(MEASURE).catch(() => ({ rows: [], measured: 0, pixelQueue: [] }))

  /**
   * 🩸 2026-09-16 — **고정 대기(3.5초)는 머신이 한가할 때만 맞다.**
   *
   *   `npm run build` 직후에 이 가드를 돌렸더니 `/cart`·`/checkout`·`/payment/success` 셋이
   *   "아무것도 안 그려짐"으로 빨간불이 났는데, **같은 dist 를 단독으로 다시 재니 전부 정상**이었다
   *   (48경로 1,467텍스트, 0건). 즉 화면이 깨진 게 아니라 **빌드 잔여 부하에 렌더가 못 따라온 것**이다.
   *   그리고 CI(`dark-contrast.yml`)가 정확히 그 순서로 돈다 — 빌드하고 바로 잰다.
   *
   *   ⇒ 무른 판정으로 되돌리지 않는다(그러면 진짜 깨진 경로를 놓친다). 대신 **바닥을 밑돈 경로만
   *     한 번 더, 더 길게** 재고 그래도 밑돌면 그때 실패로 본다. 진짜로 안 그려지는 경로는
   *     두 번째에도 안 그려지므로 엄격함은 그대로다.
   */
  if ((res.measured || 0) < EMPTY_FLOOR) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
    await page.waitForTimeout(9000)
    await openSteps(page, R)
    if (R.fill) { await page.evaluate(FILL_INPUTS).catch(() => {}); await page.waitForTimeout(600) }
    const retry = await page.evaluate(MEASURE).catch(() => ({ rows: [], measured: 0, pixelQueue: [] }))
    if ((retry.measured || 0) > (res.measured || 0)) res = retry
  }
  measured += res.measured || 0
  perRoute.push({ name: R.name, route: R.route, n: res.measured || 0 })
  for (const r of (res.rows || [])) findings.push({ ...r, where: R.name, route: R.route })

  /* 🖼️ 사진/그라디언트 위 글자 — 계산으로는 배경색을 못 구한다. 글자를 잠깐 투명하게 만들고
     그 자리를 스크린샷으로 찍어 **진짜 픽셀의 평균 밝기**로 잰다. 우리 히어로가 정확히 이 형태라
     (사진 위 흰 글자) 여기를 안 보면 가장 위험한 자리를 빼놓고 "0건" 을 보고하게 된다. */
  const queue = res.pixelQueue || []
  if (queue.length) {
    await page.evaluate(HIDE_PIXEL_TEXT).catch(() => {})
    await page.waitForTimeout(250)
    const shotPath = path.join(SHOTDIR, `dc-${R.name.replace(/[^\w가-힣]+/g, '_')}.png`)
    await page.screenshot({ path: shotPath }).catch(() => {})
    if (fs.existsSync(shotPath)) {
      const png = await readPng(shotPath)
      for (const q of queue) {
        const avg = avgRect(png, q.rect)
        if (!avg) continue
        measured++
        const cr = contrast(q.fgRaw, avg)
        if (cr >= 3.0) continue
        findings.push({
          ...q, fgRaw: undefined,
          where: R.name, route: R.route,
          dir: relLum(avg) >= 0.5 ? '사진 위 밝은 글자' : '사진 위 어두운 글자',
          bg: `rgb(${avg.r},${avg.g},${avg.b}) (사진 평균)`,
          ratio: Math.round(cr * 100) / 100,
        })
      }
      fs.unlinkSync(shotPath)
    }
  }

  /* 🖱️ 호버·포커스 — 기본 상태만 보면 "누르려는 순간 사라지는 글자" 를 못 본다.
     hover: 로 색이 바뀌는 요소만 골라 실제로 마우스를 올리고 다시 잰다(전부 하면 느리다). */
  const hoverables = await page.evaluate(() => {
    const out = []
    let i = 0
    for (const el of document.querySelectorAll('a,button,[role="button"]')) {
      const cls = typeof el.className === 'string' ? el.className : ''
      if (!/hover:(text-|bg-)/.test(cls)) continue
      if (el.disabled === true || el.getAttribute('aria-disabled') === 'true') continue // WCAG 1.4.3 면제(비활성)
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > innerHeight) continue
      if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      el.setAttribute('data-dc-hover', String(i))
      out.push(i); i++
      if (i >= 12) break
    }
    return out
  }).catch(() => [])
  for (const i of hoverables) {
    const sel = `[data-dc-hover="${i}"]`
    await page.hover(sel, { timeout: 1500 }).catch(() => {})
    const hit = await page.evaluate(MEASURE_ONE, sel).catch(() => null)
    if (hit) { measured++; if (hit.bad) findings.push({ ...hit.bad, where: `${R.name} (호버)`, route: R.route }) }
  }
  const focusables = await page.evaluate(() => {
    const out = []
    let i = 0
    /* 🩸 2026-09-07: 여기엔 **텍스트 검사가 없었다** — 호버 경로(위)는 직접 텍스트 노드를 요구하는데
       포커스 경로만 빠져서, 글자가 자식에 있는 `<button>`(자기 텍스트 0)과 체크박스까지 재고 있었다.
       읽을 것이 없는 요소를 신고하면 진짜 결함이 소음에 묻힌다 — 그러면 결국 가드를 꺼 버리게 된다. */
    const NON_TEXT_INPUT = new Set(['checkbox', 'radio', 'hidden', 'range', 'color', 'file', 'button', 'submit', 'reset', 'image'])
    const readable = (el) => {
      const tag = el.tagName.toLowerCase()
      if (tag === 'input') {
        if (NON_TEXT_INPUT.has((el.getAttribute('type') || 'text').toLowerCase())) return false
        return !!(el.value || el.placeholder)
      }
      if (tag === 'textarea' || tag === 'select') return true
      return Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
    }
    for (const el of document.querySelectorAll('a,button,input,textarea,select,[tabindex]')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > innerHeight) continue
      if (!readable(el)) continue
      /* 🩸 2026-09-16: 비활성 컨트롤은 WCAG 1.4.3 면제다. 그리고 포커스는 애초에 안 간다 —
         `page.focus()` 가 조용히 실패하고 **직전 요소가 포커스된 채** 다시 재게 된다(가짜 신고). */
      if (el.disabled === true || el.getAttribute('aria-disabled') === 'true') continue
      el.setAttribute('data-dc-focus', String(i)); out.push(i); i++
      if (i >= 12) break
    }
    return out
  }).catch(() => [])
  for (const i of focusables) {
    const sel = `[data-dc-focus="${i}"]`
    await page.focus(sel, { timeout: 1500 }).catch(() => {})
    const hit = await page.evaluate(MEASURE_ONE, sel).catch(() => null)
    if (hit) { measured++; if (hit.bad) findings.push({ ...hit.bad, where: `${R.name} (포커스)`, route: R.route }) }
  }

  await ctx.close()
}
await browser.close()
server.close()
try { fs.rmSync(SHOTDIR, { recursive: true, force: true }) } catch { /* 임시 디렉터리 */ }

/* 🛡️ 측정 대상이 0이면 **통과가 아니라 실패**로 본다. 렌더가 깨졌거나(시드 실패·라우트 삭제)
   측정기가 헛돌면 findings 도 0 이라 초록불이 되는데, 그게 이 레포가 반복해 당한 사고다
   (check-guard-registry 가 명시한 "등록은 됐는데 늘 통과하는 가드"). */
if (measured < 200) {
  console.log(`❌ dark-contrast: 측정된 텍스트가 ${measured}개뿐 — 렌더가 깨졌거나 측정기가 헛돈다(통과 아님).`)
  process.exit(1)
}

/* 🩸 2026-09-16 — 위 합계 검사는 **한 경로가 통째로 안 그려져도 못 잡는다.** 다른 41개가
   1,200개를 채우면 초록불이고, 그 경로만 조용히 검사 밖으로 나간다. 실제로 이 목록에
   `/pay/widget` 을 새로 넣으면서 "정말 그려졌나"를 합계로는 확인할 수 없었다 —
   그게 이 레포가 반복해 당한 "측정할 수 없어서 통과" 의 경로별 판이다.
   ⚠️ 빈 상태 화면(주문 0건 등)도 헤더·안내문 몇 줄은 그린다. 5 미만이면 렌더 실패로 본다. */
const EMPTY_ROUTES = perRoute.filter((r) => r.n < EMPTY_FLOOR)
if (EMPTY_ROUTES.length) {
  console.log(`❌ dark-contrast: 아무것도 안 그려진 경로 ${EMPTY_ROUTES.length}건 — 그 경로는 검사되지 않았다(통과 아님).`)
  for (const r of EMPTY_ROUTES) console.log(`   ${r.name}  (${r.route})  측정 ${r.n}개`)
  console.log('\n   흔한 원인: 라우트 삭제·이름 변경 · ProtectedRoute 가 시드를 안 받아 로그인으로 튕김 ·')
  console.log('   필수 쿼리 누락으로 조기 return · 기능이 꺼져(FEATURE_STATUS) 빈 화면.')
  process.exit(1)
}

const BASELINE = path.join(ROOT, 'scripts/dark-contrast-baseline.json')
const known = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { allow: [] }
const sig = (f) => `${f.where}|${f.tag}|${f.text}`
const fresh = findings.filter((f) => !known.allow.includes(sig(f)))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 1))
  process.exit(0)
}

if (fresh.length === 0) {
  console.log(`✅ dark-contrast: 다크에서 안 보이는 글자 0건 (${ROUTES.length}개 경로 실제 렌더 측정, 텍스트 ${measured}개)`)
  process.exit(0)
}
console.log(`❌ dark-contrast: 다크에서 안 보이는 글자 ${fresh.length}건\n`)
for (const f of fresh) {
  console.log(`   ${f.where} (${f.route})`)
  console.log(`     <${f.tag}> "${f.text}"  대비 ${f.ratio}:1  (${f.dir})`)
  console.log(`     글자 ${f.fg} / 배경 ${f.bg}`)
  if (f.cls) console.log(`     class: ${f.cls}`)
  console.log('')
}
console.log('   수정: 그 표면이 "늘 밝은" 자리면 조상에 `light-island` 를 붙인다(전역 .dark 규칙을 끈다).')
console.log('   의도적 예외는 scripts/dark-contrast-baseline.json 의 allow 에 등록.')
process.exit(process.env.STRICT_DARK_CONTRAST === '1' ? 1 : 0)
