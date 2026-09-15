/**
 * 🪟 공구 상세 테두리 걷기 — 안 3 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/gb-detail-borders-2026-09-15.test.ts
 *
 * 두 방향을 다 잡는다: **되돌아가는 것**(테두리 부활)과 **과잉교정**(구분선까지 걷기).
 * 후자가 더 흔하다 — "테두리 0" 을 규칙으로 오독하면 카드 안 구분선까지 지운다.
 */
const TEST = 'src/tests/unit/gb-detail-borders-2026-09-15.test.ts'
const DETAIL = 'src/pages/GroupBuyDetailPage.tsx'
const BOX = 'src/pages/group-buy/DealPurchaseBox.tsx'
const USAGE = 'src/pages/group-buy/UsageGuide.tsx'

export default [
  {
    name: '[테두리] 지도 상자가 되살아난다 (섹션 갭과 경계가 두 겹)',
    file: DETAIL,
    find: "<div style={{ borderRadius: 14, overflow: 'hidden' }}>",
    replace: "<div style={{ borderRadius: '14px 14px 0 0', overflow: 'hidden', border: '1px solid var(--gbd-line2)', borderBottom: 'none' }}>",
    test: TEST,
    why: '이 페이지는 이미 8px 색면 갭으로 섹션을 나눈다 — 상자를 또 두르면 같은 일을 두 번 한다(규칙 ① 위반).',
  },
  {
    name: '[테두리] 주소 줄이 다시 상자 안으로 들어가 좌우가 어긋난다',
    file: DETAIL,
    find: "gap: 11, padding: '13px 0 0' }}>",
    replace: "gap: 11, padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderTop: 'none', borderRadius: '0 0 14px 14px' }}>",
    test: TEST,
    why: '안쪽 패딩이 생기면 이 줄만 다른 섹션보다 안으로 들어가 왼쪽 정렬이 깨진다.',
  },
  {
    name: '[테두리] 내 공구 CTA 가 다시 테두리 상자가 된다',
    file: DETAIL,
    find: "padding: '13px 14px', background: 'var(--gbd-chip)', borderRadius: 14",
    replace: "padding: '13px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 14",
    test: TEST,
    why: '규칙 ① 위반 — 걷어낸 자리는 면으로 채우거나 비운다.',
  },
  {
    name: '[테두리] PC 히어로 테두리가 되살아난다',
    file: DETAIL,
    find: 'className="relative lg:rounded-2xl lg:overflow-hidden"',
    replace: 'className="relative lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100 dark:lg:border-[#2C2F35]"',
    test: TEST,
    why: '사진 자체가 경계다 — 그 위에 선을 두르면 경계가 두 겹이다.',
  },
  {
    name: '[테두리] PC 구매 박스가 하드코딩 그림자로 되돌아간다 (다크에서 안 꺼진다)',
    file: BOX,
    find: "borderRadius: 18, padding: 18, background: 'var(--gbd-card)', boxShadow: 'var(--lift)'",
    replace: "border: '1px solid var(--gbd-line2)', borderRadius: 18, padding: 18, background: 'var(--gbd-card)', boxShadow: '0 6px 24px rgba(0,0,0,.06)'",
    test: TEST,
    why: '다크는 `--lift: none` 이라 그림자가 꺼져야 하는데 하드코딩 값은 테마를 모른다.',
  },
  {
    name: '[테두리·과잉교정] 이용 안내 행 구분선까지 걷어낸다',
    file: USAGE,
    find: "borderTop: '1px solid var(--gbd-line2)', borderBottom: i === arr.length - 1 ? '1px solid var(--gbd-line2)' : 'none'",
    replace: "borderTop: 'none', borderBottom: 'none'",
    test: TEST,
    why: '규칙 ①이 금지하는 건 **카드 테두리**다 — 카드 안 구분선은 `--rule` 이 존재하는 이유다.',
  },
  {
    name: '[테두리] 컨트롤이 다시 카드선 토큰을 쓴다',
    file: DETAIL,
    find: "padding: '9px 14px', border: '1px solid var(--rule-strong)', borderRadius: 11",
    replace: "padding: '9px 14px', border: '1px solid var(--gbd-line2)', borderRadius: 11",
    test: TEST,
    why: '체계가 outline 버튼·칩용으로 `--rule-strong` 을 따로 정의해 뒀다 — 카드선을 쓰면 너무 옅다.',
  },
]
