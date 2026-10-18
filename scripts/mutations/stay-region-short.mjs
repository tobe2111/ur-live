/**
 * 📍 숙소 짧은 지역 — 주입 매니페스트 (2026-10-18 등록).
 * 가드: src/tests/unit/detail-title-ssot-2026-10-14.test.ts (①-5)
 *
 * 라이브 숙소 49건 중 12건은 지역 칸이 주소와 다른 곳을 가리킨다(`/stays/2887` 제목이 `(강원 속초시)`
 * 인데 주소는 양양군). 에러가 안 나고 화면 주소 줄은 맞아서 아무도 신고하지 않는 종류다.
 */
export default [
  {
    name: '📍 숙소 지역이 다시 칸을 먼저 본다 (주소와 다르면 틀린 지역이 검색 제목에)',
    file: 'src/shared/stay-address.ts',
    find: '  if (parsed?.sigungu) return `${parsed.sido} ${parsed.sigungu}`',
    replace: "  if (parsed?.sigungu && !(sido || sigungu)) return `${parsed.sido} ${parsed.sigungu}`",
    test: 'src/tests/unit/detail-title-ssot-2026-10-14.test.ts',
    why: '2026-10-14 의 "컬럼 우선" 이 정확히 이 모양이었고, 12건이 실제와 다른 시·군·구를 검색 제목·설명에 적었다.',
  },
]
