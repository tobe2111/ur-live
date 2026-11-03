/**
 * 🎨 2026-11-03 — 첫 화면 CSS 를 **번들할 때** 진짜 값으로 바꿔 끼운다 (라우트 청크 맵 2026-11-01 과 같은 처방).
 *
 * 대표 *"낭비 없이 빨리 각 세션의 배포들을"* → *"가장 이상적으로 해줘"*.
 *
 * 왜(실측): `src/worker/generated/critical-css.ts` 는 59KB 가 **한 줄**인 생성물인데 추적·커밋되고 있었다.
 * 최근 3일 main 머지 109건 중 **16건**이 이 파일을 고쳤다 — 첫 화면 클래스를 하나만 바꿔도 그 한 줄이 통째로 바뀌므로,
 * 두 PR 이 동시에 고치면 **무조건 충돌**한다(손으로 합칠 수도 없다). 그런데 배포는 매번 `build:worker` 가 다시 만든다 —
 * 커밋본은 배포에 **아무 일도 안 했다**(시험이 "커밋본 = 재생성본" 을 강제해서 커밋했을 뿐이다).
 *
 * ⇒ 추적 파일은 **빈 자리표시자**(타입검사용), 진짜 값은 생성기가 `critical-css.build.ts`(추적 안 함)로 만들고
 *    이 플러그인이 번들할 때 바꿔 끼운다. 빌드 파일이 없으면 빈 값 = `criticalCssUsable('')` 이 false = **종전과 byte-동일**한
 *    HTML(첫 화면 CSS 없이 앱 CSS 로)이다 — 실패해도 깨지지 않고 느려질 뿐이라 아래 대조가 그걸 **실패**로 잡는다.
 */
const fs = require('fs');
const path = require('path');

function criticalCssPlugin(
  root = process.cwd(),
  PLACEHOLDER = path.resolve(root, 'src/worker/generated/critical-css.ts'),
  BUILD = path.resolve(root, 'src/worker/generated/critical-css.build.ts'),
) {
  return {
    name: 'critical-css-build',
    setup(build) {
      build.onResolve({ filter: /[\\/]generated[\\/]critical-css$/ }, (args) => {
        const target = path.resolve(args.resolveDir, args.path) + '.ts';
        if (target !== PLACEHOLDER) return undefined; // 다른 파일이면 손대지 않는다
        return { path: fs.existsSync(BUILD) ? BUILD : PLACEHOLDER };
      });
    },
  };
}

/** 빌드 파일의 CSS 에서 따옴표·역슬래시 없는 조각 하나 — 번들(JS 문자열)에서도 글자 그대로 남는다. */
function probeOf(css) {
  const parts = css.split(/["\\]/).filter((p) => p.length >= 80);
  return parts.length ? parts.sort((a, b) => b.length - a.length)[0].slice(0, 80) : '';
}

/**
 * 번들 대조 — 빌드 파일에 CSS 가 **있었는데** 번들에 없으면 플러그인이 헛돈 것이다(첫 화면 CSS 가 조용히 빠진 배포).
 * 빌드 파일이 없으면(생성기를 안 돌린 로컬 워커 빌드) 종전에도 그 상태라 통과.
 */
function assertCriticalCssBundled(
  outfile,
  BUILD = path.resolve(process.cwd(), 'src/worker/generated/critical-css.build.ts'),
  exit = (code) => process.exit(code),
) {
  if (!fs.existsSync(BUILD)) return 'no-build-file';
  const m = /export const CRITICAL_CSS: string = (".*")\s*$/m.exec(fs.readFileSync(BUILD, 'utf8'));
  const css = m ? JSON.parse(m[1]) : '';
  if (!css) {
    console.error('❌ 첫 화면 CSS 빌드 파일이 비었다(또는 형식이 바뀌었다) — 못 잰 것은 통과가 아니다. generate-critical-css.mjs 를 확인할 것.');
    exit(1);
    return 'empty';
  }
  const probe = probeOf(css);
  const out = fs.readFileSync(outfile, 'utf8');
  if (!probe || !out.includes(probe)) {
    console.error('❌ 첫 화면 CSS 가 번들에 안 들어갔다 — 배포하면 첫 화면이 앱 CSS 를 기다린다. 플러그인 critical-css-build 를 확인할 것.');
    exit(1);
    return 'missing';
  }
  console.log(`✅ 첫 화면 CSS 번들 확인 — ${css.length}B 가 _worker.js 에 있음`);
  return 'ok';
}

module.exports = { criticalCssPlugin, assertCriticalCssBundled, probeOf };
