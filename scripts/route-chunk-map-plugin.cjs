/**
 * 🧩 2026-11-01 — 라우트 청크 맵을 **번들할 때** 진짜 값으로 바꿔 끼운다.
 *
 * `src/worker/generated/route-chunk-map.ts` 는 추적되는 **자리표시자**(빈 값, 타입검사용)이고, 진짜 맵은
 * `generate-route-chunk-map.mjs` 가 빌드마다 `route-chunk-map.build.ts`(추적 안 함)로 만든다. 종전엔 빌드가
 * 추적 파일을 덮어써서 ① 클라 빌드 없는 워커 빌드(로컬 pre-commit)가 **빈 맵**으로 덮었고 ② 그게 커밋됐고
 * (main 150커밋 중 5회) ③ 무관한 PR 끼리 그 파일에서 충돌했다.
 *
 * 🔴 **이 플러그인이 조용히 실패하면 배포 HTML 에서 라우트 청크 미리받기가 사라진다**(첫 화면 느려짐 —
 *    에러 0). 그래서 아래 `assertRouteChunkMapBundled` 가 번들 결과를 대조한다.
 */
const fs = require('fs');
const path = require('path');

/** 경로는 인자로 받는다 — 시험이 합성 트리에서 진짜 esbuild 로 돌릴 수 있게. */
function routeChunkMapPlugin(
  root = process.cwd(),
  ROUTE_MAP_PLACEHOLDER = path.resolve(root, 'src/worker/generated/route-chunk-map.ts'),
  ROUTE_MAP_BUILD = path.resolve(root, 'src/worker/generated/route-chunk-map.build.ts'),
) {
  return {
  name: 'route-chunk-map-build',
  setup(build) {
    build.onResolve({ filter: /[\\/]generated[\\/]route-chunk-map$/ }, (args) => {
      const target = path.resolve(args.resolveDir, args.path) + '.ts';
      if (target !== ROUTE_MAP_PLACEHOLDER) return undefined; // 다른 파일이면 손대지 않는다
      // 빌드 파일이 없으면(생성기를 안 돌림) 자리표시자 = 빈 맵 — 종전 "manifest 없음 → 빈 맵" 과 같은 결과.
      return { path: fs.existsSync(ROUTE_MAP_BUILD) ? ROUTE_MAP_BUILD : ROUTE_MAP_PLACEHOLDER };
    });
  },
  };
}

/**
 * 번들 대조 — 빌드 파일에 청크가 **있었는데** 번들에 없으면 플러그인이 헛돈 것이다. 실패로 끝낸다.
 * (빌드 파일이 빈 맵이면 = 클라 빌드 없이 워커만 빌드한 것이고, 그건 종전에도 빈 맵이었다 — 통과.)
 */
function assertRouteChunkMapBundled(
  outfile,
  ROUTE_MAP_BUILD = path.resolve(process.cwd(), 'src/worker/generated/route-chunk-map.build.ts'),
  exit = (code) => process.exit(code),
) {
  if (!fs.existsSync(ROUTE_MAP_BUILD)) return 'no-build-file';
  const src = fs.readFileSync(ROUTE_MAP_BUILD, 'utf8');
  const chunks = [...src.matchAll(/"(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  if (chunks.length === 0) return 'empty-map';
  const out = fs.readFileSync(outfile, 'utf8');
  const missing = chunks.filter((c) => !out.includes(c));
  if (missing.length > 0) {
    console.error(
      `❌ 라우트 청크 맵이 번들에 안 들어갔다 — 빌드 파일의 청크 ${chunks.length}개 중 ${missing.length}개가 _worker.js 에 없다` +
        ` (예: ${missing[0]}). 배포하면 첫 화면 미리받기가 사라진다. 플러그인 route-chunk-map-build 를 확인할 것.`,
    );
    exit(1);
    return 'missing';
  }
  console.log(`✅ 라우트 청크 맵 번들 확인 — 청크 ${chunks.length}개 전부 _worker.js 에 있음`);
  return 'ok';
}

module.exports = { routeChunkMapPlugin, assertRouteChunkMapBundled };
