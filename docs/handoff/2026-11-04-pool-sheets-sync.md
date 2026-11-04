# 2026-11-04 — 파트너 풀 · 매장후보 풀 구글시트 연동

대표: *"연동이 어디에 되어있는거지? 파트너풀, 매장후보 풀 모두 다 연동하고픈데"*

## 현재 상태 (라이브 실측, 2026-11-04 16시 KST)
- **인플루언서 풀**만 연동돼 있었다 — ur-ads 워커 Variables `GSHEETS_SHEET_ID` 의 시트, 탭 `pool`.
  서비스계정 `google-sheets@urteam-live-commerce-5b284.iam.gserviceaccount.com`. 매시간 12,000줄씩 커서 미러, 정상.
- 파트너 풀(활성 83,711 / 전체 561,864)·매장후보(활성 390,671)는 CSV 다운로드만 있었다.
- 다운로드 엔드포인트 5종 전부 200(서버 정상). 인플루언서 "전체" 엑셀은 174MB — 브라우저가 못 버틸 수 있는 크기.

## 이번에 만든 것
- `src/features/marketing/api/pool-sheets-sync.ts` — 풀별 **별도 시트 파일**(ID 는 `platform_settings.ads_sheets_id_{company|store}`),
  id 커서(keyset)로 읽기, RAW 쓰기, 화면에 보이는 행만(파트너 active=1·병합패자 제외 / 매장 active=1).
- ur-ads: `/__ads/pool-sheets-status` · `/__ads/pool-sheets-sync` (`src/worker-ads/pool-sheets.routes.ts`), 알람 레인 `sheets-sync-pools`(시간당 1, 게이트 `ADS_SHEETS_SYNC_ENABLED`).
- 어드민 API `/api/admin/ads/pool-sheets*` + 화면 `PoolSheetSync`("구글 시트 연동" 버튼, 파트너 풀·매장후보 화면).
- 가드 `src/tests/unit/pool-sheets-sync-2026-11-04.test.ts`(주입 1건 빨간불 확인).

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
대표가 화면에서 시트 주소를 저장한 뒤:
`/api/admin/tools/settings` 의 `ads_sheets_last_sync_company` / `ads_sheets_last_sync_store` → `ok:true` 이고 진행이 늘면 E4.
`HEADER ... 403` 이면 공유 안 됨, `GRID` 면 셀 한도.

## 틀렸던 판단
- 다운로드 확인하려고 `newOnly` 기본(ON) 엔드포인트를 직접 불러 **세 풀에 "내보냄" 도장 500건씩**을 찍었다.
  대표 허락 후 `pool-export-batches/cancel` 로 1,500건 전부 되돌림(확인: 묶음 목록 0). ⇒ 확인용 호출은 `newOnly=0`.

## 대기
- 대표: 빈 시트 2개 만들기 → 서비스계정 이메일 편집자 공유 → 화면에 주소 붙여넣기.

## 2차 (배포 후 실측 → 수리)
- #2185 머지 `b5de120` · 배포 3종 success. 라이브에서 상태·동기화가 둘 다 `skipped: budget` — ur-ads 진입 차단기(`lane-gate.ts`)가
  오늘 읽기 예산 초과로 `/__ads/*` 를 막고 있었다. 그런데 어드민 API 가 그걸 **"0줄 성공"** 으로 옮겼다(틀린 판단: 차단기의 200+skipped 를 몰랐다).
- 수리: `/__ads/pool-sheets-status` 를 관측 면제에 추가(면제 6→7) · 어드민 API 가 skipped 를 409 + 한국어 사유로 돌려줌.
- 참고: 같은 차단기 때문에 인플루언서 시트 미러도 오늘 한도가 풀릴 때까지 쉰다.

## 3차 — 시트 링크 + "이메일 보냄" 표시 (대표 "방법 2. 대량으로 체크하려면?")
- 시트 생성(대표 드라이브, Drive 커넥터) + SA 편집자 공유 + 어드민 등록 완료. 첫 회차 라이브: 파트너 20,000/84,228 · 매장 24,000/391,055 [E4].
  - 파트너 `1DFn0KZ44M3zzc7ujNHkqCZE3iJfSctb_Bs-EnJTBHeQ` · 매장 `1VqpTA9rgVzf-jEtysMlwjsViuGrivJAJYnRm2FuUNN4`
- `pool-sheets-marks.ts`: 맨 오른쪽 '이메일 보냄' 열(아무 글자) + '발송기록' 탭(이메일 목록 붙여넣기) → 덮어쓰기 **전에** 읽어 `email_sent_at`
  저장(ID/이메일로 매칭, 한 방향), 새 리드는 status new→contacted. 이메일 매칭은 부분 인덱스(MARK_DDL, 체크섬 1회).
- 열 수 변경 시 사이클 재시작(`cursorForCols`) — 배포 직후 두 시트 모두 처음부터 다시 쓴다(정상).
- 표시가 DB 에 들어가기까지는 그 줄이 다시 덮어써질 때(최대 한 바퀴: 파트너 ~5h · 매장 ~17h). `발송기록` 은 매시간 반영.
