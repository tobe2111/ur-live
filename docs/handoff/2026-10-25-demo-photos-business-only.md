# 2026-10-25 데모 이용권 사진 = 지도 등록 업체 사진뿐 + 최소 3장 영구 재시도

## 대표 지시
- "데모들의 사진들을 보면 그냥 매장과 연관된 블로그에서 사진 발췌해서 의미없는 것도 올려와져있고"
- "데모 이용권들 사진 최소 3장 이상씩 올려라고 했는데 그게 전혀 영구적으로 지켜지지 않아"
- "업체 사진을 데모에 쓰는것 승인할게. 3장 미만인 데모를 숨기진 않겠어."

## 원인 (코드)
1. 지도에서 1~2장(카카오 og 1 · 네이버 대표 1)만 받고 나머지를 네이버 **이미지검색**으로 채움.
   점수 규칙이 블로그 호스트에 +2 가산점, 이름이 하나도 안 맞는 0점도 통과(`_score >= 0`).
2. 네이버 플레이스 매칭이 이름 불일치 시 `list[0]`(다른 가게) 사용 + 빈 이름 항목이 `includes('')` 로 늘 통과.
3. "3장" 이 어디에도 강제 안 됨 — 1장만 구해져도 `demo_cond_v` 마킹으로 끝, 시도 3회 후 영구 포기.

## 수정
- `naver-place-photo.ts`: `pickMatchingPlace`(이름 맞는 가게만) · `fetchNaverPlaceBusinessPhotos`(업체사진 탭 → 홈, `ldb-phinf` 만 = 업체 등록 사진 가정) · `isBusinessPhotoUrl`.
- `demo-photo-set.ts`: 이미지검색 경로 제거. 카카오 대표 → 네이버 업체 사진 여러 장 → (없으면) 네이버 대표 1장. `DEMO_MIN_PHOTOS=3`, `isSearchDerivedPhoto`.
- `demo-image-rehost.ts`: `DEMO_COND_V` 5→6(전량 재조정) · keepOld 경로 제거(커버=이번 업체 사진) · 3장 미만이면 숨기지 않고 `demo_photo_retry_after`(+3일) 예약 → 큐 복귀 · 시도 소진도 재시도 예약 · 0장일 땐 종전대로 커버 유지/숨김 + 검색·블로그 갤러리 칸 제거 · 하트비트 `photoShort`.
- 가드 `demo-photos-business-only-2026-10-25.test.ts` 15건 + 주입 5건 빨간불 확인. `demo-image-provenance` keepOld 단언 재조준(경로 부재로 강화).

## 다음 세션 첫 액션 (E4)
- `/api/admin/cron-heartbeats` 의 demo-image-rehost 비트에서 `photoShort` 가 줄어드는지(회당 3개 처리라 수렴은 수일).
- 라이브 데모 상세 몇 개의 갤러리 주소가 `ldb-phinf`·`daumcdn`·`/api/media` 뿐이고 `search.pstatic`/`blogfiles` 0건인지.
- 🔴 가정 검증: 네이버가 업체 사진을 정말 `ldb-phinf` 에 두는지, 업체사진 탭 HTML 에서 주소가 뽑히는지 — 안 뽑히면 photoShort 가 안 줄어든다(사진은 지어내지 않으므로 화면이 깨지진 않는다).

## 이번에 틀렸던 판단
- 주입 하나가 헛돌았다: `BUSINESS_PHOTO_HOST` 를 추출 정규식과 push 두 겹으로 잠가서 한 겹을 지워도 출력이 같았다 → `isBusinessPhotoUrl` 로 모아 직접 시험.

## 남은 결정
- 없음(대표 승인 완료: 업체 사진 사용 O, 3장 미만 숨김 X).
