# 카카오싱크 구현 검토 보고서

**검토일**: 2026-02-06  
**프로젝트**: toss-live-commerce  
**검토 기준**: [카카오싱크 개발 가이드](https://developers.kakao.com/docs/latest/ko/kakaosync/dev-guide)

---

## 📋 체크리스트 검토 결과

### ✅ 필수 구현 기능

#### 1. 카카오 로그인
| 항목 | 상태 | 구현 위치 | 비고 |
|------|------|----------|------|
| 카카오 로그인 구현 | ✅ | `public/static/live.html` (L405-410) | `Kakao.Auth.authorize()` 사용 |
| 사용자 정보 조회 | ✅ | `src/index.tsx` (L464-477) | `/v2/user/me` API 호출 |
| 리다이렉트 URI 설정 | ✅ | 환경 변수 `KAKAO_REDIRECT_URI` | `/auth/kakao/sync/callback` |
| OAuth 토큰 교환 | ✅ | `src/index.tsx` (L432-457) | `/oauth/token` API 호출 |

#### 2. 간편가입
| 항목 | 상태 | 구현 위치 | 비고 |
|------|------|----------|------|
| 서비스 약관 동의 내역 조회 | ❌ | 미구현 | **필수 구현 필요** |
| 사용자 정보 저장 | ✅ | `src/index.tsx` (L494-524) | DB에 저장 |
| 회원 가입 처리 | ✅ | `src/index.tsx` (L519-523) | 신규 사용자 INSERT |
| 기존 회원 정보 갱신 | ✅ | `src/index.tsx` (L510-515) | UPDATE 처리 |

---

## ⚠️ 발견된 문제점

### 🔴 심각 (Critical) - 즉시 수정 필요

#### 1. **서비스 약관 동의 내역 조회 미구현**
- **문제**: 카카오싱크 필수 기능인 서비스 약관 동의 내역 조회가 구현되지 않음
- **영향**: 사용자가 어떤 서비스 약관에 동의했는지 확인 불가
- **해결책**: `/v2/user/service_terms` API 호출 추가 필요

```typescript
// 필요한 구현
const termsResponse = await fetch('https://kapi.kakao.com/v2/user/service_terms', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### 2. **연결 해제 처리 미구현**
- **문제**: 회원 탈퇴 시 카카오 연결 해제 API 호출 없음
- **영향**: 사용자가 재가입 시 약관 동의를 다시 받지 못함
- **해결책**: 회원 탈퇴 시 `/v1/user/unlink` API 호출 추가

```typescript
// 필요한 구현
app.post('/api/user/unlink', async (c) => {
  // 1. Kakao 연결 해제
  await fetch('https://kapi.kakao.com/v1/user/unlink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  // 2. 서비스 DB에서 사용자 삭제
  // ...
});
```

#### 3. **연결 해제 알림(Webhook) 미구현**
- **문제**: 사용자가 카카오계정 관리 페이지에서 직접 연결 해제 시 알림 받지 못함
- **영향**: 서비스 DB와 카카오 연결 상태 불일치 발생
- **해결책**: Webhook 엔드포인트 구현 필요

```typescript
// 필요한 구현
app.post('/webhooks/kakao/unlink', async (c) => {
  const { user_id } = await c.req.json();
  // DB에서 사용자 삭제 또는 비활성화
});
```

---

### 🟡 중요 (High) - 빠른 시일 내 수정 권장

#### 4. **Kakao JS SDK 하드코딩**
- **문제**: `live.html`에 JavaScript 키가 하드코딩됨
```javascript
Kakao.init('975a2e7f97254b08f15dba4d177a2865');  // ❌ 하드코딩
```
- **해결책**: 환경 변수로 주입
```javascript
Kakao.init(window.KAKAO_JS_KEY || '975a2e7f97254b08f15dba4d177a2865');  // ✅
```
- **구현 필요**: `src/index.tsx`에서 `/live/:id` 라우트에 환경 변수 주입

#### 5. **로그아웃 기능 미구현**
- **문제**: 사용자가 로그아웃할 수 있는 기능 없음
- **영향**: 보안 문제 (다른 사용자가 로그인 상태 유지)
- **해결책**: 로그아웃 버튼 및 API 추가

```typescript
// 필요한 구현
app.post('/api/auth/logout', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  // 세션 삭제
  await DB.prepare('DELETE FROM admin_sessions WHERE session_token = ?')
    .bind(sessionToken).run();
  return c.json({ success: true });
});
```

#### 6. **세션 관리 불완전**
- **문제**: 
  - 세션이 `admin_sessions` 테이블에 저장되나 `user_type='user'`로만 저장
  - `user_id` 외래키가 설정되지 않음
- **해결책**: 세션 테이블 구조 개선 및 user_id 연결

```sql
-- 현재 구조
INSERT INTO admin_sessions (session_token, user_type, expires_at) 
VALUES (?, ?, ?)

-- 개선 필요
INSERT INTO admin_sessions (session_token, user_id, user_type, expires_at) 
VALUES (?, ?, ?, ?)
```

#### 7. **"카카오계정으로 정보 수집 후 제공" 미사용**
- **문제**: 필수 정보가 누락될 경우 회원 가입 실패 가능
- **영향**: 닉네임, 이메일 등이 없을 때 가입 실패
- **현재 상태**: 폴백 값 사용 중 (`'Kakao User'`, `''`)
- **권장**: 카카오 개발자 콘솔에서 "카카오계정으로 정보 수집 후 제공" 활성화

---

### 🟢 권장 (Medium) - 개선 권장

#### 8. **에러 메시지 개선**
- **문제**: 에러 발생 시 리다이렉트 URL에 에러 정보만 전달
```javascript
return c.redirect(`${state}?error=kakao_oauth_${error}`);
```
- **개선**: 사용자 친화적 에러 페이지 또는 토스트 메시지

#### 9. **카카오톡 간편로그인 미사용**
- **문제**: `throughTalk: false` 설정으로 카카오톡 간편로그인 비활성화
```javascript
Kakao.Auth.authorize({
  redirectUri: redirectUri,
  state: currentPath,
  throughTalk: false  // ❌ 카카오톡 간편로그인 비활성화
});
```
- **권장**: `throughTalk: true`로 변경하여 모바일 사용자 경험 개선

#### 10. **사용자 ID 관리 개선**
- **문제**: `toss_user_id`와 `kakao_id`를 동일하게 저장
```typescript
'INSERT INTO users (toss_user_id, kakao_id, name, email, profile_image) 
VALUES (?, ?, ?, ?, ?)'
).bind(kakaoId, kakaoId, nickname, email, profileImage)
```
- **권장**: `toss_user_id`는 자체 서비스 ID, `kakao_id`는 카카오 ID로 분리

---

## 🔍 추가 확인 필요 사항

### 1. **카카오 개발자 콘솔 설정**
다음 항목이 카카오 개발자 콘솔에 올바르게 설정되어 있는지 확인 필요:

- [ ] **간편가입 활성화**: [카카오 로그인] > [간편가입] 설정이 ON
- [ ] **서비스 약관 등록**: 이용약관, 개인정보처리방침 등이 등록되어 있는지
- [ ] **동의항목 설정**: [카카오 로그인] > [동의항목]에 필요한 정보가 등록되어 있는지
  - 닉네임 (필수)
  - 이메일 (선택 권장)
  - 프로필 이미지 (선택)
- [ ] **리다이렉트 URI 등록**: `https://live.ur-team.com/auth/kakao/sync/callback`
- [ ] **카카오톡 채널 연결**: 서비스 카카오톡 채널이 앱에 연결되어 있는지

### 2. **환경 변수 확인**
- [x] `KAKAO_REST_API_KEY`: ✅ 설정됨
- [x] `KAKAO_REDIRECT_URI`: ✅ 설정됨
- [x] `KAKAO_JS_KEY`: ✅ 설정됨
- [ ] ~~`KAKAO_ADMIN_KEY`~~: Webhook 구현 시 필요

---

## 📊 종합 평가

### 현재 구현 수준: **60% 완료**

| 카테고리 | 점수 | 비고 |
|---------|------|------|
| 카카오 로그인 | 85% | ✅ 기본 로그인 흐름 완성 |
| 간편가입 | 40% | ❌ 서비스 약관 동의 내역 조회 미구현 |
| 연결 관리 | 0% | ❌ 연결 해제, Webhook 미구현 |
| 세션 관리 | 70% | ⚠️ 로그아웃 기능 없음 |
| 보안 | 60% | ⚠️ JS SDK 키 하드코딩 |
| 사용자 경험 | 50% | ⚠️ 에러 처리 개선 필요 |

---

## 🚀 우선순위별 수정 계획

### 🔥 Phase 1: 즉시 수정 (1-2일)
1. ✅ **서비스 약관 동의 내역 조회 API 구현**
2. ✅ **연결 해제 API 구현**
3. ✅ **로그아웃 기능 구현**
4. ✅ **Kakao JS SDK 환경 변수 주입**

### 🎯 Phase 2: 빠른 시일 내 (3-5일)
5. ✅ **연결 해제 Webhook 구현**
6. ✅ **세션 관리 개선**
7. ✅ **에러 페이지/토스트 메시지 개선**

### 💡 Phase 3: 개선 (1-2주)
8. ✅ **카카오톡 간편로그인 활성화**
9. ✅ **사용자 ID 관리 개선**
10. ✅ **카카오계정 정보 수집 후 제공 활성화**

---

## 📝 권장 사항

### 1. **카카오싱크 신청 전 필수 체크리스트**
- [ ] 서비스 약관 동의 내역 조회 API 구현
- [ ] 연결 해제 API 구현
- [ ] 연결 해제 Webhook 구현
- [ ] 로그아웃 기능 구현
- [ ] 카카오 개발자 콘솔 설정 완료

### 2. **테스트 시나리오**
- [ ] 신규 회원 가입 테스트
- [ ] 기존 회원 로그인 테스트
- [ ] 회원 정보 갱신 테스트
- [ ] 회원 탈퇴 및 연결 해제 테스트
- [ ] 로그아웃 테스트
- [ ] 재로그인 테스트

### 3. **문서화**
- [ ] API 문서 작성 (Swagger/OpenAPI)
- [ ] 개발자 가이드 작성
- [ ] 트러블슈팅 가이드 작성

---

## 🔗 참고 문서

- [카카오싱크 개발 가이드](https://developers.kakao.com/docs/latest/ko/kakaosync/dev-guide)
- [카카오 로그인 REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [서비스 약관 동의 내역 조회](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#terms)
- [연결 해제](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#unlink)
- [연결 해제 알림](https://developers.kakao.com/docs/latest/ko/kakaologin/callback#unlink)

---

**검토자**: AI Assistant  
**최종 업데이트**: 2026-02-06
