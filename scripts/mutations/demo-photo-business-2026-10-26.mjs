/**
 * 🧬 주입 — 데모 사진 출처를 업체 사진으로(2026-10-26). 가드: src/tests/unit/demo-photos-business-source-2026-10-26.test.ts
 */
const T = 'src/tests/unit/demo-photos-business-source-2026-10-26.test.ts'
export default [
  {
    name: 'demo-photo-biz — 카카오가 손님·블로그 사진까지 받는다',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: '      if (strictType && p.type !== tag) continue',
    replace: '      if (!p.type) continue',
    test: T,
    why: '태그 필터가 풀리는 날 손님 리뷰·블로그 사진이 데모에 섞인다(대표: 업체가 올린 사진만).',
  },
  {
    name: 'demo-photo-biz — 제휴사 사진을 늘 한 번 더 부른다',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: '(mine?.counts?.vendor ?? 0) > 0',
    replace: 'true',
    test: T,
    why: '서브리퀘스트 예산(무료 50)을 데모마다 하나씩 헛되이 쓴다.',
  },
  {
    name: 'demo-photo-biz — 숨김 데모를 재시도 대상에서 뺀다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: '        AND (COALESCE(p.is_active, 1) = 1 OR EXISTS (',
    replace: '        AND (COALESCE(p.is_active, 1) = 1 AND EXISTS (',
    test: T,
    why: '사진이 없어 내려간 데모가 사진이 생겨도 영영 안 올라온다.',
  },
  {
    name: 'demo-photo-biz — 네이버 홈 화면을 다시 긁는다',
    file: 'src/worker/utils/naver-place-photo.ts',
    find: '    // ③ 2026-10-26 (대표 확정): 홈 화면 통째 긁기 제거',
    replace: '    `https://m.place.naver.com/place/${id}/home`,\n    // ③',
    test: T,
    why: '홈엔 방문자 리뷰·주변 가게 사진이 같은 CDN 으로 섞여 업체 사진 판정이 무력해진다.',
  },
]
