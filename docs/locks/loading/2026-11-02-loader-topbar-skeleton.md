# [UNLOCK_LOADING] 로딩 화면 = 위쪽 얇은 막대 + 화면 모양 미리 보여 주기 (2026-11-02)

**대표 지시(원문)**: *"그리고 로딩 페이지 부분. 지금은 너무 별로이고 모션그래픽으로 그리 느려보이지 않는 효과처럼 보이게 할 수 없나?"*
→ 시안(`docs/design/assets/loading-2026-11-02.html`) A~D → *"유달이 뜨는게 별로인 것 같아 로딩 중에. 그래서 A처럼 위쪽 얇은 막대를 넣으면서 화면 모양 미리 보여주기로 가는게 좋을 것 같은데?"*

## 바꾼 잠금 항목
| 파일 | 잠긴 항목 | 무엇을 |
|---|---|---|
| `src/worker/index.ts` | HTMLRewriter SSR inject 블록의 `#root` 정적 로더(`urdealLoaderHtml`) | 유달이·로고·왕복 막대 → `brandLoaderMarkup(4)`(SSOT `shared/brand-loader-markup.ts`). **주입 위치·catch-all else·첫 화면 builder 배선은 불변** |
| `index.html` | preload | 로딩 유달이 그림(10KB) preload 삭제 — 그림 자체가 없어졌다. 남은 preload 0(crossOrigin 규칙은 시험이 계속 본다) |
| `index.html` | `#ur-pre-react` | 같은 SSOT 문자열(글자 단위 — 시험이 대조) |

## 왜 이렇게
- 되풀이 동작(통통·숨쉬기·왕복)은 끝이 안 보여 "멈췄다 → 기다린다" 로 읽힌다. 막대는 **한 번만** 차오른다(0→45% 빠르게, 이후 92% 까지 천천히, 10초).
- 화면 모양(카드 4줄 + 빛 훑기)은 곧 나올 화면의 자리를 미리 잡아 "벌써 거의 다 왔다" 로 읽힌다.
- 스타일을 문자열 안에 같이 싣는다 — 첫 화면 CSS(`critical-css`)는 Tailwind 클래스만 고르므로 전용 클래스를 index.css 에 두면 첫 페인트에 빠질 수 있다. 색은 토큰(`--brand`·`--rule`)만.
- 위상: 앱 로더는 첫 페인트 이후 흐른 시간만큼 음수 delay(`loaderPhaseVars`) — 서버 로더 → 앱 로더 교체 순간 막대가 처음부터 다시 차지 않는다.

## 회귀 감시
- `scripts/check-loader-continuity.mjs`(재조준) · `src/tests/unit/loader-topbar-skeleton-2026-11-02.test.ts` · 주입 `scripts/mutations/loader-topbar-skeleton-2026-11-02.mjs`(4건 빨간불 확인).
- 걷은 것: `shared/udal-loader.ts` · `.ur-udal-hop` · `.ur-loader-breathe/sweep` · `css-first-boot` 의 유달이 preload 제거 규칙·`loaderImgPriorityAttr`(지킬 대상 소멸).

## 못 본 것(정직하게)
- 폰에서 "빨라 보이는지" 는 사람 눈 판정이다(E4/E5). 화면 모양은 카드 목록 모양 하나라 상세·마이 같은 화면과는 모양이 다르다 — 화면별 모양은 다음 단계.

## 🫥 같은 날 #2122 "아예 안 보이게" 와 합침 — 대표 *"섞기"* (AskUserQuestion 그대로)
- 질문: *"로딩 화면 방향이 둘로 갈렸어요 … 둘을 어떻게 할까요?"* → 선택 **"섞기 (추천)"** — *"0.5초 안에 뜨면 아무것도 안 보이고(지금처럼), 그보다 오래 걸릴 때만 위쪽 얇은 막대 + 화면 모양이 나타나요."*
- 구현: `brandLoaderMarkup(rows, shy)` — shy 면 `.ur-ldr-shy` 가 `LOADER_REVEAL_S`(0.5초) 투명했다가 0.2초에 나타난다. 워커·index.html·전체 화면·quiet 가 shy, 문구 있는 로더·대시보드·섹션 인라인·카카오 오버레이는 바로 보인다.
  앱 로더는 `--ur-ldr-in-d = 0.5 − 첫 페인트 뒤 흐른 시간` — 서버 로더가 이미 보였으면 바로 보인다(교체 순간 깜빡임 0).
- #2122 의 `visibility:hidden`·`invisible` 은 이 shy 로 대체(시험 `boot-loader-hidden-2026-11-02` 재조준).
