# 2026-10-27 데모 이용권 사진 — 업체 사진 → 카카오 분류 사진 보충 (v8)

## 대표 지시
- "데모 이용권 어드민 대시보드에서 발행 때, 사진들이 너무 연관없는 것들이 많아."
- `AskUserQuestion` → **"업체사진→분류사진 (추천)"** 확정.

## 실측 (KST 10-27 00시대, 라이브)
- 하트비트 `demo-image-rehost`: `reconditioned=0 · photoShort=309` — 직전 PR #2033(v7, 업체 사진만) 뒤에도 재수집 0장.
- 진단(`/api/admin/dongnedeal/photo-source-diag`, id 2484·2491): 네이버는 Cloudflare 에서 캡차/429(allSearch `ncaptcha-all-search-no-result`) → 0장. 카카오 og 403.
- 카카오 사진 탭 counts 를 활성 데모 40곳 무작위로 직접 재니: **mystore>0 은 6곳(15%)** · food 26 · indoor 29 · outdoor 28 곳.
- 분류 태그 응답의 type 은 `KMAPREVIEW`(손님 리뷰)·`BLOG` — 업체 사진이 아니라 카카오가 그 장소에 묶고 장면을 분류한 사진.
- 그래서 v7 상태로는 어드민에서 새로 발행하면 대부분 `skippedNoPhoto` 로 건너뛰고, 기존 데모의 무관한 커버는 안 바뀐다.

## 수정 (이 PR)
- `kakao-place-photos.ts`: `classifiedTagsFor(category)` — 식사=FOOD→INDOOR→OUTDOOR, 그 밖(미용·기타·숙소·생활)=INDOOR→OUTDOOR. MENU(메뉴판)·분류 없는 사진은 안 받는다. 업체 사진(MYSTORE·VENDOR) 먼저, 모자랄 때만, **첫 응답 counts 가 0 이 아닌 태그만** 부른다(서브리퀘스트 예산).
- `demo-photo-set.ts`: `DemoPhotoOpts.category` → 카카오에 태그 전달.
- 호출부: 어드민 발행(`w.t.cat`) · 재조정 cron(`p.category`) · 어드민 heal · 숙소 시드(`stay_voucher`).
- `DEMO_COND_V` 7 → 8 — 기존 데모 전체 재적용(재조정은 커버를 항상 새 사진으로 바꾼다).
- 가드 `demo-photos-classified-2026-10-27.test.ts` 9건 + 주입 4건 빨간불 확인.

## 추가 (같은 PR) — 발행 때 사진 3장 보장
- 대표 "3번 해봐": 어드민 동네딜·숙소 데모 발행이 근거 있는 사진 `DEMO_MIN_PHOTOS`(3)장 미만인 매장을 건너뛰고 다음 라운드(최대 3)에서 다른 매장으로 채운다. 건너뛸 매장은 커버 R2 재호스팅도 안 한다.
- 대표: 2번(재수집 0장 알림)·4번(네이버 요청 건너뛰기)은 하지 않는다.
- 대가: 라운드 3번 안에 3장 매장을 못 찾으면 요청 개수보다 적게 발행된다(`skippedNoPhoto` 로 보인다).

## 추가 (같은 PR) — 3장이 안 되는 매장은 다른 실제 매장으로 교체
- 대표 "그 방식으로 진행". 재조정에서 동네딜 데모가 3장을 못 채우고, 카카오가 그 매장의 쓸 수 있는 사진(업체+분류)이 3장 미만이라고 **응답으로 확인**해 줄 때만(`fetchKakaoUsablePhotoCount` — 응답 못 받으면 null → 종전 경로) `swapDemoStore`(`src/worker/cron/demo-store-swap.ts`)가 같은 업종(`demo_biz`)을 그 좌표 근처 다른 실제 매장에서 찾아 **같은 상품 행을 옮긴다**(가게·주소·전화·좌표·사진·카카오 주소, 리뷰 재생성). 응모 수·상품명·가격은 유지.
- 회차당 1건(`SWAP_PER_RUN`), 후보 2곳까지. 못 찾으면 그 데모를 내린다(is_active=0, 가역) → 3일 뒤 다시.
- 숙소 데모(demo-stay)는 대상 아님(종전대로).
- 하트비트 `swapped=N`.
- 대표에게는 "내리고 새로 발행"으로 말씀드렸으나 구현은 같은 행을 옮기는 방식 — 결과(노출 데모 전부 3장 이상)는 같고 응모 수가 유지된다.

## 다음 세션 첫 액션 (E4)
- 하트비트 `demo-image-rehost` 의 `reconditioned` 가 0 이 아니고 `photoShort` 가 309 에서 줄어드는지(회당 3개 · 5분마다 → 전체 약 9시간).
- 미용 데모 하나(예: 2872 유후네일)의 갤러리가 가게 안·밖 사진인지 눈으로.
- 어드민 `/admin/dongnedeal-import` 에서 소량(2~3개) 발행해 `skippedNoPhoto` 가 줄었는지.

## 안 한 것 / 주의
- cron heal 경로(`demo-image-rehost.ts` 모든 사진이 깨졌을 때 재획득)는 category 를 안 넘긴다 → 그 경우 내부·외부만. 드문 경로라 둠.
- 분류 사진이 없는 매장(실측 약 20%)은 여전히 3장 미만 → 숨기지 않고 재시도(대표 확정 10-25).
- 블로그 사진(postfiles)은 `isSearchDerivedPhoto` 에 걸리는 모양이라, 다음 재시도에서 0장이 나오면 그 갤러리 칸이 걷힐 수 있다(사진이 생긴 상태에서는 안 걸린다).
- 손님 리뷰·블로그 사진을 쓰는 것은 대표 확정 사항(10-27). 업체 사진만으로 되돌리려면 `classifiedTagsFor` 가 [] 를 돌려주게.

## 이번에 틀렸던 판단
- 없음. 다만 직전 세션의 v7 은 "업체 사진이 대부분 매장에 있다"는 확인 없이 들어갔다 — 출처를 좁히기 전에 **그 출처가 몇 % 에 있는지 먼저 잴 것.**

## 🤖 3단계 — 매장주 제공 사진만 + AI 판정 (대표 "AI로 사진 판정" · "숨기고 자동 교체")

- 모듈 `src/worker/utils/demo-photo-judge.ts`(Claude Haiku 비전) · 수집 `collectJudgedDemoPhotos`(demo-photo-set.ts).
- **켜짐 조건 = Cloudflare 에 `ANTHROPIC_API_KEY`** — 2026-10-27 라이브 실측: GitHub Actions 시크릿엔 있고(SNS 워크플로)
  Cloudflare(Pages·cron 워커 ur-live)엔 **없다**(env-readiness `present:false`). 키가 없으면 종전 v8 그대로(무변경).
- 옮기기: 수동 워크플로 `.github/workflows/sync-anthropic-secret.yml`(workflow_dispatch) — 값을 보지 않고 두 곳에 넣는다.
  ⚠️ Pages 시크릿은 **다음 배포부터** 런타임에 보인다(넣은 뒤 배포 1회 필요). cron 워커는 `wrangler secret put` 즉시.
- 키가 들어가면 버전 '9'(`DEMO_COND_V_JUDGED`)로 전 데모 재검사: 매장주(MYSTORE) 사진 → AI 통과분만 → 3장 미만이면
  같은 업종 근처 실매장으로 교체(회차 1건, 후보 3) · 못 찾으면 숨김(가역) · 판정 실패(모름)는 아무것도 안 바꾼다.
- 다음 액션(E4): 워크플로 실행 → env-readiness `ANTHROPIC_API_KEY present:true` → 하트비트 `demo-image-rehost` 에서
  swapped·hiddenNoPhoto 증가 → 데모 30장 표본 육안 검사(메뉴판·로고·공사 0인지).
- 틀렸던 판단: "키가 없다"고만 보고하려 했다 — 대표 지적대로 GitHub 시크릿에는 있었다. 판정은 *어디에* 있나까지 볼 것.

## 4. 그루폰식 상세 사진 + 리뷰 더 보기 (2026-10-27, PR #2042 에 추가)

- 모바일 상세: 큰 사진 아래 **썸네일 2칸**(마지막 칸에 `+N`), 누르면 **전체 화면**(번호 `2 / 6` · 아래 큰 좌우 버튼 · 손가락 넘김 · 모바일은 검은 바탕).
  이용권·숙소 상세가 **같은 부품**(`DetailGallery`)과 **같은 서버 첫 화면 함수**(`mobileThumbRowHtml`·`restSlidesHtml`)를 쓴다 — 대표 *"통일할 건 통일"*.
- "로딩 지나야 넘어가" 원인: 서버 첫 화면이 **첫 장 하나만** 그렸다. 이제 모든 장을 스냅 슬라이드로 그린다(둘째부터 `loading=lazy` — 넘겨야 받는다).
- 리뷰: 5개 뒤에 `리뷰 더 보기 (N개 남음)` — 다음 페이지를 이어 붙인다(서버 page 기반, limit 5).
- 가드: `detail-mobile-thumbs-2026-10-27` 6건 · `review-load-more-2026-10-27` 1건 + 주입 6건 전부 빨간불 확인.
- 시안(하네스 렌더): `out/visual/gb-1-first.png` · `gb-2-lightbox.png`. 상단 버튼(원 없애기) 시안 3안은 **대표 선택 대기**(추천 = 원 없음 + 위쪽 그늘).
- ⚠️ 못 잰 것: 실제 폰에서 서버 첫 화면을 넘긴 뒤 앱이 뜨면 첫 장으로 돌아갈 수 있다(앱이 새 갤러리로 갈아끼움). E4 = 배포 후 폰에서 `/pass/:id` 하드로드 직후 넘겨 보기.
- 남은 일: 데모 응모하기 버튼 · AI 상세 설명 · 지도 섹션 위치/모바일 스크롤 · 지도 하단 카드 넘김 모션 · 상단 버튼 원.

## 5. 추첨(데모) 이용권 하단 [응모하기] — 이용권·숙소 통일 (2026-10-27)

- 원인: 추첨 상품도 하단은 [구매하기] → 결제 → 서버 `fcfs-gate.ts` 가 "당첨자만 구매" 로 거절. 대표 신고.
- 처방: `features/group-buy/useFcfsDetail.ts`(상품별 공유 저장소 — 요청 1회) 를 응모 칸 · 모바일 바 · PC 상자 · **숙소 바**가 같이 본다.
  당첨 전 = [응모하기 (무료)] → [응모 완료 · 당첨 시 안내] / 당첨자 = 종전 [구매하기].
- 숙소 데모도 추첨인데(`demo-fcfs-renew` 가 seed) 숙소 상세엔 응모 칸이 **아예 없었다** → 추가.
- ⚠️ 발견(미수리, 머니 경로): 숙소 예약 서버 경로엔 `fcfs-gate` 가 없다 — 데모 숙소는 PC 예약 패널로 결제까지 갈 수 있다. 결재 대상.
- 가드 `fcfs-raffle-cta-2026-10-27` 5건 + 주입 3건 빨간불 확인. `GroupBuyDetailPage.tsx`(잠금) 무접촉.

## 6. 이용권 상세 지도 위치 · 폰 지도 스크롤 · 지도 카드 넘김 (2026-10-27)

- 지도(매장 위치)를 상품 구성 바로 아래로, 상단 탭도 같은 순서. 잠금 파일 → CLAUDE.md audit log 기록.
- 폰 지도 위 스크롤: 드래그만 꺼서 핀치(확대)가 터치를 붙잡고 있었다 → 터치 기기는 확대도 끄고 투명 덮개.
- 지도 하단 선택 카드: ×0.35 고무줄 → 1:1 따라가다 빠지고 반대쪽에서 들어옴. 폰은 사진 가리던 ◀▶ 숨김(PC 유지), `20 / 50` 은 가격과 안 겹치는 오른쪽 아래.
- 가드 `detail-map-order-touch` 4건 · `map-card-slide` 4건 + 주입 4건 빨간불 확인.
- ⚠️ E4: 배포 후 폰에서 지도 위 스크롤 · 카드 넘김 손맛은 대표 눈 판정.

## 7. 상단 버튼 C안 (2026-10-27 대표 "C 추천으로 하자")

- 사진 위(스크롤 전): 원 없이 흰 아이콘 + 헤더보다 긴 위쪽 그늘(`data-header-scrim`). 헤더 배경으로 깔면 아래 끝선이 줄로 보여 별도 요소로 늘였다(렌더 확인).
- 숙소는 빵부스러기가 사진 위에 와서 `overPhoto` 아님 → 종전 흰 원(흰 바탕 위 흰 아이콘 방지). 통일하려면 숙소도 이용권처럼 폰에서 사진을 맨 위로(서버 첫 화면 함께).
- 가드 `detail-header-c` 2건 + 주입 1건.

## 8. AI 데모 설명 (2026-10-27)

- `worker/cron/demo-description.ts` — 동네딜 데모(`demo-deal-`)의 상품 구성(description, 글머리)과 가게 소개(long_description)를 Haiku 가 쓴다. 근거 = 이용권 이름·짧은 설명 + AI 판정을 통과한 매장 사진(최대 3장). 카카오 메뉴 탭은 406 이라 못 쓴다.
- 실제 가게라 영업시간·주차·금액·수상 등은 금지어로 걸러 **버린다**(3회 버려지면 종전 짧은 설명 유지). 회차당 2건, 사진 정비 크론에 배선(R2 무관 자리). 하트비트 `descWritten`.
- 가드 8건 + 주입 2건.
- E4: 배포 후 하트비트 `descWritten` 이 오르는지 + 데모 상세 3~4개 눈 판정.

## 9. 상세 틀 통일 1~4단계 (대표 "숙소랑 다른 이용권 이분법 분리 필요한가?" → "모두 이상적으로 작업해줘")
- ① 숙소 폰 화면: 빵부스러기는 PC 만(`hidden lg:block`), 사진이 맨 위 + 상단 버튼 C안(`overPhoto`). 서버 첫 화면(`stay-detail-ssr-body.ts`)도 같은 모양 — 가드 `stay-photo-top-2026-10-27`.
- ② 하단 바: 공용 부품 `src/components/deal/BuyBar.tsx`(`BuyBarFrame`·`BuyBarPrice`·`BuyBarCta`)를 이용권(`DealBottomBar`)·숙소(`StayStickyBar`)가 같이 씀. 숙소 바가 가격 24px·버튼 52px 로 이용권과 같아짐 — 가드 `buy-bar-unify-2026-10-27`. 기존 가드 둘 재조준(`stay-detail-e` z-층, `gb-detail-borders` 위 구분선).
- ③ 숙소 섹션 띠 = 흰 면 + 8px 띠(`STAY_BAND` 한 상수 — 종전 7곳 사본), 숙소 제목 폰 24px.
- ④ PC 숙소 예약 상자가 이용권 상자와 같은 숫자(반경 18·여백 18·버튼 50/14, `PURCHASE_BOX_CLS`/`PURCHASE_CTA_CLS`) + 추첨 상품이면 PC 에서도 응모 버튼. ₩ 표기 → "원". 가드 `detail-unify-head-box-2026-10-27`.
- 미리보기 도구에 숙소 상세 스텁 추가(`--deals` + `/stays/:id`).
- ⚠️ 여전히 미해결(머니 경로·결재 필요): 숙소 예약 서버에 추첨(fcfs) 게이트 없음 — 화면은 이제 응모만 보이지만 API 직행 예약은 막히지 않는다.
- 남은 일: #6 상세 갤러리에 매장 숏폼 영상.

## 10. 데모 상품 결제 차단 (2026-10-26 대표 "데모 숙소에도 실제로 결제가 되면 안돼")
- 원인: 숙소 예약 서버가 추첨 게이트를 아예 안 불렀다 + 공용 게이트는 `fcfs_enabled` 없는 데모·조회 실패를 통과시켰다.
- 수정: `fcfs-gate.ts` 에 `isDemoProductForPurchase`(slug `demo-*` → 차단, 조회 실패 → 막지 않음)를 맨 앞에 · 숙소 create / create-multi / confirm(Toss 승인 전) 배선.
- 가드: `demo-purchase-block-2026-10-26.test.ts` 7건 + 주입 4건 빨간불 확인. staging: `STAGING_CHECKLIST.md` S-DEMO-1~3.
- 대표 직접 지시가 승인(머니 경로 차단 방향만 — 결제·원장 계산은 무변경).

## 11. 상세 사진 위 '▶ 매장 영상' (2026-10-26 — 작업 #6)
- 데이터: 유어쇼츠 `home_shorts.product_id`(어드민·사장님이 이미 이용권에 붙인다). 상세는 새 목록을 안 만들고 공개 목록 `/api/urshorts?all=1` 에서 걸러 쓴다(`shared/urshorts-store.ts`).
- 화면: `group-buy/StoreShortsPill.tsx` — 사진 위 떠 있는 알약(밀림 0), 첫 화면 뒤에 목록을 받고, 누르면 `/videos?v=` 가 그 영상부터 튼다. 이용권·숙소 상세 둘 다(`DetailGallery` 의 `overlay` prop — PC 대형 사진 버튼 **밖**).
- 라이브 실측: 영상 10편 중 2편만 이용권(2580)에 붙어 있다 → 지금 버튼이 뜨는 상세는 그 하나뿐.
- ⚠️ 틱톡·인스타 등은 아직 못 넣는다 — 유어쇼츠가 유튜브 주소만 받는다(`parseYouTubeUrl`). 넓히려면 등록·재생기 둘 다 바꿔야 한다(별건).
- 가드: `store-shorts-pill-2026-10-26.test.tsx` 6건 + 주입 3건 빨간불 확인.

## 12. 추첨(데모) 이용권은 응모만 (2026-10-26 대표 "데모 이용권은 그냥 응모하기만 되면 돼")
- PC 구매 상자: 추첨이면 수량·딜 사용·"토스로 안전결제" 문구를 안 그리고 [응모하기] + "결제 없이 응모해요" 만.
- 추첨 여부를 받기 전(`useFcfsDetail().pending`)엔 결제 버튼이 아무 일도 안 한다 — 데모 상세를 열자마자 누르면 결제 창이 뜨던 틈.
- 라이브 실측: 데모 이용권 155 · 숙소 활성 25 전부 `fcfs_enabled=1` → 설정 누락 데모는 0.
- 장바구니 담기는 `VOUCHER_CART_UI_ENABLED=false` 라 입구 없음. 서버 차단은 §10.
- Verify 실패(ebacd2f)는 매장 영상 버튼의 반쪽 간격(gap-1.5·pl-2.5) → 4px 격자로.

## §13 2026-10-31 — 요청 4~7 (생활 숨김 · 배경 한 톤 · 이름 사진 아래 · 숙소 부대시설)
- `e65b507` 메인에서 생활 이용권 숨김 — SSOT `deal-cats.ts` `HOME_HIDDEN_CATEGORIES`/`HOME_DEAL_CAT_LABELS`/`isHomeVisibleProduct`.
  홈 탭(모바일·PC 레일·사이드바)·피드·HomeSections·워커 첫 화면이 같은 판정. PC 상단 네비 '생활'(→ `/life`)과 지역 페이지(`showLife`)는 그대로.
- `bebc2d9` follow-redirects 1.16.2 — 새 advisory(GHSA-mrwp-f3q8-3g9p)로 npm audit 게이트가 **main 에서도** 빨강이었다.
- `5ed90dc` 상세 배경 한 톤 — `PASS_PAGE_BG`=카드색, `PASS_CARD`/`STAY_BAND` 8px 회색 띠·PC 그림자 카드 → 가는 선.
- `ae077f4` PC 상세 제목을 사진 아래로(08-19 '그루폰 1안: 사진 위' 대체). 이용권·숙소 둘 다.
- (이 커밋) 숙소 '서비스 및 부대시설' 그리드 11칸 — 없는 칸 '없음', 정보 0이면 안내 한 줄. 셀러 폼 코드(`parking_free` 등)와 시드 한글을 같은 판정으로.
  🩸 종전 상세는 **공통 시설만** 읽어서 셀러 폼이 객실 시설로 저장한 취사·냉난방·금연이 상세에 한 번도 안 떴다 — 이번에 합쳤다.
  🩸 그리고 폼 코드를 그대로 라벨로 그려 `wifi`·`tv` 가 영문 코드로 보였을 것이다(라이브 데이터는 전부 시드 한글이라 아직 노출 0).
- ⚠️ 못 잰 것: 실제 화면(폰·PC) 눈 확인 — 배포 뒤 `/stays/:id`·`/pass/:id` 에서 볼 것. 시안 8~10 은 아직(다음).

## §14 2026-10-31 — 시안 8(폰 머리 도시 사진) · 10(폰 목록 가로 줄)

- 8: `src/shared/home-region-hero.ts` + `public/assets/region-hero/{seoul,busan,daegu,jeju}-v1.webp`. 폰 전용(대표 지시). 고른 지역 우선, 없으면 좌표 상자. 사진 추가 = 파일 하나 + 표 한 줄(파일명 버전 올릴 것 — `/assets` 1년 캐시).
- 10: `DEAL_ROW`(`shared/deal-card-grid.ts`) — 카드 `row` prop. 워커 첫 화면이 같은 상수. md+ 는 종전 4열 격자.
- 렌더 확인: `visual-preview` + 로컬 스텁(서울·부산 머리, 108px 줄).
- 대기: ① 사진 인천·세종·전주 + 이름 모를 3장을 대표가 도시 이름과 함께 다시 보내 주기 ② 시안 9(마이 판 제거) — 구분 방안 A~D 중 대표 선택 ③ Figma 이미지 생성은 11-01 09:00 KST 이후 가능.
