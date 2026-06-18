# 링크샵 랜딩 페이지 리디자인 (나브랜딩 시안)

> 2026-06-17 사용자 시안(스크린샷 3장) — `/u/{handle}` (CuratorPage/CuratorHeader)를 "독립 브랜드 랜딩 페이지"로.
> 참고 브랜드: **나브랜딩** ("나를 브랜딩 하다 / 당신의 평범함을 비범함으로", 인플루언서 양성 프로젝트).

## 시안 설명 (위→아래)

1. **상단 마퀴(marquee) 바** — 주황(브랜드 액센트) 바에 텍스트가 **옆으로 흐름**. 예: "나브랜딩 : 인플루언서 양성 프로젝트" 반복 스크롤. = 공지/헤드라인.
2. **풀블리드 배너 히어로** — 행사 사진이 상단을 가득(프레임 라운드 코너). 좌상단 공유 아이콘, 우상단 알림(벨) 아이콘 오버레이. **동그라미 아바타 없음.**
3. **이름** — "나브랜딩" (중앙, 굵게, 잉크).
4. **태그라인** — "'나를 브랜딩 하다' / 당신의 평범함을 비범함으로." (중앙, 2줄).
5. **SNS** — 인스타 아이콘 (중앙).
6. **비즈니스 제안 버튼** — 메일 아이콘 + "비즈니스 제안" (중앙, outline). *(이번 요청 범위 밖 — 보류)*
7. **구분선** → **콘텐츠 카드** (핀) — 예: VOD 썸네일 + "인스타 인플루언서 공구 수익화 클래스 🏅".

### PC(프레임) 전용
8. **우하단 QR** — "모바일로 보기" (현재 페이지 URL QR). PC 액자 바깥 gutter.
9. **좌측 카테고리 사이드바 숨김** — 링크샵 진입 시 DesktopLiveSidebar 비표시 → 깔끔한 액자.

## 현재 vs 시안

| 요소 | 현재 (CuratorHeader) | 시안 |
|---|---|---|
| 헤더 | 가로형 컴팩트: `[62px 동그라미][이름/소개]` 흰 배경 | **배너 히어로 + 중앙 이름/태그라인/SNS** |
| 배너 | 2026-06-10 "배경 완전 제거" (banner_url 필드만 잔존, 미렌더) | **풀블리드 히어로로 재도입** |
| 프로필 사진 | 카카오 이미지 → 동그라미 아바타 | **동그라미 제거, 배너가 정체성** |
| 마퀴 바 | 없음 | **신규** (흐르는 헤드라인) |
| PC QR | 없음 | **신규** (모바일로 보기) |
| PC 좌측바 | DesktopLiveSidebar 표시 | **/u/ 에선 숨김** |

## 새 데이터 필드 (users — products/sellers 아님, 추가 OK)
- `linkshop_headline` (마퀴 텍스트) — 신규 컬럼. 비면 마퀴 숨김.
- `banner_url` — **이미 존재**(레거시). 히어로로 재사용. 소유자 업로드 배선만.
- name / bio(태그라인) / sns_* / profile_image — 기존.

## 구현 todo
- [x] `banner_url` 히어로 렌더 (풀블리드 16:9, 라운드, 공유 오버레이) + 소유자 배너 업로드 (1440px/0.4MB)
- [x] 동그라미 아바타 제거 (배너 없을 때 앰버→잉크 그라데이션 폴백)
- [x] 이름/태그라인/SNS 중앙 정렬 레이아웃
- [x] 마퀴 바 (CSS `@keyframes marquee` seamless, `linkshop_headline`, 소유자 인라인 편집) + users 컬럼 + repair-schema
- [x] PC 프레임 우하단 QR ("모바일로 보기", qrcode.react lazy, xl+ only)
- [x] `/u`·`/profile/`·`/s/` PC 좌측 사이드바 숨김 (MobileAppLayout `LINKSHOP_PREFIXES`, 프레임은 유지)
- [ ] (보류) 비즈니스 제안 버튼 — 사용자 추가 요청 시

## 메모
- 배너 재도입은 2026-06-10 "배경 제거" 결정을 되돌리는 것 (사용자 재요청 2026-06-17).
- 방문자 화면 우선(공유 대상). 소유자 편집 chrome 은 최소.

## ✅ 구현 완료

2026-06-18 — 3단계로 구현 (branch `claude/charming-sagan-y9hx6m`):
- **Stage 1 (backend)**: `linkshop_headline` 컬럼 (`curator.routes.ts` ensureUserProfileCols + repair-schema) — GET `/api/curator/:handle` 응답에 `headline` 포함(별도 best-effort 쿼리, 컬럼 누락 env 에서 메인 SELECT 안 깨짐), PATCH `/me/profile` 에서 `headline`(80자) 수용. `banner_url` 은 기존 수용/반환 그대로 재사용.
- **Stage 2 (CuratorHeader)**: 마퀴 바(seamless `@keyframes marquee`, index.css) + 풀블리드 16:9 배너 히어로(공유 오버레이/소유자 배너 업로드/그라데이션 폴백) + 동그라미 아바타 제거 + 이름/태그라인/SNS 중앙 정렬. 소유자 편집(이름/소개/SNS/핸들/헤드라인)·방문자 공유 전부 보존. `CuratorProfile` 타입에 `headline` 추가.
- **Stage 3 (PC 표현)**: `LinkshopMobileQR.tsx`(qrcode.react lazy, xl+ 우하단 gutter) + `MobileAppLayout` `LINKSHOP_PREFIXES` 로 `/u`·`/profile/`·`/s/` 좌측 사이드바 숨김(프레임은 유지).

> ⚠️ 운영 반영 전: prod 에서 `/api/_internal/repair-schema` 1회 실행 필요 (`users.linkshop_headline` 컬럼 생성). 미실행이어도 GET 의 headline 은 best-effort try-catch 라 안전(null 폴백 → 마퀴만 숨김).
