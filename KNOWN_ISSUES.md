# 알려진 이슈 및 해결 방법

## 1. 토스페이먼츠 모바일 앱 Intent 에러

### 증상
```
Failed to launch 'intent://?xid=8004700#Intent;scheme=monimopay;package=net.ib.android.smcard;end;'
because the scheme does not have a registered handler.
```

### 원인
- 토스페이먼츠 SDK가 모바일 환경을 감지하여 모바일 결제 앱 실행 시도
- 데스크톱 브라우저의 모바일 시뮬레이션 또는 결제 앱 미설치 환경
- `monimopay` scheme (스마트카드 앱) 핸들러 없음

### 영향
**✅ 기능에 영향 없음** - 이 에러는 무시해도 됩니다:
- 모바일 앱 실행 실패 시 자동으로 웹 결제로 fallback
- 카드, 계좌이체, 가상계좌 등 모든 결제 수단 정상 작동
- 실제 프로덕션 환경에서는 사용자가 인지하지 못함

### 해결 방법
**이 에러는 해결할 필요가 없습니다.**

만약 콘솔 로그를 깨끗하게 유지하고 싶다면:
1. 브라우저 개발자 도구에서 "intent:" 에러를 필터링
2. 실제 모바일 기기에서 테스트 (모바일 앱이 있으면 에러 없음)
3. 테스트 환경에서는 무시

### 추가 정보
- 토스페이먼츠 공식 동작: https://docs.tosspayments.com/
- 모바일 앱 없이도 웹 결제로 정상 작동
- 이 에러는 개발 중에만 자주 보이며, 실제 사용자는 거의 인지하지 못함

---

## 2. 장바구니 중복 카드 문제

### 증상
같은 상품이 여러 개의 카드로 표시됨

### 해결
✅ **2026-02-12 해결됨** (Commit: 307f85a)
- 장바구니 추가 시 중복 체크 로직 추가
- 같은 상품 재추가 시 수량만 증가

---

## 3. D1 바인딩 에러

### 증상
```
Cannot read properties of undefined (reading 'call')
```

### 해결
✅ **2026-02-12 해결됨** (Commit: 2dee0d3)
- CloudflareBindings 타입 사용
- wrangler types 자동 생성

자세한 내용: [D1_BINDING_ISSUE_RESOLVED.md](./D1_BINDING_ISSUE_RESOLVED.md)
