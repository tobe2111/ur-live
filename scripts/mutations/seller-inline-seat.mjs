/**
 * 🪑 마이 안 판매 — 좌석 불변식 (2026-09-25, 설계 §15) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-inline-seat-2026-09-25.test.ts
 */
const TEST = 'src/tests/unit/seller-inline-seat-2026-09-25.test.ts'

export default [
  {
    name: '🪑 좌석 목록이 옛 길(switch-to-seller)로 되돌아간다',
    file: 'src/pages/user-profile/useMyStores.ts',
    find: "api.get('/api/seller/my-stores/summary')",
    replace: "api.post('/api/seller/switch-to-seller')",
    test: TEST,
    why: '그 길은 linked_user_id 한 행만 본다 — /store/new 로 만든 좌석(라이브 9개)이 통째로 안 보이고, 사장님은 "내 가게 등록" 을 권유받는다.',
  },
  {
    name: '🪑 전환해도 세대가 안 올라 옛 가게 데이터가 화면에 남는다',
    file: 'src/lib/seller-seat.ts',
    find: '  if (label) { try { localStorage.setItem(\'seller_name\', label) } catch { /* storage 접근 불가 */ } }\n  bumpSeatGeneration()',
    replace: '  if (label) { try { localStorage.setItem(\'seller_name\', label) } catch { /* storage 접근 불가 */ } }',
    test: TEST,
    why: '세대가 하드 리로드를 대신한다 — 안 오르면 A 의 목록을 펼쳐 둔 채 B 로 바꿔도 화면이 A 를 계속 보여 준다.',
  },
  {
    name: '🪑 데이터 훅이 좌석 변화를 구독하지 않는다',
    file: 'src/pages/user-profile/useMyStores.ts',
    find: '  useEffect(() => onSeatChange(() => load()), [load])',
    replace: '',
    test: TEST,
    why: '구독이 없으면 전환은 성공하는데 숫자만 옛 가게 것이다 — 에러가 0이라 아무도 신고하지 않는다.',
  },
  {
    name: '🪑 칩이 좌석이 있어도 계속 떠서 진입점이 둘이 된다',
    file: 'src/pages/user-profile/SellerSwitchInline.tsx',
    find: '  if (hasSeat) return null',
    replace: '  if (false) return null',
    test: TEST,
    why: '같은 화면에 "내 가게" 섹션과 옛 칩이 함께 뜨면 둘은 반드시 갈린다(하나는 좌석, 하나는 linked_user_id 를 본다).',
  },
  {
    name: '🪑 부품이 좌석을 각자 물어 같은 화면이 두 답을 말한다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'export default function SellerSection({ state }: { state: MyStoresState }) {\n  const { stores, currentSellerId, loading, failed } = state',
    replace: 'export default function SellerSection({ state: _state }: { state: MyStoresState }) {\n  const { stores, currentSellerId, loading, failed } = useMyStores()',
    test: TEST,
    why: '요청이 둘이면 응답 시점이 갈리고, 칩과 섹션이 서로 다른 가게를 말하는 순간이 생긴다.',
  },
  {
    name: '🪑 좌석 id 를 토큰이 아니라 localStorage 에서 읽는다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'currentSeatId() === store.seller_id',
    replace: "localStorage.getItem('seller_id') === String(store.seller_id)",
    test: TEST,
    why: 'localStorage 는 토큰과 따로 논다 — 전환 실패로 토큰이 안 바뀐 날에도 "맞다" 고 답해 발급을 건너뛴다.',
  },
  {
    name: '🪑 전환 실패가 조용히 성공으로 넘어간다',
    file: 'src/pages/user-profile/StoreSwitchSheet.tsx',
    find: "    if (!ok) { toast.error('가게를 바꾸지 못했습니다'); return }",
    replace: '',
    test: TEST,
    why: '시트가 닫히면 사장님은 바뀐 줄 안다 — 그 뒤 모든 작업이 옛 가게로 나간다.',
  },
  {
    name: '🪑 불러오기 실패를 0원으로 위장한다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '  if (loading || failed || !store) return null',
    replace: '  if (loading || !store) return null',
    test: TEST,
    why: '"오늘 매출 0원" 은 실패와 구분되지 않는다 — 사장님이 장사가 안 된 줄 안다(머니 표면 룰).',
  },
]
