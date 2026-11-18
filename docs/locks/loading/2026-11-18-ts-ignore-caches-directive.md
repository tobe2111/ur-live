# [LOADING_ADDITIVE] 2026-11-18 — `caches.default` 위 타입 주석 한 단어 (`@ts-expect-error` → `@ts-ignore`)

- **파일**: `src/worker/index.ts`(SSR `caches.default.match` 직접 read 근처) · `src/worker/middleware/edge-cache.ts`
- **바뀐 것**: 주석 지시어만. 런타임 코드 0줄 — `caches.default` 읽기·`useKv:false`·`CDN-Cache-Control` 그대로.
- **왜**: 서버 타입 검사(`tsconfig.worker.json`)를 막는 단계로 바꾸면서(대표 "남은 과제도 다 해주고") 이 두 줄이
  "쓸모없는 expect-error" 오류가 됐다. 워커 타입엔 `caches.default` 가 있고 브라우저 타입(DOM)엔 없어서,
  두 tsconfig 가 같은 파일을 볼 때 `expect-error` 는 한쪽에서 반드시 틀린다. `ts-ignore` 는 양쪽에서 맞다.
- **판정**: `npx tsc -p tsconfig.worker.json` 0 · `npx tsc -p tsconfig.json` 0 · `npm run build:worker` 통과.
