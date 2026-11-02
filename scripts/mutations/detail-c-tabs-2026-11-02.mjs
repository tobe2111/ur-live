// 📑 2026-11-02 이용권 상세 C안 · ③B — `src/tests/unit/detail-c-tabs-2026-11-02.test.tsx` 가 잡아야 하는 결함.
const T = 'src/tests/unit/detail-c-tabs-2026-11-02.test.tsx'
export default [
  {
    name: '📑 폰 탭이 PC 탭과 다른 목록을 손으로 다시 쓴다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<DetailSectionTabs tabs={mobileTabs} />',
    replace: "<DetailSectionTabs tabs={[{ id: 'gb-sec-info', label: '이용 안내' }, { id: 'gb-sec-reviews', label: '리뷰' }]} />",
    test: T,
    why: '탭 목록이 두 벌이 되면 한쪽만 고쳐져 폰에서 눌러도 안 가는 탭이 생긴다',
  },
  {
    name: '🐢 폰 크게 보기가 다시 1600 원본을 받는다',
    file: 'src/pages/group-buy/DetailLightboxMobile.tsx',
    find: 'export const MOBILE_VIEW_WIDTH = 1080',
    replace: 'export const MOBILE_VIEW_WIDTH = 1600',
    test: T,
    why: '대표 신고 "넘길 때 뜨는 사진이 너무 느려" 의 원인 하나',
  },
  {
    name: '🐢 폰 크게 보기가 옆 사진을 미리 안 받는다',
    file: 'src/pages/group-buy/DetailLightboxMobile.tsx',
    find: 'const near = Math.abs(i - active) <= 1',
    replace: 'const near = i === active',
    test: T,
    why: '넘기는 순간에야 요청이 나가 검은 화면이 보인다',
  },
  {
    name: '🐢 폰 크게 보기의 밑그림(이미 받은 사진)이 사라진다',
    file: 'src/pages/group-buy/DetailLightboxMobile.tsx',
    find: 'backgroundImage: `url("${placeholderUrl(src)}")`, ',
    replace: '',
    test: T,
    why: '큰 사진이 오기 전까지 빈 칸이 보인다',
  },
]
