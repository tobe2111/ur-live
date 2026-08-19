# 2026-08-19 — 에이전시 대시보드 일몰 + 매장 운영 주체 모델 박제

**브랜치**: `claude/agency-dashboard-review-iqbv5u`
**대표 지시**: "에이전시 대시보드의 가치를 모르겠어. 셀러대시보드에 매장을 여러개 함께 운영할 수 있도록 해서
에이전시 대시보드를 없애는 방향으로" → (승계 질문) → **"응 모두 하자"**
**설계 SSOT**: `docs/design/store-operator-model.md`

---

## 1. 다음 세션의 첫 액션

### (a) 배포 후 라이브 판정 — 이것만 보면 된다
```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
# ① 신규 가입 서버 차단 — 403 + AGENCY_SIGNUP_CLOSED 여야 한다
curl -sS -X POST https://urdeal.kr/api/agency/register -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data '{"name":"t","contact_name":"t","email":"t@example.com","password":"xxxxxxxx"}' | head -c 300
# ② 언마운트 확인 — 404 여야 한다(200 이면 마운트가 되살아난 것)
for p in campaigns incentives messages coupons members calendar kpi; do
  printf "%-12s %s\n" "$p" "$(curl -sS -o /dev/null -w '%{http_code}' "https://urdeal.kr/api/agency/$p" -H "User-Agent: $UA")"
done
# ③ 살아 있어야 하는 것 — 401(인증 필요)이면 정상, 404 면 사고
curl -sS -o /dev/null -w '%{http_code}\n' https://urdeal.kr/api/agency/delegation -H "User-Agent: $UA"
```
**⚠️ 이 판정은 배포 후에만 가능하다.** Workers 런타임 라우팅은 단위테스트로 못 본다(HTMLRewriter 와 같은 클래스).

### (b) 기존 4개 계정에게 알릴지 대표 판단 대기
가입만 닫았고 **로그인·정산·위임은 그대로**다. 그런데 다음 로그인에서 메뉴 20개가 사라진 걸 보게 된다.
대시보드에 `sunset-2026-08` 가이드 섹션은 넣었지만 **능동 통지(알림톡/메일)는 하지 않았다** — 대표 판단 사항.
계정: `유어딜 본사`(id 1) · `인디아즈`(7) · `제아스컴퍼니`(8) · `KONEX`(9).

### (c) 2단계는 **착수하지 않는 것이 현재 결론**
`store-operator-model.md` §6 의 착수 조건(다중 매장 수요 또는 대리 등록 매장 발생) 판정 쿼리를 먼저 돌릴 것.
지금은 둘 다 0이다.

---

## 2. 완료분

| 항목 | 내용 |
|---|---|
| 플래그 | `AGENCY_DASHBOARD_SUNSET = true` (`src/shared/feature-flags.ts`) |
| 가입 차단 | 클라(`AgencySunsetPage`) + 서버(`signupClosedResponse` 403) **한 쌍** |
| 라우트 | **39 → 16** |
| 페이지 삭제 | 23개 / **5,137줄** |
| API 언마운트 | 13개 (파일 보존) · 죽은 엔드포인트 `POST /sellers/:id/streams` 제거 |
| nav | 30항목 → 10항목, 죽은 링크 0 |
| cron | `handleAgencySellerMatch` 정지 |
| 가드 | `agency-sunset-invariants.test.ts` **18건** + `check-guard-mutations` 주입 **3건** |
| 문서 | `store-operator-model.md` 신설 · `urdeal-platform-model.md` 3곳 · `design/README.md` |
| 시드 | `GUIDE_SEED_VERSION` 14→15(섹션 5개 제거 + 변경 안내) · `BLOG_SEED_VERSION` 8→9(에이전시 모집 글 제거) |

**되돌려-검증**: 4가지 주입(서버 게이트 제거 / 죽은 nav 추가 / 재마운트 / 라우트 0개) 전부 빨강 확인 후 복원.

---

## 3. 이번에 틀렸던 판단 (다음 세션이 같은 함정을 피하도록)

1. **"에이전시 API 파일도 같이 지우면 되겠다" — 틀렸다.**
   `agency-incentives.routes.ts` 는 `computeCommission` 을 **머니 경로**(`order-commissions.ts`·
   `commission-budget.ts`)에 export 한다. `agency-invites` 의 `consumeInviteCode` 는 셀러 가입이,
   `promote-boosts` 는 셀러 라우터를 함께 export 한다. **파일 삭제 대신 마운트만 내린 이유가 이것이다.**

2. **가드 주입 대상을 잘못 골랐다(두 번).**
   ① `if (AGENCY_DASHBOARD_SUNSET) {` 는 두 곳에 있어 러너가 "유일해야 한다"로 거부 → 응답을 헬퍼
   (`signupClosedResponse`)로 추출해 유일하게 만들었다(코드도 DRY 해졌다).
   ② 주석 처리된 마운트를 `find` 로 삼았더니 **"주입 대상이 주석에만 있다(낡은 지도)"** 로 거부됐다 —
   러너가 이 레포의 옛 함정을 이미 알고 막고 있었다. 살아 있는 코드(delegation 마운트)를 겨냥해 해결.

3. **`check-guard-mutations` 를 타임아웃(2분)으로 죽였더니 무관한 파일에 주입이 남았다.**
   `influencer-keyword-rotation.ts` 가 수정된 채 남아 있었다(러너는 try/finally 로 복원하지만 SIGKILL
   에는 못 이긴다). **전체 실행은 백그라운드로 돌리거나 `--only` 로 좁힐 것.** 중단했으면 `git status` 확인 필수.

4. **`[SKIP_SIZE]` 같은 커밋 태그는 CI 에서 안 통한다 — 로컬 pre-commit 전용이다.**
   PR 의 HEAD 는 **머지 커밋**이라 CI 검사기가 내 커밋 메시지를 못 읽는다. 로컬에서
   `✅ file-size: [SKIP_SIZE] — skip (pre-commit)` 이 떠서 CI 도 통과할 줄 알았는데
   `STRICT_FILE_SIZE — 차단` 으로 실패했다(PR #1179 첫 Verify).
   ⇒ **우회 태그로 CI 를 넘기려 하지 말 것.** 실제로 고쳐야 한다. 이번엔 마침 PR 취지에 맞는
   대상이 있었다 — `POST /api/agency/sellers/:id/streams`(도달 경로 0: 화면 삭제 +
   `LIVE_COMMERCE_SUSPENDED` 영구 결정) 26줄 제거로 1120 → 1094줄. baseline 도 1094 로 **조였다**
   (느슨하게 두면 다음에 그만큼 다시 자란다).
   ⚠️ CI 와 같은 조건으로 미리 확인하는 법: `node scripts/check-file-size.mjs --changed-only -s`

5. **"라우트 개수만 세는 가드"는 파일이 통째로 비어도 통과한다.** 그래서 하한(`> 5`)도 함께 걸었다.
   nav 파싱도 0건이면 실패로 뒤집었다(측정 대상 0 = 통과 아님 — CLAUDE.md 가드 레지스트리 교훈 ⓐ).

---

## 4. 남은 결정 / 대기

| 항목 | 누가 | 비고 |
|---|---|---|
| 기존 4개 계정 능동 통지 여부 | 대표 | 위 §1(b) |
| 2단계(`seller_operators`) 착수 | 대표 | 수요 0 — §6 착수 조건 충족 시 |
| 3단계 owner 승계 + 영입 보상 분리 | 대표 | 2단계 이후. **머니 경로**(정산 귀속) → 단독 세션 + staging 실결제 |
| 남은 에이전시 코드(약 11,000줄) 완전 삭제 | 대표 | 지금은 보존(가역성). 6개월 뒤에도 관계 0이면 삭제 검토 |
| `/agency/sellers`·`agency_sellers` 테이블 | — | 위임(`store_agency_delegation`)과 **중복 개념**. 2단계에서 `seller_operators` 로 흡수 예정 |

---

## 5. 실측 스냅샷 (2026-08-19, 판단 근거)

```
agencies 4 (전부 active, 1개는 '유어딜 본사')
agency_sellers 0행 · store_agency_delegation 0행 · introduced_by_agency_id 0명
sellers 10 (approved 9 · suspended 1) · 다중매장 소유 유저 0 · 중복 사업자번호 0
agency_invites/coupons/incentives/messages/notices/targets = 테이블 없음(= 한 번도 실행 안 됨)
```
