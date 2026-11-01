const T = 'src/tests/unit/voucher-hero-art-2026-10-24.test.ts'
export default [
  { name: '교환권 머리 — 사진을 다시 꽉 채운다(유달이가 제목 아래로)', file: 'src/shared/home-strip-banners.ts', find: '[&>img]:!h-[62%]', replace: '[&>img]:!h-[100%]', test: T, why: '꽉 채우면 4:1 그림의 주인공이 제목 아래로 들어온다(대표 신고).' },
  { name: '교환권 머리 — 제목 폭이 그림 위로 넓어진다', file: 'src/shared/home-strip-banners.ts', find: '[&>strong]:!max-w-[46%]', replace: '[&>strong]:!max-w-[60%]', test: T, why: '60% 면 제목이 유달이 머리 위로 지나간다.' },
  { name: '교환권 머리 — 화면이 가장자리 색 채움을 빼먹는다', file: 'src/components/home/HomeBannerStrip.tsx', find: 'hero ? heroEdgeFillStyle(bg) : undefined', replace: 'undefined', test: T, why: '빼먹으면 왼쪽이 페이지 색으로 비고 서버 첫 화면과 갈린다.' },
  // 🔀 2026-11-01 — '서버 첫 화면이 가장자리 색을 빼먹는다' 주입은 걷었다. A안에서 워커는 교환권 배너를
  //   아예 안 그리므로 그 결함을 심을 자리가 없다. 되살아나는 방향은 `vouchers-hero-banner-ssr-2026-10-18`
  //   의 '교환권 머리에 배너가 되살아난다' 가 잡는다(같은 자리를 두 번 잠그면 어느 쪽도 판정이 안 된다).
]
