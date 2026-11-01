# prerender 가 매 빌드 죽던 것 — `window is not defined` (2026-11-01)

## 한 줄
`src/App.tsx` 의 Suspense 폴백이 **렌더 중** `window.location.pathname` 을 읽어 `npm run build` 의
prerender 단계가 몇 달간 **매번** 죽었다. 그런데 빌드는 `exit 0` 이라 아무도 몰랐다.

## 왜 안 보였나 — 침묵이 **세 겹**이었다 (전부 실측)
1. `entry-server.tsx` 의 안전판 로그(`onShellError`·`onError`·타임아웃 warn)가 `vite.config.ts` 의
   `terserOptions.compress.drop_console: true` 로 **번들에서 전부 제거**돼 있었다
   (빌드된 `dist/server/entry-server.mjs` 에 `'shell 렌더 실패'` 문자열 **0건**).
   ⇒ "관측만 한다" 던 주석이 거짓이었다.
2. 그 `onShellError` 가 부른 `renderToString` 폴백이 **같은 에러를 React 콜백 안에서 다시** 던져
   `main().catch` 밖으로 나갔다 → 처리 안 된 예외로 프로세스 사망, `[prerender-main] 실패:` 줄도 없음.
3. `package.json` 의 `|| echo '[build] prerender skip (graceful)'` 가 exit code 를 삼켰다.
   문구가 "skip (graceful)" 이라 **정상처럼 읽혔다.**

## 수정
| 파일 | 무엇 |
|---|---|
| `src/App.tsx` | `PageLoader` 가 경로를 **라우터에서 받는다**(`pathname` prop ← `location.pathname`). `typeof window` 가드로 서버가 기본값을 *짐작*하는 쪽이 아니다 — 서버도 참값을 알고, 형제 `isDashboardLoaderSurface(location.pathname)` 와 출처가 하나가 된다 |
| `src/entry-server.tsx` | `console.warn` → `ssrLog()`(`process.stderr`, terser 가 안 지운다). 안전판이 처음으로 실제로 관측한다 |
| `scripts/prerender-main.mjs` | `uncaughtException`/`unhandledRejection` 핸들러 → 어떤 경로로 죽어도 이 스크립트 이름으로 보고 + 가드 명령 안내. **빌드는 안 깨뜨린다**(근거는 파일 주석) |
| `package.json` | 삼키는 문구를 정직하게(`WARN prerender FAILED … continues on purpose`) |
| `tests/setup.ts` | `global.window.*` 직접 대입 → `__win` 분기. 종전엔 이 줄이 **node 환경 시험 자체를 불가능**하게 만들어 이 결함을 재는 가드를 아무도 못 썼다. jsdom 에서는 byte-동일 |

## 왜 빌드를 깨뜨리지 않았나 (결정)
산출물이 **지금 아무도 안 쓴다**(CLAUDE.md 2026-07-07 — 워커 `#root` catch-all 이 홈까지 정적 로더로
덮는다). 그런데 `exit 1` 로 배포를 막으면 쓰지도 않는 단계가 긴급 수정까지 세운다 — 이 스크립트는
앱 트리 전체를 Node 에서 렌더하므로 의존성 하나가 모듈 평가 중 `window` 를 읽기 시작하면 그날부터
main 배포가 멎는다. ⇒ **게이트는 PR 단위 시험**(1.9초)이 맡고 빌드는 크게 소리만 낸다.
⚠️ 이 균형은 "산출물을 안 쓴다" 에 달려 있다 — 다시 쓰게 되면 뒤집고 이유를 적을 것.

## 가드
`src/tests/unit/ssr-render-window-2026-11-01.test.tsx` 6건 — prerender 와 **같은 조건**(node 환경 +
같은 스토리지 스텁)으로 `/`·`/videos`·`/seller` 를 실제 렌더한다. **문자열이 아니라 동작 판정.**
주입 `scripts/mutations/ssr-render-window-2026-11-01.mjs` **3건 되돌려-검증 전부 빨간불 확인**
(그중 하나는 **반대 방향** — `typeof window` 가드로 "고친 척" 하면 렌더는 안 터지므로 동작 판정은
통과하고 소스 단언만이 잡는다).
🔁 낡은 앵커 **3건을 지우지 않고 재조준**: `boot-first-screen-2026-09-16.test.tsx`(인자 목록만 허용,
`BrandLoader` 직접 호출 차단은 그대로) · `scripts/mutations/{detail-ssr-first-screen,dark-loader-surface}.mjs`
(결함은 한 글자도 안 바꿨고 둘 다 재검증 빨간불).

### 이 가드가 **못** 보는 것
- **lazy 페이지 모듈 본문**: `renderToString` 은 Suspense **폴백**까지만 그린다. 전체 트리 판정은
  빌드의 prerender(`onAllReady`)가 하고, 그래서 그 단계가 시끄러워야 한다.
- `ROUTES` 3개 밖의 경로 · 빌드된 번들(terser·청크) 고유 문제.
- 렌더 중 `document.body` 를 읽는 **잠든** 두 자리 — `components/CustomModal.tsx:175` ·
  `components/main/AppDownloadModal.tsx:87`(`createPortal(…, document.body)`). 지금은 서버에서
  렌더되지 않아 안 터지지만, 그 모달이 서버 렌더 경로에 들어오는 날 같은 사고가 난다.

## 판정 (실측)
- 수정 전: `build-before.log` 에 `ReferenceError: window is not defined` + `Node.js v22.23.4`(프로세스 사망) + `[build] prerender skip (graceful)`, 빌드 **exit 0**.
- 수정 후: 전체 빌드 로그 `is not defined` **0건**, `[prerender-main] 렌더 완료 (59ms, 20104 chars)` →
  `갱신 완료 ✅` → `종료 (exit 0)`. **prerender 가 처음으로 성공했다.**
- `tsc --noEmit` 0 에러(⚠️ 기본 힙으론 OOM — `NODE_OPTIONS=--max-old-space-size=6144` 필요).

## 🔴 다음 세션의 첫 액션 — 복구한 로그가 **두 번째 버그**를 바로 드러냈다
수정 후 빌드 로그:
```
[entry-server] boundary 오류(해당 섹션 fallback 유지): Error: The render was aborted by the server without a reason.
[entry-server] allReady nullms 타임아웃 — renderToString 폴백
```
`nullms` — `scripts/prerender-main.mjs` 가 `renderApp('/', initialData)` 로 부르는데 `initialData` 는
`null` 이고, 받는 쪽 시그니처는 **`renderAppComplete(url, timeoutMs = 20000)`** 다. 기본값은 `undefined`
에만 적용되므로 `setTimeout(…, null)` → 0ms → 즉시 abort → `renderToString` 폴백.
⇒ **`renderAppComplete` 의 allReady 경로는 prerender 에서 한 번도 돈 적이 없다.** 즉 2026-07-05 가
"스피너만 구워지는 것" 을 고치려고 만든 그 함수가 그 일을 한 번도 하지 않았다.

🔴 **그런데 "고치면 된다" 가 아니다 — 고치는 쪽이 더 나쁠 수 있다.** CLAUDE.md 2026-07-07 이 이
산출물을 *"순수 낭비"* 로 판정했으므로, allReady 를 살리면 아무도 안 읽는 마크업 100KB+ 를 `index.html`
에 구워 **자산만 커진다**. 먼저 **누가 그 산출물을 읽는지**를 재고(워커 `#root` 분기 전수) 그 다음에
① 제대로 살린다 ② 이 단계를 아예 걷는다 중 하나를 고를 것. **이 세션은 범위 밖이라 보고만 했다.**

## 틀렸던 판단 (반복 방지)
- `window.`/`document.` 를 brace 추적으로 정적 스캔해 "257건 후보" 가 나왔는데 **대부분 오탐**이었다
  (문자열·템플릿 리터럴 안의 `{` 로 깊이가 밀리고, `onClick={() => window…}` 같은 인라인 핸들러는
  블록을 열지 않아 콜백으로 안 세어진다). ⇒ **이 클래스는 정적 스캔으로 못 잰다. 렌더해 봐야 한다.**
  그래서 가드를 문자열 검사가 아니라 실제 렌더로 만들었다.
- `tail` 로 빌드 로그를 자르면 이 에러를 놓친다(1,122줄 중 1,086줄에 있다) — `> log 2>&1` 후 grep.
