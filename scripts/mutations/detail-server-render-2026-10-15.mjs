/**
 * 🧊 이용권 상세 서버 렌더 2단계(서버 안전화) — 주입 매니페스트.
 * 가드: src/tests/unit/detail-server-render-2026-10-15.test.tsx
 *
 * 이 결함들은 오늘 화면을 안 깨뜨린다(지금은 브라우저만 그린다). 3단계에서 워커가 상세를 그리는 순간
 * ① 서버 렌더가 죽거나 ② hydrate 가 갈려 React 가 서버 HTML 을 버리고 다시 그린다 — 에러 0, 이득 0.
 */
const TEST = 'src/tests/unit/detail-server-render-2026-10-15.test.tsx'

export default [
  {
    name: '🧊 상세가 렌더 중 localStorage 를 바로 읽는다(서버에서 던진다)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "  const storedUserId = useStoredValue('user_id'), storedUid = useStoredValue('uid')\n",
    replace: "  const storedUserId = localStorage.getItem('user_id'), storedUid = localStorage.getItem('uid')\n",
    test: TEST,
    why: '워커에는 localStorage 가 없다 — 상세 서버 렌더가 첫 줄에서 죽는다.',
  },
  {
    name: '🧊 상세가 가드만 두고 브라우저 값을 첫 렌더에 그린다(hydrate 가 갈린다)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "  const sellerId = useStoredValue('seller_id')\n",
    replace: "  const sellerId = typeof localStorage !== 'undefined' ? localStorage.getItem('seller_id') : null\n",
    test: TEST,
    why: '서버는 null, 브라우저는 셀러 id — 같은 첫 렌더가 달라 React 가 서버 HTML 을 버린다(에러 0).',
  },
  {
    name: '🧊 저장값 훅의 서버 스냅샷이 브라우저 값을 준다',
    file: 'src/hooks/useStoredValue.ts',
    find: '  return useSyncExternalStore(subscribeStorage, get, serverNull)',
    replace: '  return useSyncExternalStore(subscribeStorage, get, get)',
    test: TEST,
    why: 'hydrate 첫 렌더가 서버(null)가 아니라 브라우저 값을 그려 갈린다 — 이 훅이 존재하는 이유가 사라진다.',
  },
  {
    name: '🧊 유효기간이 실행 기계의 시간대로 찍힌다',
    file: 'src/pages/group-buy/UsageGuide.tsx',
    find: '  const expiry = voucherExpiry && safeDate(voucherExpiry) ? formatKSTDate(voucherExpiry) : null',
    replace: "  const expiry = voucherExpiry ? safeDate(voucherExpiry)?.toLocaleDateString('ko-KR') : null",
    test: TEST,
    why: '워커(UTC)와 브라우저(KST)가 자정 근처에서 다른 날을 그린다 — hydrate 가 갈리고, 손님에게 하루 틀린 날짜를 보인다.',
  },
]
