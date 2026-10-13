/**
 * 🧬 주입 — **AI 봇 문서의 첫 본문 219자** (2026-10-12)
 *
 * 되돌리면 전부 **조용히** 종전으로 간다. `display:none` 이라 사람 화면은 한 픽셀도 안 바뀌고
 * 빌드도 테스트도 초록인데, AI 검색봇이 받는 문서의 맨 앞이 다시
 * "인앱 브라우저에서는 일부 기능이 제한돼요" 가 된다. 재 본 사람만 아는 종류다.
 */
const HTML = 'index.html'
const T = 'src/tests/unit/inapp-block-removed-2026-10-12.test.ts'
const ROOT_LINE = '    <div id="root" role="application" aria-label="유어딜 라이브 커머스">'

/** 종전 블록의 축약판 — id·문구·본문 텍스트 셋을 모두 되살린다 */
const BLOCK = `    <div id="ud-inapp-block" role="alert" aria-live="polite">
      <div class="wrap">
        <div class="ulogo">유어딜</div>
        <p id="ud-title" class="blk-title">인앱 브라우저에서는<br/>일부 기능이 제한돼요</p>
        <a id="ud-open-btn" href="#" class="open-btn">📲 외부 브라우저 열기</a>
        <div class="url-box" id="ud-url"></div>
        <button class="copy" id="ud-copy-btn" type="button">URL 복사</button>
      </div>
    </div>

`

export default [
  {
    name: '인앱안내 — 풀스크린 블록이 root 앞에 되살아난다 (종전 동작)',
    file: HTML,
    find: ROOT_LINE,
    replace: BLOCK + ROOT_LINE,
    test: T,
    why:
      '정확히 종전 상태다. `#ud-inapp-block` 은 `.show` 를 붙이는 코드가 없어 **뜰 수 없는** ' +
      '죽은 마크업인데, 바이트로는 남아 AI 검색봇(BOT_UA_REGEX 밖 → 봇 셸이 아닌 이 문서를 받는다)이 ' +
      '모든 페이지의 첫 본문 219자로 이 안내를 읽는다.',
  },
  {
    name: '인앱안내 — id 는 새 이름인데 문구가 그대로다',
    file: HTML,
    find: ROOT_LINE,
    replace:
      `    <div id="ud-notice" style="display:none"><p>인앱 브라우저에서는 일부 기능이 제한돼요</p></div>\n\n` +
      ROOT_LINE,
    test: T,
    why:
      'id 만 바꿔 되살리는 경우. ①(id 검사)은 통과하므로 ②(문구 검사)가 따로 있어야 한다 — ' +
      '크롤러가 읽는 것은 id 가 아니라 **글자**다.',
  },
  {
    name: '인앱안내 — 이름도 문구도 새 것인 안내가 root 앞에 선다',
    file: HTML,
    find: ROOT_LINE,
    replace:
      `    <div id="ud-promo" hidden><p>앱으로 보면 더 편해요. 지금 설치하기</p></div>\n\n` +
      ROOT_LINE,
    test: T,
    why:
      '이 클래스 전체. ①②는 통과한다 — ③(`#root` 앞 본문 0자)만 잡는다. 사람에겐 안 보이고 ' +
      '언어모델에겐 그 페이지의 첫 문장이 되는, 같은 사고의 다음 판본이다.',
  },
  {
    name: '인앱안내 — 폐기 명칭 "링크샵" 이 메타에 돌아온다',
    file: HTML,
    find: '나만의 유어샵까지. 유어딜에서 돈버는 쇼핑." />\n    <meta name="keywords"',
    replace: '나만의 링크샵까지. 유어딜에서 돈버는 쇼핑." />\n    <meta name="keywords"',
    test: T,
    why:
      '2026-08-26 대표 확정으로 폐기된 이름이다. 이 메타는 표에 항목이 없는 모든 경로' +
      '(`/cart`·`/wishlist`·`/notifications` …)에 그대로 서빙되는 **우리 자기소개**라 ' +
      '검색·AI 가 옛 이름으로 우리를 설명하게 된다.',
  },
  {
    name: '인앱안내 — 치우다 UA 감지까지 끈다',
    file: HTML,
    find: '          var isKakao = /KAKAOTALK/i.test(ua);',
    replace: '          var isKakao = false;',
    test: T,
    why:
      '반대 방향. 안내를 지울 때 감지 스크립트까지 "정리" 하면 일반 브라우저 8초 슬로우 힌트의 ' +
      '분기 판정이 무너진다 — 부팅이 멈춘 사용자에게 남는 유일한 안내다.',
  },
  {
    name: '인앱안내 — 잠금표 항목(히어로 preload)에 crossorigin 을 붙인다',
    file: HTML,
    find: '<link rel="preload" as="image" href="/assets/mascot/udal-loader-v2.webp" />',
    replace: '<link rel="preload" as="image" href="/assets/mascot/udal-loader-v2.webp" crossorigin />',
    test: T,
    why:
      '같은 파일을 만지는 작업이 잠금표 항목까지 번지는 경우. same-origin 인데 crossOrigin 을 붙이면 ' +
      'preload mismatch 로 200~500ms 를 버린다(잠금표가 그 사유를 명시한다).',
  },
]
