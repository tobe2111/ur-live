# 2026-09-02 — 소비자 팝업·입력창 다크/디자인 시스템 (담기 토스트 · 리뷰 작성란 · 장바구니)

**레일**: 🎟️ 유어딜(소비자) · **머니 경로**: 없음 · **롤백**: 파일별 독립(아래 표)

대표 신고 3건을 한 세션에서 처리했다.

| 신고 | 원인 | 수정 |
|---|---|---|
| "핀 추가 중 오류가 발생했습니다" — 추가돼도 문구가 너무 길다 | 서버는 이미 담은 상품에 **409 + `ALREADY_PINNED`** 를 주는데 axios 가 4xx 를 throw 해서 `result.code === 'ALREADY_PINNED'` 분기가 **한 번도 도달한 적이 없었다**(늘 catch → "오류"). 성공 문구는 📌·🎉 + "5명 공유 시 예상 N원 적립" 시뮬레이터가 붙어 한 줄 토스트로 못 읽는 길이 | `usePinAction.ts`: catch 에서 응답 code 를 읽어 "이미 담은 상품이에요"(info). 문구를 `MSG` 상수로 모아 전부 30자 이내·이모지 0·"핀"→"담기". 시뮬레이터 제거. 매장 업주 안내는 "유어샵 추천에 담았어요" 까지만(편집 절차는 편집 화면이 말할 자리) |
| 리뷰 작성란 다크에서 글자가 흰색이라 안 보임 | textarea 에 `dark:bg-*` 가 없어 브라우저 기본 흰 배경 + 전역 `.dark textarea{color:gray-100}` = 흰 바탕에 흰 글자 | `ProductReviews.tsx`: 입력창 `bg-[#F8F7FC] dark:bg-[#11141C]`(카드 안 한 톤 낮은 면). 함께 디자인 시스템 적용 — 카드 테두리 0 + `shadow-lift`, 핑크 정보상자·🎁 → 회색 한 줄, 별 노랑 → `text-brand-text`, 주 버튼 `bg-brand`, 공유 프롬프트 제목 이모지 제거 |
| 장바구니 페이지 심각 | 로그인 상태 래퍼만 `bg-[#F4F4F4]` 단독(dark: 없음) → 빈 장바구니 아래 화면 절반이 회색 | `CartPage.tsx`: 바탕 `--bg` 두 톤(`#F8F7FC` / `#11141C`), 셀러 묶음·요약은 surface `#1D1F29`. 핑크 체크박스·무료배송 텍스트 → 브랜드, `#f9fafb` 정보상자 제거. `CustomModal.tsx`: 초록 체크 원·파란 i 제거(규칙 ⑥), surface+lift, `z-50` → `Z.MODAL_BACKDROP`(10500 — 종전엔 하단 네비 9999 뒤로 숨는 값) |
| (동반) 토스트 자체 | 2026-06-22 의 잉크 상자(`#18181B` + 링 + 무거운 그림자 + 초록/하늘 아이콘) | `ToastContainer.tsx`: 라이트 흰 카드 + `shadow-lift` / 다크 surface, 성공·안내 아이콘은 브랜드 글자색 하나, 오류만 빨강 |

**가드**: `src/tests/unit/consumer-popups-dark.test.ts` 9건 + `check-guard-mutations` 주입 3건(**되돌려-검증 3종 빨간불 확인**).
⚠️ 테스트 작성 중 **내 설명 주석 속 옛 문자열**("핀 추가 중 오류"·🎁·`bg-[#F4F4F4]`)에 테스트가 걸렸다 — 주석을 바꿨다.
`★`(U+2605)이 이모지 정규식 2600 블록에 잡혀 오탐 → 1F 블록만 본다.

**검증**: tsc 0 · vitest 9/9 · theme/design-slop(이모지 533→532)/modal-zindex/input-text-color/anti-slop/image-fallback/lock-table GREEN.
🩸 `check-guard-mutations` 를 인자 없이 import 했다가 664건 전체가 돌기 시작해 타임아웃으로 끊었다 — 자식 프로세스 잔존 0 · `check-no-injection-in-progress` 통과 확인 후 진행. **`--only` 없이 부르지 말 것.**

**콘솔에서 같이 보인 것(이번 범위 밖)**: `/api/group-buy/join/2887` 403 — 코드상 403 은 `SELF_PARTICIPATION_BLOCKED`(본인 상품)·`REVIEW_LEVEL_REQUIRED`·선착순 게이트 중 하나. 대표 계정이 본인 상품에 참여를 눌렀을 가능성이 크다. Sentry 429 는 무료 쿼터 초과(무해).

**다음 세션 첫 액션**: 배포 후 다크모드에서 ① 이미 담은 상품 다시 담기 → "이미 담은 상품이에요" ② 상품 상세 리뷰 작성 textarea 타이핑 글자 보임 ③ `/cart` 빈 상태 아래까지 다크. 셋 다 눈으로.
**Notion**: 미기록(MCP 연결 세션에서 개발 업데이트 로그 1행 — 유어딜 / UI).
