# 2026-10-31 교환권 사진이 안 뜨던 것 — 원본 직행 + R2 이관

대표 *"교환권 사진 안나오는거 많던데 영구적으로 문제 해결해줄래?"* → 승인 "원본 바로 보기 + 우리 저장소로 옮기기".

## 원인 (라이브 실측)
- 활성 교환권 2,260장 전부 `bizimg.giftishow.com`, R2 0장.
- 리사이저(`/cdn-cgi/image`) 30장 중 25장 실패: 429 `err=9422` 14 · 524 `err=9504` 11.
- 워커 프록시 `/api/image/resize` 도 21초 뒤 원본 302(같은 CF 이그레스).
- `onerror=redirect` 는 이 존에서 안 돈다 → 카드는 ~7초 뒤 원본 재시도, 상세 갤러리는 사진 제외.

## 한 것
1. `src/utils/cf-image.ts` — `RAW_ONLY_IMAGE_HOSTS=['giftishow.com']`, 원본 그대로·srcset 없음. `CDN_CGI_VERIFIED` 에서 giftishow 제거(잠금 — 대표 승인, CLAUDE.md audit log).
2. `src/worker/cron/voucher-image-rehost.ts` + `scheduled.ts` 매시 :05(:55 는 만회 전용) — 4장/회, 많이 팔린 순, 실패는 30분×2^n(최대 하루) 뒤 재시도, CAS 덮어쓰기.
3. 가드 `src/tests/unit/voucher-image-rehost-2026-10-31.test.ts` + 주입 4건(빨간불 확인). 재조준: `qa-image-host-coverage`, `voucher-detail-ssr-first-screen`.

## 다음 세션 첫 액션
- 어드민 `GET /api/admin/cron-heartbeats` 에서 `voucher-image-rehost` 의 `migrated=` 확인. **0 이 계속이면** CF 워커 fetch 도 giftishow 가 막는 것 → 이관은 다른 경로(비-CF 이그레스) 필요, 대표 판단.
- D1: `SELECT COUNT(*) FROM products WHERE deal_only=1 AND image_url LIKE '/api/media/%'` 가 늘어나는지.

## 틀렸던 판단
- **429 `err=9422` 를 giftishow 차단으로 읽었다 — 실제로는 Cloudflare Images 무료 한도(월 5,000 고유 변환) 소진**이었다. 대표가 받은 CF 메일로 알았고, pstatic·picsum·media.ur-team.com 새 변환도 전부 같은 429 로 확인. ⇒ 사이트 전체의 새 리사이즈가 멈춰 있다(캐시된 것만 산다). 옮긴 교환권 사진은 줄이지 않고 R2 주소 그대로 낸다.
- 2026-07-13 "giftishow 차단 해제 · onerror=redirect 안전판이라 다운사이드 0" — 둘 다 지금은 사실이 아니다.

## 남은 것
- 상세 설명 이미지(`detail_images`)는 아직 giftishow 원본(원본 직행으로 표시는 됨). 이관 대상 확장은 별건.
- 어드민 재가져오기(`admin-kt-alpha/catalog.ts`)가 image_url 을 giftishow 로 되돌리면 cron 이 다시 옮긴다(R2 해시 키라 저장은 재사용).

## 대표 결정 (2026-10-31)
- **무료 유지 + 변환 수 줄이기**("2번. 이용권 많아지면 무조건 유료 전환"). 구현: `cf-image.ts` `snapResizeOptions`(폭 8칸·화질 3칸) + srcset 기본 2x + 교환권 변환 0.
- 다음: 이용권이 늘어 다시 한도 메일이 오면 유료 전환. 이번 달 사용량은 대시보드 Images 에서 대표만 본다.

## 2026-11-01 후속 — 상품 사진 크기별 미리 저장 (대표 "응 잠금 해제해줄게 진행해줘")

**왜**: 변환 한도는 *그달에 쓰인 사진 × 크기* 로 센다 → 이용권이 늘면 매달 사용량도 같이 큰다. 사진을 올릴 때 한 번 세 크기로 줄여 R2 에 넣으면 변환이 영원히 0.

**한 것**
- SSOT `src/shared/sized-image.ts` — 주소 모양 `uploads/sized/…/w{320|640|1280}.{webp|jpg}` 가 곧 표식(DB 조회 없음).
- `cf-image.ts` — 그 모양이면 `media.ur-team.com` 파일 그대로(폭 고르기 · Save-Data 한 칸 아래). srcset 도.
- 업로드: `src/lib/image-sized.ts`(브라우저 캔버스) → `POST /api/upload/image-sized`(한 크기씩, 서버가 키 생성, 리사이저 안 부름). `ImageUpload`·`PhotoGalleryEditor` 가 먼저 시도, 실패 시 종전 경로.
- 기존 사진 이관: 어드민 `/admin/image-sizing` (브라우저가 줄임) + `/api/admin/image-sizing/{pending,store,commit}`. commit 은 R2 에 셋 다 있는지 확인 후에만 주소 교체. 옛 파일 안 지움.
- 라이브 실측(D1): 교환권 아닌 활성 상품 184개 · 대표 사진 182 · 갤러리 697 — **전부 R2**(옮길 대상 전체).

**대가**: 크기별 사진은 `gravity=auto`(피사체 찾아 자르기)가 없다 — 상세 히어로는 화면 object-fit 가운데 자르기.

**다음 세션 첫 액션**
1. 배포 후 어드민 `/admin/image-sizing` → 시작 → "남은 사진" 이 0 으로 가는지(실패 목록 사유 확인).
2. 홈·상세 사진 주소가 `https://media.ur-team.com/uploads/sized/…/w640.webp` 인지(개발자 도구 네트워크).
3. 셀러 화면에서 새 사진 하나 올려 저장 주소가 `…/uploads/sized/seller/…/w1280.webp` 인지.

**범위 밖(남은 변환 사용처)**: 숙소 객실 사진·리뷰 사진·배너·프로필 등 상품 표 밖 R2 사진 — 종전대로 리사이저를 쓴다(양이 작다). 늘면 같은 도구를 표별로 넓힐 것.
