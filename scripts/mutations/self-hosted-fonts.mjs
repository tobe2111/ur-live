/**
 * 🔤 첫 페인트가 남의 CDN 에 걸려 있지 않은가 (2026-10-12, 대표 "메인페이지 로딩 속도 … 느려").
 * 가드: src/tests/unit/self-hosted-fonts-2026-10-12.test.ts
 *
 * 라이브 실측: 외부 폰트 CSS 두 개(jsdelivr 12KB / googleapis 0.2KB)가 각각 384·382ms 를 먹어
 * HTML→FCP 677ms 였고, 우리 오리진으로 옮기자 337ms(편차 264→42ms)가 됐다. 이 주입들은 그
 * 되돌림이 **조용히** 일어나는 것을 막는다 — 되돌려도 에러가 안 나고 화면도 안 깨진다.
 */
const TEST = 'src/tests/unit/self-hosted-fonts-2026-10-12.test.ts'

export default [
  {
    name: '🔤 Pretendard CSS 를 다시 jsdelivr 에서 받는다 (렌더 블로킹 외부 요청 복귀)',
    file: 'index.html',
    find: '         배치하는 일도 없다. 숫자 글꼴(UrDigits)·워드마크(Poppins)는 그대로다. -->',
    replace: '         배치하는 일도 없다. 숫자 글꼴(UrDigits)·워드마크(Poppins)는 그대로다. -->\n    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />',
    test: TEST,
    why: '이 사고의 본체. 되돌리면 첫 페인트가 384ms 늦고 편차가 264ms 로 돌아가는데 **에러는 0건**이다.',
  },
  {
    name: '🔤 손님 본문 글꼴에 Pretendard 를 되살린다 (2026-10-15 기기 글꼴 전환 되돌림)',
    file: 'src/index.css',
    find: '    font-family:\n      "UrDigits",\n',
    replace: '    font-family:\n      "UrDigits",\n      "Pretendard Variable",\n',
    test: TEST,
    why: '목록에 이름만 돌아와도 시트를 다시 받게 되는 길이 열린다 — 대표 확정(쿠팡·네이버처럼 기기 글꼴)의 되돌림이다.',
  },
  {
    name: '🔤 Poppins 를 다시 fonts.googleapis.com stylesheet 로 받는다',
    file: 'index.html',
    find: '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    replace:
      '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
      '    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&text=urdeal&display=swap" rel="stylesheet" />',
    test: TEST,
    why: '0.2KB 인데 382ms 였다 — 바이트가 아니라 외부 오리진의 왕복이 비용이라는 증거 자리.',
  },
  {
    name: '🔤 Poppins 인라인 @font-face 의 unicode-range 를 뺀다',
    file: 'index.html',
    find: '        unicode-range: U+61, U+64-65, U+6c, U+72, U+75;',
    replace: '        /* unicode-range 제거 */',
    test: TEST,
    why: 'Google 원본에 있던 제한이다. 빼면 그 글자가 없는 화면에서도 폰트를 받는다.',
  },
  {
    name: '🔤 /static/fonts/* immutable 캐시를 뺀다 (매 방문 재다운로드)',
    file: 'public/_headers',
    find: '  ! Expires\n  Cache-Control: public, max-age=31536000, immutable',
    replace: '# (제거)',
    test: TEST,
    why: '빼면 맨 위 `/*` 의 `no-cache, no-store` 에 걸린다. 2026-10-12 실측에서 숫자 폰트가 실제로 그 상태(엣지 BYPASS)였다.',
  },
  {
    name: '🔤 src 없는 @font-face 를 되살린다 (무효 규칙 = 조용한 거짓)',
    file: 'index.html',
    find: "      @font-face {\n        font-family: 'Poppins';",
    replace:
      "      @font-face {\n" +
      "        font-family: 'Pretendard Variable';\n" +
      "        font-display: optional;\n" +
      "        ascent-override: 92%;\n" +
      "      }\n" +
      "      @font-face {\n" +
      "        font-family: 'Poppins';",
    test: TEST,
    why: '2026-10-12 까지 이 규칙이 적용된다고 믿고 있었다. src 가 없으면 규칙 전체가 무효라 브라우저가 버린다(실측: 전부 swap).',
  },
]
