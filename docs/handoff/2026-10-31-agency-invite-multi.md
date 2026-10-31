# 2026-10-31 — 에이전시 매장 초대 링크: 직원 복사 · 카톡 카드 · 여러 매장 한 번에

대표: *"마이 페이지에서 대행사 입장에선 매장 초대코드를 생성하는 버튼도 있어야 하지 않을까?"* →
*"매장 사장이 매장 여러개를 가질 수도 있잖아. 프랜차이즈도"* · *"2번 카카오톡에선 어떻게 보여?"* → *"모두 진행해줘. 4번 승인도 해줄게."*

## 한 것 (머니 무관)
1. **직원도 초대 링크를 쓴다** — `GET /api/agency-console/store-invite` 가 adminOnly 해제(POST·revoke 는 관리자 그대로).
   마이 에이전시 구역에 직원에게도 '매장 초대 링크' 줄, 시트 안 대신 등록 카드는 관리자만. **[카카오톡으로 보내기]** 버튼(실패 시 폰 공유 → 복사).
2. **여러 매장 한 번에** — `/store/agency/:token` 이 체크박스 + 전체 선택, 이미 이 에이전시가 운영 중인 내 매장은 '운영 중'(못 고름).
   `POST /api/store-agency-invite/accept` 가 `seller_ids[]`(상한 50, 옛 `seller_id` 도 받음) — 매장마다 주인 확인, 하나가 막혀도 나머지 진행,
   관리자 메일은 한 통. `GET /:token` 은 로그인 사장님에게만 `entrustedSellerIds`(그땐 `private, no-store`).
3. **카톡 카드** — 실측(배포 전): 링크가 유어딜 홈 카드 + `index, follow`, 없는 토큰도 200. → 워커 슬롯 `STOREINVITE`
   (`utils/store-invite-ssr.ts`) 가 "○○ 에이전시가 매장 운영을 맡겠다고 해요" 카드 + **늘 noindex**, 없는 토큰은 ENTITY 슬롯이라 404.
   문구 SSOT `shared/agency-store-invite.ts` `agencyInviteCardCopy`(보내기 버튼과 서버 메타가 같은 문장).
- 가이드: 셀러 가이드 한 줄 + `GUIDE_SEED_VERSION` 57.
- 가드: `agency-invite-multi-2026-10-31.test.ts` 17건 + 주입 `scripts/mutations/agency-invite-multi-2026-10-31.mjs` 6건 전부 빨간불 확인.
  🩸 카톡 카드 SSOT 단언 첫 판이 헛돌았다(폰 공유 시트도 같은 제목을 써서 파일 전체 검색이 늘 통과) → feedPayload 블록으로 좁힘.

## 다음 세션의 첫 액션 (E4)
- 배포 뒤: `curl -A 'KakaoTalk-Scrap/1.0' https://urdeal.kr/store/agency/<살아있는 토큰>` → `og:title` 에 에이전시 이름 · `robots noindex`.
  없는 토큰(`aaaa…64자`) → **404** + noindex. 실제 카톡방 카드는 대표 판정.
- 매장 2곳 이상 가진 테스트 사장님 계정으로 링크 열어 둘 다 맡기기 → 에이전시 콘솔 '맡은 매장' 에 둘 다 '운영 중'.

## 다음 — 4번(머니, 2026-10-31 대표 승인 · 별도 PR · 단독 세션)
결재 `docs/decisions/2026-10-11-agency-model-email-only.md` 끝 "2026-10-31 — 3단계(머니) 승인".
지금 상태: 몫은 `agency-share.ts` 1단계(계산만, 매장이 직접 송금) · 중개 매장 4곳은 개인 `broker_share`(게이트 `broker_share_enabled`).
1. 중개 매장 4곳 이전 — 각 중개사(카카오 유저)에게 카카오 에이전시 계정(2026-10-26 경로) + `agency_store_links` active +
   `broker_share_pct` → `agency_share_terms`. 이전 전 `seller_operators`·`seller_meta` 스냅샷 기록(롤백용).
2. 규칙 1~3 적립 — 에이전시 계정 잔액(새 레일), 재원 = 매장 몫(`debit seller:{id}`), 판매 시각의 %, 환불 역전 대칭(머니 룰 #2), 주문당 UNIQUE.
   규칙 1: 에이전시가 자기 링크로 판 건은 소개비 미적립.
3. 정산 분기 — 사업자(세금계산서) / 개인(3.3% `withholdAndLog`).
- 게이트 기본 OFF, `STAGING_CHECKLIST.md` 에 실결제 항목 추가 후 대표가 켠다.

## 틀린 판단
- 대표에게 4번을 "에이전시 몫 규칙과 정산 분기" 로만 설명했는데, 10-24 에 대표가 **이미** "지금은 계산만, 플랫폼 지급은 실제 에이전시가 들어온 뒤" 로 정해 둔 상태였다(`agency-share.ts` 머리말). 보고 전에 그 파일을 먼저 읽었어야 했다.
- 라이브 중개 매장 상태를 재려 했으나 CF 토큰을 파일로 꺼내는 명령이 권한 거부됐다(자격증명을 디스크에 쓰지 말 것 — 어드민 API 로 읽을 것).

## 머지 정리 (같은 날 #2046 과 겹침)
같은 날 다른 세션이 #2046(영입 링크 늘 보이는 버튼 · 카톡 카드 · 링크로 가입하면 바로 연결)을 먼저 머지해 세 파일이 충돌했다.
**main 쪽을 기준으로 받고** 이 PR 고유분만 다시 얹었다:
- 직원도 영입 버튼·시트를 연다 — 카드는 `canManage` 로 새로 만들기·끊기를 가리고, 직원은 링크가 없어도 스스로 만들지 않는다(서버 adminOnly).
- 여러 매장 한 번에 맡기기(체크박스) — #2046 의 "매장 없으면 등록하고 맡기기"와 함께 산다. 등록 화면(`StoreClaimPage`)은 `seller_id` 하나로 부르고 서버가 그대로 받는다.
- 카드 문구는 #2046 의 `agencyInviteCardCopy` 하나로 통일(내 사본 `store-agency-invite-copy.ts` 삭제).
- 서버 메타: #2046 은 조회 없이 이름 없는 제목 + noindex, 이 PR 의 `STOREINVITE` 슬롯은 조회해 **에이전시 이름** + 없는 토큰 404.
  둘 다 같은 주소에 걸리고 공통 쪽이 나중에 덮으므로, 초대 메타가 있으면 공통 rewrite 를 건너뛴다. 토큰이 없거나 조회 실패면 공통 메타(noindex)가 남는다.
- #2046 시험 2건을 재조준(불변식 그대로 — 버튼은 늘 판 위 · 시트는 영입 링크만): 조건이 "관리자만" → "조건 없음" 으로 바뀌었다.
