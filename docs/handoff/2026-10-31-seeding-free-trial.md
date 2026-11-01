# 2026-10-31 — 무상 체험 제공(협찬) + SNS 연동 + 신청권(노쇼 방지 보증금)

서비스: 🎟️ 유어딜 소비자(이용권) · 머니 접촉: 신청권 카드 구매(게이트 OFF) · 롤백: `git revert` (테이블은 남아도 무해)

## 대표 확정 (그대로)
- "모집 인원도 그러면 사장님이 이용권 등록할 때 설정하게끔 하자. 게시 의무도 하게끔 하고, 패널티도 필요하겠네?"
- "알림톡으로 하는걸로 일단 하자. 충전한 돈이 아닌, 신청권 N장으로 하자. 처음 가입 혜택으로 첫 3회까지 무료 진행하자. 네 말대로 노쇼 방지 보증금으로 가자."
- "플랫폼들 연동은 어떻게 할거야? 유튜브도 연동 되지 않아? 일단 할 수 있는거 다 하고싶은데"

## 만든 것 [E2 — 타입체크·유닛 통과, 배포 전]
- 규칙 SSOT `src/shared/seeding.ts` — 제공 설정 정규화 · 자격 판정 · 상태 · 패널티 · 묶음 · 알림톡 문안
- 서버 `src/features/seeding/api/` — `seeding-db`(테이블·신청권 원장·패널티·CAS) · `sns-link`(인스타/유튜브/틱톡 OAuth) ·
  `seeding-actions`(사장님·어드민 공용 전이) · `seeding.routes`(인플루언서) · `seeding-store.routes`(사장님·어드민) · `seeding-sweep`(cron 18:40 KST)
- 화면: 이용권 등록 3단계에 설정 칸 · 상세 '이 이용권 팔아보기'(`SellThisCard`) · `/my-seeding` · `/store/seeding` · `/admin/seeding`
- 알림톡 7종 문안·버튼 `docs/alimtalk-register-list.md` 23~29 · 매장 링크 `/store/go?to=seeding`
- 0원 체험 이용권은 기존 체험단 발급 함수 재사용(`issueExperienceVoucher(..., 'SEED')`, `is_experience=1` → 자동 정산 제외)
- 가드 `src/tests/unit/seeding-2026-10-31.test.ts` 27건(실제 SQLite)

## 이번에 틀렸던 판단
- 무료 신청권 횟수 설정이 비어 있으면 `Number(null) = 0` 이라 **가입 혜택 3회가 0회**로 읽혔다 — 시험이 잡아 고쳤다.

## 대표님이 해야 켜지는 것 (코드 밖)
1. **인스타그램**: 메타 앱(자동DM 과 같은 앱) → 인스타그램 로그인 리디렉션 URI 에 `https://urdeal.kr/api/sns-link/instagram/callback` 추가. 프로페셔널 계정만 연동된다.
2. **유튜브**: 구글 클라우드 콘솔 OAuth 클라이언트(`YOUTUBE_CLIENT_ID`)에 `https://urdeal.kr/api/sns-link/youtube/callback` 추가 + `youtube.readonly` 범위(OAuth 동의 화면 검수).
3. **틱톡**: TikTok for Developers 앱에 리디렉션 `https://urdeal.kr/api/sns-link/tiktok/callback` + `user.info.stats` 범위 심사. 심사 전엔 연동돼도 팔로워 수가 비어 "읽지 못함"으로 뜬다.
4. **알림톡 7종** SENS 등록·심사 → 승인되면 `alimtalk_approved_templates` 에 `seeding_request_store=seedingrequeststore, …` 추가(세션이 대신 적을 수 있다).
5. **신청권 구매**는 `seeding_pass_charge_enabled` 기본 OFF — staging 실결제 S-SEED 후 어드민 `/admin/seeding` 에서 켠다. 묶음 기본값 1장 1,000 · 5장 4,500 · 10장 8,000(어드민 조정).

## 다음 세션 첫 액션
- 배포 후 `curl -s https://urdeal.kr/api/seeding/offer/2917` → `{"enabled":false}` (테이블 자동 생성 확인)
- 대표 계정으로 `/my-seeding` 열어 무료 신청권 3장이 보이는지(E4)

## 후속 (같은 날)
- PR #2048 머지 후 **구매 취소(청약철회)** — `/my-seeding` 구매 내역에서 산 지 7일 안·그 묶음 장수가 남아 있으면 [구매 취소]. 원장 cancel 줄 + 유료 칸 CAS 차감 → `cancelTossPayment` → 실패 시 되돌림. 가드 +4 · 주입 +2.

## 남은 결정
- 노쇼 자동 판정은 일부러 안 했다(매장이 스캔을 깜빡할 수 있다) — 사장님 신고·운영자만.
