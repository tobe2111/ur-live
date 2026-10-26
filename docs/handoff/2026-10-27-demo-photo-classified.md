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
