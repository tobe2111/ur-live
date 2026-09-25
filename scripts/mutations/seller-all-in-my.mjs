/**
 * 🧰 주입 — "모두 마이에서" (2026-09-26, 설계 §20)
 *
 * 여기 있는 것들은 전부 **에러 없이** 회귀한다. 목록이 갈려도 빌드는 통과하고, 귀환 띠가 빠져도
 * 화면은 멀쩡해 보이며, 좌석 종류가 안 따라가도 메뉴는 그냥 *다른* 메뉴일 뿐이다.
 * 그래서 시험이 실제로 빨간불을 낼 수 있는지 매번 확인한다.
 */
const TEST = 'src/tests/unit/seller-all-in-my-2026-09-26.test.ts'

export default [
  {
    name: '🧰 마이 도구 목록이 대시보드 색인을 안 읽는다 (두 벌로 갈린다)',
    file: 'src/pages/user-profile/seller-section/AllToolsSheet.tsx',
    find: '  const { commandItems } = useSellerNavModel()',
    replace: "  const commandItems = [{ path: '/seller/orders', label: '주문', icon: Search, group: '' }]",
    test: TEST,
    why: '도구가 하나 늘 때마다 두 곳을 고쳐야 하고, 반드시 한쪽을 잊는다 — 잊힌 쪽에서는 그 화면에 닿을 길이 없다.',
  },
  {
    name: '🧰 전체 도구가 다시 대시보드로 나간다 (마이가 경유지가 된다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "        onClick={() => openTool('tools')}",
    replace: "        onClick={() => enterSeat('/seller')}",
    test: TEST,
    why: '그 순간 사장님은 "셀러 대시보드라는 게 따로 있다" 를 배우게 된다 — 대표 지시의 정반대다.',
  },
  {
    name: '↩️ 내보낼 때 귀환 표시를 안 붙인다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '    if (to) window.location.assign(withMyReturn(to))',
    replace: '    if (to) window.location.assign(to)',
    test: TEST,
    why: '이용권 등록 폼은 저장 후 /seller/group-buy 로 간다 — 표시가 없으면 마이에서 출발한 사장님이 대시보드 한복판에 남겨진다.',
  },
  {
    name: '↩️ 귀환 띠가 레이아웃에서 빠진다 (65개가 한꺼번에 길을 잃는다)',
    file: 'src/components/SellerLayout.tsx',
    find: '          <BackToMyBar />',
    replace: '',
    test: TEST,
    why: '띠는 레이아웃 한 곳에만 있다 — 빠지면 마이에서 들어간 모든 화면에서 돌아올 길이 사라진다.',
  },
  {
    name: '↩️ 귀환 흔적을 localStorage 에 적는다 (어제 것이 오늘 뜬다)',
    file: 'src/lib/seller-return.ts',
    find: "    sessionStorage.setItem(KEY, '1')",
    replace: "    localStorage.setItem(KEY, '1')",
    test: TEST,
    why: '탭 수명이어야 한다. 영속으로 적으면 어제 마이에서 들어간 흔적이 오늘 대시보드에 띠로 뜬다.',
  },
  {
    name: '↩️ 마이에 도착해도 흔적을 안 지운다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '  useEffect(() => { clearMyReturn() }, [])',
    replace: '',
    test: TEST,
    why: '여정이 끝났는데 흔적이 남으면, 나중에 대시보드를 직접 열었을 때도 "마이로 돌아가기" 가 뜬다.',
  },
  {
    name: '🪑 도구 목록이 좌석을 안 따라간다 (A 의 메뉴를 B 에서 본다)',
    file: 'src/components/seller-layout/useSellerNavModel.ts',
    find: "(currentSeatType() || localStorage.getItem('seller_type'))",
    replace: "localStorage.getItem('seller_type')",
    test: TEST,
    why: 'localStorage.seller_type 은 로그인할 때만 쓰이고 좌석 전환을 안 따라간다 — 대시보드에도 원래 있던 결함이다.',
  },
  {
    name: '🪑 좌석 토큰 디코드가 두 벌이 된다',
    file: 'src/lib/seller-seat.ts',
    find: '  return readSeatClaims().name\n}',
    replace: '  try {\n    const t = localStorage.getItem(SEAT_TOKEN_KEY) || ""\n    const b = atob(t.split(".")[1] || "")\n    return (JSON.parse(b) as { name?: string }).name || null\n  } catch { return null }\n}',
    test: TEST,
    why: 'claim 을 하나 더 읽을 때마다 세 벌, 네 벌이 된다 — 그리고 한 벌만 고쳐진다(한글 이름이 깨졌던 그 버그가 정확히 이 모양이었다).',
  },
  {
    name: '📱 시트가 뒤로가기를 안 먹는다 (마이가 통째로 닫힌다)',
    file: 'src/pages/user-profile/seller-section/Sheet.tsx',
    find: "    try { window.history.pushState({ urSheet: true }, '') } catch { return }",
    replace: '    if (true) { /* noop */ } else { return }',
    test: TEST,
    why: '안드로이드 사용자는 열린 것을 시스템 뒤로가기로 닫는다 — 칸을 안 쌓으면 앱이 튕긴 것처럼 보인다.',
  },
  {
    name: '📱 시트를 X 로 닫으면 히스토리 칸이 남는다',
    file: 'src/pages/user-profile/seller-section/Sheet.tsx',
    find: '      if (!popped) { try { window.history.back() } catch { /* 히스토리 접근 불가 */ } }',
    replace: '      /* 칸을 안 뺀다 */',
    test: TEST,
    why: '쌓아 둔 칸이 남으면 그 뒤 뒤로가기가 한 번 먹힌다 — 사장님은 버튼이 고장난 줄 안다.',
  },
  {
    name: '🔑 PIN 412 가 안내 문구로만 끝난다 (사장님이 대시보드를 찾아가야 한다)',
    file: 'src/pages/user-profile/seller-section/WithdrawSheet.tsx',
    find: "      if (res?.code === 'PIN_REQUIRED' && onFixPin) { toast.error(BLOCKED.PIN_REQUIRED); onFixPin(); return }",
    replace: '',
    test: TEST,
    why: '돈이 나가는 흐름 한복판에서 화면이 통째로 바뀐다 — 사장님은 출금을 하다 말고 어디론가 보내진다.',
  },
  {
    name: '🔑 PIN 을 걸기만 하고 확인은 안 한다 (출금이 또 412 를 받는다)',
    file: 'src/pages/user-profile/seller-section/PinSheet.tsx',
    find: "      const v = await api.post('/api/seller/verify-pin', { pin })",
    replace: '      const v = { data: { success: true } }',
    test: TEST,
    why: '쿠키는 verify 에서만 나온다 — set 만 하면 사장님은 PIN 을 걸었는데도 출금이 또 막힌다.',
  },
  {
    name: '🔑 비밀번호 필요 여부를 한국어 문장으로 판정한다',
    file: 'src/pages/user-profile/seller-section/PinSheet.tsx',
    find: "          if (res?.code === 'PASSWORD_REQUIRED') {",
    replace: "          if (res?.error === '현재 비밀번호를 입력해주세요') {",
    test: TEST,
    why: '문구를 다듬는 순간 깨진다 — 그리고 깨져도 에러가 안 난다(칸이 안 열릴 뿐이다).',
  },
  {
    name: '🏦 계좌 시트가 좌석을 안 따라가는 localStorage 를 적는다',
    file: 'src/pages/user-profile/seller-section/BankSheet.tsx',
    find: "      toast.success('정산 계좌를 저장했어요')",
    replace: "      localStorage.setItem('seller_bank_name', bank)\n      toast.success('정산 계좌를 저장했어요')",
    test: TEST,
    why: '그 키는 좌석 전환을 안 따라간다 — 가게를 옮긴 뒤 출금하면 직전 가게 계좌가 남는다(§19-3).',
  },
  {
    name: '🔑 풀고 나서 출금으로 안 돌아온다 (흐름이 끊긴다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "      {tool === 'pin' && <PinSheet sellerId={store.seller_id} onClose={() => setTool(null)} onDone={() => setTool('withdraw')} />}",
    replace: "      {tool === 'pin' && <PinSheet sellerId={store.seller_id} onClose={() => setTool(null)} />}",
    test: TEST,
    why: 'PIN 을 걸고 나면 사장님이 출금을 다시 찾아 눌러야 한다 — 그 사이에 왜 눌렀는지 잊는다.',
  },
]
