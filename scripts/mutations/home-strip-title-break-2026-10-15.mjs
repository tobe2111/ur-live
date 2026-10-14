export default [
  {
    name: '홈 띠 배너 제목이 어드민 줄바꿈을 무시한다 (2026-10-15)',
    file: 'src/shared/home-strip-banners.ts',
    find: 'tracking-[-.02em] whitespace-pre-line [word-break:keep-all] line-clamp-2',
    replace: 'tracking-[-.02em] line-clamp-2',
    test: 'src/tests/unit/home-strip-title-break-2026-10-15.test.ts',
    why: '폭이 끊어 "부산 / 합리적으로" 처럼 구 가운데서 잘린다 — 어드민이 넣은 줄바꿈이 공백으로 사라진다',
  },
]
