# 2026-08-17 — 소비자 표면 5건 수리 (대표 신고: 카드 큼 · 더보기 플래시 · 숙소 예약 401 · 마이페이지 2건)

브랜치: `claude/service-page-ui-redesign-gkm900`

## 무엇을 고쳤나 (전부 소비자(유어딜) 레일 — 머니 경로 접촉: 없음*)

*\* 숙소 예약/confirm 의 **인증 해석**만 바꿨고 금액검증·Toss 호출·CAS·달력 차감은 전부 byte-불변.*

### 1) 숙소 예약 "로그인이 필요합니다" — 로그인돼 있어도 뜨고 창이 꺼짐 (근본 수리)
- **원인**: `stays-public.routes.ts` 의 소비자 엔드포인트 **7곳**(bookings/create·create-multi·confirm·cancel·review·orders/:id·my-bookings)이 **Bearer JWT 만** 수용. 한국 소비자 로그인은 카카오 = httpOnly `ur_session` 쿠키(localStorage 토큰 없음) → 로그인 상태여도 무조건 401. 클라가 `/login` 으로 보내면 로그인 페이지가 이미-로그인 상태를 보고 즉시 복귀 → 사용자에겐 "창이 그냥 꺼짐".
- **수정**: 파일 상단 `resolveStayUserId()` 헬퍼 — Bearer 우선(기존 알고리즘 그대로) + `parseSessionCookie`(requireAuth 미들웨어와 같은 SSOT, `['user']` 한정) 폴백. 세션 쿠키는 `isDbId=true`(sub=숫자 users.id)라 이 파일의 숫자 userId 계약 유지.
- ⚠️ **staging 확인 권장**: 카카오 로그인 상태에서 숙소 예약 → 결제 → confirm 까지 1회 (BookingModal → /checkout?stay=1 → StayCheckoutReturnPage). 비로그인 상태에선 401 → /login?returnUrl 이동이 정상 동작.

### 2) "지금 인기 이용권" 더보기 → 옛 프레임 플래시
- **원인**: 섹션 시드 v1 이 `more_href='/group-buy'` 로 넣었는데 그 경로는 **라우트가 아니라 별칭**(`<Navigate to="/">` + 서버 301). 클릭 → pathname 변경 → 리마운트, 그리고 `/group-buy` 는 pc-fullbleed 목록에 없어 **한 프레임 동안 구 430px 액자+거터 레일**(= "옛날 프레임")이 그려졌다가 홈 복귀.
- **수정 3겹**:
  - `section-seed.ts`: 시드 `more_href` → `/?sort=popular`, `SECTION_SEED_VERSION` 1→2 + **v2 heal**(값이 정확히 `/group-buy` 인 행만 UPDATE — 별칭은 어떤 의도로도 옳을 수 없는 죽은 링크. 대표 편집 보존 원칙 유지, `home-showcase.test.ts` 가드도 이 좁은 예외만 허용하도록 갱신).
  - `PcHomePage.tsx`: `?category=`/`?sort=` **쿼리 변화에 반응**(기존엔 마운트 시 1회만 읽음) + 쿼리 내비 도착 시 그리드 제목으로 스크롤(scroll-mt-24). 쿼리 전용 이동이라 리마운트 0 = 플래시 0.
  - `HomeSections.tsx`: 렌더 시 `resolveConsumerAlias` SSOT 로 별칭 href 방어(어드민이 다시 별칭을 넣어도 차단).

### 3) 홈 컴팩트화 (대표: "카드가 커, 여백 많음" — 여기어때/그루폰 참고)
- 2026-07-15 "4열 카드 크게" 지시를 **대체**하는 새 지시.
- `PcHomePage`: 컨테이너 1600→**1440**, pt-6→pt-4, 제목 24→20px, 정렬칩 px-4 py-2→px-3.5 py-1.5 등 상하 여백 축소.
- `GroupBuyFeed` pc 그리드: `lg:4열` → `lg:4 xl:5 2xl:6열`, gap 5→4. 카드 폭 ~370 → ~220-260px(그루폰 스케일).
- `GroupBuyFeedCard` pc: 이미지 정방형→**4:3**(행 높이 −25%, HomeSections DealCard 와 정합), 텍스트/패딩 소폭 축소. **모바일(!pc) 경로는 전부 불변.**
- `HomeSections`: 섹션 pb-8→pb-6, 제목 18.5→17px, gap 5→4.

### 4) /user/profile 동네 리뷰어 Lv.1 카드 풀폭으로 벌어짐
- **원인**: 형제 섹션은 전부 `ur-content-medium px-4 lg:px-8` 로 자기 폭을 감싸는데 `ReviewLevelCard` 만 bare `w-full` → /user/profile 이 pc-fullbleed 라 혼자 화면 끝까지 늘어남. → 동일 래퍼 추가.

### 5) 마이페이지 위에 링크샵 방문자 팝업 2개(QR·"나도 링크샵") 겹침
- **원인**: `MobileAppLayout` 의 `LINKSHOP_PREFIXES` 에 bare `'/u'` 가 있어 `startsWith` 검사로 **`/user/*` 전체가 링크샵 방문자로 오판** → `LinkshopVisitorRails`(430 액자 기준 fixed 위치)가 풀블리드 마이페이지 콘텐츠 위에 렌더.
- **수정**: 접두사를 세그먼트 경계(`'/u/'`)로 — `/u` 단독은 기존 exact 비교가 이미 처리. `startsWith('/u')` 클래스는 레포 전체 grep 으로 이곳 하나뿐임을 확인.

## 검증
- `tsc --noEmit` 0 · vitest **5688 pass (429 파일)** · audit-gate (커밋 시점 기록 참조)
- home-showcase 가드 갱신: seed UPDATE 는 "`WHERE more_href='/group-buy'` 정정 1개만" 허용(그 외 UPDATE/DELETE 여전히 금지) — 일부러 깨서 빨강 확인함(갱신 전 heal 추가 시 기존 가드가 실제로 빨갛게 떴다).

## 이번에 틀렸던/주의할 판단
- 숙소 예약의 "창이 꺼짐"은 클라 버그가 아니라 **서버 인증 수용 폭** 문제였다 — 클라 401 처리(/login 이동)는 원래 있었고, 로그인 페이지가 즉시 복귀해서 "꺼짐"처럼 보였던 것.
- `startsWith('/u')` 는 `/user/*` 를 삼킨다 — 접두사 검사는 항상 세그먼트 경계로.

## 남은 결정/대기
- staging: 숙소 예약 E2E 1회(위 ①) + PC 홈 밀도 눈 확인(대표 취향 — xl 5열/2xl 6열이 과하면 gridCls 한 줄 롤백).
- 라이브 DB heal 은 배포 후 첫 `/api/sections` 조회에서 자동 실행(SECTION_SEED_VERSION=2). 확인: 홈 더보기 링크가 `/?sort=popular` 인지.
- Notion 기록: PR 머지·배포 후 개발 업데이트 로그에 1행 기록 필요(이 세션이 머지를 확인하면 그때 기록).
