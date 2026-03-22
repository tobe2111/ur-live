# Firebase 프로덕션 배포 최종 체크리스트

## ✅ 완료된 작업

### 1. Firebase 설정
- [x] Firebase 프로젝트 생성: `urteam-live-commerce-5b284`
- [x] Realtime Database 활성화
- [x] Database URL: `https://urteam-live-commerce-5b284-default-rtdb.asia-southeast1.firebasedatabase.app`
- [x] 보안 규칙 설정: 읽기/쓰기 모두 허용

### 2. 코드 통합
- [x] Firebase SDK 설치 (`firebase`, `firebase-admin`)
- [x] Frontend 설정: `src/lib/firebase-config.ts`
- [x] React Hooks: `src/hooks/useFirebaseStream.ts`
- [x] Server API: `src/lib/firebase-admin.ts`
- [x] LivePageV2 통합 완료

### 3. 환경 변수 설정
- [x] 로컬 개발: `.dev.vars` 파일 설정
- [x] 프로덕션: Cloudflare Pages 환경 변수 설정
  - FIREBASE_DATABASE_URL
  - FIREBASE_API_KEY
  - FIREBASE_PROJECT_ID
  - FIREBASE_PRIVATE_KEY
  - FIREBASE_CLIENT_EMAIL

### 4. GitHub & 배포
- [x] 코드 커밋: `436159e`
- [x] GitHub 푸시 완료
- [x] Cloudflare Pages 자동 배포 대기 중

---

## 🚀 다음 단계

### 1. 배포 상태 확인
Cloudflare Dashboard에서 확인:
👉 https://dash.cloudflare.com → Workers & Pages → ur-live → Deployments

**확인 사항:**
- Commit: `436159e` (feat: Add Firebase Realtime Database integration...)
- Status: Building → Success → Live
- 빌드 시간: 약 3-5분

### 2. 환경 변수 적용 확인
배포 완료 후, 환경 변수가 적용되었는지 확인:
- Deployments → 최신 배포 클릭 → "View build logs"
- 로그에서 "Environment variables" 섹션 확인

### 3. 프로덕션 테스트
배포 완료 후:

**3-1. 라이브 페이지 테스트:**
```
URL: https://live.ur-team.com/live/1
```

**3-2. 브라우저 Console 확인 (F12):**
```
예상 로그:
✅ Firebase initialized successfully
🔥 Firebase: Subscribing to stream 1...
✅ Firebase: Listener attached to stream 1
```

**3-3. Firebase Console에서 데이터 확인:**
```
URL: https://console.firebase.google.com/project/urteam-live-commerce-5b284/database
```

### 4. 실시간 업데이트 테스트
**테스트 시나리오:**

1. Firebase Console에서 테스트 데이터 생성:
   ```
   경로: streams/stream1
   데이터:
   {
     "id": 1,
     "title": "테스트 라이브",
     "status": "live",
     "current_product_id": 101,
     "viewer_count": 50,
     "updated_at": 1740636000000
   }
   ```

2. 라이브 페이지에서 즉시 반영 확인 (0.2초 이내)

3. Firebase Console에서 `viewer_count` 값 변경: `50` → `100`

4. 라이브 페이지가 자동으로 업데이트되는지 확인

---

## 📊 예상 성능

| 지표 | 기존 (Polling) | 새로운 (Firebase) | 개선율 |
|------|---------------|------------------|--------|
| **재고 업데이트** | 3초 | 0.2초 | **93% ↓** |
| **상품 변경** | 3초 | 0.2초 | **93% ↓** |
| **API 호출** | 2,000회/분 | 0회 | **100% ↓** |
| **Workers CPU** | 1,500 요청 | 10 요청 | **99% ↓** |
| **월 비용** | ~$20 | ~$0 | **100% ↓** |

---

## 🐛 문제 해결

### 빌드 실패 시:
1. Cloudflare Dashboard → Deployments → View build logs
2. 에러 메시지 확인
3. 필요 시 GitHub에서 다시 푸시

### Firebase 연결 실패 시:
1. 브라우저 Console 에러 확인
2. Firebase 보안 규칙 재확인
3. 환경 변수 값 재확인

### 실시간 업데이트 안 될 시:
1. Firebase Console에서 데이터 존재 확인
2. 브라우저 Network 탭에서 WebSocket 연결 확인
3. Console에서 Firebase 리스너 로그 확인

---

## 📝 배포 완료 후 확인 사항

- [ ] Cloudflare Pages 배포 성공 (Status: Live)
- [ ] 환경 변수 적용 확인
- [ ] 프로덕션 URL 접근 가능: https://live.ur-team.com
- [ ] Firebase 초기화 로그 확인
- [ ] 실시간 리스너 작동 확인
- [ ] 테스트 데이터 실시간 반영 확인

---

**다음 단계:** Cloudflare Dashboard에서 배포 상태를 확인하고 결과를 알려주세요!
