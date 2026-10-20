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

- **main 머지 뒤 CI 를 "로컬 71건 초록"으로 대신했다** — `origin/main` 을 머지하면 **main 이 그 사이 새로 만든 가드**도 같이 들어온다(이번엔 09-13 신설 `check-comment-stripper`). 내 테스트가 그 가드의 첫 위반자가 되어 Verify 가 53분 만에 빨간불(`cff67b0e1` 로 수리 — 자체 정규식 제거기 → SSOT `stripComments`). ⇒ 머지 커밋 뒤에는 관련 테스트가 아니라 **`bash scripts/audit-gate.sh` 를 다시** 돌릴 것. 새 가드는 내 diff 를 안 봐도 잡는다.

## 4. 렌더 하네스 (이 세션이 쓴 방법 — 다음 세션이 그대로 쓸 수 있게)

`vite dev --port 5199` + `playwright-core`(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
`--no-sandbox`). `ctx.route('**/api/**')` 로 응답을 채우고 `addInitScript` 로 `seller_token` 등을 심는다.
⚠️ **응답 shape 을 세 번 틀렸다** — `/seller/my-stores` 와 `/seller/products` 는 `data` 가 **배열 그 자체**,
통계는 `data.summary.{total_sales,…}` + `data.daily` + `data.topProducts`(평평하지 않다).

## 5. 남은 결정/대기

- **대표 확인**: 새 껍데기가 Rinda 에 충분히 가까운가(특히 셀러 메인 2열 배치).
- 개별 페이지 본문 잔여 정리(위 §1-3)를 **이 PR 에 더 담을지, 후속으로 뺄지** — 범위가 156페이지라 후속 권장.
- 별건: PR #1239(인플루언서 제휴 제안서)는 초록으로 **대표 머지 대기** 중이다.

---

## 6. (같은 날 오후) 모바일 우선 재설계 구현 — 대표 *"그대로 모두 진행. 그리고 추가로 저 삭제할 건 없어? 모두 진행해줘."*

[E2] 검증됨 — tsc 0 · vitest 전체 pass · 관련 가드 GREEN · 주입 5건 되돌려-검증 red · 폰/PC × 3인격 렌더 확인. 라이브 판정(E4)은 머지·배포 뒤.

### 완료분 (전부 PR #1429 에 얹음)
- 시안 문서 `docs/design/seller-dashboard-mobile-first-2026-09.md` "✅ 구현 완료" 표가 SSOT — ①~④ 어디에 무엇이 있는지.
- 서버 1곳: `seller-settlements.routes.ts` `/dashboard/stats` — 오늘 매출을 **KST 달력일 + PAID/DONE** 으로(종전 UTC + 결제 실패 포함). 읽기 전용 통계, 머니 경로 아님.

### 다음 세션의 첫 액션
1. 머지·배포 뒤 라이브 `/seller` 를 **폰으로** 열어 하단 탭 5개 + 오늘 티켓 숫자가 실제 주문과 맞는지(`오늘 매출` = 오늘 KST 결제 완료 합). 어드민 계정으로 셀러 로그인이 안 되면 대표 화면 캡처로 판정.
2. `/seller/group-buy` 에서 판매 스위치를 한 번 껐다 켜기(PUT `/api/seller/products/:id` HIDDEN/ACTIVE) — 400 이 뜨면 서버 허용 status 가 바뀐 것.
3. 폰 `/seller/orders` 처리 대기 행의 [주문 확인] → 준비 중으로 넘어가는지(확인창 1회).

### 이번에 틀렸던 판단
- **매장 패널을 게이트 분기 양쪽에 각각 그렸다** → React 가 부모가 바뀔 때 재마운트하고, 새 인스턴스가 `null`(판정 중)을 보고해 게이트가 풀렸다 잠겼다를 반복 → 첫 렌더에서 STEP 1 티켓이 **아예 안 보였다**. 렌더 실측이 아니면 못 잡는 부류(tsc·테스트 초록). ⇒ 게이트로 부모를 바꾸지 말고 **열 안의 내용만** 바꾼다. 주입 가드가 이 회귀를 잠근다.
- **첫 하네스가 옛 클라 셰이프(`summary.*`)를 mock 해서 통과했다.** 그 이름은 서버가 준 적이 없다. mock 은 서버 코드를 읽고 만들 것(이번엔 `/dashboard/stats` 핸들러를 읽고 다시 짰다).
- 가로 레일이 `overflow-x-auto` 인데도 폰 화면 밖으로 밀렸다 — 그리드 칸의 `min-width:auto` 가 콘텐츠 폭으로 벌어진다. `min-w-0` 세 곳.

### 남은 결정/대기 (대표)
- 꺼진 기능의 페이지·라우트 삭제 여부(라이브 `notify-followers`·`youtube-growth` · 매장 전용 모드로 숨긴 상품/소싱/번들/재고/위탁/광고슬롯/마케팅). 이번엔 **소비처 0 인 파일만** 지웠다(10 컴포넌트 + SimpleNav + 라우트 없는 nav 3항목).
- 어드민 대시보드도 같은 모바일 재설계를 할지(이번 범위는 셀러만).
- PC 주문 화면의 우측 선택 주문 티켓(P-orders) — 기존 상세 모달로 대체 중.

## §7 main 머지 — #1430(이용권 삭제·정가)을 M4 행으로 이식 (2026-09-14 오후)

같은 날 머지된 #1430 이 `SellerGroupBuyPage.tsx` 카드에 [수정][삭제] 줄을 넣었는데, 이 브랜치는 그 카드를
`seller-group-buy/VoucherRow.tsx` 로 통째로 옮겼다(M4). 자동 병합이 충돌을 냈고 **한쪽을 고르면 다른 쪽 기능이 사라지는**
자리라 손으로 이식했다:

| #1430 | 이 브랜치(M4 행) |
|---|---|
| 카드 `deleteVoucher(p)` + 삭제 버튼 | 행 `deleteVoucher()` + 펼침 안 삭제 버튼(`text-tone-bad`), `onChanged()` 로 목록 갱신 |
| 수정 버튼을 연락처 분기 밖으로 | 진입점을 `goEdit` **하나**로 — 행 헤더(폰 아이콘·PC 라벨), 펼침 안 편집 버튼은 제거(둘이면 한쪽이 조용히 죽는다) |
| 정가(`original_price`) 폼·PriceStockFields | 충돌 없이 그대로 들어옴 |
| 테스트 13건 + 주입 8건 | `MANAGE` 경로·앵커를 VoucherRow 로 재조준, 반환 ④ 도 `goEdit` 기준으로 이식 — **주입 8건 + 이 브랜치 5건 전부 되돌려-검증 빨간불 확인** |

로케일 6개는 양쪽이 같은 자리에 키를 넣어 충돌 — 둘 다 보존(+`seller.vouchers.deleteConfirm/deleteFailed` 신설).
⚠️ **틀렸던 판단**: 머지 전 `git merge-tree` 가 충돌 0 이라고 보고했는데 실제 머지는 8파일 충돌이었다(merge-tree 호출 방식 문제).
"충돌 없음"은 실제 `git merge` 로만 판정할 것.

## §8 CI 빨강 1건 — `components/seller-layout/` 에 청크 규칙이 없었다 (2026-09-14 밤)

머지 커밋 `0a462d0a3` 의 Verify 가 `surface-role-leak` 8건으로 빨강: gbDetail·product·linkshop·vouchers 표면에
`app-seller-components`·`app-dashboard`. 로컬 `npm run build` 가 원인을 그대로 찍어 줬다 —
`Circular chunk: app-seller-components -> app-components -> app-seller-components`.
`SellerBottomTabs`·`useSellerNavModel` 을 둔 `components/seller-layout/` 은 manualChunks 에 규칙이 없어 `components/`
catch-all(app-components)로 떨어졌고, 그 둘이 `components/seller/seller-primary-nav` 를 import 해 순환이 생겼다.
소비자 페이지는 app-components 를 거의 다 쓰므로 그 순환이 첫 페인트로 셀러 봉투를 끌고 왔다(에러 0·화면 정상 — 바이트만).
수리: 규칙 한 줄(`seller-layout/` → app-seller-components, catch-all 앞). 실측: 빌드 경고 0 · 가드 0건 · critical-chunks 17 동일.
가드: `seller-mobile-first` 테스트 +1(규칙 존재 + catch-all 보다 앞) · 주입 +1(되돌려-검증 빨간불).
🩸 **틀렸던 판단**: 로컬 audit-gate 에서 이 가드가 빨갛게 떴을 때 "옛 dist 산출물 탓" 으로 넘겼다(PR 본문에도 그렇게 적었다).
실제로는 진짜 누수였다. 이 가드는 `npm run build` 직후에만 믿을 수 있고, **빨간불의 이유를 추측으로 기각하지 말 것**.
