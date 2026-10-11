# 💬 카카오톡 채널 챗봇으로 매장 관리 (2026-10-10)

**서비스**: 🎟️ 유어딜(소비자 서비스의 사업자 유저 = 셀러 대시보드 쪽). 도매·공구 서비스·유어애즈 무접촉.

대표: *"카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거"* → *"이상적으로 진행해줘"*.

## 무엇을 했나

기존 카카오 i 오픈빌더 스킬 서버 `POST /api/cs/kakao-skill`(CS FAQ 전용, `KAKAO_SKILL_SECRET` 없으면 404)에
**매장 관리 명령**을 얹었다. 연결 안 한 사람에게는 FAQ 가 종전과 똑같이 답한다.

| 명령 | 하는 일 | 쓰기? |
|---|---|---|
| `연결 123456` | 셀러 대시보드에서 받은 6자리 1회용 코드(10분)로 이 채팅을 (사람, 매장)에 묶는다 | 연결 행 |
| `오늘` / `판매` | 오늘(KST) 판매 건수·금액 — 마이 판매 구역(`/my-stores/summary`)과 같은 규칙(PAID/DONE · `DATE(created_at,'+9 hours')`) | – |
| `사용 대기` | 이 매장 상품의 미사용·미만료 이용권 수 | – |
| `정산` | `getPayablePending(sellerLedgerAccount(id))` **읽기만** | – |
| `사용 코드` | 확인 질문 → `네` 면 **계산대 스캔과 같은 함수** `redeemVoucherForStore` 로 사용 처리(원장 3종 포함) | 🔴 머니 |
| `이용권` | 이 매장 이용권 상품 최대 10개(판매 중 먼저) — 번호 스냅샷을 연결 행에 저장 | – |
| `중지 N` / `재개 N` | 확인 질문 → `네` 면 `is_active` 토글(`WHERE id=? AND seller_id=?`, 삭제 상품 제외) + 피드 캐시 무효화 | 상품 |
| `해제` | 연결 끊기 | 연결 행 |
| `도움말` | 명령 목록. 연결된 사람이 모르는 말을 보내면 FAQ → 없으면 이것 | – |

### 안전 모델
- **매장은 채팅 입력에서 받지 않는다** — 오직 서버가 만든 연결 행에서 온다.
- **매 명령마다 좌석 재확인**(`canOperateStore` + `isSeatableStoreStatus`). 회수·정지되면 연결을 지우고 "권한이 없어져…" 라고 답한다.
- 연결 코드: CSPRNG 6자리 · 1회용(CAS `used_at IS NULL AND expires_at > now`) · 새 코드 발급 시 이전 미사용 코드 무효 ·
  봇 키당 시간당 실패 5회 / 전체 300회 상한(시도 자체를 안 한다).
- 쓰기는 전부 `네` 확인(대기 3분, `DELETE … RETURNING` 으로 원자적으로 꺼내 한 번만 실행).
- 게이트 OFF(기본): 연결·명령 → "준비 중". 연결 안 한 사람의 FAQ 는 그대로(DDL 없이 확인).
- 📵 알림톡·문자를 보내지 않는다.

### 리팩토링 (행동 불변)
`POST /api/group-buy/:code/use-by-seller` 의 본문(만료 전이 · 조회 · 소유 검사 · 상태 검사 · CAS · 방문 이벤트 · 원장 3종)을
`src/worker/utils/voucher-seller-redeem.ts` 로 **그대로** 옮겼다. 문구·상태코드·원장 호출 byte-동일. 라우트에는 인증·알림톡·
커미션 표시만 남았다(793 → 729줄). 기존 시험 1건(`voucher-verify-seller-login`)의 소유권 앵커를 새 자리로 재조준했다.

## 파일
- 신규: `src/worker/utils/kakao-bot-store.ts`(연결·좌석·확인 대기·게이트·DDL SSOT) · `src/worker/utils/kakao-bot-commands.ts`(명령) ·
  `src/worker/utils/voucher-seller-redeem.ts`(사용 처리 SSOT) · `src/features/seller/api/seller-kakao-bot.routes.ts`(대시보드 API) ·
  `src/pages/seller-scan/KakaoBotLinkCard.tsx`(UI) · `src/worker/routes/repair-schema/kakao-bot-tables.ts` ·
  `src/tests/unit/kakao-bot-store-ops-2026-10-10.test.ts`(34건, node:sqlite) · `scripts/mutations/kakao-bot-store-ops.mjs`(9건)
- 수정: `kakao-skill-webhook.routes.ts` · `group-buy-voucher.routes.ts`(추출) · `voucher-visit.ts`(path `kakao_bot`) ·
  `seller-operators.routes.ts`(라우트 등록 1줄) · `SellerVoucherScanPage.tsx`(카드 1줄) · `repair-schema.routes.ts` ·
  `admin-system-monitoring.routes.ts`(OPS_GATES 2) · `AdminPlatformSettingsPage.tsx`(손잡이) · `platform-settings-validation.ts`(boolStr) ·
  6개 locale · `docs/STAGING_CHECKLIST.md`(S-KAKAOBOT) · `docs/design/urdeal-platform-model.md`(§4 한 줄)

대시보드 API (`/api/seller` 아래, seller 토큰):
`POST /kakao-bot/link-code` · `GET /kakao-bot/links` · `POST /kakao-bot/links/:key/revoke`

## 🧑‍💼 대표 활성 절차 (전부 대표 액션 — 세션은 플랫폼 쓰기를 하지 않는다)
1. **카카오 비즈니스 → 챗봇(오픈빌더)** 에서 유어딜 채널용 봇 생성(이미 있으면 그대로).
2. 시나리오의 **폴백 블록**에 스킬 연결 — 스킬 URL `https://urdeal.kr/api/cs/kakao-skill`, 커스텀 헤더 `x-skill-secret: <임의의 긴 값>`.
3. Cloudflare Pages `ur-live` 환경변수 **`KAKAO_SKILL_SECRET`** = 같은 값(없으면 404 — 봇 전체 비활성).
4. 매장 관리를 열려면 **`/admin/platform-settings` → "카카오톡 매장 관리(챗봇)" = `true`**
   (또는 env `KAKAO_BOT_STORE_OPS_ENABLED=true`). 켜기 전 **S-KAKAOBOT** 8건, 특히 **S-KAKAOBOT-5(사용 처리 → 원장)** staging 확인.
5. 챗봇 배포 → 사장님은 `/seller/scan` 하단 **"카카오톡으로 매장 관리" → 연결 코드 받기** → 채널에 `연결 123456`.

## 다음 세션의 첫 액션
- 대표가 1~4 를 하면: staging(또는 파일럿 매장)에서 S-KAKAOBOT-1~8. 판정 쿼리:
  `SELECT event_type, amount, credit_account FROM ledger_entries WHERE reference_id = 'voucher:<id>'` 가 계산대 스캔으로 처리한 이용권과 **같은 행 모양**인지.
- 오픈빌더 실제 요청의 `userRequest.user.id` 가 채팅마다 고정인지(봇 키) 라이브 1회 확인 — 문서 기준으로만 구현했다.

## 못 한 것 / 판단 대기
- ⚠️ **E1~E2 까지다**(tsc 0 · 유닛 34 + 기존 관련 시험 · 주입 9건 빨간불 확인). 오픈빌더 실연동·라이브 원장 판정은 못 했다(대표 활성 필요).
- 🧑‍⚖️ **손님 "사용됨" 알림톡**: 계산대 스캔은 사용 처리 때 손님에게 알림톡을 보내는데, 챗봇은 이 기능의 안전 규칙(알림톡 발송 없음)
  때문에 **안 보낸다**. 손님 입장에서는 "내 이용권이 쓰였다" 를 모르는 경로가 하나 생긴다(부정사용 탐지 신호 약화). 보낼지 대표 판단.
- 연결은 채팅 1개 = 매장 1개(봇 키 PK). 여러 매장 운영자는 `연결 새코드` 로 전환한다(다중 매장 동시 선택 UI 없음).
- 운영 가이드(셀러) 섹션은 게이트가 꺼진 동안 혼란을 줄 수 있어 **미반영**(guide-update-pending) — 켤 때 함께.
- 이용권 코드 대소문자: 입력 그대로 조회한다(계산대 스캔과 동일). 손으로 소문자로 치면 "찾을 수 없어요".

## 이번에 틀렸던 판단
- 시험 첫 판이 "원장 기록" 단언에서 빨갛게 떴는데 원인은 코드가 아니라 **`ensureLedgerTable` 의 모듈 전역 `DDL_DONE` 플래그**였다
  (시험마다 새 DB 인데 두 번째부터 DDL 을 건너뛴다). 원장 테이블은 시험 스키마에 직접 둔다 — 같은 함정이 `seller_operators` 에도 있다(WeakSet 은 DB 별이지만 그 DB 에서 ensure 가 아직 안 돈 상태).
