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

## 남은 것 / 판단 필요
- **개인정보처리방침**(`/privacy`)에 "인스타 연결 시 수집 항목(인스타 계정 ID·아이디·댓글 내용 일부·발송 기록), 보관·삭제" 문단 추가가 메타 심사에 필요할 수 있다 — 법적 문구라 대표 확인 후 반영(이번 커밋엔 없음).
- 데이터 삭제 응답의 상태 확인 주소는 지금 `/privacy` 다. 전용 상태 페이지가 필요하면 별건.
- 팔로우 확인 2단계(버튼 → 답장 → 링크)는 아직 없다.

## 틀렸던 판단
- 처음엔 마이 전용 손수 시트를 따로 만들려 했다 — 그러면 다크 지원·타입 스케일·아이콘 규칙을 따로 맞춘 **두 번째 화면**이 생긴다.
  마이의 "전체 도구"가 이미 셀러 라우트를 시트 안에서 그대로 렌더(ToolPageSheet)하므로 **셀러 페이지 하나**로 끝냈다(도착지는 하나).
