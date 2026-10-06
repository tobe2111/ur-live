/**
 * 🧬 주입 매니페스트 — 이용권 상세 안 B + 1인당 구매 상한 (2026-09-14)
 *
 * 대표 확정: *"안 B로 하자."* + *"셀러가 이용권 한 계정 당 구매 갯수 제한이 걸리게끔 해야할 것 같아."*
 * 지키려는 성질마다 "그걸 깨는 가장 그럴듯한 되돌림" 을 하나씩 심는다. 초록이 뜨면 그 가드는 헛돈다.
 */
const TEST = 'src/tests/unit/detail-unify-qty-cap-2026-09-14.test.ts'
const GB = 'src/pages/GroupBuyDetailPage.tsx'
const STAY = 'src/pages/StayDetailPage.tsx'
const BAR = 'src/pages/stay-detail/StayStickyBar.tsx'
const USAGE = 'src/pages/group-buy/UsageGuide.tsx'
const JOIN = 'src/features/group-buy/api/group-buy.routes.ts'
const CAP = 'src/worker/utils/purchase-cap.ts'
const META = 'src/features/group-buy/api/detail-meta-enrich.ts'

export default [
  {
    name: '[상세0914] 🎟️ 이용 안내에 매장명(사용처) 행이 되살아난다',
    file: USAGE,
    find: "    { k: '사용 방법', v: 'QR 제시 · 확인코드' },",
    replace: "    { k: '사용처', v: '전 지점' },\n    { k: '사용 방법', v: 'QR 제시 · 확인코드' },",
    test: TEST,
    why: '매장명이 제목 위·셀러 카드·위치 카드에서 이미 세 번 나온다. 네 번째는 정보가 아니라 소음이다.',
  },
  {
    name: '[상세0914] 🎟️ 설명이 제목과 같아도 그대로 그린다 (상품명 중복 부활)',
    // 🔄 2026-09-24: 판정의 자리가 상세 본문 → '가게 소개' 부품으로 옮겨졌다(대표 문서 ①).
    //   불변식은 그대로라 주입을 지우지 않고 새 자리로 옮긴다.
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: "  const spec = raw && raw !== (productName || '').trim() ? raw : ''",
    replace: '  const spec = raw',
    test: TEST,
    why: '라이브 상품(2888)은 description 이 name 과 같은 문자열이라 제목이 화면에 세 번 찍힌다.',
  },
  {
    name: '[상세0914] 🎟️ 수량이 본문 카드에서 다시 하단 바로 내려간다',
    file: GB,
    find: '                label="수량"',
    replace: '                label="장수"',
    test: TEST,
    why: '숙소 인원 행과 같은 부품·같은 라벨 규약이어야 두 상세가 한 앱으로 읽힌다.',
  },
  {
    name: '[상세0914] 🎟️ 이용 안내 3단계가 다시 항상 펼쳐진다',
    file: USAGE,
    find: '  const [howToOpen, setHowToOpen] = useState(false)',
    replace: '  const [howToOpen, setHowToOpen] = useState(true)',
    test: TEST,
    why: '늘 펼쳐 두면 그 아래 유의사항·리뷰가 화면 밖으로 밀린다(안 B 가 고친 자리).',
  },
  {
    name: '[상세0914] ⭐ 리뷰 0건이라고 섹션째 숨긴다 (쓰는 자리가 사라진다)',
    file: GB,
    find: '              <ProductReviews productId={productId} limit={5} />',
    replace: '              {Number(detail.review_count || 0) > 0 && <ProductReviews productId={productId} limit={5} />}',
    test: TEST,
    why: '주문 상세의 리뷰 작성 버튼은 **배송완료** 조건이라 배송이 없는 이용권엔 안 열린다. 여기가 유일한 작성 자리다.',
  },
  {
    name: '[상세0914] 🏨 숙소 하단 바가 다시 담아야만 뜬다 (가격 노출 0회로 회귀)',
    file: BAR,
    find: '  if (!hasCart && minPrice == null) return null',
    replace: '  if (!hasCart) return null',
    test: TEST,
    why: '담기 전 가격이 한 번도 안 보이던 것이 안 B 가 고친 결함이다.',
  },
  {
    name: '[상세0914] 🏨 만실인데 목록을 통째로 대체한다 (어떤 객실이 있는지 못 본다)',
    file: STAY,
    find: '              {rooms.every((r) => !r.available) && (',
    replace: '              {false && (',
    test: TEST,
    why: '전부 매진일 때 다음 행동(다른 날짜)을 말해 주는 카드가 사라진다.',
  },
  {
    name: '[상세0914] 🧾 과금 전 재검증이 자기 규칙을 따로 갖는다 (그 틈으로 초과 구매)',
    file: JOIN,
    find: '    const lim2 = await recheck(DB, productId, userId, qty, mppRaw)',
    replace: '    const lim2 = { ok: true } as { ok: true } | { ok: false; error: string }',
    test: TEST,
    why: '사전검증과 재검증이 갈리면 결제창을 띄워 둔 채 다른 탭에서 한도를 채우는 우회가 통한다.',
  },
  {
    name: '[상세0914] 🧾 미설정이 다시 무제한이 된다 (API 직행 100장)',
    file: CAP,
    find: '  return Math.min(HARD_QTY_CAP, platformCap)',
    replace: '  return 0',
    test: TEST,
    why: '0 을 무제한으로 읽으면 상한이 통째로 사라진다 — 화면(10)을 안 거치는 호출이 그대로 통과한다.',
  },
  {
    name: '[상세0914] 🧾 상한이 하드 캡을 넘어간다',
    file: CAP,
    find: "  if (Number.isFinite(n) && n > 0) return Math.min(HARD_QTY_CAP, Math.floor(n))\n  return Math.min(HARD_QTY_CAP, platformCap)",
    replace: "  if (Number.isFinite(n) && n > 0) return Math.floor(n)\n  return platformCap",
    test: TEST,
    why: '설정 실수 하나(9999)가 상한을 무력화한다. 하드 캡은 마지막 안전판이다.',
  },
  {
    name: '[상세0914] 🧾 응답이 실효 상한을 안 싣는다 (화면이 옛 상수로 되돌아감)',
    file: META,
    find: '  try { qty_cap = resolveQtyCap(mppRaw, await getPlatformQtyCap(DB)) } catch { /* fail-soft */ }',
    replace: '  // qty_cap 미계산',
    test: TEST,
    why: '어드민이 기본 한도를 낮춰도 화면은 10 에서 멈춰, 서버가 400 을 주는 조합이 생긴다.',
  },
  {
    name: '[상세0914] 🧾 서버가 기본값 리터럴을 따로 든다 (두 벌이 된다)',
    file: CAP,
    find: "export { DEFAULT_QTY_CAP } from '../../shared/purchase-cap-default'",
    replace: 'export const DEFAULT_QTY_CAP = 10',
    test: TEST,
    why: '두 수가 갈리면 화면이 허용한 수량을 서버가 거절한다 — 사용자는 이유를 모른다.',
  },
]
