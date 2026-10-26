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
