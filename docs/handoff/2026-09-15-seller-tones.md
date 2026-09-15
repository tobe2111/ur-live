# 2026-09-15 — 셀러 2차 페이지 정리: 색 정보상자·이모지·버튼 체계·숫자 위계 (PR 1/3)

> 대표 지시: *"다른 대시보드들의 페이지들도 개선 계속 해줘. 예외들도 너가 다 게이트 on 하고 진행해"*
> (= 결재 대기 없이 자율 진행 · PR 은 열자마자 auto-merge). 이 파일은 그 첫 PR 의 인계다.
> 어느 서비스인가: **유어딜 소비자 셀러 대시보드**(`/seller/*`). 도매·공구 서비스·유어애즈 무접촉.

## 무엇이 달라졌나 (사용자 관점)

셀러 대시보드의 **2차 페이지 90여 개**(숙소 등록·분석·소싱·상품·재고·프로모·인플 딜·사업자 정보·이전·
실시간·알림톡·예약·교환권 이력·소개비·광고·번들 …)에서

- 파랑/노랑/초록/빨강 **색깔 정보상자 200여 곳 → 흰 카드 + 헤어라인**, 뜻은 글자 톤(`text-tone-ok/warn/bad`)으로만.
  상태 배지(모집중·거절·완료…)는 톤 토큰 알약(`bg-tone-*-bg text-tone-*`)으로 — 파일마다 제각각이던 색이 4군으로 통일.
- 선택 상태(라디오 카드·탭)는 **브랜드 블루**(`border-brand bg-brand-tint`)로 통일.
- **이모지 0** — 화면 문구·토스트·옵션·6개 언어 로케일(`seller.*` 304건)에서 전부 제거, 자리가 필요한 곳은 lucide.
- 빨간 단색 버튼(2FA 해제·노쇼·삭제·반려)은 `ur-btn-danger`, 유튜브 성장 CTA 는 `ur-btn-primary`, 회색 원시 버튼은 `ur-btn-secondary`.
- 큰 숫자(분석 KPI·상품 수·실시간 매출·교환권 합계·등급)는 홈과 같은 `dash-num` 위계.
- 사진 위 오버레이 컨트롤(`PhotoGalleryEditor`)만 검정 반투명 유지 — `dashboard-button-ok` 주석 4곳.

## 🩸 이번에 틀렸던 판단 / 발견한 구멍 — **이게 제일 값지다**

1. **`git ls-files 'src/pages/seller-*/**/*.tsx'` 는 0개를 돌려준다.** git 은 이중 별표를 `:(glob)` 없이 안 푼다.
   그래서 `check-dashboard-button-system.mjs` 가 **"62개 검사"** 초록을 찍는 동안 `seller-*/` 54개 +
   `components/seller/` 15개는 **검사 밖**이었다(2026-08-31 부터). 코드모드 `adopt-button-system` 도, 형제 테스트
   `seller-d3-2026-09-15.test.ts` 도 같은 글로브였다. 셋 다 `:(glob)` 으로 고쳤고 그 순간 원시 버튼 13개가 드러나
   같이 정리했다. 가드: `seller-tones-2026-09-15.test.ts` ① + 주입 "글로브가".
   ⇒ **다른 가드의 `git ls-files` 글로브도 의심할 것** — `**` 가 있는데 `:(glob)` 이 없으면 그 가드는 헛돈다.
2. 코드모드 첫 판은 **삼항 조각의 문맥을 잃었다** — `w-7 h-7 rounded-full ${x ? 'bg-red-100 …' : …}` 의 안쪽 문자열은
   자기 안에 `rounded-full` 이 없어 배지가 아니라 정보상자로 바뀌었다(테두리 원). 바깥 문맥(ctx)을 넘겨 판정하도록 고쳤다.
3. 이모지 일괄 제거가 **`✕` 닫기 버튼 3개와 아이콘 자리 2개를 빈 요소로** 만들었다(U+2715 가 범위 안). 빈 `<button></button>`
   grep 으로 잡아 lucide `X`/`Ticket`/`Camera` 로 채웠다. **일괄 제거 뒤에는 반드시 빈 요소 grep.**
4. `text-2xl` 일괄 → `dash-num` 이 **모달 제목**(`OrderDetailModal` h2)까지 mono 숫자체로 바꿨다 → 제목은 되돌림.
   숫자 위계 규칙은 *숫자*에만.
5. 테스트 파일 doc 주석에 `**/*.tsx` · `seller-*/` 를 그대로 적어 **블록 주석이 닫혔다**(PARSE_ERROR 두 번). 주석에
   글로브를 적을 땐 전각 `＊` 로.

## 검증 (E2)

- tsc 0 · 관련 유닛 3파일 41건 pass · 전체 vitest 659파일 8,136건 pass(코드모드 직후 시점)
- 가드: theme · dashboard-button(131파일) · design-slop(이모지 497→458) · input-text-color · file-size · dashboard-theme ·
  light-input GREEN
- 주입 4건 **되돌려-검증 빨간불 확인**(`scripts/mutations/seller-tones.mjs`)
- 렌더(하네스, API 목): 폰·PC 17페이지 pageerror 0(실시간 페이지의 `length` 오류는 목 데이터 형태 — 라이브 무관)

## 다음 세션의 첫 액션

1. PR 2 = **어드민 셸 Rinda**: `.admin-light-theme` 에 `--dash-*` 토큰 부여(`src/index.css` 445~470 의 셀러 블록 미러),
   `src/components/AdminLayout.tsx`(505줄) 사이드바를 셀러 A2 구조로(흰 면 · 블루 알약 · 평면 메뉴).
   ⚠️ 주입 "D3 토큰이 어드민 래퍼로 새어 든다"(`seller-d3.mjs`)가 **어드민 스코프에 `--dash-radius` 를 두면 빨간불**이다 —
   그 주입은 "셀러만" 이 약속이던 시점의 것이라, 어드민에 넣기로 한 지금은 **주입과 테스트를 함께 갱신**해야 한다
   (`seller-d3-2026-09-15.test.ts` 의 해당 단언 포함).
2. PR 3 = 어드민 페이지: `node scripts/codemods/adopt-dashboard-tones.mjs --scope=admin --write` (정보상자 460 · 이모지 743 ·
   잉크 버튼 238). 코드모드 GLOBS.admin 은 이미 `:(glob)` 이다. 버튼 코드모드는 셀러 전용 글로브라 admin 스코프 인자를 더해야 한다.
3. 도매몰(유통스타트) 대시보드는 **범위 밖** — 2026-07-29 철거 결정(`docs/design/wholesale-teardown-plan.md`).

## 남은 결정 없음

머니 경로 0 · 잠금 파일 0 · 게이트 0. (대표가 "게이트 on" 을 말했지만 이 PR 엔 켤 게이트가 없다.)
