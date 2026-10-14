/**
 * ⭐ 상세 본문 평점 줄 (2026-10-14) — 되돌려-검증 매니페스트.
 *
 * 지키는 불변식: ① 이용권 본문이 평점을 낸다(294건) ② 숙소와 **같은 함수**를 쓴다
 * ③ 리뷰 0·별점만이면 **안 낸다**(지어내기 금지) ④ 시드 타입에 필드가 선언돼 있다.
 */
export default [
  {
    name: '⭐ 이용권 본문에서 평점 줄을 뺀다 (JSON-LD 에만 남는다 — 종전 결함)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '    ratingLine(d.avg_rating, d.review_count),',
    replace: '',
    test: 'src/tests/unit/detail-rating-line-2026-10-14.test.ts',
    why: '라이브 실측 그대로의 결함 — /pass 294건이 가진 숫자를 본문에서 잃는다.',
  },
  {
    name: '⭐ 숙소가 평점 문구를 손으로 다시 적는다 (두 벌 → 조용히 갈린다)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '    ratingLine(p.avg_rating, p.review_count),',
    replace: "    (Number(p.avg_rating) || 0) > 0 && (Number(p.review_count) || 0) > 0 ? `평점 ${Number(p.avg_rating).toFixed(1)}점 (후기 ${Number(p.review_count)}건)` : '',",
    test: 'src/tests/unit/detail-rating-line-2026-10-14.test.ts',
    why: '문구를 베끼면 두 상세가 다른 말을 하고 빌드는 초록이다.',
  },
  {
    name: '⭐ 리뷰 0인데 평점을 낸다 (지어내기 — ratingValue: 0 으로 값을 치른 자리)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '  return rating > 0 && reviews > 0 ? `평점',
    replace: '  return rating > 0 ? `평점',
    test: 'src/tests/unit/detail-rating-line-2026-10-14.test.ts',
    why: '평점 0점짜리 상품이라고 말하는 셈이고 구글 정책 위반이다.',
  },
  {
    name: '⭐ 평점 자리를 주소 뒤로 (두 상세가 다른 순서로 읽힌다)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: `    ratingLine(d.avg_rating, d.review_count),
    placeLine,`,
    replace: `    placeLine,
    ratingLine(d.avg_rating, d.review_count),`,
    test: 'src/tests/unit/detail-rating-line-2026-10-14.test.ts',
    why: '자리가 갈리면 같은 두 상세가 서로 다른 순서로 읽힌다.',
  },
  {
    name: '⭐ 시드 타입에서 avg_rating 선언을 뺀다 (값이 와도 못 쓴다 — 종전 원인)',
    file: 'src/worker/utils/crawler-noscript.ts',
    find: '  avg_rating?: number | null\n  review_count?: number | null\n  /** 🖼️ 2026-10-14',
    replace: '  /** 🖼️ 2026-10-14',
    test: 'src/tests/unit/detail-rating-line-2026-10-14.test.ts',
    why: '이 선언 누락이 294건을 잃게 만든 원인 그 자체다.',
  },
]
