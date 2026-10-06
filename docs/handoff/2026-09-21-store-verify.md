# 2026-09-21 — 매장 확인 통화 기록 + 신규 매장 노출 유예 (사기 방어 ①②)

`[E2]` 작성·검증됨(tsc 0 · 유닛 80건 · 주입 19건 되돌려-검증 전부 빨간불). **머지·배포·라이브 판정은 아직.**

## 대표가 시킨 것
사기 방어 세 갈래 중 ①② (③ 신고 경로는 PR #1515). 앞선 세션에서 실측으로 확인한 구멍:
승인 도장은 찍히는데 **전화를 걸었는지 아무 데도 안 남고**, 승인되는 **그 순간 메인에 뜬다**(제보할 시간 0초).

## 무엇이 달라지나

### ① 매장 확인 통화 기록 — 지금 바로 쓸 수 있다
- 어드민 `/admin/store-owner` 에 **"매장 확인 통화"** 큐가 생겼다. 승인됐는데 아직 `확인됨` 통화가
  없는 매장만 뜬다. [확인됨] [본인 아님] [부재] 세 버튼 + 메모.
- **번호가 010 이 아니면 `직접 걸어야 함` 배지** — 알림톡으로 대신할 수 없는 번호다.
  ⚠️ 반대로 010 이라고 안전한 게 아니다(사기꾼은 자기 휴대폰을 적으면 그만).
- 기록은 **쌓인다**(부재 → 재시도 → 확인됨). 마지막 결과만 남기지 않는다 — 몇 번 걸었는지가 증거다.
- 🔴 **여기엔 정지·환불 버튼이 없다.** "본인 아님" 을 눌러도 매장은 안 꺼진다. 오귀속 한 건에
  멀쩡한 가게가 마비되면 안 되고 환불은 등급 C다. 테스트가 그 경계를 잠근다.

### ② 신규 매장 노출 유예 — **기본 OFF. 대표가 켠다**
- 첫 승인 시 `seller_meta.store_exposure_from` 에 "언제부터 보인다" 를 찍고, 소비자 노출 술어가
  그때까지 가린다. **확인 통화가 `확인됨` 이면 마커가 지워져 즉시 보인다**(확인의 보상).
- `platform_settings.store_exposure_grace_hours` 가 없거나 0 이면 **마커를 아예 안 쓴다** ⇒
  오늘 라이브와 byte-동일. 노출을 늦추는 건 매출에 닿아 **등급 C** 다.
- **재승인(suspended→approved)에는 유예 없음** — 사고 수습이 더 늦어질 뿐이다.

## ⚠️ 다음 세션이 꼭 알아야 할 것 (이게 제일 값지다)

**`approvedSellerProductSql` 이 이제 `seller_meta` 를 읽는다.** 그 함수는 소비자 메인 피드·홈 섹션·
피드 캐시 cron 네 곳이 쓴다 ⇒ **그 테이블이 없는 DB 에서는 메인이 통째로 깨진다.**
- 라이브 D1 에는 **있다**(2026-09-21 `sqlite_master` 직접 조회로 확인).
- 없는 환경 대비로 `repair-schema`(daily-lane 이 하루 1회 실행) + 승인 시 런타임 ensure 두 겹.
- 🩸 **테스트 픽스처 둘이 실제로 깨졌다**(`danggeun-approval-gates` 4건 · `home-section-no-duplicate` 3건)
  — 그게 이 위험의 조기 경보였다. 둘 다 픽스처에 `seller_meta` 를 만들어 해소. **이 술어를 쓰는
  새 픽스처는 그 테이블을 같이 만들어야 한다.**
- 📌 같은 자리에 2026-09-16 이 `sellers` 를 더할 때도 똑같은 일이 났다(그 파일 주석에 남아 있다).
  **이 술어에 테이블을 하나 더 붙일 때마다 같은 값을 치른다** — 다음에 또 붙이려 하면 이 문단을 먼저 읽을 것.

**locked 파일은 한 글자도 안 바뀌었다.** 유예를 `approvedSellerProductSql` **안에서 합성**했기 때문에
`group-buy-public.routes.ts`(잠금표) 등 호출부 네 곳의 diff 가 0 이다. 술어를 따로 만들어 호출부에
배선했다면 잠금 해제 승인이 필요했을 것이다.

## 파일
| 파일 | 무엇 |
|---|---|
| `src/shared/store-phone.ts` (신규) | 010 판정 SSOT — 알림톡(③ 후속)도 이걸 쓴다 |
| `src/worker/utils/store-verify.ts` (신규) | 통화 기록 · 유예 마커 · 큐. **돈·상태 무접촉** |
| `src/shared/db/consumer-visible-product.ts` | `approvedStatusSql` + `exposureReadySql` 로 쪼개고 합성 |
| `src/features/admin/api/admin-store-owner.routes.ts` | 큐 조회 · 통화 기록(finance + 감사로그) |
| `src/features/admin/api/admin-sellers.routes.ts` · `admin-tools.routes.ts` | 승인 **두 경로 모두** 마커 |
| `src/pages/admin-store-owner/StoreVerifyQueue.tsx` (신규) | 어드민 큐 화면 |
| `src/worker/routes/repair-schema/column-repairs.ts` | `store_verify_calls` · `seller_meta` 등록 |
| `src/tests/unit/store-verify-2026-09-21.test.ts` (신규) | 30건 — 진짜 SQLite 에 넣고 잰다 |
| `scripts/mutations/store-verify.mjs` (신규) | 19건 되돌려-검증 |

## 다음 세션의 첫 액션
1. PR 초록 확인 → 머지 → 배포.
2. **E4 판정**: 어드민 `/admin/store-owner` 에서 "매장 확인 통화" 큐가 뜨고, 아무 매장에
   [부재] 를 한 번 눌러 기록이 남는지. 그다음 `GET /api/admin/store-verify/queue` 가 `last_result`
   를 실어 오는지.
3. **유예를 켜려면**(대표 판단): `platform_settings.store_exposure_grace_hours` 를 예컨대 `6`.
   켠 뒤 매장 하나를 승인해 큐 맨 위에 `노출 유예 중` 이 뜨고, [확인됨] 을 누르면 즉시 사라지는지.
   ⚠️ 켜는 순간부터 **새로 승인되는 매장은 그 시간 동안 메인에 안 뜬다** — 매출에 닿는 스위치다.
4. 남은 것: ③ 사장님 알림톡(대표 승인 — 010 이면 보내기). 탐지·큐까지는 발송 0 으로 만들 수 있고,
   실제 발송은 카카오 템플릿 검수가 끝나야 한다(대표가 채널 관리자에서 등록).
