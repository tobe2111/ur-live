/**
 * 🧬 2026-10-14 — `og:image:alt` 을 **그림을 고르는 같은 자리**에서 정하는가.
 *
 * 근거는 `src/tests/unit/og-image-alt-2026-10-14.test.ts` 머리말(실측: `summary_large_image`
 * 33표면 전부 alt 0건 — 클라 `<SEO>` 에만 있어 JS 렌더 크롤러만 보고 있었다).
 *
 * 🔀 절반은 **반대 방향**이다 — 리터럴로 적는 쪽(두 벌) · 그림 없이 alt 만 두는 쪽 ·
 *   메타 파싱이 통째로 비어 ③이 `undefined === undefined` 로 통과하는 쪽.
 */
const SSOT = 'src/shared/og-share-image.ts'
const WORKER = 'src/worker/index.ts'
const SEO_TSX = 'src/components/SEO.tsx'
const HTML = 'index.html'
const TEST = 'src/tests/unit/og-image-alt-2026-10-14.test.ts'

export default [
  {
    name: '🖼️ alt — 봇 셸에서 선언이 사라진다 (33표면이 다시 0건)',
    file: WORKER,
    find: '<meta property="og:image:alt" content="${esc(ogImageAlt(og.image, og.title))}" />',
    replace: '',
    test: TEST,
    why:
      '봇 셸은 검색 크롤러가 받는 문서다 — 여기서 빠지면 **JS 를 렌더하지 않는 크롤러**(네이버 Yeti · ' +
      '카톡 스크래퍼)에게 그림 설명이 영영 안 간다. 실측에서 정확히 그 상태였다.',
  },
  {
    name: '🖼️ alt — 봇 셸이 함수 대신 리터럴을 적는다 (그림이 바뀌어도 alt 이 안 따라온다)',
    file: WORKER,
    find: '<meta property="og:image:alt" content="${esc(ogImageAlt(og.image, og.title))}" />',
    replace: '<meta property="og:image:alt" content="유어딜 브랜드 카드" />',
    test: TEST,
    why:
      '그림은 셋(브랜드 카드 · 사진 카드 · 유달이)인데 리터럴은 하나만 말한다 — 사진 카드에도 ' +
      '"브랜드 카드" 라고 설명하게 되고, **틀린 설명은 없는 설명보다 나쁘다.**',
  },
  {
    name: '🖼️ alt — `index.html` 의 값이 함수와 갈린다 (정적 HTML 두 벌)',
    file: HTML,
    find: '<meta property="og:image:alt" content="유어딜 브랜드 카드" />',
    replace: '<meta property="og:image:alt" content="유어딜" />',
    test: TEST,
    why:
      '정적 HTML 은 함수를 부를 수 없으므로 **대조가 두 벌을 막는 유일한 수단**이다 — 그 대조가 ' +
      '없으면 함수 쪽 문구를 고쳐도 `index.html` 은 옛 값으로 남는다(에러 0).',
  },
  {
    name: '🖼️ alt — 사진 카드와 브랜드 카드를 같은 말로 설명한다',
    file: SSOT,
    find: "  if (/\\/og-image\\.(png|svg)$/.test(u)) return `${siteName} 브랜드 카드`",
    replace: '',
    test: TEST,
    why:
      '브랜드 카드(로고 그래픽)와 사진 카드(상품·가게 사진)는 보여 주는 것이 전혀 다르다 — ' +
      '가르지 않으면 로고 카드에 상품명을 설명으로 붙인다.',
  },
  {
    name: '🖼️ alt — 클라 `<SEO>` 가 다시 페이지 설명을 잘라 넣는다',
    file: SEO_TSX,
    find: '      <meta property="og:image:alt" content={ogImageAlt(resolvedImage, fullTitle, siteName)} />',
    replace: '      <meta property="og:image:alt" content={`${siteName} - ${resolvedDescription.slice(0, 60)}`} />',
    test: TEST,
    why:
      '그것은 *페이지 설명*이지 *그림 설명*이 아니다. 그리고 봇 셸·`index.html` 과 달라 **한 URL 에 ' +
      '두 alt** 이 된다(JS 렌더 크롤러와 비-JS 크롤러가 다른 값을 본다).',
  },
  {
    name: '🔁 alt 반대 방향 — 그림 없이 alt 만 둔다',
    file: HTML,
    find: '    <meta property="og:image" content="https://urdeal.kr/og-image.png" />',
    replace: '',
    test: TEST,
    why:
      'alt 은 그림의 **부속**이다 — 그림이 없으면 아무것도 설명하지 않는다. ⑥이 둘의 존재를 ' +
      '**짝으로** 묶는다(한쪽만 있는 상태를 양방향으로 막는다).',
  },
  {
    name: '🔁 alt 반대 방향 — 메타 파싱이 통째로 비어 ③이 헛돈다',
    file: TEST,
    // 🔀 재조준(2026-10-14): 파싱을 순수 함수 `parseMetas` 로 빼면서 줄이 옮겨졌다.
    //   지키는 불변식(*파서가 비면 ③이 `undefined === undefined` 로 통과한다*)은 그대로다.
    find: "  (raw.replace(/<!--[\\s\\S]*?-->/g, ' ').match(/<meta[^>]*>/g) || [])",
    replace: '  ([] as string[])',
    test: TEST,
    why:
      '③은 `content` 를 꺼내 비교하므로 **파싱이 비면 `undefined === undefined` 로 통과**한다 ' +
      '(실패가 아니라 부재). ⑤의 메타 수 하한이 그 경우를 잡는다.',
  },
  {
    // 🩸 첫 판은 `readRaw(HTML)` 에서 주석 제거를 뺐는데 **결과가 같았다** — 이 파일의 설명 주석은
    //   `og:image:alt` 를 *백틱으로* 인용할 뿐 `<meta>` 태그가 아니라 정규식에 안 걸린다.
    //   진짜 위험은 **메타를 주석으로 감싸는 것**이고, 그것을 주입한다.
    name: '🖼️ alt — index.html 의 선언을 주석으로 감싼다 (라이브엔 없는데 파서가 살아 있는 선언으로)',
    file: HTML,
    find: '    <meta property="og:image:alt" content="유어딜 브랜드 카드" />',
    replace: '    <!-- <meta property="og:image:alt" content="유어딜 브랜드 카드" /> -->',
    test: TEST,
    why:
      '메타를 주석으로 감싸는 것은 흔한 변경이다 — 주석을 걷지 않는 파서는 그 태그를 **살아 있는 ' +
      '선언으로 읽고** 라이브엔 없는데 초록이 뜬다(이 레포가 robots·d1-migrate 에서 두 번 밟은 클래스).',
  },
  {
    name: '🔁 alt 반대 방향 — 주석 제거기가 멀쩡한 태그까지 먹는다',
    file: TEST,
    find: "  (raw.replace(/<!--[\\s\\S]*?-->/g, ' ').match(/<meta[^>]*>/g) || [])",
    replace: "  (raw.replace(/<!--[\\s\\S]*-->/g, ' ').match(/<meta[^>]*>/g) || [])",
    test: TEST,
    why:
      '탐욕 정규식(`*` vs `*?`)은 **첫 주석의 시작부터 마지막 주석의 끝까지** 통째로 먹는다 — ' +
      '그 사이의 살아 있는 메타가 전부 사라지고 ③이 `undefined === undefined` 로 통과한다. ' +
      '⑤의 반대 방향 단언이 그걸 잡는다.',
  },
]
