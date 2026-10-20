export default [
  {
    name: '⚡ 이용권 상세 설명이 다시 Intl 로 숫자를 찍는다',
    file: 'src/shared/seo/detail-description.ts',
    find: 'const priceStr = formatNumber(price)',
    replace: "const priceStr = price.toLocaleString('ko-KR')",
    test: 'src/tests/unit/pass-description-intl-free-2026-10-17.test.ts',
    why: '첫 렌더에서 Intl 로캘 적재 64ms(CPU 4배)가 돌아온다',
  },
]
