/**
 * 🔗 '가게 소개' 탭↔섹션 판정 일치 — 주입 매니페스트 (2026-09-25 등록).
 * 가드: src/tests/unit/store-intro-tab-parity-2026-09-25.test.ts
 *
 * 이 결함은 **에러가 안 난다** — 탭이 하나 더 뜨고 눌러도 아무 일이 없을 뿐이다.
 * 그래서 사람이 아니라 기계가 지켜야 한다.
 */
export default [
  {
    name: '[가게소개] 탭을 다시 무조건 그린다(눌러도 안 가는 탭 부활)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "              ? [{ id: 'gb-sec-store', label: '가게 소개' }] : []),",
    replace: "              ? [{ id: 'gb-sec-store', label: '가게 소개' }] : [{ id: 'gb-sec-store', label: '가게 소개' }]),",
    test: 'src/tests/unit/store-intro-tab-parity-2026-09-25.test.ts',
    why:
      '2026-09-25 라이브에서 실제로 이 상태였다 — 설명이 빈 상품(활성 2,620건 중 23건)에서 ' +
      '탭이 없는 섹션을 가리켰다. 되돌아가면 같은 조용한 부재가 생긴다.',
  },
  {
    name: '[가게소개] 섹션이 판정을 손으로 다시 쓴다(두 벌이 되어 갈린다)',
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: "  if (!hasStoreIntro({ description, productName, longDescription, sellerBio })) return null",
    replace: '  if (!body && !bio && !spec) return null',
    test: 'src/tests/unit/store-intro-tab-parity-2026-09-25.test.ts',
    why:
      '조건을 두 곳에 손으로 쓰면 한쪽만 바뀌는 날이 온다 — 이번 결함이 정확히 그 모양이었다. ' +
      '판정은 한 함수에서만 나와야 한다.',
  },
  {
    name: '[가게소개] 제목과 같은 설명도 소개로 친다(상품명이 두 번 찍힌다)',
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: "  const spec = raw && raw !== (src.productName || '').trim() ? raw : ''\n  return !!((src.longDescription || '').trim() || (src.sellerBio || '').trim() || spec)",
    replace: "  return !!((src.longDescription || '').trim() || (src.sellerBio || '').trim() || raw)",
    test: 'src/tests/unit/store-intro-tab-parity-2026-09-25.test.ts',
    why: '라이브 상품 중 description 이 name 과 같은 문자열인 것이 있다 — 그러면 제목이 화면에 두 번 찍힌다(2026-09-14 규칙).',
  },
]
