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

## 3-2. 2단계 — app-utils (commit `0d5c81f`)

같은 기법을 `app-utils`(크리티컬 2위)에 적용:

- **`tailwind-merge` 97.1 KB raw** 가 크리티컬에 있었다. 이 패키지는 manualChunks 규칙이
  **없어서** rollup 이 *importer 가 있는 청크*에 넣는데, 유일한 importer 가 `src/lib/utils.ts`
  (=`cn()`)이고 그게 `/src/lib/` catch-all 로 app-utils 에 있었다. 그런데 `lib/utils.ts` 는
  **엔트리에서 도달 불가**(importer 가 `ui/skeleton`·`ui/separator` 둘뿐, 둘 다 lazy).
  → 전용 leaf 청크 `app-ui-utils` 로 빼면 tailwind-merge 가 따라 나간다.
- **도매 훅** `useWholesale`·`useWholesaleChat`(15.7 KB)이 `/src/hooks/` catch-all 로 묶여
  도매몰을 안 여는 소비자도 받고 있었다 → `app-wholesale-hooks`.

**226.7 → 216.2 KB** · 예산 250 → **240** 재하향.

> 💡 **규칙이 없는 node_modules 패키지는 "importer 를 따라간다".** 그래서 무거운 서드파티가
> 크리티컬에 있으면 그 패키지가 아니라 **그것을 import 하는 우리 모듈의 청크 배정**을 봐야 한다.

### ❗ 여기서 걸러낸 함정 — 청크 이동이 SSR 을 조용히 깨뜨린다

`cn` 을 처음엔 실사용처와 같은 청크(`app-components`)로 보냈다. 그랬더니
**`prerender:main` 출력이 25,718 → 2,873 chars 로 붕괴**했다.
`manualChunks` 는 `build:ssr`(`vite build --ssr`, **같은 vite.config**)에도 적용돼
**SSR 모듈 초기화 순서를 바꾸고**, SSR 중 컴포넌트가 던져 React 가 서브트리를 스트립한다
("SSR-unsafe 경계" 경고). **빌드 exit 0 · tsc 0 · 번들 예산 통과** — 전부 초록이라
그냥 지나갈 뻔했다. **전용 leaf 청크**로 바꾸니 25,718 chars 유지 + 이득은 동일.

⇒ **청크를 옮겼으면 번들 크기만 보지 말고 `npm run prerender:main` 의 chars 를 같이 볼 것.**
   비교 기준값: **25,718 chars**(2026-07-29 기준).

> 참고: `NO_I18NEXT_INSTANCE` 경고는 **이 작업 이전부터 있던 것**이다. 중간에 이걸 새 회귀로
> 오해했다가 첫 빌드 로그를 다시 grep 해서 정정했다 — 경고 유무가 아니라 **chars 수**가 신호다.

## 4. 남은 결정 / 대기

- **대표 판단 대기**: PR #878 머지 여부(draft).
- **후보(미착수)**: `index` 15.9 KB(App.tsx 70.6 KB raw 가 대부분) — 라우트 트리를 더 쪼갤 수
  있는지. `app-utils` 는 2단계에서 처리했다(32.5 KB 로 축소).
  현재 헤드룸 23.8KB(216.2/240) 라 급하지 않다.
- `dist/` 빌드가 재생성하는 `src/worker/generated/route-chunk-map.ts` 는 **커밋 대상 아님**
  (이번에도 `git checkout --` 로 되돌렸다).
