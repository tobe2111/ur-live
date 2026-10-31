/** 🧬 주입 — 숙소 상세 사진 맨 위(2026-10-27). 가드: src/tests/unit/stay-photo-top-2026-10-27.test.ts */
const T = 'src/tests/unit/stay-photo-top-2026-10-27.test.ts'
export default [
  {
    name: 'stay-photo-top — 서버 첫 화면이 폰에서도 빵부스러기를 그린다 (마운트 때 사진이 위로 튄다)',
    file: 'src/worker/utils/stay-detail-ssr-body.ts',
    find: "(crumb ? `<div class=\"hidden lg:block\">${crumb}</div>` : '') +",
    replace: 'crumb +',
    test: T,
    why: '화면은 폰에서 빵부스러기가 없는데 서버만 그리면 사진이 85px 내려앉았다 올라간다.',
  },
  {
    name: 'stay-photo-top — 숙소 헤더가 원 버튼으로 돌아간다',
    file: 'src/pages/StayDetailPage.tsx',
    find: "onBack={() => navigate(-1)}\n        overPhoto\n",
    replace: "onBack={() => navigate(-1)}\n",
    test: T,
    why: '이용권 상세와 상단 버튼 모양이 다시 갈린다.',
  },
]
