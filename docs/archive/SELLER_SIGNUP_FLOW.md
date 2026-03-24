# 셀러 회원가입 플로우 분석 (2026-02-19)

## 📝 현재 셀러 회원가입 플로우

### 1단계: 회원가입 페이지 접속
- **URL**: `/seller/register`
- **페이지**: `SellerRegisterPage.tsx`

### 2단계: 회원가입 폼 작성
**필수 입력 항목**:
- 이메일 (email) *
- 비밀번호 (password, 6자 이상) *
- 비밀번호 확인 (passwordConfirm) *
- 이름 (name) *
- 전화번호 (phone) *
- 회사명 (company_name) *
- 사업자등록번호 (business_number) *

### 3단계: API 호출
- **엔드포인트**: `POST /api/seller/register`
- **처리 로직**:
  ```typescript
  1. 유효성 검증
     - 필수 항목 체크
     - 비밀번호 6자 이상
     - 이메일 중복 체크
  
  2. 셀러 계정 생성
     - username: email의 @ 앞부분 자동 생성
     - password_hash: 간단한 해시 저장 (placeholder)
     - status: 'pending' (관리자 승인 대기)
     - is_active: 1
  
  3. DB 저장
     INSERT INTO sellers (
       username, email, password_hash, name, phone,
       business_number, company_name, status, is_active,
       created_at, updated_at
     )
  ```

### 4단계: 가입 완료
- **알림 메시지**: "회원가입이 완료되었습니다! 관리자 승인 후 로그인할 수 있습니다."
- **리다이렉트**: `/seller/login`
- **승인 대기 시간**: 안내문구에는 "1-2일" 표시

## ⚠️ 현재 문제점 및 개선사항

### 1. **보안 문제**
**문제**:
- 비밀번호가 `placeholder_hash_for_${password}` 형태로 저장됨
- 실제 해시 알고리즘 미적용

**개선 필요**:
- bcrypt 또는 crypto.subtle.digest 사용
- 솔트(salt) 추가

### 2. **승인 프로세스 부재**
**문제**:
- 관리자 승인 기능이 구현되어 있지 않음
- status가 'pending'인 셀러는 로그인 불가
- 승인 알림 시스템 없음

**개선 필요**:
- 관리자 페이지에서 셀러 승인 기능 추가
- 승인/거부 시 이메일 알림
- 승인 히스토리 기록

### 3. **대량 가입 대응 부족**
**문제**:
- 가입 시 이메일 인증 없음
- 스팸 방지 기능 없음 (CAPTCHA 등)
- Rate Limiting 없음

**개선 필요**:
- 이메일 인증 토큰 발송
- CAPTCHA 또는 Turnstile (Cloudflare) 추가
- Rate Limiting (IP당 10분에 3회 등)
- 중복 사업자등록번호 체크

### 4. **사업자 정보 검증 부족**
**문제**:
- 사업자등록번호 형식 검증 없음
- 실제 사업자 여부 확인 없음
- 전화번호 형식 검증 없음

**개선 필요**:
- 사업자등록번호 형식 검증 (000-00-00000)
- 국세청 API 연동 (선택사항)
- 전화번호 자동 하이픈 추가

### 5. **사용자 경험 개선**
**문제**:
- 승인 대기 중 상태 확인 불가
- 승인 여부 알림 없음
- 가입 후 다음 단계 안내 부족

**개선 필요**:
- 승인 상태 확인 페이지
- 이메일 알림 시스템
- 가입 완료 후 가이드 제공

## 🔥 긴급 개선 필요 사항

### 우선순위 1: 관리자 승인 시스템
```typescript
// 필요 기능:
1. 관리자 페이지에서 pending 셀러 목록 조회
2. 승인/거부 버튼
3. 승인 시 status를 'approved'로 변경
4. 알림 발송 (이메일 또는 시스템 알림)
```

### 우선순위 2: 이메일 인증
```typescript
// 필요 기능:
1. 가입 시 인증 토큰 생성
2. 이메일 발송 (verification link)
3. 토큰 검증 API
4. 인증 완료 후 승인 대기
```

### 우선순위 3: Rate Limiting
```typescript
// 필요 기능:
1. IP 기반 Rate Limiting
2. 동일 이메일 재가입 방지 (24시간)
3. CAPTCHA/Turnstile 추가
```

## 🎯 권장 개선 플로우

### 개선된 회원가입 플로우:
```
1. 회원가입 폼 작성
   ↓
2. CAPTCHA 검증 (Cloudflare Turnstile)
   ↓
3. Rate Limiting 체크 (IP당 10분에 3회)
   ↓
4. 이메일 인증 토큰 발송
   ↓
5. 사용자가 이메일에서 링크 클릭
   ↓
6. 이메일 인증 완료 → status: 'email_verified'
   ↓
7. 관리자 승인 대기 알림
   ↓
8. 관리자가 사업자 정보 확인 후 승인
   ↓
9. 승인 완료 알림 발송 → status: 'approved'
   ↓
10. 로그인 가능
```

## 📊 데이터베이스 개선 필요

### sellers 테이블에 추가 필요한 컬럼:
```sql
-- 이메일 인증
ALTER TABLE sellers ADD COLUMN email_verified BOOLEAN DEFAULT 0;
ALTER TABLE sellers ADD COLUMN email_verification_token TEXT;
ALTER TABLE sellers ADD COLUMN email_verified_at DATETIME;

-- 승인 정보
ALTER TABLE sellers ADD COLUMN rejection_reason TEXT;
ALTER TABLE sellers ADD COLUMN approved_by INTEGER;  -- 이미 존재
ALTER TABLE sellers ADD COLUMN approved_at DATETIME;  -- 이미 존재

-- Rate Limiting
ALTER TABLE sellers ADD COLUMN last_signup_ip TEXT;
ALTER TABLE sellers ADD COLUMN signup_attempts INTEGER DEFAULT 0;
```

## 🚨 보안 권고사항

1. **비밀번호 해시**: bcrypt 또는 Web Crypto API 사용
2. **이메일 인증**: 필수 구현
3. **CAPTCHA**: Cloudflare Turnstile 추가
4. **Rate Limiting**: Cloudflare Workers Rate Limiting API 사용
5. **사업자 정보 검증**: 국세청 API 연동 (선택)

---

**작성일**: 2026-02-19
**작성자**: AI Developer
**상태**: 분석 완료 - 개선 필요
