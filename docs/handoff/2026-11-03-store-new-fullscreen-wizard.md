# 2026-11-03 — `/store/new` 매장 등록 위저드 재구성 (유어딜 소비자 화면 · 머니 경로 접촉 없음)

대표 신고: *"여기 플로우도 확인해줘. 지금 이상적이지 않은 것 같고, UI 디자인도 별로야 그 다음 페이지들도"* (스크린샷: 1/4 지도 단계)

## 완료분
- 폰 전체 화면 위저드: 하단 탭 숨김(`src/lib/consumer-chrome.ts` `fullScreenExactPaths` 에 `/store/new`), 페이지가 `h-dvh` 로 높이를 잡아 [다음]이 늘 바닥.
- 설명은 ① 단계 머리(`lead` prop)에만, PC 는 왼쪽 열 그대로.
- `PERSONAL_BROKER_SIGNUP_DISABLED` 동안 "운영 방식" 단계 제외 → 3단계. `channel` 초기값 `direct`(성공 등록은 원래 전부 direct).
- 지도 반쪽 빈 칸: `KakaoMapPicker` ResizeObserver → `relayout()`.
- 디자인 시스템 정리(평면·글자 크기·굵기). 비교 이미지 `docs/design/assets/store-new-2026-11-03-*.webp`, 상세 `docs/design/store-new-onboarding-2026-09.md`.
- 커밋/PR: (아래 PR 참조)

## 이번에 틀렸던 판단
- 첫 렌더에서 버튼이 바닥에 안 붙었다 — 패널만 `flex-1` 로 줬고 **page 변형의 바깥 틀(`shellCls`)이 flex 가 아니었다**. 시험이 이제 그 줄을 고정한다.
- 지도 빈 칸은 이 환경에서 카카오 SDK 가 막혀 **재현 못 했다**. 처방(크기 감시 relayout)은 원인 추정이다 → 라이브 판정 필요.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
- 라이브 폰에서 `https://urdeal.kr/store/new` 열고: ① 하단 탭 없음 ② [다음]이 바닥 ③ 지도 타일이 칸 전체를 채우는지. ③이 여전히 반쪽이면 원인은 다른 곳(SDK 로드 타이밍) — `KakaoMapPicker` initMap 직후 `setTimeout(relayout)` 로 좁힐 것.

## 남은 결정
- 없음. (완료 후 "첫 이용권 올리기"로 바로 잇는 완료 화면은 제안만 — 대표 판단 시 별건.)
