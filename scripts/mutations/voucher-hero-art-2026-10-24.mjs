const T = 'src/tests/unit/voucher-hero-art-2026-10-24.test.ts'
export default [
  { name: '교환권 머리 — 사진을 다시 꽉 채운다(유달이가 제목 아래로)', file: 'src/shared/home-strip-banners.ts', find: '[&>img]:!h-[62%]', replace: '[&>img]:!h-[100%]', test: T, why: '꽉 채우면 4:1 그림의 주인공이 제목 아래로 들어온다(대표 신고).' },
  { name: '교환권 머리 — 제목 폭이 그림 위로 넓어진다', file: 'src/shared/home-strip-banners.ts', find: '[&>strong]:!max-w-[46%]', replace: '[&>strong]:!max-w-[60%]', test: T, why: '60% 면 제목이 유달이 머리 위로 지나간다.' },
  { name: '교환권 머리 — 화면이 가장자리 색 채움을 빼먹는다', file: 'src/components/home/HomeBannerStrip.tsx', find: 'hero ? heroEdgeFillStyle(bg) : undefined', replace: 'undefined', test: T, why: '빼먹으면 왼쪽이 페이지 색으로 비고 서버 첫 화면과 갈린다.' },
  { name: '교환권 머리 — 서버 첫 화면이 가장자리 색 채움을 빼먹는다', file: 'src/worker/utils/vouchers-first-screen.ts', find: '` style="${escAttr(heroEdgeFillCss(bg))}"`', replace: "''", test: T, why: '서버만 빠지면 마운트 때 바탕색이 바뀐다.' },
]
