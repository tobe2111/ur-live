/** 🧬 주입 — 이용권 상세 모바일 썸네일 2칸(2026-10-27). 가드: src/tests/unit/detail-mobile-thumbs-2026-10-27.test.tsx */
const T = 'src/tests/unit/detail-mobile-thumbs-2026-10-27.test.tsx'
export default [
  {
    name: 'detail-mobile-thumbs — 서버 첫 화면이 썸네일 줄을 안 그린다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '      mobileThumbRowHtml(images)\n',
    replace: "      ''\n",
    test: T,
    why: '마운트 때 썸네일 줄 높이만큼 제목이 아래로 밀린다.',
  },
  {
    name: 'detail-mobile-thumbs — 썸네일을 눌러도 전체 화면이 안 열린다',
    file: 'src/pages/group-buy/DetailGallery.tsx',
    find: '<button key={src} type="button" onClick={() => { setActive(i + 1); setLightbox(true) }}',
    replace: '<button key={src} type="button" onClick={() => { setActive(i + 1) }}',
    test: T,
    why: '그루폰처럼 눌러서 크게 보는 동작이 사라진다.',
  },
  {
    name: 'detail-mobile-thumbs — 서버 첫 화면이 첫 장만 그린다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '          restSlidesHtml(images, d.name) +\n',
    replace: '',
    test: T,
    why: '앱이 뜨기 전에는 사진을 넘길 수 없다(대표 "로딩 지나니까 넘어가").',
  },
  {
    name: 'detail-mobile-thumbs — 나머지 장을 eager 로 받는다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: 'alt="${escAttr(alt)}" loading="lazy"',
    replace: 'alt="${escAttr(alt)}" loading="eager"',
    test: T,
    why: '화면 밖 사진까지 첫 화면에서 받아 첫 사진과 회선을 나눈다.',
  },
]
