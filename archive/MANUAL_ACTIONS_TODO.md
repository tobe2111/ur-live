# 🔒 보안 강화 완료 - 수동 조치 필요 사항

**날짜**: 2026-03-17  
**상태**: 자동화 조치 완료, 수동 조치 대기 중

---

## 🔴 긴급 조치 필요 (즉시)

### 1. Toss Payments LIVE Secret Key 순환
**우선순위**: 🔴 **최우선**  
**소요 시간**: 10분

**단계**:
```bash
# 1. Toss 대시보드 접속
https://developers.toss.im

# 2. 로그인 → 개발자 센터 → API 키 관리

# 3. 기존 LIVE 키 폐기
기존 키: sk_live_Rk5xZE4K8zRk5nJ5aG2z
→ "폐기" 버튼 클릭

# 4. 새 LIVE Secret Key 발급
→ "새 키 발급" 클릭
→ 키 복사 (sk_live_로 시작)

# 5. Cloudflare Workers에 등록
wrangler secret put TOSS_SECRET_KEY
# → 새로 발급받은 키 입력

# 6. 배포
npm run deploy

# 7. 테스트
# → 테스트 결제 진행하여 정상 작동 확인
```

**체크리스트**:
- [ ] Toss 대시보드에서 기존 키 폐기 완료
- [ ] 새 키 발급 완료
- [ ] `wrangler secret put TOSS_SECRET_KEY` 실행 완료
- [ ] `npm run deploy` 배포 완료
- [ ] 테스트 결제 정상 작동 확인

---

### 2. Firebase API Key 제한 설정
**우선순위**: 🔴 **높음**  
**소요 시간**: 5분

**단계**:
```bash
# 1. Google Cloud Console 접속
https://console.cloud.google.com/apis/credentials

# 2. 프로젝트 선택
프로젝트: toss-live-commerce

# 3. API 키 선택
Firebase API Key 선택
```

**Application restrictions 설정**:
```
✅ HTTP referrers (web sites) 선택

Add an item:
  ✅ https://live.ur-team.com/*
  ✅ https://localhost:*/*  (로컬 개발용)
```

**API restrictions 설정**:
```
✅ Restrict key 선택

Select APIs:
  ✅ Firebase Authentication API
  ✅ Firebase Realtime Database API
  ✅ Identity Toolkit API
```

**체크리스트**:
- [ ] Google Cloud Console 접속 완료
- [ ] HTTP referrers 제한 설정 완료
- [ ] API restrictions 설정 완료
- [ ] 저장 후 변경사항 적용 확인

---

### 3. Kakao API Key 제한 설정
**우선순위**: 🔴 **높음**  
**소요 시간**: 5분

**단계**:
```bash
# 1. Kakao Developers 접속
https://developers.kakao.com

# 2. 내 애플리케이션 선택
애플리케이션: ur-live (또는 해당 앱 이름)

# 3. 플랫폼 설정
앱 설정 → 플랫폼 → Web 플랫폼
```

**사이트 도메인 설정**:
```
✅ 사이트 도메인 추가:
   https://live.ur-team.com

❌ 와일드카드 제거:
   https://* (있다면 삭제)
   http://localhost:* (개발 환경 필요시 유지 가능)
```

**체크리스트**:
- [ ] Kakao Developers 접속 완료
- [ ] 사이트 도메인 설정 완료
- [ ] 와일드카드(*) 제거 확인
- [ ] 저장 완료

---

## 🧪 기능 테스트 (조치 완료 후)

### 4. 카카오 로그인 버튼 테스트
**우선순위**: 🔴 **높음**  
**소요 시간**: 3분

**테스트 절차**:
```bash
# 1. 로그인 페이지 접속
https://live.ur-team.com/login

# 2. 카카오 로그인 버튼 확인
- 버튼에 마우스 hover
- 커서가 👆 (pointer)로 표시되는지 확인
- 🚫 (금지) 아이콘이 아니어야 함

# 3. 클릭 테스트
- 버튼 클릭
- 알림창 표시 확인
- 카카오 OAuth 페이지로 리디렉션 확인

# 4. 로그인 완료
- 카카오 계정으로 로그인
- returnUrl로 정상 복귀 확인
```

**체크리스트**:
- [ ] 커서가 pointer (👆)로 표시됨
- [ ] 버튼 클릭 시 알림창 표시됨
- [ ] 카카오 OAuth 리디렉션 정상
- [ ] 로그인 후 정상 복귀

---

### 5. 결제 시스템 테스트
**우선순위**: 🔴 **높음**  
**소요 시간**: 5분  
**전제조건**: Toss Secret Key 순환 완료 후

**테스트 절차**:
```bash
# 1. 상품 선택 및 장바구니 담기
https://live.ur-team.com → 상품 선택 → 장바구니

# 2. 결제 진행
- 체크아웃 페이지 이동
- 배송 정보 입력
- Toss Payments 위젯 로드 확인

# 3. 테스트 결제
- 테스트 카드 사용
- 결제 승인 진행
- 성공 페이지 리디렉션 확인

# 4. 주문 확인
- 마이페이지 → 주문 내역
- 주문 상태 확인
```

**체크리스트**:
- [ ] Toss Payments 위젯 정상 로드
- [ ] 테스트 결제 성공
- [ ] 결제 승인 webhook 정상 처리
- [ ] 주문 내역에 표시됨

---

### 6. Firebase 인증 테스트
**우선순위**: 🔴 **높음**  
**소요 시간**: 5분

**테스트 항목**:

**이메일 로그인**:
```bash
https://live.ur-team.com/login
- 이메일: buyer@test.com
- 비밀번호: test1234!
- 로그인 성공 확인
```

**Google 로그인**:
```bash
- Google 로그인 버튼 클릭
- Google 계정 선택
- 로그인 성공 확인
```

**세션 유지**:
```bash
- 로그인 후 새로고침 (F5)
- 로그인 상태 유지 확인
- 다른 탭에서도 로그인 상태 확인
```

**체크리스트**:
- [ ] 이메일 로그인 정상 작동
- [ ] Google 로그인 정상 작동
- [ ] 세션 유지 정상
- [ ] 멀티탭 동기화 정상

---

## 🟢 선택적 조치 (시간 여유 있을 때)

### 7. Git History 정리
**우선순위**: 🟢 **낮음**  
**소요 시간**: 20분  
**주의**: 강제 push 필요, 팀 조율 필수

**단계**:
```bash
# ⚠️ WARNING: 이 작업은 Git history를 재작성합니다
# 팀원들과 조율 후 진행하세요

# 1. .env 파일들의 모든 기록 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env .env.kr .env.global .env.production" \
  --prune-empty --tag-name-filter cat -- --all

# 2. src-backup-hono의 모든 기록 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch -r src-backup-hono" \
  --prune-empty --tag-name-filter cat -- --all

# 3. Git reflog 정리
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. 강제 push (팀 조율 후)
git push origin --force --all
git push origin --force --tags

# 5. 팀원들에게 알림
# 팀원들은 로컬 저장소를 다시 clone해야 합니다
```

**체크리스트**:
- [ ] 팀 조율 완료
- [ ] Git history 정리 완료
- [ ] 강제 push 완료
- [ ] 팀원들에게 알림 전송
- [ ] 팀원들 로컬 저장소 재동기화 확인

---

## 🟡 중기 조치 (1주일 내)

### 8. Secret 순환 정책 수립
**우선순위**: 🟡 **중간**  
**소요 시간**: 10분

**Google Calendar 일정 등록**:
```
📅 2026-06-15 (90일 후)
제목: [보안] API 키 순환 - Firebase, Kakao
내용:
- Firebase API Key 순환
- Kakao REST API Key 순환
- Google Cloud Console에서 새 키 발급
- Kakao Developers에서 새 키 발급
반복: 90일마다

📅 2026-09-15 (180일 후)
제목: [보안] JWT Secret 순환
내용:
- JWT Secret 재생성: openssl rand -hex 32
- wrangler secret put JWT_SECRET
- 배포 및 테스트
반복: 180일마다
```

**체크리스트**:
- [ ] Google Calendar에 API 키 순환 일정 등록
- [ ] JWT Secret 순환 일정 등록
- [ ] 알림 설정 (7일 전)
- [ ] 담당자 지정

---

### 9. Google Cloud 필수 연락처 설정
**우선순위**: 🟡 **중간**  
**소요 시간**: 5분

**단계**:
```bash
# 1. Google Cloud Console 접속
https://console.cloud.google.com/iam-admin/settings

# 2. Essential Contacts 설정
- 프로젝트 선택: toss-live-commerce
- Essential Contacts → Add
```

**추가할 연락처**:
```
✅ Security notifications:
   - 이메일: tobe2111@naver.com
   - 이메일: jiwon@ur-team.com

✅ Billing notifications:
   - 이메일: tobe2111@naver.com
   - 이메일: jiwon@ur-team.com

✅ Technical notifications:
   - 이메일: jiwon@ur-team.com
```

**체크리스트**:
- [ ] Essential Contacts 설정 완료
- [ ] 이메일 확인 완료
- [ ] 테스트 알림 수신 확인

---

### 10. 결제 이상 및 예산 알림 설정
**우선순위**: 🟡 **중간**  
**소요 시간**: 10분

**결제 이상 알림 설정**:
```bash
# Google Cloud Console
https://console.cloud.google.com/billing/alerts

# 1. 예산 생성
- 이름: ur-live 월간 예산
- 금액: $100 (조정 가능)
- 알림 임계값: 50%, 90%, 100%

# 2. 알림 대상
- 이메일: tobe2111@naver.com, jiwon@ur-team.com
```

**이상 사용량 모니터링**:
```bash
# 1. Cloud Monitoring 설정
https://console.cloud.google.com/monitoring

# 2. Alert Policy 생성
- API 호출 급증 (평소 대비 300% 이상)
- Firebase Auth 요청 급증
- Database 쿼리 급증
```

**체크리스트**:
- [ ] 월간 예산 설정 완료
- [ ] 알림 임계값 설정 완료
- [ ] 이메일 알림 대상 추가 완료
- [ ] Cloud Monitoring alert 설정 완료

---

## 📊 진행 상황 체크리스트

### 긴급 조치 (즉시)
- [ ] 1. Toss Payments LIVE Secret Key 순환
- [ ] 2. Firebase API Key 제한 설정
- [ ] 3. Kakao API Key 제한 설정

### 기능 테스트
- [ ] 4. 카카오 로그인 버튼 테스트
- [ ] 5. 결제 시스템 테스트
- [ ] 6. Firebase 인증 테스트

### 선택적 조치
- [ ] 7. Git History 정리

### 중기 조치
- [ ] 8. Secret 순환 정책 수립
- [ ] 9. Google Cloud 필수 연락처 설정
- [ ] 10. 결제 이상 및 예산 알림 설정

---

## 📞 문의 및 지원

**문서 참조**:
- `SECURITY_AUDIT_REPORT.md` - 전체 감사 보고서
- `SECRET_MANAGEMENT.md` - 보안 관리 가이드
- `.env.example` - 환경 변수 템플릿

**긴급 문의**:
- Toss Payments: https://developers.toss.im
- Firebase: https://console.firebase.google.com
- Kakao: https://developers.kakao.com

---

**생성일**: 2026-03-17  
**상태**: ✅ 자동화 조치 완료, ⏳ 수동 조치 대기 중
