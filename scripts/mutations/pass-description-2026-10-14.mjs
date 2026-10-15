/**
 * 📝 이용권 설명 (2026-10-14) — 되돌려-검증 매니페스트.
 *
 * 불변식: ① 할인율은 `priceDisplay` SSOT(선언값 0 에 묶이지 않는다) ② 별점·지역·설명은
 * 가진 것만 ③ 지어내지 않는다(리뷰 0·할인 없음) ④ 참가자 수를 스니펫에 쓰지 않는다.
 *
 * 🔁 2026-10-15 재조준 — 생성기가 `shared/seo/detail-description.ts` 로 옮겨갔다(클라가 같은
 *   함수를 쓰게 만든 커밋 · 서버 출력 byte-불변). **불변식 넷은 그대로**이고 앵커만 옮겼다.
 *   ④ 가 특히 값지다: 그 문장이 바로 클라가 내고 있던 것이고, 이제 한 함수라 서버·클라가
 *   함께 되돌아간다.
 */
export default [
  {
    name: '📝 설명 할인율을 선언 컬럼으로 되돌린다 (310건 전부에서 사라진다 — 종전 결함)',
    file: 'src/shared/seo/detail-description.ts',
    find: "  return (pd.discount > 0",
    replace: "  return ((Number(d.current_discount_pct) || 0) > 0",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '라이브 45/45건이 선언값 0 이라 그 분기는 한 번도 돈 적이 없다.',
  },
  {
    name: '📝 정가를 안 보여 준다 (할인의 근거가 사라진다)',
    file: 'src/shared/seo/detail-description.ts',
    find: "  const origStr = pd.showOriginal && pd.originalPrice > pd.price ?",
    replace: "  const origStr = false ?",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '"11% 할인" 만 있고 정가가 없으면 사람이 검증할 수 없다.',
  },
  {
    name: '📝 리뷰 0 에도 별점을 말한다 (지어내기)',
    file: 'src/shared/seo/detail-description.ts',
    find: "  const ratingPrefix = rating > 0 && reviews > 0 ?",
    replace: "  const ratingPrefix = rating > 0 ?",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '평점 0점짜리 상품이라고 말하는 셈이다(2026-10-11 에 값을 치른 자리).',
  },
  {
    name: '📝 주소 파싱이 실패해도 지역을 지어낸다',
    file: 'src/shared/seo/detail-description.ts',
    find: "  const regionStr = ref ? `${ref.sido}${ref.sigungu ? ` ${ref.sigungu}` : ''} · ` : ''",
    replace: "  const regionStr = `${ref?.sido || String(d.restaurant_address ?? '').slice(0, 6)} · `",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '덜 정확한 쪽이 아니라 틀린 지역이 된다(postalAddress 머리말의 같은 규율).',
  },
  {
    name: '📝 설명이 상품명과 같아도 덧붙인다 (같은 말을 두 번)',
    file: 'src/shared/seo/detail-description.ts',
    find: "  const tail = intro && intro !== name && intro !== storeName ?",
    replace: "  const tail = intro ?",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '시드 실측상 설명이 상품명과 같은 경우가 흔하다.',
  },
  {
    name: '📝 참가자 수를 설명에 넣는다 (라이브 98%가 0명 — "0명 함께 구매 중")',
    file: 'src/shared/seo/detail-description.ts',
    find: "    ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인${tail}`",
    replace: "    ? `${ratingPrefix}${regionStr}${storeName} ${priceStr}원${origStr} ${pd.discount}% 할인, ${Number(d.group_buy_current) || 0}명 함께 구매 중${tail}`",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '화면 쪽이 지금 그렇게 하고 있고(결재 대기) 서버로 번지면 안 된다.',
  },
  {
    name: '📝 설명에 줄표를 섞는다 (#79 가 0 으로 동결한 문자)',
    file: 'src/shared/seo/detail-description.ts',
    find: "    : `${ratingPrefix}${regionStr}${storeName} ${priceStr}원, 유어딜에서 할인가로 바로 구매${tail}`",
    replace: "    : `${ratingPrefix}${regionStr}${storeName} — ${priceStr}원, 유어딜에서 할인가로 바로 구매${tail}`",
    test: 'src/tests/unit/pass-description-2026-10-14.test.ts',
    why: '검색 스니펫의 줄표는 anti-slop 가드가 0 으로 동결했다.',
  },
]
