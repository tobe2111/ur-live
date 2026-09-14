# 셀러·어드민 대시보드 — Rinda 껍데기 (2026-09-14)

브랜치 `claude/seller-dashboard-rinda` · **PR #1429 (draft)** · 시안·근거 `docs/design/dashboard-rinda-2026-09.md`

> 🔴 **이 PR 뒤에 대표가 방향을 더 밀었다** — *"모바일이 더욱 중요. 기존 UI 전체를 뒤엎어도 된다. 카드·섹션 자체가 싫다. 이용권 등록·관리·매출이 주인공."* 모바일 시안 4안 제안·선택 대기: `docs/design/seller-dashboard-mobile-first-2026-09.md`. 다음 세션은 **그 선택부터** 확인할 것 — 선택에 따라 이 PR 의 카드 부품은 대체된다.

## 대표 지시 (원문)

> *"1번째이미지는 지금 우리 유어딜의 셀러대시보드, 2번째 이미지대로 거의 동일하게 셀러대시보드 디자인 UI를
> 맞추고 싶어. 모든 페이지. 된다면 어드민 대시보드도."*
> *"특히나 지금 셀러대시보드는 되게 UI가 불편해. 나도 불편한데 셀러 가입하는 유저들 모두 헷갈릴거야."*
> *"rinda처럼 보이게, 그리고 쉽게 모두 해당이야."* · *"셀러대시보드 메인이 일단 가장 중요한데도 메인이 너무 보기 안좋아."*

`AskUserQuestion` 으로 확정: **새 브랜치**(#1239 오염 방지) · 범위 **시각 + 구조 정리**(껍데기 + 공유 부품 +
사이드바 IA + 중복 진입점 제거 + 글자·터치 키우기, 어드민도 같은 껍데기).

## 1. 다음 세션의 첫 액션

1. **PR 을 열고 CI 를 본다** — 이 세션은 커밋·푸시까지 하고 draft PR 을 연다. 초록이면 대표 확인 요청.
2. **눈으로 본다** (가드가 못 보는 것): `node scripts/visual-preview.mjs --route=/seller --pc --auth=seller`
   또는 이 세션이 쓴 Playwright 방식(아래 §4). **1440×1100 에서 두 인격**(신규 셀러 전부 0 / 운영 중 셀러)을
   반드시 둘 다 볼 것 — 내 레이아웃 회귀 둘이 **신규 인격에서만** 드러났다.
3. **남은 범위**: 사이드바 *밖* 개별 페이지 본문(`/seller/*` 50개 · `/admin/*` 106개)의 잔여
   **검은 버튼 · 그림자 카드**. 껍데기와 공유 부품은 끝났고 그건 따라오지만, 페이지가 자기 className 으로
   직접 칠한 자리는 안 따라온다. 찾는 법:
   `grep -rn "bg-gray-900\|bg-black" src/pages/Seller*.tsx src/pages/seller-*/ src/pages/Admin*.tsx | grep -v "text-"`

## 2. 완료분

| 무엇 | 파일 |
|---|---|
| 흰 사이드바 260px + 워크스페이스 카드 + 파란 CTA + 헤어라인 구분(그룹 라벨 제거) | `SellerLayout.tsx` · `AdminLayout.tsx` · `seller-layout/SellerSimpleNav.tsx` |
| 활성 = 연파랑 알약(`.ur-*-nav-active` → `var(--brand-tint)`) | `src/index.css` |
| 라이트 래퍼가 `--brand-tint`/`--brand-text` 를 되박음(다크 누수 차단) | `src/index.css` |
| 카드 부품: 들림 → **헤어라인 테두리**(대시보드는 소비자 🎫 규칙 ①과 갈라진다 — 시안 §3) | `dashboard/DashboardCard.tsx` · `DashboardStatCard.tsx` |
| 검은 타일 제거 · 강조는 브랜드 틴트 한 가지 | `seller-page/PrimaryActions.tsx` |
| 셀러 메인 13블록 세로 나열 → 전폭 매장 → 타일 → **2열**(좌 2/3 · 우 1/3) → 전폭 공개페이지 | `pages/SellerPage.tsx` |
| 어드민 섹션 액센트 대비 수리(1.8~2.8:1 → 4.87/5.02/7.58:1) | `admin/admin-nav-config.ts` |
| 🐛 **₩412,000 → "정산 가능 412000건"** 수리(금액 키 신설, 6개 언어) | `SellerPage.tsx` + `public/locales/*/translation.json` |

**가드**: `src/tests/unit/dashboard-rinda-shell.test.ts` 18건(R1 흰 사이드바 / R2 틴트 되박기 /
R3 CTA 를 빼도 ⌘K 색인은 무손상 / R4 검은 타일 0 / R5 금액을 건수로 말하지 않음) +
`scripts/check-guard-mutations.mjs` 매니페스트 5건 등록 — **5건 전부 주입해 빨간불 확인 후 복원**.

## 3. 이번에 틀렸던 판단 (제일 값진 부분)

1. **`bg-bg` 는 존재하지 않는 토큰이고 `--bg` 는 라이트 래퍼가 되박지 않는다** — 다크 모드에서 대시보드
   바탕이 검게 갈 뻔했다. `bg-warm`(tailwind.config 의 **리터럴 hex**)으로 갔다. 같은 이유로 `--brand-tint`
   는 **되박아야** 한다 — `.seller-light-theme` 가 `--lift`/`--rule`/`--tone-*` 만 되박고 틴트를 빠뜨려서,
   흰 사이드바로 바꾸는 순간 `:root.dark` 의 `#16243D`(남색)가 새어 활성 알약이 검게 떴다.
   **사이드바가 흰 면이 되면서 비로소 도달 가능해진 경로다.**
2. **레이아웃 회귀를 내가 두 번 만들었고, 둘 다 타입체크·테스트를 통과했다.** ① 통계를 2열 *위*에 두었더니
   조건부 블록이 전부 없는 신규 셀러에서 왼쪽 2/3 칸이 **빈 구멍**이 됐다(종전보다 나빴다) ② `PublicPagePreview`
   를 1/3 칸에 넣었더니 "내 공개 페이지"가 **한 줄에 한 글자씩** 줄바꿈했다. ⇒ **렌더해서 보지 않았으면 그대로
   머지됐다.** 대시보드 레이아웃 변경은 tsc 로 판정할 수 없다.
3. **`toContain('bg-amber-50')` 이 `bg-amber-500`(상태 점)에 걸렸다** — 부분일치 함정. 막으려던 건 색깔
   *정보상자*이지 점이 아니다 → `/bg-amber-50(?!\d)/` 로 경계를 박았다.
4. **낡은 가드 앵커 3건**(`seller-dashboard-b.test.ts`, 2026-09-02 B안) — 그 파일은 *"잉크 사이드바 유지"* 를
   고정하고 있었다. 지우지 않고 **승계 사실을 문서 블록에 적고 값만 교체**했다(나머지 불변식은 여전히 유효).
   재앵커한 두 단언은 되돌려-검증으로 빨간불을 확인했다.
5. **브랜치 head 해시를 한 번 틀리게 말했다**(`d9df9dc` ↔ `d98da7f`). 보고 전에 `git log -1` 로 확인할 것.

## 4. 렌더 하네스 (이 세션이 쓴 방법 — 다음 세션이 그대로 쓸 수 있게)

`vite dev --port 5199` + `playwright-core`(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
`--no-sandbox`). `ctx.route('**/api/**')` 로 응답을 채우고 `addInitScript` 로 `seller_token` 등을 심는다.
⚠️ **응답 shape 을 세 번 틀렸다** — `/seller/my-stores` 와 `/seller/products` 는 `data` 가 **배열 그 자체**,
통계는 `data.summary.{total_sales,…}` + `data.daily` + `data.topProducts`(평평하지 않다).

## 5. 남은 결정/대기

- **대표 확인**: 새 껍데기가 Rinda 에 충분히 가까운가(특히 셀러 메인 2열 배치).
- 개별 페이지 본문 잔여 정리(위 §1-3)를 **이 PR 에 더 담을지, 후속으로 뺄지** — 범위가 156페이지라 후속 권장.
- 별건: PR #1239(인플루언서 제휴 제안서)는 초록으로 **대표 머지 대기** 중이다.
