# 🔐 프로덕션 환경변수 체크리스트

## 현재 상태 (2026-02-25)

### ✅ 설정 완료된 환경변수 (3개)
| 변수명 | 설명 | 필수도 | 상태 |
|-------|------|--------|------|
| JWT_SECRET | JWT 토큰 암호화 키 | 🔴 필수 | ✅ 설정됨 |
| TOSS_SECRET_KEY | Toss Payments 비밀 키 | 🔴 필수 | ✅ 설정됨 |
| TOSS_CLIENT_KEY | Toss Payments 클라이언트 키 | 🔴 필수 | ✅ 설정됨 |

---

## 🔴 필수 환경변수 (추가 설정 필요)

### 1. 알림톡 시스템
| 변수명 | 설명 | 현재 상태 | 설정 방법 |
|-------|------|----------|----------|
| KAKAO_REST_API_KEY | 카카오 REST API 키 | ⚠️ 미설정 | `npx wrangler pages secret put KAKAO_REST_API_KEY --project-name ur-live` |
| ALIMTALK_SENDER_KEY | 알림톡 발신 프로필 키 | ⚠️ 미설정 | `npx wrangler pages secret put ALIMTALK_SENDER_KEY --project-name ur-live` |
| ALIMTALK_PROFILE_KEY | 알림톡 프로필 키 | ⚠️ 미설정 | `npx wrangler pages secret put ALIMTALK_PROFILE_KEY --project-name ur-live` |

**참고**: 알림톡 없이도 서비스 운영은 가능하지만, 주문 확인 알림이 발송되지 않습니다.

---

## 🟡 권장 환경변수 (선택사항)

### 2. 이메일 알림 (Resend)
| 변수명 | 설명 | 현재 상태 | 설정 방법 |
|-------|------|----------|----------|
| RESEND_API_KEY | Resend 이메일 API 키 | ⚠️ 미설정 | `npx wrangler pages secret put RESEND_API_KEY --project-name ur-live` |
| EMAIL_FROM | 발신 이메일 주소 | ⚠️ 미설정 | `npx wrangler pages secret put EMAIL_FROM --project-name ur-live` |

**권장 값**: `EMAIL_FROM="UR Live <noreply@ur-team.com>"`

### 3. YouTube Live API
| 변수명 | 설명 | 현재 상태 | 설정 방법 |
|-------|------|----------|----------|
| YOUTUBE_API_KEY | YouTube Data API v3 키 | ⚠️ 미설정 | `npx wrangler pages secret put YOUTUBE_API_KEY --project-name ur-live` |
| YOUTUBE_ACCESS_TOKEN | YouTube OAuth 액세스 토큰 | ⚠️ 미설정 | `npx wrangler pages secret put YOUTUBE_ACCESS_TOKEN --project-name ur-live` |

**참고**: YouTube Live 생성/종료 기능에 필요

---

## 🔵 선택 환경변수 (고급 기능)

### 4. 모니터링 & 로깅
| 변수명 | 설명 | 현재 상태 | 설정 방법 |
|-------|------|----------|----------|
| DISCORD_WEBHOOK_URL | 에러 알림용 Discord Webhook | ⚠️ 미설정 | `npx wrangler pages secret put DISCORD_WEBHOOK_URL --project-name ur-live` |
| STATS_SECRET_TOKEN | 통계 API 보안 토큰 | ⚠️ 미설정 | `npx wrangler pages secret put STATS_SECRET_TOKEN --project-name ur-live` |

### 5. 푸시 알림 (PWA)
| 변수명 | 설명 | 현재 상태 | 설정 방법 |
|-------|------|----------|----------|
| VAPID_PUBLIC_KEY | Web Push VAPID 공개 키 | ⚠️ 미설정 | `npx wrangler pages secret put VAPID_PUBLIC_KEY --project-name ur-live` |
| VAPID_PRIVATE_KEY | Web Push VAPID 비밀 키 | ⚠️ 미설정 | `npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name ur-live` |

---

## 🚀 설정 가이드

### 필수 환경변수 설정 (알림톡)

```bash
# 1. Kakao REST API Key
npx wrangler pages secret put KAKAO_REST_API_KEY --project-name ur-live
# 입력: (카카오 개발자 콘솔에서 발급받은 REST API 키)

# 2. 알림톡 발신 프로필 키
npx wrangler pages secret put ALIMTALK_SENDER_KEY --project-name ur-live
# 입력: (알림톡 발신 프로필 키)

# 3. 알림톡 프로필 키
npx wrangler pages secret put ALIMTALK_PROFILE_KEY --project-name ur-live
# 입력: (알림톡 프로필 키)
```

### 권장 환경변수 설정 (이메일)

```bash
# 1. Resend API Key
npx wrangler pages secret put RESEND_API_KEY --project-name ur-live
# 입력: re_xxxxxxxxxxxxxxxxxxxxxxxx

# 2. 발신 이메일 주소
npx wrangler pages secret put EMAIL_FROM --project-name ur-live
# 입력: UR Live <noreply@ur-team.com>
```

---

## 🧪 환경변수 확인 방법

### 1. Secret 목록 조회
```bash
npx wrangler pages secret list --project-name ur-live
```

### 2. 특정 환경변수 테스트
```bash
# API 엔드포인트에서 환경변수 확인 (개발용)
curl https://live.ur-team.com/api/test/env
```

**주의**: 프로덕션에서는 `GET /api/test/env` 엔드포인트를 비활성화해야 합니다!

---

## ⚠️ 보안 주의사항

### 1. 절대 Git에 커밋하지 말 것
```bash
# .gitignore에 추가됨 (확인)
echo ".env" >> .gitignore
echo ".dev.vars" >> .gitignore
```

### 2. Secret 값 변경 방법
```bash
# 기존 Secret 덮어쓰기
npx wrangler pages secret put JWT_SECRET --project-name ur-live
```

### 3. Secret 삭제 방법
```bash
# Secret 삭제 (주의!)
npx wrangler pages secret delete SOME_SECRET --project-name ur-live
```

---

## 📊 환경변수 우선순위

| 순위 | 변수 그룹 | 필수도 | 설정 상태 | 서비스 영향도 |
|-----|----------|--------|----------|------------|
| 1 | JWT + Toss Payments | 🔴 필수 | ✅ 완료 | 결제 & 인증 불가 |
| 2 | 카카오 알림톡 | 🔴 필수 | ⚠️ 미설정 | 주문 알림 미발송 |
| 3 | 이메일 알림 | 🟡 권장 | ⚠️ 미설정 | 이메일 알림 미발송 |
| 4 | YouTube Live API | 🟡 권장 | ⚠️ 미설정 | 라이브 생성 불가 |
| 5 | 모니터링 & PWA | 🔵 선택 | ⚠️ 미설정 | 부가 기능 미작동 |

---

## ✅ 런칭 전 체크리스트

### 최소 요구사항 (런칭 가능)
- [x] JWT_SECRET 설정
- [x] TOSS_SECRET_KEY 설정
- [x] TOSS_CLIENT_KEY 설정
- [ ] KAKAO_REST_API_KEY 설정 (알림톡용)

### 권장 설정 (사용자 경험 향상)
- [ ] ALIMTALK_SENDER_KEY 설정
- [ ] ALIMTALK_PROFILE_KEY 설정
- [ ] RESEND_API_KEY 설정
- [ ] EMAIL_FROM 설정

### 선택 설정 (고급 기능)
- [ ] YOUTUBE_API_KEY 설정
- [ ] DISCORD_WEBHOOK_URL 설정
- [ ] VAPID 키 설정 (PWA 푸시)

---

## 🎯 결론

### 현재 상태
- **핵심 기능 (결제/인증)**: ✅ 환경변수 완료 → 즉시 런칭 가능
- **알림 기능**: ⚠️ 환경변수 미설정 → 주문 알림 미발송
- **기타 기능**: ⚠️ 선택 사항

### 권장 사항
1. **알림톡 환경변수 즉시 설정** (5분)
2. 이메일 알림은 선택사항 (나중에 추가 가능)
3. YouTube Live API는 필요 시 설정

### 설정 예상 시간
- 알림톡: 5-10분
- 이메일: 5분
- 전체: 15-20분

---

작성일: 2026-02-25
문서 상태: 완료 ✅
