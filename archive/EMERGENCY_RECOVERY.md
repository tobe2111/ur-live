# 🚨 긴급 복구 가이드

## 현재 상황
- ur-live: 원래 잘 작동하던 프로젝트
- ur-live-working: 문제 많은 새 프로젝트
- 도메인: live.ur-team.com (연결 안 됨)

## 가장 빠른 복구 방법

### 1단계: ur-live-working 삭제 (2분)
```
Cloudflare Dashboard
→ Workers & Pages
→ ur-live-working
→ Settings (왼쪽 하단)
→ Delete project
→ "ur-live-working" 입력하여 확인
→ Delete 버튼 클릭
```

### 2단계: DNS 레코드 정리 (3분)
```
Cloudflare Dashboard
→ Websites (왼쪽 메뉴)
→ ur-team.com
→ DNS
→ Records 탭
```

**모든 "live" 관련 레코드 삭제:**
- Type: CNAME, Name: live → Delete
- Type: A, Name: live → Delete (있다면)
- Type: AAAA, Name: live → Delete (있다면)

### 3단계: 2분 대기
DNS 전파 시간 기다리기

### 4단계: ur-live에 도메인 추가 (2분)
```
Cloudflare Dashboard
→ Workers & Pages
→ ur-live
→ Custom domains
→ Set up a custom domain
→ "live.ur-team.com" 입력
→ Continue
→ Activate domain
```

### 5단계: 배포 확인 (1분)
```
Workers & Pages
→ ur-live
→ Deployments
→ 최신 배포 상태 확인 (Success인지)
```

### 6단계: 테스트 (1분)
```
https://live.ur-team.com/login
→ 카카오 로그인 테스트
```

## 예상 소요 시간
**총 10분**

## 만약 안 되면
1. Cloudflare 캐시 삭제:
   - Websites → ur-team.com → Caching → Purge Everything
   
2. 브라우저 강력 새로고침:
   - Ctrl + Shift + R (Windows)
   - Cmd + Shift + R (Mac)

## ur-live가 GitHub 연결되어 있다면
자동으로 최신 코드로 배포됩니다!

---

**모든 것이 원래대로 돌아갑니다!** ✅
