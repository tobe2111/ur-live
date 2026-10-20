# 시크릿 회전 후 사용자 액션 가이드 (2026-04-27)

> 시크릿 회전 + 토스 라이브 웹훅 등록 + ENVIRONMENT=production 까지 완료 후 남은 운영 액션 모음. **사용자가 직접 진행** 해야 하는 것들만 정리.

---

## 1. 결제 실제 흐름 검증 (30분 — 권장 즉시)

새 시크릿이 적용된 후 토스 결제가 끝까지 잘 동작하는지 확인.

### 1-1. 카드 결제 테스트
1. live.ur-team.com 에서 1000원짜리 상품 또는 후원 결제
2. 토스 결제창 → 카드 결제 완료
3. **확인**:
   - 셀러 대시보드 → 주문 → `결제완료` 상태로 보이는지
   - 어드민 대시보드 → 주문 → `payment_status = approved` 인지

### 1-2. 가상계좌 입금 콜백 테스트
1. 1000원 상품을 가상계좌로 결제
2. 발급된 가상계좌에 입금 (테스트 가능하면)
3. **확인**:
   - 토스 웹훅이 도착해서 주문 상태가 `PAID` 로 바뀌는지
   - Cloudflare → ur-live → Logs 에 `[WEBHOOK]` 정상 로그 (서명 검증 통과) 보이는지

### 1-3. 결제 취소 테스트
1. 위 1-1 의 주문을 어드민/셀러가 취소
2. **확인**:
   - 토스 부분/전체 환불이 호출됐는지
   - 주문 상태가 `CANCELLED` 또는 `REFUNDED` 로 바뀌는지
   - 사용자에게 환불 알림 발송됐는지

### 1-4. 웹훅 서명 검증 동작 확인
- Cloudflare Logs 에 `[WEBHOOK] ❌ INVALID_SIGNATURE` 가 안 떠야 함
- 떠있다면 → Cloudflare 의 `TOSS_WEBHOOK_SECRET` 값이 토스 보안 키와 일치하는지 재확인

---

## 2. 마이그레이션 적용 상태 확인 (5분)

이번 세션에 추가된 마이그레이션 0207~0222 (총 16개) 가 D1 에 적용됐는지.

### 어드민 토큰 발급
1. live.ur-team.com/admin/login 으로 어드민 로그인
2. 브라우저 DevTools (F12) → Console:
   ```js
   localStorage.getItem('admin_token')
   ```
3. 출력된 긴 문자열 복사 (Bearer 접두 X)

### 검증 호출 (PowerShell)
```powershell
$token = "여기에_어드민_토큰_붙여넣기"
curl.exe -H "Authorization: Bearer $token" https://live.ur-team.com/api/_internal/migration-status | ConvertFrom-Json | ConvertTo-Json -Depth 5
```

### 결과 해석
| 결과 | 의미 |
|---|---|
| `summary.missing: 0` | ✅ 모두 적용됨 — OK |
| `summary.missing: 1~20` | ❌ 일부 미적용 → 아래 응급 처치 |

### 응급 처치 (미적용 시)
```powershell
$token = "여기에_어드민_토큰_붙여넣기"
curl.exe -X GET -H "Authorization: Bearer $token" https://live.ur-team.com/api/_internal/repair-schema
```
→ 멱등 ALTER/CREATE TABLE IF NOT EXISTS 일괄 실행. 이미 적용된 건 skip.

> ⚠️ **본격 해결**: D1 권한 받아 `wrangler d1 execute toss-live-commerce-db --remote --file=migrations/02XX_*.sql` 한 번씩 실행 권장. 영구 해결.

---

## 3. TikTok 통합 활성화 (선택)

이번 세션에 TikTok Tier 1 코드를 다 넣었지만 **운영 활성화는 키 등록 필요**.

### 3-1. TikTok for Developers 앱 등록
1. https://developers.tiktok.com 로그인
2. **Manage apps** → **Create an app**
3. 입력:
   - App name: `urteam-live`
   - Redirect URI: `https://live.ur-team.com/seller/tiktok/callback`
   - Scopes: `user.info.basic`, `user.info.profile`, `video.list`
4. 발급된 **Client Key**, **Client Secret** 복사

### 3-2. Cloudflare 등록
- ur-live → Settings → Variables and Secrets → Add (둘 다 Type: Secret)
  - `TIKTOK_CLIENT_KEY` = 위 Client Key
  - `TIKTOK_CLIENT_SECRET` = 위 Client Secret

### 3-3. 재배포
```cmd
git commit --allow-empty -m "deploy: enable TikTok integration"
git push origin main
```

### 3-4. 테스트
- 셀러 대시보드 → "외부 채널 연동" → TikTok 연동 시도
- 정상 동작하면 비디오 자동 sync cron 도 활성 (월요일 00:00 UTC)

> 활성화 안 하면 TikTok 관련 cron 은 graceful skip 됨 (kill switch + try/catch). 서비스 영향 0.

---

## 4. Cloudflare 유령 프로젝트 정리 (1시간, 권장)

`TECHNICAL_DEBT.md` TD-003 — 잘못 만들어진 부수 프로젝트들이 트래픽 빨아당겨 사고 재발 위험.

### 점검 대상
1. https://dash.cloudflare.com → Workers & Pages
2. **Workers** 탭에 `ur-live` (Worker, NOT Pages) 가 있는지 확인
   - Pages 와 별개의 Worker 가 있다면 → **Custom Domain 분리 후 삭제**
3. `ur-live-global`, `ur-live-cleanup-cron` 같은 부수 프로젝트
   - **Build 실패 49일 이상 이면 삭제 후보**

### 안전 절차
1. 의심 프로젝트 클릭 → Settings → **Custom Domains** 확인
   - `live.ur-team.com` 또는 다른 운영 도메인이 붙어있으면 **절대 삭제 금지**
   - 도메인 없거나 `*.workers.dev` 만 있으면 삭제해도 안전
2. **Disconnect GitHub** 먼저 (자동 재배포 끊기)
3. 1주일 관찰 → 문제 없으면 **Delete project**

> 실수 위험 큼. 자신 없으면 Cloudflare 지원팀 문의 권장.

---

## 5. 사용자 재로그인 안내 (2분)

JWT_SECRET 회전으로 모든 세션이 무효화됨. 사용자가 다음 접속 시:
- 브라우저 자동: 401 인터셉터가 강제 로그아웃 + alert (코드에 이미 있음)
- 신규 추가: 페이지 진입 시 **하단 파란 배너** "🔒 보안 업데이트 안내" 한 번 표시 후 dismiss 가능 (이번 커밋에 추가됨)

추가 안내 채널:
- 알림톡 (있는 경우): "보안 업데이트로 인해 다시 로그인이 필요합니다."
- 카카오 채널 / 인스타 공지 / 이메일 뉴스레터

---

## 6. (선택) `REGION` 변수 등록

`/api/health` 응답에 `region: "unknown"` 나오는 거 정리:
- Cloudflare → Variables and Secrets → Add
- Type: **Plain text**, Name: `REGION`, Value: `KR`

기능 영향 0, cosmetic.

---

## 체크리스트 요약

| 항목 | 우선순위 | 시간 | 상태 |
|---|---|---|---|
| 결제 실제 흐름 검증 (1000원) | 🔴 즉시 | 30분 | ⏳ |
| 마이그레이션 적용 확인 | 🔴 오늘 | 5분 | ⏳ |
| 사용자 재로그인 안내 (알림톡) | 🟡 오늘 | 30분 | ⏳ |
| Cloudflare 유령 프로젝트 점검 | 🟡 이번 주 | 1시간 | ⏳ |
| TikTok 키 등록 + 활성화 | 🟢 선택 | 30분 | ⏳ |
| `REGION` 변수 등록 | ⚪ 선택 | 1분 | ⏳ |

---

## 막힐 때 참고

- 시크릿 메뉴 위치: `dash.cloudflare.com` → Workers & Pages → ur-live → Settings → Variables and Secrets
- 토스 보안 키: https://app.tosspayments.com → 개발 → API 키 → 라이브 → API 개별 연동 키 (`urteamizy1`) → 보안 키
- 토스 웹훅 URL: `https://live.ur-team.com/api/payments/webhook`
- 어드민 로그인: live.ur-team.com/admin/login
- 실시간 로그: Cloudflare → ur-live → Logs → Begin log stream
