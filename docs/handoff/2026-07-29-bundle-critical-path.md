# 2026-07-29 — 번들 critical path: app-components 를 엔트리 preload 에서 분리

**PR**: #878 (draft) · **브랜치**: `claude/bundle-critical-path-optimization-oseglf` · commit `9f1cd06`

## 1. 다음 세션의 첫 액션

PR #878 CI 확인 → 초록이면 머지 검토. 머지 후 라이브에서 실측:

```bash
curl -s https://urdeal.kr/ | grep -o 'modulepreload[^>]*app-components' || echo "OK: app-components 가 엔트리 preload 에 없음"
```

`OK` 가 나오면 의도대로 배포된 것. 나오지 않으면(=app-components 가 여전히 preload)
`generate-route-chunk-map.mjs` 가 CI 빌드에서 표면 폐쇄를 다르게 계산한 것이므로
`src/worker/generated/route-chunk-map.ts` 의 CI 산출물을 먼저 볼 것.

## 2. 완료분

- `vite.config.ts` manualChunks 에 **`app-shell` 허용목록** 추가(엔트리 정적 폐쇄집합 14개).
  catch-all `/src/components/` → `app-components` 는 그대로 두되, **더 이상 엔트리가 그 청크를
  필요로 하지 않게** 만들어 modulepreload 에서 빠지게 했다.
- `scripts/check-bundle-size.mjs` `criticalGzipKB` **300 → 250 하향**(이 파일 최초의 하향).
- 실측 **294.7 → 226.7 KB gzip (−68KB, −23%)**, preload 청크 22 → 17개.

## 3. 이번에 알아낸 것 / 틀렸던 판단

**❗가장 값진 것 — 측정 방법.** "app-components 가 크다"까지는 예산 출력이 알려주지만
**무엇이 왜 거기 있는지는 안 알려준다.** 청크를 여는 방법:

```js
// vite.analyze.config.ts (임시) — 기존 config 에 플러그인 하나 얹는다
{ name:'dump', generateBundle(_o, bundle){ /* c.modules 의 renderedLength 를 덤프 */ } }
```

이걸로 **76 모듈 327.2 KB 중 엔트리 eager 는 14 모듈 46.8 KB(14%) 뿐**이고
62 모듈 280.4 KB(86%)가 얹혀 가고 있었음을 확정했다(추정 아님). 같은 방법으로
`app-utils`(43.3 KB) · `index`(15.9 KB) 도 열어볼 수 있다 — **다음 최적화 후보**.

**틀리기 쉬운 지점 1 — 원인을 개별 컴포넌트로 오해하는 것.** 문제는 특정 컴포넌트가
아니라 **분류 규칙의 기본값**이었다. catch-all 이 마지막에 있어서 폴더 규칙에 이름이
안 적힌 컴포넌트가 전부 크리티컬 청크로 떨어졌다. 그래서 2026-05-24(−248KB)·
05-27(−305KB) 두 번의 대규모 분리에도 **다시 20% 로 차올랐다.** 블록리스트를 한 번 더
늘리는 대신 **기본값을 뒤집어야** 재발이 멈춘다.

**틀리기 쉬운 지점 2 — 허용목록은 정적 import 에 대해 닫혀 있어야 한다.**
`app-shell` 안의 모듈이 `app-components` 의 무언가를 정적 import 하면
`app-shell → app-components` 엣지가 생겨 **그 청크가 도로 preload 된다.**
목록은 main.tsx 로부터의 정적 폐쇄집합으로 뽑아야 하고(dynamic import() 는 경계),
바꾼 뒤엔 반드시 청크 그래프 덤프로 **엣지가 없는지 확인**할 것.

**틀리기 쉬운 지점 3 — "68KB 가 모든 라우트에서 절약된다"는 과장이다.**
하드로드 7개 표면은 `generate-route-chunk-map.mjs` 가 이 청크를 표면 폐쇄로 자동 포함해
**워커 주입 preload 로 옮겨 갈 뿐 병렬은 유지**된다(동등, 회귀 아님).
순수 이득은 그 7개 밖의 라우트 + SPA 내비게이션이다.

**예산을 내린 이유.** 헤드룸 24% 를 그대로 두면 eager import 가 새로 들어와도 한참 뒤에야
울리는 둔한 감지기가 되고, 위 이력처럼 그 사이 다시 찬다. 임계값을 **올릴 때는** 무엇이
왜 늘었는지 적을 것 — raw 예산이 5번 올라가는 동안 근거로 인용된 gzip 값은 죽어 있었다
(2026-07-29 에 복구됨).

## 4. 남은 결정 / 대기

- **대표 판단 대기**: PR #878 머지 여부(draft).
- **후보(미착수)**: `app-utils` 43.3 KB(19%) · `index` 15.9 KB 을 같은 덤프 기법으로 열어
  엔트리가 실제로 쓰는 부분만 남기기. 지금 헤드룸이 23KB 라 다음 유기적 성장은 흡수 가능하지만,
  구조적으로는 `app-utils` 가 다음 차례다.
- `dist/` 빌드가 재생성하는 `src/worker/generated/route-chunk-map.ts` 는 **커밋 대상 아님**
  (이번에도 `git checkout --` 로 되돌렸다).
