# Google OAuth 및 YouTube API 설정 가이드

## 1. Google Cloud Console 프로젝트 생성

1. https://console.cloud.google.com 접속
2. 새 프로젝트 생성: "Live Commerce Platform"
3. 프로젝트 ID 복사 (예: `live-commerce-123456`)

## 2. YouTube Data API v3 활성화

1. API 및 서비스 > 라이브러리
2. "YouTube Data API v3" 검색
3. "사용 설정" 클릭
4. "YouTube Live Streaming API"도 활성화

## 3. OAuth 동의 화면 구성

1. API 및 서비스 > OAuth 동의 화면
2. 사용자 유형: **외부** 선택
3. 앱 정보 입력:
   - 앱 이름: "우리 라이브커머스"
   - 사용자 지원 이메일: your-email@domain.com
   - 개발자 연락처 정보: your-email@domain.com

4. **범위 추가** (중요!):
   ```
   https://www.googleapis.com/auth/youtube
   https://www.googleapis.com/auth/youtube.force-ssl
   https://www.googleapis.com/auth/youtube.readonly
   ```

5. 테스트 사용자 추가 (개발 중):
   - 셀러 테스트 계정 이메일 추가

## 4. OAuth 클라이언트 ID 생성

1. API 및 서비스 > 사용자 인증 정보
2. "사용자 인증 정보 만들기" > "OAuth 클라이언트 ID"
3. 애플리케이션 유형: **웹 애플리케이션**
4. 이름: "Live Commerce Web Client"
5. **승인된 JavaScript 원본**:
   ```
   http://localhost:3000
   http://localhost:5173
   https://live.ur-team.com
   ```

6. **승인된 리디렉션 URI**:
   ```
   http://localhost:3000/auth/google/callback
   http://localhost:5173/auth/google/callback
   https://live.ur-team.com/auth/google/callback
   https://live.ur-team.com/seller/youtube/callback
   ```

7. **클라이언트 ID와 시크릿 복사** (안전하게 보관!)
   ```
   클라이언트 ID: 123456789-abcdefg.apps.googleusercontent.com
   클라이언트 시크릿: GOCSPX-xxxxxxxxxxxxxxx
   ```

## 5. 환경 변수 설정

`.env` 파일에 추가:
```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
GOOGLE_REDIRECT_URI=https://live.ur-team.com/auth/google/callback

# YouTube API
YOUTUBE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX (선택사항)
```

## 6. Prism B2B 연동 (고급)

네이버 클라우드 Prism B2B 서비스 연동 시:
1. https://www.ncloud.com/product/media/prism 신청
2. B2B API 키 발급
3. OAuth 토큰 공유 프로토콜 설정

## 7. 할당량 관리

- YouTube Data API: 기본 10,000 units/day
- Live Streaming API: 무제한 (생성 제한 있음)
- 할당량 초과 시: Google Cloud Console에서 증가 요청

## 8. 프로덕션 배포 전 체크리스트

- [ ] OAuth 동의 화면 "게시 상태" 변경
- [ ] 승인된 도메인에 프로덕션 URL 추가
- [ ] SSL 인증서 적용 (HTTPS 필수)
- [ ] 할당량 모니터링 설정
- [ ] 에러 로깅 및 알림 설정

---

## 🚨 중요 주의사항

1. **클라이언트 시크릿은 절대 프론트엔드에 노출 금지**
   - 백엔드에서만 사용
   - 환경 변수로 관리

2. **Refresh Token 저장 필수**
   - Access Token은 1시간 후 만료
   - Refresh Token으로 자동 갱신

3. **YouTube 채널 필수**
   - 셀러가 YouTube 채널이 없으면 생성 안내
   - 채널 생성 API 또는 수동 생성 가이드 제공

4. **테스트 계정 제한 (개발 중)**
   - 최대 100명까지만 테스트 가능
   - 게시 전까지는 추가된 테스트 사용자만 로그인 가능
