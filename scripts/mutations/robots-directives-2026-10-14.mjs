/**
 * 🤖 2026-10-14 — `robots` 메타 값 SSOT 의 주입.
 *
 * 근거·실측은 `src/shared/seo/robots-directives.ts` 머리말,
 * 가드는 `src/tests/unit/robots-directives-2026-10-14.test.ts`.
 *
 * 🔴 **절반이 반대 방향이다.** 이 처방은 "더 막는" 쪽으로 틀리면 피해가 비교 불가다 —
 *    `ROBOTS_INDEX` 에 `noindex` 가 섞이면 **전 표면이 색인에서 빠지고** 복구는 수주다.
 *    큰 이미지를 못 얻는 손실과 비교할 수 없다.
 *
 * 🧭 이름에 `robots 지시어` 를 공유한다 — 러너의 `--only` 는 정규식이 아니라 **부분일치**라
 *    공통 토큰이 없으면 이 묶음을 한 번에 돌릴 수 없다(2026-10-14 에 값을 치르고 배운 자리).
 */
const SSOT = 'src/shared/seo/robots-directives.ts'
const TEST = 'src/tests/unit/robots-directives-2026-10-14.test.ts'

export default [
  {
    name: '🤖 robots 지시어 — max-image-preview 를 뺀다 (종전 상태로 되돌림)',
    file: SSOT,
    find: "export const ROBOTS_INDEX = 'index, follow, max-image-preview:large'",
    replace: "export const ROBOTS_INDEX = 'index, follow'",
    test: TEST,
    why:
      '라이브 실측에서 색인 대상 12경로가 **전부 이 상태**였다. 지시어가 없으면 검색결과·Discover 의 ' +
      '이미지 미리보기 크기를 구글이 자기 기본값으로 정하고 그 기본값은 보장되지 않는다 — 사진이 ' +
      '상품인 서비스에서 그 자리를 포기하는 것이다.',
  },
  {
    name: '🤖 robots 지시어 — 색인제외를 nofollow 로 (크롤 경로를 끊는다)',
    file: SSOT,
    find: "export const ROBOTS_NOINDEX = 'noindex, follow'",
    replace: "export const ROBOTS_NOINDEX = 'noindex, nofollow'",
    test: TEST,
    why:
      '`noindex` 와 `nofollow` 는 다른 일이다 — 이 레포는 *색인만* 빼고 크롤 경로는 남기려 한다. ' +
      'nofollow 면 크롤 열린 noindex 6표면 + 교환권 상세 2,260건이 Googlebot 에게 **막다른 길**이 ' +
      '되고, 그게 수리 전 실제 상태였다(서버는 follow 인데 클라가 nofollow 를 덧붙였다).',
  },
  {
    name: '🤖 robots 지시어 — max-image-preview 값을 구글이 모르는 것으로',
    file: SSOT,
    find: "max-image-preview:large'",
    replace: "max-image-preview:medium'",
    test: TEST,
    why:
      '유효값은 `none|standard|large` 셋뿐이다. 모르는 값을 주면 구글이 **그 지시어를 버리면서 ' +
      '에러를 안 낸다** — 빌드도 화면도 안 깨지고 큰 이미지만 안 나온다(이 레포가 상대 URL 로 ' +
      '같은 클래스를 두 번 밟았다).',
  },
  {
    name: '🤖 robots 지시어 — 색인 값에 noindex 를 섞는다 (반대 방향 · 가장 비싸다)',
    file: SSOT,
    find: "export const ROBOTS_INDEX = 'index, follow, max-image-preview:large'",
    replace: "export const ROBOTS_INDEX = 'noindex, follow, max-image-preview:large'",
    test: TEST,
    why:
      '**이 방향이 비교 불가로 비싸다.** 한 글자로 전 색인 대상 표면이 검색에서 빠지고 복구는 ' +
      '수주다. 큰 이미지를 얻는 이득과 견줄 수 없으므로 양방향을 잠근다.',
  },
  {
    name: '🤖 robots 지시어 — index.html 리터럴만 종전 값으로 (두 벌이 갈린다)',
    file: 'index.html',
    find: '<meta name="robots" content="index, follow, max-image-preview:large" />',
    replace: '<meta name="robots" content="index, follow" />',
    test: TEST,
    why:
      '정적 HTML 은 상수를 import 할 수 없어 **여기만 리터럴**이다 — 대조가 유일한 잠금이다. ' +
      '봇 셸과 `index.html` 은 **상호배타 응답**이라 갈리면 *같은 URL 이 크롤러에 따라 다른 지시어*를 ' +
      '받는다(오늘 제목·`og:image:alt` 에서 고친 그 클래스).',
  },
  {
    name: '🤖 robots 지시어 — index.html 에 robots 메타를 둘 넣는다',
    file: 'index.html',
    find: '    <meta name="robots" content="index, follow, max-image-preview:large" />',
    replace:
      '    <meta name="robots" content="index, follow, max-image-preview:large" />\n' +
      '    <meta name="robots" content="index, follow" />',
    test: TEST,
    why:
      '구글은 robots 메타가 충돌하면 **가장 제한적인 쪽**을 쓴다 — 둘이 되는 순간 둘 중 약한 쪽이 ' +
      '이기고 지시어 하나가 조용히 무효가 된다(canonical 2개로 같은 사고를 2026-10-12 에 겪었다).',
  },
  {
    name: '🤖 robots 지시어 — 봇 셸이 값을 손으로 적는다',
    file: 'src/worker/index.ts',
    find: '<meta name="robots" content="${ROBOTS_INDEX}" />',
    replace: '<meta name="robots" content="index, follow" />',
    test: TEST,
    why:
      '봇 셸은 **검색 크롤러가 받는 유일한 문서**다(사람은 `index.html` 을 받는다). 여기서 값을 ' +
      '손으로 적으면 상수를 고쳐도 크롤러에게 전달되지 않는다 — 2026-10-11 `#organization` 과 ' +
      '같은 자리다(*파일에 있다 ≠ 크롤러가 받는다*).',
  },
  {
    name: '🤖 robots 지시어 — 워커 noindex rewrite 가 리터럴로 돌아간다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "el.setAttribute('content', ROBOTS_NOINDEX) }",
    replace: "el.setAttribute('content', 'noindex, follow') }",
    test: TEST,
    why:
      '오늘 값이 갈린 두 자리 중 하나다. 리터럴이 남으면 `ROBOTS_NOINDEX` 를 고쳐도 서버 쪽만 ' +
      '안 따라오고, 그 불일치는 **에러가 없다**.',
  },
  {
    name: '🤖 robots 지시어 — SEO.tsx 가 nofollow 리터럴로 돌아간다',
    file: 'src/components/SEO.tsx',
    find: 'content={ROBOTS_NOINDEX}',
    replace: 'content="noindex, nofollow"',
    test: TEST,
    why:
      '수리 전 실제 상태다. `react-helmet-async` 는 `meta[data-rh]` 만 질의하므로 서버 태그를 ' +
      '지우지 않는다 ⇒ JS 를 렌더하는 Googlebot 이 robots 를 둘 받고 `nofollow` 가 이긴다.',
  },
  {
    name: '🤖 robots 지시어 — 초대장 페이지가 리터럴로 돌아간다 (/i/join)',
    file: 'src/pages/InfluencerJoinPage.tsx',
    find: 'content={ROBOTS_NOINDEX}',
    replace: 'content="noindex, nofollow"',
    test: TEST,
    why:
      '`/i/join/:code`·`/i/offer/:token` 은 **robots.txt 가 안 막는다**(`Disallow: /influencer/` 는 ' +
      '다른 경로다 — 실측으로 확인했다). 즉 크롤러가 실제로 오는 자리이고, 리터럴 두 벌을 남겨 두면 ' +
      '값이 다시 갈린다.',
  },
  {
    name: '🤖 robots 지시어 — 전수 검사의 정규식을 무력화한다 (헛도는 가드)',
    file: TEST,
    // 🔀 2026-10-14 재조준: 되돌려-검증이 **헛돈다**고 잡았다 — ⑤-2 탐침이 자기 정규식 사본을
    //   쓰고 있어 ⑤-1 의 식을 무력화해도 통과했다. 식을 `ROBOTS_LITERAL_RE` 한 곳으로 모아
    //   둘이 **같은 식**을 돌게 했고, 앵커도 그 한 줄로 옮겼다.
    find: 'const ROBOTS_LITERAL_RE = /content="(?:no)?index[^"]*"/g',
    replace: 'const ROBOTS_LITERAL_RE = /content="ZZZ_NEVER_MATCHES"/g',
    test: TEST,
    why:
      '⑤-1 은 "리터럴 0개" 를 단언하는데 **정규식이 아무것도 안 잡으면 영원히 0개**다 — 이 레포가 ' +
      '반복해 당한 *검사가 실패할 수 없음* 이다. ⑤-2 가 탐침으로 그 방향을 잠근다.',
  },
  {
    name: '🤖 robots 지시어 — 판정을 주석 포함 원문으로 한다 (거짓 빨간불)',
    file: TEST,
    find: "const code = (p: string) => readCode(p)",
    replace: "const code = (p: string) => readRaw(p)",
    test: TEST,
    why:
      '설명 주석이 사고를 인용하므로(`noindex, nofollow`) 원문을 검사하면 **코드가 멀쩡한데** ' +
      '빨간불이 난다. 이 레포가 `d1-migrate`·robots 가드·anti-slop 에서 네 번 밟은 함정이라 ' +
      '⑥-1 이 양방향을 고정한다.',
  },
]
