# 2026-11-01 — prerender 를 끝냈다: 그 단계는 **검사기**가 됐다

**대표 지시**: *"가장 이상적이고 영구적으로 끝까지 마무리지어줘"*
**선행 세션**: `2026-11-01-prerender-window-crash.md` (PR #2070, main `ce1f9b5`) — 그 인계가 남긴 숙제
(*"먼저 누가 그 산출물을 읽는지 재고 ①살린다 ②단계를 걷는다 중 고를 것"*)의 **답**이 이 세션이다.

---

## 🔴 다음 세션의 첫 액션

### 1) 배포 확인 (이 PR 이 머지된 뒤)
```bash
# ① 빌드 로그에 검사가 돌고 결함 0 인가
#    Actions → Deploy to Cloudflare Pages → Build 로그에서:
#    "[ssr-render-window] ✅ 결함 0 — 렌더 중 브라우저 전역 접근 없음(앱 트리 전체)"

# ② 라이브가 종전과 같은가 (산출물을 안 쓰므로 #root 는 소스 로더여야 한다)
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
curl -sS -A "$UA" https://urdeal.kr/ | grep -c 'ur-first-screen'   # 1 이어야 — 워커가 교체한다
curl -sS -A "$UA" https://urdeal.kr/ | grep -c 'data-ssr="main"'   # 0 이어야 — 더는 굽지 않는다
```
⚠️ **`data-ssr="main"` 이 0 인 것이 정상이다.** `docs/SSR_MIGRATION.md` 의 2026-05 절이 *"그 속성이 보이면
확정"* 이라 적어 둔 것은 **낡았다**(그래서 그 문서 머리에 경고를 붙였다). 그걸 믿고 "prerender 실패" 로
오진하지 말 것.

### 2) 남은 같은 클래스 — **잠든 두 자리** (범위 밖으로 둔 것)
```bash
grep -n "document.body" src/components/CustomModal.tsx src/components/main/AppDownloadModal.tsx
```
둘 다 `createPortal(…, document.body)` 를 **렌더 중에** 읽는다. 지금은 SSR 경로에 없어 검사기가 안 잡지만,
그 모달이 서버 렌더 경로에 들어오는 날 **PR #2070 과 같은 모양으로** 터진다. 고치는 법은 그 PR 과 같다:
렌더 중 전역을 읽지 말고 라우터/부모가 준 값이나 effect 로 옮긴다. ⚠️ `typeof document` 가드로 "고친 척"
하지 말 것(그러면 SSR 에서 포털이 조용히 사라진다 — PR #2070 의 반대 방향 주입이 그 교훈이다).

---

## ✅ 완료분

| 무엇 | 어디 |
|---|---|
| `prerender-main.mjs` → **`check-ssr-render-window.mjs`** (검사기로 재정의, 파일 안 씀) | `scripts/check-ssr-render-window.mjs` |
| `allReady` 켬 (인자 제거 — 검사 범위 = 앱 트리 전체) | 같은 파일 |
| npm 스크립트 `prerender:main` → **`check:ssr-render`** | `package.json` |
| **PR 게이트 신설**(`--strict`, `build:ssr` 포함) | `.github/workflows/verify.yml` |
| 하네스 `#root` 비우기 수리(헛돌던 정규식) | `scripts/visual-preview.mjs` |
| 패리티 EXCLUDE 등록(사유: `dist/server` 필요) | `scripts/local-ci-parity.mjs` |
| `entry-server` 머리말 "lazy 는 safe" **정정** | `src/entry-server.tsx` |
| 가드 6 → **16건** · 주입 3 → **12건** | `src/tests/unit/ssr-render-window-2026-11-01.test.tsx` · `scripts/mutations/ssr-render-window-2026-11-01.mjs` |
| 문서 머리 경고 + 현재 상태 절 | `docs/SSR_MIGRATION.md` |
| 감사 로그 | `CLAUDE.md` 로딩 절 |

**검증**: tsc **0** · 빌드 **exit 0**(체인 안에서 `✅ 결함 0` · 60ms · 20,192자) · 되돌려-검증 **9/9 빨간불** ·
앵커 **5,062건 실재** · `local-ci-parity` 초록(CI strict 110 = 로컬 101 + 제외 9) · 충돌 마커 0.

**최종 산출물 실측**: `data-ssr="main"` **0건** · `#root` **1,184B**(소스 `ur-pre-react` 로더) · 전체 **28,438B**.

---

## 📐 결정의 근거 (실측 — 다시 재지 말 것)

| 질문 | 실측 |
|---|---|
| 라이브가 구운 `#root` 를 쓰는가 | **아니오.** 워커가 모든 HTML 응답에서 교체(첫 화면 분기 + **catch-all `else`**) |
| 우회 경로 | 없음. `/index.html` → Pages **308 → `/`** · 검색 크롤러는 봇 셸 |
| `#root` 를 읽는 가드 | **0개** |
| `dist/server/entry-server.mjs` 소비자 | **이 검사기 하나뿐**(`build:ssr` 도 사실상 전용) |
| 수리 전 구워진 것 | `#root` **1,298B** · `role="status"` = **BrandLoader 스피너** |
| 원인 | 호출부 2번째 인자 `null` ↔ `renderAppComplete(url, timeoutMs = 20000)` → `setTimeout(…, null)` = **0ms** |
| 인자 제거 시 | 107ms · **20,192자** · 에러 **0** · Suspense 실패 **1 → 0** |
| 그 대가 | `index.html` **28,568 → 47,860B (+19.3KB)** — 매 응답에서 워커가 파싱한 뒤 **버린다** |

⇒ **둘을 같이** 해야 순수 이득이다(검사 범위↑ + 낭비 0). 하나만 하면 손해이거나 현상 유지다.

### 🧭 비대칭이 의도다 — 지우지 말 것
| 자리 | 동작 | 이유 |
|---|---|---|
| `npm run build` | **소리만**(`\|\| echo` 가 exit code 를 삼킨다) | 앱 트리 전체를 Node 에서 렌더하므로 의존성 하나가 모듈 평가 중 `window` 를 읽으면 **main 배포가 통째로 멎는다** |
| `verify.yml`(PR) | **`--strict` → `exit 1`** | 머지를 막는 자리는 배포가 아니라 PR |

strict 를 빌드로 옮기면 긴급 수정이 막히고, PR 게이트를 빼면 이 검사가 **다시 로그 속 침묵**이 된다
(= 원 사고의 원인).

---

## 🩸 이번에 틀렸던 판단

1. **"고치면 더 나쁘다(100KB)" 는 절반만 맞았다.** 실측은 **19.3KB** 이고, 더 중요하게 — 고칠 **값이
   있었다**(Suspense 실패 1→0 = lazy 모듈이 실제로 평가된다). 선행 세션이 추정으로 범위 밖에 두었고,
   그 추정이 다음 세션의 판단을 **한 번 더** 미루게 했다. ⇒ **추정값을 인계에 숫자로 적지 말 것.**
2. **"하네스/라이브 불일치" 로 우려했는데 기각됐다.** 하네스 6개가 `visual-preview` 의 `shell()` 을
   거치고 거기서 비운다. ⇒ 다만 **그 비우기가 헛돌고 있었다**(아래 3).
3. **내 측정기가 두 번 거짓말했다.** ⓐ `new Function(...)` 으로 ESM 구문 검사 → 늘 실패(검사기 오류) ⓑ
   스크래치 하네스가 120초를 넘겨 멈췄다 — 조건을 완전히 같게 만들려고 **스크립트를 복사해 인자만** 바꿔
   돌리자 27ms 에 끝났다. ⇒ **조건이 다른 하네스를 새로 쓰지 말고 원본을 복사할 것.**
4. **치환이 조용히 실패했다.** `python ... s.replace(a,b)` 에 `assert a in s` 를 안 걸어 머리말 보강이
   안 들어갔는데 "✅" 가 찍혔다. ⇒ **모든 치환에 앵커 assert.**
5. **내 단언 하나가 헛돌았다**(주입이 잡았다). 폴백 감시를 *장치의 존재*로만 봐서, 가로채기를 남기고
   **모으는 줄만** 지우면 통과했다. ⇒ **체인**(담는다 → 읽는다)으로 판정.

---

## ⏳ 남은 결정 / 대기

- **없음**(이 세션 범위에서). 위 "잠든 두 자리" 는 결함이지만 **지금 도달 경로가 없고**, 고치는 것은
  소비자 모달 렌더 변경이라 별건이다.
- 🔵 참고 — **`build:ssr` 를 빌드 체인에서 뺄 수 있나?** 이론상 가능하다(소비자가 검사기 하나뿐이고
  그 검사는 CI 에도 있다). **하지만 안 했다**: 그러면 배포 로그에서 이 신호가 사라진다(이중 방어 상실).
  빼고 싶으면 **배포 로그에서 window 결함을 볼 필요가 없다**를 먼저 납득해야 한다.
