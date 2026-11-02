# [E3] 대외 소개서 자동 생성 — 라이브 숫자 · 매일 · Release (2026-11-02)

대표: *"제안서는 계속 자동 업데이트가 안돼. 3번은 더 이상적인 방법 알려줘."* → *"응 진행해줘. 가장 이상적으로."*

## 왜 안 바뀌었나 (실측)
1. 숫자를 손으로 적었다 — `deck-common.mjs` FACTS. 11-02 라이브: 판매 중 이용권 **165 → 160** · 식사 평균 **32,521 → 33,724** · 숙박 **155,693 → 147,800** · 뷰티 45,253 → 42,683.
2. 만드는 과정이 수동이었다 — 다섯 중 넷이 10-26 커밋에 멈춰 있었다.
3. 완성본(약 40MB)을 레포에 커밋했다 — 다시 뽑을 때마다 git 이 영구로 분다.
4. 🔴 **덱이 지금 설정과 다른 약속을 하고 있다** — 대행사·인플루언서·상인회 덱이 *"귀사(중개) 몫을 유어딜이 직접 보낸다"* 고 말하는데 라이브 `broker_share_enabled = false`(11-02 D1 실측). **문장은 고치지 않았다 — 대표 판단 사항이다**(스위치를 다시 켤지, 문장을 바꿀지). 이제 어드민 화면과 워크플로 요약이 이 어긋남을 매일 경고한다.

## 바꾼 것
- 서버 `GET /api/public/proposal-facts`(건수·평균만, edge 1h) — 정의 SSOT `src/shared/proposal-live-facts.ts`
- 덱: `facts-live.mjs`(받기·표기) · `deck-common.mjs` FACTS 에서 라이브 키 리터럴 제거(+폐지된 영입 2% 키 삭제) · `build-all.mjs`(다섯 덱 + PDF + 쪽수 대조 + CLAIMS 경고 + manifest) · 자체 `package.json`/lock
- 워크플로 `.github/workflows/proposals.yml` — 매일 05:23 + 원본 변경 시 → Release `proposals-latest`
- 어드민: `GET /api/admin/proposals/{manifest,file/:name}`(adminApp — 어드민 인증) · 화면이 자동 생성본을 blob 으로 먼저 띄우고, 못 받으면 저장된 판이라고 **말한다** · 경고를 빨갛게
- `partners-facts.ts`: 아무 화면도 안 쓰던 거울(activeVouchers·realStores·catalogMeasuredAt) 제거, 예시 상품에 앵커 id
- 랜딩 `/partners` 정직 고지도 같은 서버 숫자로(못 받으면 숫자 없는 문장 — 옛 숫자를 안 보여 준다). 종전엔 손으로 적은 165건이었다
- 저장소 PDF·PPTX 10개 **동결**(해시) — 다시 커밋하면 빨간불
- 검증: 이 환경에서 다섯 덱 + PDF 실제 생성 65초, 쪽수 전부 일치(15·17·20·20·30), 상인회 덱 PDF 에 "판매 중인 이용권 160건 · 2026-11-02" 확인. 시험 17 + 주입 8 전부 빨간불.

## 이어받는 세션의 첫 액션 (대표가 이 작업을 이어서 하라고 했을 때만)
1. 머지·배포 뒤 `curl -sS https://urdeal.kr/api/public/proposal-facts -H 'User-Agent: Mozilla/5.0'` → `activeVouchers` 등이 D1 과 같은지.
2. Actions 에서 `Proposals (소개서 자동 생성)` 를 수동 실행(workflow_dispatch) → Release `proposals-latest` 에 PDF 5 + PPTX 5 + manifest.json.
3. 어드민 `/admin/proposals` 에서 "자동 생성본 · … 생성 · 숫자 기준 …" 이 뜨고 경고(중개 몫)가 빨갛게 뜨는지 = E4.

## 틀렸던 판단
- 처음엔 완성본을 R2 에 올리려 했다 — GitHub 의 Cloudflare 토큰에 R2 쓰기 권한이 있는지 이 세션이 확인할 수 없었다. Release 는 워크플로 자신의 토큰(contents: write)으로 되고 git 기록도 안 늘린다.
- 인플루언서 DB 규모도 자동으로 재려 했다 — 공개 경로에서 30만 행 COUNT 는 D1 읽기 한도를 태운다. 손으로 남겼다(기준일 표기).

## 남은 것
- 🔴 **대표 판단(결재함)**: `docs/decisions/2026-11-02-proposal-broker-share-copy.md` — 중개 몫 송금 문장 vs 꺼진 지급(10-13 결재로 OFF). 새 경로 `agency_share_payout_enabled` 도 함께 본다.
- 자동 생성이 E4 로 확인되면 저장소의 동결 판(약 40MB)과 화면 폴백을 지운다.
- 화면 캡처(`shots/`) 주 1회 자동 · 랜딩(`/partners`) 계산기 예시 가격(아직 손으로 적은 값)도 같은 서버 숫자로.

## 2026-11-02 머지 뒤 (#2097 → `268518b`)
- ✅ 라이브 숫자 경로 배포됨(15:04 배포 `7695d10`): `/api/public/proposal-facts` → 판매 중 160 · 실제 매장 2 · 식사 평균 33,724 · 앵커 2915 · broker false — 오전 D1 실측과 같다.
- ❌ 첫 워크플로 실행(push) 실패: 라이브 숫자를 6분 기다렸는데 그 배포가 12분 뒤 **다음 머지에 밀려 취소**됐다 → 404. 기다림을 30분으로 늘림(이 커밋).
- 🔒 이 세션에서 수동 실행(workflow_dispatch·rerun)은 **403**(앱 토큰·MCP 둘 다 Actions 쓰기 권한 없음). 워크플로 파일이 main 에 바뀌면 push 트리거로 돈다 — 이 커밋 머지가 그 실행이다.

## 🩸 틀렸던 판단 — 동결 시험이 main 배포를 70분 막았다
- `inline-mutations-frozen` 은 **절대 개수**를 본다. 동결 **전에** Verify 를 통과한 #2094 가 동결 **뒤에** 머지되며 2건을 더 넣었고(981 > 979), main 배포의 단위 시험이 그 뒤 두 번(04:54 · 05:21) 실패했다. #2098 이 시험 메시지대로 그 주입을 `scripts/mutations/` 로 옮겨 15:04 배포가 다시 초록이 됐다.
- 원인: GitHub 이 "최신 main 과 합친 뒤 다시 검사" 를 요구하지 않아, 래칫을 새로 세우는 순간 이미 초록인 PR 이 빠져나간다. **절대값 래칫은 세우는 날 한 번 이 경주가 난다.**
- 다음에 래칫을 세울 때: 열린 PR 중 그 자리를 건드리는 것을 먼저 찾아 보거나, 시험을 *변경분 기준*(merge-base 대비 증가)으로 만든다.
