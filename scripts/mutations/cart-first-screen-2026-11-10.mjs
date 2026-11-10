/** 🧬 주입 — 장바구니 서버 첫 화면 (2026-11-10) */
const T = 'src/tests/unit/cart-first-screen-2026-11-10.test.tsx'
const B = 'src/worker/utils/cart-first-screen.ts'
export default [
  { name: '장바구니첫화면 — 비로그인에도 로더만 준다(빈 장바구니를 안 그린다)', file: B, find: "${authed ? '' : emptyHtml()}", replace: "''", test: T, why: '비로그인의 LCP(빈 장바구니 안내)가 다시 API 뒤 2.0~2.5s 로 돌아간다.' },
  { name: '장바구니첫화면 — 워커가 authed 를 안 넘긴다', file: 'src/worker/index.ts', find: "shouldRenderMobileFirstScreen(c.req.header('user-agent')), authed); /* 비로그인은", replace: "shouldRenderMobileFirstScreen(c.req.header('user-agent'))); /* 비로그인은", test: T, why: '모두 로그인으로 취급돼 비로그인도 로더만 받는다.' },
  { name: '장바구니첫화면 — 빈 장바구니 부품이 클래스를 손으로 적는다', file: 'src/components/cart/EmptyCart.tsx', find: 'className={CART_EMPTY_CLS.wrap}', replace: 'className="flex flex-col items-center justify-center py-20 px-4"', test: T, why: '상수가 바뀌어도 앱이 안 따라와 서버와 갈린다.' },
  { name: '장바구니첫화면 — 뿌리를 흰 바탕으로', file: B, find: 'const page = `<div class="${CART_CLS.root}">', replace: 'const page = `<div class="min-h-[100dvh] bg-white">', test: T, why: '서버 그림(흰) → 완성(bg-warm) 사이 바탕색이 바뀐다.' },
  { name: '장바구니첫화면 — 제목에 개수를 지어 넣는다', file: B, find: '${esc(CART_COPY.title)} </h1>', replace: '${esc(CART_COPY.title)} <span class="${CART_CLS.count}">0</span></h1>', test: T, why: '담긴 게 있어도 0 이 먼저 보였다가 바뀐다(거짓 숫자).' },
  { name: '장바구니첫화면 — 로딩 분기가 다시 흰 바탕 + 큰 로더', file: 'src/pages/CartPage.tsx', find: '<CartHeader itemCount={0} allSelected={false} selectedCount={0} onToggleSelectAll={() => {}} onDeleteSelected={() => {}} /><BrandLoader label=', replace: '<BrandLoader fullScreen label=', test: T, why: '서버 머리줄이 떴다가 로딩에서 사라지고 완성에서 다시 뜬다(깜빡임 2회).' },
  { name: '장바구니첫화면 — 머리줄 부품이 클래스를 손으로 적는다', file: 'src/components/cart/CartHeader.tsx', find: 'className={CART_CLS.headerRow}', replace: 'className="mx-auto max-w-md lg:max-w-[1020px] flex items-center justify-between px-5 py-3"', test: T, why: '상수가 바뀌어도 앱이 안 따라와 서버와 갈린다.' },
  { name: '장바구니첫화면 — PC 에서 네비 예약을 뺀다', file: B, find: "const topnav = isMobile ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", replace: "const topnav = isMobile || true ? '' : `<div class=\"${PC_HOME_FS.topnav}\">", test: T, why: 'PC 에서 네비가 마운트 때 끼어들어 첫 화면이 113px 밀린다.' },
  { name: '장바구니첫화면 — 첫 화면 CSS 자격에서 빠진다', file: 'src/worker/utils/css-first-boot.ts', find: "    || pathname === '/cart' || pathname === '/cart/'", replace: '    || false', test: T, why: '서버가 그린 첫 화면이 앱 CSS 를 기다려 안 보인다.' },
]
