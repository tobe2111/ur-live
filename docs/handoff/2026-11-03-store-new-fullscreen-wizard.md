# 2026-11-03 — `/store/new` 매장 등록 4화면 + 첫 이용권 한 화면 (유어딜 소비자 · 머니 경로 접촉 없음)

대표 신고: *"여기 플로우도 확인해줘. 이상적이지 않고 UI 디자인도 별로야 그 다음 페이지들도"* → 시안 두 번 → **"시안대로 해줘. 판매 기간은 제한 없어."**
설계·시안: `docs/design/store-new-onboarding-2026-09.md` "2026-11-03 — 4화면 흐름" · 캔버스 https://claude.ai/artifact/QiE7JRE9CpZHFtsh2kcKcS

## 완료분 (PR #2160)
- `/store/new` = ① 찾기 ② 이 가게로 등록 ③ 완료 할 일 (`src/pages/store-new/*`), ④ `/store/first-voucher` 첫 이용권 한 화면.
- 약관 동의 = 버튼 아래 안내문(대표 확정). 서버 계약(`POST /api/seller/stores` · `terms_agreed_version` · 409) 무변경.
- 첫 이용권 = `POST /api/seller/products`, `group_buy_deadline: null`(판매 기간 제한 없음, 대표 확정), 받는 돈은 서버 `fee-context` 값만.
- 다크모드 지원, 하단 탭 숨김, PC 액자 해제, robots Disallow, 셀러 가이드 v61.
- 대시보드 모달(`StoreRegisterModal`)은 유지 — 그 안의 운영 방식 단계만 스위치 동안 뺐다.

## 이번에 틀렸던 판단
- 첫 판에서 버튼이 바닥에 안 붙었다 — 바깥 틀이 flex 가 아니었다.
- 시안 검사용 에이전시 토큰을 짧게 넣어 띠가 안 보였다 — 토큰은 64자 16진수다(`TOKEN_RE`).
- 대시보드 마진 계산기를 그대로 넣었더니 시안(받는 돈 한 줄)보다 커졌다 → `voucherMargin` 으로 한 줄.

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
- 라이브 폰(라이트·다크)에서 `/store/new` → 실제 가게 하나로 등록 → 첫 이용권까지. 확인: 지도 타일이 칸을 채우는지 · 계정 번호가 채워지는지 · 첫 이용권이 마이 '내 가게'에 뜨는지.
- 에이전시 초대 링크로 같은 흐름 — 띠·완료 문구·맡기기 토스트.

## 남은 결정
- 없음.
