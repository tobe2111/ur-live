/**
 * 🏠 생활 견적 — 내 요청 찾기 · 링크 공유 (2026-10-31 대표 "견적 링크를 공유해야 홍보도 되는거잖아").
 * 가드: src/tests/unit/life-my-quotes-share-2026-10-31.test.ts
 * 되돌려도 에러가 안 나고 화면도 안 깨진다 — 들어갈 길·공유할 길이 조용히 사라질 뿐이다.
 */
const TEST = 'src/tests/unit/life-my-quotes-share-2026-10-31.test.ts'

export default [
  {
    name: '🏠 마이에서 내 견적 요청 줄이 빠진다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "path: '/life/requests' },",
    replace: "path: '/my-stays' },",
    test: TEST,
    why: '견적을 낸 손님이 다시 찾아갈 길이 생활 페이지 안쪽 하나로 돌아간다.',
  },
  {
    name: '🏠 목록 API 가 마감된 요청의 공유 토큰까지 낸다',
    file: 'src/features/home-service/api/home-service.routes.ts',
    find: "CASE WHEN status = 'open' THEN share_token END AS share_token",
    replace: 'share_token',
    test: TEST,
    why: '이미 고른 요청 링크가 돌아다니면 업체가 마감된 요청을 보고 가입했다가 빈손이 된다.',
  },
  {
    name: '🏠 접수 완료 화면이 공유 토큰을 버린다',
    file: 'src/pages/life/LifeRequestFormPage.tsx',
    find: 'setDoneShare(r.data.data.share_token || null)',
    replace: 'setDoneShare(null)',
    test: TEST,
    why: '막 보낸 순간이 공유하기 가장 좋은 때인데 그 버튼이 조용히 안 뜬다.',
  },
]
