# 테스트 가이드

## 현재 상태
- ✅ **프로덕션**: 정상 작동 (https://46e5297d.toss-live-commerce.pages.dev)
- ⚠️ **로컬**: DB seed 데이터 문제로 일부 기능 제한

## 테스트 진행 방법

### 1. 프로덕션에서 테스트 (권장)
```
프로덕션 URL: https://46e5297d.toss-live-commerce.pages.dev
또는: https://live.ur-team.com
```

**테스트 체크리스트**:
- [ ] 카카오 로그인
- [ ] 상품 상세페이지 접근
- [ ] 장바구니 담기 버튼
- [ ] 구매하기 버튼
- [ ] 장바구니 페이지
- [ ] 결제 페이지 (TossPayments 위젯)
- [ ] 뒤로가기 네비게이션

### 2. 캐시 초기화 방법
**데스크톱**:
- Windows/Linux: `Ctrl + Shift + R` 또는 `Ctrl + F5`
- Mac: `Cmd + Shift + R`

**모바일**:
- 브라우저 설정 > 캐시 삭제
- 또는 시크릿 모드 사용

### 3. 디버깅
브라우저 콘솔에서 확인:
```javascript
// 로그인 상태 확인
console.log(localStorage.getItem('session'))
console.log(localStorage.getItem('user_id'))
console.log(localStorage.getItem('user_name'))

// 빌드 버전 확인
document.querySelector('meta[name="build-timestamp"]')?.content
document.querySelector('meta[name="deployment-id"]')?.content
```

## API 테스트

### Cart API (프로덕션)
```bash
curl -X POST https://46e5297d.toss-live-commerce.pages.dev/api/cart \
  -H "Content-Type: application/json" \
  -d '{"userId":3,"productId":1,"quantity":1,"priceSnapshot":159200}'

# 예상 응답:
# {"success":true,"data":{"id":75,"isUpdate":false}}
```

## 로컬 개발 제한사항
현재 로컬 개발 환경은 **UI 프리뷰 전용**입니다:
- ✅ 페이지 레이아웃 확인 가능
- ✅ 스타일링 작업 가능
- ❌ DB 연동 기능 제한적
- ❌ 일부 API 호출 실패 가능

**실제 기능 테스트는 프로덕션 배포 후 진행하세요.**
