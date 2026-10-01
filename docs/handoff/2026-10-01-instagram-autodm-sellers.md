# 2026-10-01 (2차) — 인스타 자동 DM 을 매장(사장님·중개사)에게 — 마이에서, 토큰 없이

대표: *"토큰 없이는 안되는거야? 무료로는? 된다면 중개사까지 마이에서 되게끔 하려고 했지"* → *"진행해줘"*.
1차(공식 계정 전용, 토큰 붙여 넣기)는 [#1590](https://github.com/tobe2111/ur-live/pull/1590) — `2026-10-01-instagram-comment-autodm.md`.

**서비스**: 유어딜(사업자 유저·중개사 도구). 머니 경로 없음. 발송은 결재(C) 대상이라 **두 겹 OFF** 로 배포한다.

## 무엇이 바뀌었나

| 자리 | 내용 |
|---|---|
| 계정 모델 | `ig_autodm_accounts`(신규) — owner_key `'platform'` / `'seller:{id}'`. 같은 인스타 계정은 한 곳에만(UNIQUE). 규칙·발송 기록에 `account_id`. `ig_autodm_account`(1행)는 **앱 설정**(앱 ID·시크릿·확인 토큰·`sellers_enabled`)으로 용도 변경. 1차의 공식 계정 데이터는 ensure 가 자동 이관(라이브는 연결 전이라 0건) |
| 연결 | **인스타 로그인(Business Login for Instagram)** — `/connect-url` → instagram.com → `GET /api/instagram/oauth/callback` → code→단기→장기 토큰 교환·암호화 저장·댓글 구독. state 는 JWT_SECRET HMAC 서명(주인·만료 10분·돌아갈 주소 화이트리스트) |
| 매장 API | `/api/seller/instagram-dm/*` — 좌석 토큰(사장님·중개사 둘 다) → `seller:{sellerId}`. 켜기는 가게 승인(active/approved) 뒤만. 하루 상한 최대 500(공식 5000). 규칙 50개 상한. 규칙 수정·삭제는 `account_id` 조건(IDOR 차단) |
| 화면 | 셀러 페이지 `/seller/instagram-dm`(검색 전용 메뉴 '인스타 자동 DM') — **마이 → 전체 도구**에서 같은 화면이 시트로 열린다(ToolPageSheet, 별도 시트 안 만듦). 인스타에서 돌아오면 `from=my` 로 "마이로 돌아가기" 띠 |
| 어드민 | 앱 설정(앱 ID·시크릿, 복사용 웹훅·리디렉션·권한해제·데이터삭제 주소) · **매장 발송 전체 스위치**(기본 닫힘) · 공식 계정(로그인 또는 토큰) · 연결된 매장 목록 + 강제 끄기 |
| 메타 콜백 | `POST /api/instagram/oauth/deauthorize`(연결 해제) · `POST /api/instagram/oauth/data-deletion`(규칙·기록·계정 삭제, `{url, confirmation_code}`) — signed_request 를 앱 시크릿으로 검증 |

🔒 **게이트 두 겹**: ① 계정마다 '켜기'(기본 OFF) ② 매장 계정은 어드민 '매장 계정 발송'(기본 닫힘). 둘 다 켜져야 나간다.

## 검증
- `instagram-autodm-2026-10-01.test.ts` 32건(실제 SQLite + 가짜 fetch) — 매장 7건 추가(전체 스위치 0통 · 계정별 규칙 분리 · IDOR · 계정 가로채기 · 데이터 삭제 · state 위조/만료/화이트리스트 · signed_request)
- 주입 9건 `scripts/mutations/instagram-autodm.mjs` — **전부 빨간불 확인**
- ⚠️ 못 한 것: 실제 인스타 로그인 왕복(앱 등록 전). code 교환 응답 모양은 문서 기준이고, 두 모양(`data:[…]`/평평)을 다 받게 했다.

## ➡️ 다음 액션(대표) — 순서
1. **메타 앱**(비즈니스 유형) → Instagram 제품 → "Instagram 로그인으로 API 설정"
2. 어드민 `/admin/instagram-autodm` ① 의 주소 5개를 메타 화면에 붙여 넣기(웹훅·확인 토큰·리디렉션·권한 해제·데이터 삭제), 웹훅 구독 `comments`
3. 어드민 ② 에 **Instagram 앱 ID·앱 시크릿** 저장
4. 어드민 ④ **인스타로 연결**(유어딜 공식 계정 — 앱 역할에 그 계정을 테스터로 추가해야 개발 모드에서 된다) → 규칙 → 켜기 → 다른 계정 댓글로 확인 = **E4**
5. 그 화면을 녹화해 **앱 검수 제출**: 권한 3종 `instagram_business_basic` · `instagram_business_manage_comments` · `instagram_business_manage_messages` 고급 액세스. 비즈니스 인증(사업자등록증)을 함께 요구받을 수 있다
6. 통과하면 앱을 **라이브** 전환 → 어드민 ③ **매장 계정 발송 열기**

## 상태 (2026-10-01 오후)
- **[E3]** #1594 머지 `91ff1b3` · 배포. 라이브 확인(urdeal.kr): 웹훅 잘못된 토큰 403 · 서명 없는 POST 401 · 위조 state → `/seller/instagram-dm?ig=error&reason=…`(302) ·
  권한해제/데이터삭제 서명 없음 400 · 매장 API 비로그인 401 · `/seller/instagram-dm` 200 · 어드민 앱 설정 미입력 · 매장 발송 스위치 닫힘 · 연결 계정 0.
- **후속(같은 날, 이 브랜치)**: 개인정보 처리방침 `#instagram` 문단(국·영) · 데이터 삭제 상태 주소 `/privacy?ig_deletion=<코드>#instagram` ·
  **연결 해제 시 발송 기록 즉시 삭제**(전엔 남았다 — 처리방침과 어긋나 고침) · 발송 기록 90일 보관 후 삭제(웹훅 때 그 계정만 정리) ·
  어드민 복사 목록에 개인정보처리방침 주소. 테스트 39건 · 주입 12건.

## 메타 앱 심사 제출 문안 (대표가 그대로 붙여 넣기)
권한별 "사용 방법" 칸(영문):
- **instagram_business_basic** — UrDeal lets a business connect its own Instagram professional account so that it can set up comment keyword rules. We read the account ID and username to show which account is connected and to route incoming comment webhooks to that business.
- **instagram_business_manage_comments** — We subscribe to the `comments` webhook to receive new comments on the business's own posts, match them against the keywords the business configured, and optionally post one short public reply ("Sent you a DM") to the matching comment.
- **instagram_business_manage_messages** — When a comment matches a keyword, we send exactly one private reply to that commenter (Private Replies API, within 7 days of the comment) containing the link the business configured. We never send unsolicited messages: only people who commented with the keyword receive one message.

화면 녹화 순서(1~2분):
1. urdeal.kr 로그인 → 마이 → 전체 도구 → 인스타 자동 DM
2. "인스타로 연결" → instagram.com 로그인·권한 3종 허용 화면이 보이게 → 유어딜로 돌아와 연결됨 표시
3. 규칙 만들기(키워드 "링크", 메시지, 링크) → 켜기
4. 다른 인스타 계정으로 그 게시물에 "링크" 댓글 → 그 계정의 DM 함에 메시지 도착 + 공개 답글
5. 유어딜 화면의 발송 기록에 그 건이 뜨는 것
6. 연결 해제 버튼

앱 기본 설정: 개인정보처리방침 URL = `https://urdeal.kr/privacy#instagram`, 데이터 삭제 = 콜백 URL(어드민 ① 에 있음).

## 남은 것 / 판단 필요
- **팔로우 확인 2단계(버튼 → 답장 → 링크)는 하지 않았다.** 비공개 답장에 버튼을 싣는 모양과 팔로우 여부 조회 필드를
  실계정 없이 확인할 수 없다 — 추측으로 만들면 심사 녹화 때 처음 깨진다. 공식 계정을 연결한 뒤 실제 응답을 보고 붙일 것.
- 처리방침 문단(`src/pages/privacy/InstagramConnectSection.tsx`)은 **대표 확정**(2026-10-01 "그냥 확정하고"). 문구를 바꾸려면 다시 대표 확인.

## 틀렸던 판단
- 처음엔 마이 전용 손수 시트를 따로 만들려 했다 — 그러면 다크 지원·타입 스케일·아이콘 규칙을 따로 맞춘 **두 번째 화면**이 생긴다.
  마이의 "전체 도구"가 이미 셀러 라우트를 시트 안에서 그대로 렌더(ToolPageSheet)하므로 **셀러 페이지 하나**로 끝냈다(도착지는 하나).
