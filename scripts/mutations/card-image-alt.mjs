/**
 * 🧬 주입 — 카드 사진의 `alt` 가 어느 매장인지 말하는가 (2026-10-11 SEO)
 *
 * 이 결함들은 **화면에 안 보인다**(alt 는 그려지지 않는다). 빌드도 초록이고 테스트도
 * 함수만 보면 통과한다 — 그래서 심어 봐야만 가드가 진짜인지 안다.
 */
const TEST = 'src/tests/unit/card-image-alt-2026-10-11.test.ts'
const SSOT = 'src/utils/deal-title.ts'

export default [
  {
    name: 'card-alt: 매장명을 빼고 상품명만 (종전 상태로 환원)',
    file: SSOT,
    find: '  if (s && body) return `${s} ${body}`',
    replace: '  if (s && body) return body',
    test: TEST,
    why: '대표가 본 그 상태다 — "주말 1박 숙박권 (스탠다드 룸)" 은 호텔 수십 곳이 공유해서 '
       + '사진에 붙은 유일한 이름이 어느 매장인지 안 말한다.',
  },
  {
    name: 'card-alt: 중복 제거를 안 거친다 (매장명이 두 번)',
    file: SSOT,
    find: '  const body = stripStorePrefix(name, store)',
    replace: '  const body = (name || \'\').trim()',
    test: TEST,
    why: '상품명이 매장명으로 시작하는 상품에서 "헤이춘천 헤이춘천 주말 1박…" 이 된다. '
       + '카드 제목은 이미 그 중복을 없애고 있으므로 사진 이름만 규칙이 갈린다.',
  },
  {
    name: 'card-alt: 동네딜 카드 배선을 옛 alt 로 되돌린다',
    file: 'src/pages/main-home/GroupBuyFeedCard.tsx',
    find: '        alt={cardImageAlt(p.name, p.restaurant_name, cat.label)}',
    replace: '        alt={p.name || cat.label}',
    test: TEST,
    why: 'SSOT 는 멀쩡한데 호출부만 옛 값으로 남는 경우. 이 레포가 반복해 당한 클래스라 '
       + '함수와 배선을 **따로** 심어 본다.',
  },
  {
    name: 'card-alt: 교환권 **행**만 옛 alt 로 되돌린다 (한쪽만 고쳐진 경우)',
    file: 'src/pages/vouchers/shared.tsx',
    find: '          /* 🔎 2026-10-11 SEO: 위 카드와 같은 규칙. */\n          alt={cardImageAlt(p.name, p.brand_name)}',
    replace: '          alt={p.name}',
    test: TEST,
    why: '카드와 행이 같은 파일에 있어 한쪽만 고치기 쉽다. 목록 보기를 행으로 바꾸면 '
       + '사진 이름이 조용히 종전으로 돌아간다 — 개수를 세는 단언이 그걸 잡아야 한다.',
  },
  {
    name: 'card-alt: 빈 문자열을 돌려줘 사진에 이름이 사라진다',
    file: SSOT,
    find: '  return body || s || (fallback || \'\').trim()',
    replace: '  return body',
    test: TEST,
    why: '상품명이 없는 행에서 `alt=""` 가 된다 — 접근성(스크린리더)과 이미지 색인 둘 다 '
       + '이름을 잃는다. 폴백이 실제로 일하는지 확인한다.',
  },
]
