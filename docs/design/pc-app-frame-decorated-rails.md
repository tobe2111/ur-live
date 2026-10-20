# 🖥️ PC = 중앙 모바일 액자 + 데코 사이드레일 + 하단 네비

**시안 받은 날**: 2026-06-20 · **출처**: 대표 (에버랜드 앱 PC 화면)
**상태**: ⏳ 방향 확정 후 구현 — **현 구조에서 재구성 (신규 아키 아님)**

## 시안 설명 (에버랜드 PC)
- 중앙: **폰 폭 앱**(상단 검색/지도 + **하단 네비** 홈/Info·Map/에버포켓/솜충전소/코스/전체메뉴)
- 좌측 레일: 테마 배경 위 카드 — "앱 다운로드 QR", "굿즈# 특별혜택 QR"
- 우측 레일: 테마 배경 위 카드 — 공지사항/이벤트/이달의혜택/제휴사혜택/단체예약 + "에버랜드는 지금"
- 배경: 풀블리드 일러스트(물/캐릭터) — **좌우 여백을 비우지 않고 브랜드로 채움**

대표 의도: "PC도 상단 네비 말고, **하단 네비 있는 모바일 버전을 중앙에** 두고 **양옆 배경을 이렇게 꾸미기**".

## 🎉 핵심: 이미 70~80% 이 구조
`src/components/MobileAppLayout.tsx`:
- `framed` (`app-framed`): 컨슈머 페이지는 **이미 430px 중앙 액자** (대시보드/도매몰/비디오 제외).
- `app-frame-host` body 클래스: 액자 양옆 PC 배경(현재 = 단색 테마색, **데코 X**).
- `DesktopLiveLeftPanel` / `DesktopLiveRightPanel`: live/shorts 에서 **이미 좌우 데코 패널** 렌더 → 컨슈머로 일반화 가능.
- `HIDE_SIDEBAR_PREFIXES`(대시보드/도매몰) = 풀너비 유지 (건드리지 않음).

## 현재 vs 시안 (차이 = 할 일)
| 항목 | 현재 | 시안/목표 |
|---|---|---|
| 컨슈머 액자 | ✅ 430px 중앙 | 동일 |
| 홈 `/` | full-width(`DESKTOP_RESPONSIVE_PATHS={'/'}`) | **액자로 통일** (되돌림) |
| 양옆 배경 | 단색 | **데코(모노 일러/패턴) + 프로모/QR/퀵링크 레일** |
| PC 네비 | `DesktopLiveSidebar`(좌측바), BottomNav `lg:hidden` | **하단 네비를 액자 안에 유지**(앱처럼) + 좌측바 정리 |
| 좌우 레일 콘텐츠 | live 전용 패널 | 컨슈머용: QR(앱/링크샵)·이벤트·혜택·바로가기 |
| 톤 | — | **B&W** (시안은 컬러지만 우리는 모노 — 직전 흑백 전환과 정합) |

## ⚠️ 핵심 caveat
1. **배경 데코는 B&W로** — 시안의 컬러 일러는 참고만. 모노 일러/그레이 패턴/브랜드 모티프로(흑백 전환 유지).
2. **대시보드/도매몰/결제리턴은 풀너비 유지** (이미 제외) — 액자 강제 X.
3. **하단 네비 vs 좌측 사이드바**: 시안대로 하단 네비를 PC 액자에도 노출. 좌측바는 제거 or 슬림 보조. (과거 주석에 sidebar↔framed 플립플롭 이력 — 이걸로 **하나의 정체성으로 종결** 가능.)

## 구현 todo (방향 확정 시)
- [ ] 홈 `/` 를 `DESKTOP_RESPONSIVE_PATHS` 에서 제거 → 액자 적용
- [ ] `app-frame-host` 배경에 모노 데코 레이어 (CSS, 라이트/다크 둘 다)
- [ ] 컨슈머용 좌/우 레일 컴포넌트 (QR·이벤트·혜택·바로가기) — live 패널 패턴 재활용
- [ ] PC 에서 BottomNav 액자 내 노출 (현 `lg:hidden` 조정) + 사이드바 정책 결정
- [ ] 4 뷰포트 확인 (≤640/768/1280/1920) — CLAUDE.md PC 룰

## ✅ 구현 완료 (2026-06-20)
- `MobileAppLayout.tsx`: `DESKTOP_RESPONSIVE_PATHS` 비움 → **홈도 430 액자**. `framed` 면 좌측 사이드바 숨김(`showSidebar = … && !framed`) + `ConsumerFrameRails` 렌더(`showFrameRails = framed && !linkshopVisitor`).
- `ConsumerFrameRails.tsx` (신규): xl+ 거터 좌/우 레일 — 좌(브랜드+모바일 QR `QRCodeSVG`), 우(바로가기 5종 + 전체 동네딜 CTA). 전부 B&W, fixed calc 위치(프레임 중심 기준).
- `index.css`: `app-frame-host` 거터에 **모노 도트 텍스처**(라이트/다크) — 컬러 일러 대신 흑백 패턴.
- `BottomNav.tsx`: `lg:hidden` 제거 + `app-frame-bar` → **PC 액자 안 하단 네비**(430 중앙). linkshopPath/active-path 로직 무변경.
- `App.tsx`: `main` 의 `lg:pb-0` 제거(PC 하단 네비 여백 예약).
- 대시보드/도매몰/결제(`HIDE_SIDEBAR_PREFIXES`)·live/shorts(mobileOnly)는 불변.
- 검증: tsc 0 · 테마 일관성 통과 · build 통과.
- 후속(선택): 레일 콘텐츠 동적화(인기 딜), 좌측 사이드바 완전 제거 여부 확정, 1280 미만 거터 대응.
