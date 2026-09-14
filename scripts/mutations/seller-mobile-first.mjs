/**
 * 📱 셀러 대시보드 모바일 우선 재설계 (2026-09-14) — `seller-mobile-first-2026-09-14.test.ts` 가 실제로 실패할 수 있는가.
 */
export default [
  {
    name: '📱 seller-layout 폴더가 다시 generic app-components 로 떨어진다 (셀러 봉투가 소비자 첫 페인트로)',
    file: 'vite.config.ts',
    find: "          if (id.includes('/src/components/seller-layout/')) return 'app-seller-components'\n",
    replace: '',
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why:
      '2026-09-14 CI 가 잡은 그 상태다 — app-components → app-seller-components 순환으로 상세·유어샵·교환권 표면 8건 누수. ' +
      '빌드는 경고만 내고 성공하므로 이 규칙이 사라져도 아무도 모른다.',
  },
  {
    name: '📱 하단 탭이 목록을 손으로 적는다 (모델과 갈린다)',
    file: 'src/components/seller-layout/SellerBottomTabs.tsx',
    find: "const { primary } = useSellerNavModel()",
    replace: "const primary = [{ key: 'orders', path: '/seller/orders', label: '주문', icon: ReceiptIcon, active: false }] as any; void useSellerNavModel",
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why: '두 벌이면 반드시 갈린다 — 사이드바에 있는 탭이 폰엔 없거나 그 반대가 되고, 에러는 안 난다.',
  },
  {
    name: '📱 홈이 다시 더보기에 중복된다 (isCoveredByPrimary 가 홈을 안 덮음)',
    file: 'src/components/seller/seller-primary-nav.ts',
    find: "    if (path === tab.path) return true // 홈(`/seller`)도",
    replace: "    if (tab.key === 'home') continue\n    if (path === tab.path) return true // 홈(`/seller`)도",
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why: '폰 실측에서 더보기 첫 줄에 "대시보드"가 또 떴다. 같은 곳으로 가는 줄이 둘이면 사용자는 둘이 다른 줄인 줄 안다.',
  },
  {
    name: '📱 매장 패널이 게이트 여부로 부모를 바꾼다 (재마운트 → 게이트 깜빡임)',
    file: 'src/pages/SellerPage.tsx',
    find: "            <MyStoresPanel onGateChange={onGateChange} gateOnly={!isPc} />\n          </div>",
    replace: "            {storeGated === true ? <div><MyStoresPanel onGateChange={onGateChange} gateOnly={!isPc} /></div> : <MyStoresPanel onGateChange={onGateChange} gateOnly={!isPc} />}\n          </div>",
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why: '첫 렌더 실측에서 STEP 1 티켓이 아예 안 보였다 — 새 인스턴스가 판정 중(null)을 보고해 게이트가 풀렸다 잠겼다를 반복했다.',
  },
  {
    name: '💸 서버 오늘 매출이 다시 UTC 날짜·결제 실패 포함으로 돌아간다',
    file: 'src/features/seller/api/seller-settlements.routes.ts',
    find: "FROM orders WHERE seller_id = ? AND status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?",
    replace: "FROM orders WHERE seller_id = ? AND DATE(created_at) = ?",
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why: '새벽 0~9시엔 어제 매출이 "오늘"로 찍히고 결제 실패도 매출이 된다 — 홈의 첫 숫자가 거짓말을 한다.',
  },
  {
    name: '🎟️ 판매 스위치가 PAUSED 를 보낸다 (서버 400)',
    file: 'src/pages/seller-group-buy/VoucherRow.tsx',
    find: "status: next ? 'ACTIVE' : 'HIDDEN'",
    replace: "status: next ? 'ACTIVE' : 'PAUSED'",
    test: 'src/tests/unit/seller-mobile-first-2026-09-14.test.ts',
    why: '2026-07-02 실측: 서버 허용 status 는 ACTIVE/SOLD_OUT/HIDDEN/DELETED. 스위치를 끄면 매번 400 이 뜬다.',
  },
]
