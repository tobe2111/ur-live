// 🔤 PC(1024px+) 본문 글꼴 한글 우선 (2026-10-25 대표 안 A · PC 만)
const TEST = 'src/tests/unit/pc-font-order-2026-10-25.test.ts'
export default [
  {
    name: '🔤 PC 글꼴 — 한글이 다시 system-ui 뒤로 간다(윈도우에서 Segoe UI·맑은 고딕 혼용 복귀)',
    file: 'src/index.css',
    find: '        "Apple SD Gothic Neo",\n        "Noto Sans KR",\n        "Malgun Gothic",\n        -apple-system,\n        BlinkMacSystemFont,\n        system-ui,\n',
    replace: '        -apple-system,\n        BlinkMacSystemFont,\n        system-ui,\n        "Apple SD Gothic Neo",\n        "Noto Sans KR",\n        "Malgun Gothic",\n',
    test: TEST,
    why: '에러 0 — 윈도우 PC 에서 영문만 Segoe UI 로 그려져 글자가 다시 지저분해진다.',
  },
  {
    name: '🔤 PC 글꼴 — 미디어쿼리를 빼서 폰까지 바뀐다',
    file: 'src/index.css',
    find: '  @media (min-width: 1024px) {\n    body {\n      font-family:\n        "UrDigits",',
    replace: '  @media (min-width: 0px) {\n    body {\n      font-family:\n        "UrDigits",',
    test: TEST,
    why: '대표 결정은 PC 만이다 — 폰 픽셀이 조용히 바뀐다.',
  },
  {
    name: '🔤 PC 에서 맑은 고딕을 Noto Sans KR 앞으로 되돌린다 (쿠팡과 다른 글꼴)',
    file: 'src/index.css',
    find: '        "Noto Sans KR",\n        "Malgun Gothic",\n',
    replace: '        "Malgun Gothic",\n        "Noto Sans KR",\n',
    test: 'src/tests/unit/pc-font-order-2026-10-25.test.ts',
    why: '같은 PC 에서 쿠팡은 Noto Sans KR, 우리는 맑은 고딕으로 그려졌다(대표 개발자 도구 화면). 되돌려도 에러 0.',
  },
]
