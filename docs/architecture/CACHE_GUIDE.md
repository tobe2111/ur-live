# 캐시 문제 해결 가이드

## 문제 증상
- 새로운 배포 후에도 이전 디자인이 보임
- 새로고침해야만 새 버전이 보임
- 코드 변경이 즉시 반영되지 않음

## 해결 방법

### 1. 자동 해결 (이번 배포로 적용됨) ✅

**변경 내용**:
```
public/_headers 파일 수정
- HTML: Cache-Control: no-cache, no-store, must-revalidate
- JS/CSS (with hash): Cache-Control: public, max-age=31536000, immutable
```

**효과**:
- HTML은 항상 최신 버전 제공
- JS/CSS는 파일명에 해시가 있어서 변경 시 자동으로 새 파일 로드
- 다음 배포부터는 새로고침 없이 즉시 반영됨

### 2. 사용자 측 강제 새로고침

**방법**:
- Windows/Linux: `Ctrl + Shift + R` 또는 `Ctrl + F5`
- Mac: `Cmd + Shift + R`
- Chrome DevTools 열고: Network 탭에서 "Disable cache" 체크

### 3. Cloudflare 캐시 수동 퍼지 (긴급 시)

Cloudflare 대시보드에서:
1. 프로젝트 선택
2. **Caching** 탭
3. **Purge Cache** → **Purge Everything**

또는 Wrangler CLI:
```bash
# 전체 캐시 삭제
npx wrangler pages deployment tail --project-name toss-live-commerce

# URL별 캐시 삭제
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://live.ur-team.com/"]}'
```

### 4. 캐시 전략 설명

| 파일 타입 | 캐시 기간 | 이유 |
|----------|---------|------|
| **HTML** | 캐싱 안함 | SPA 엔트리, 항상 최신 필요 |
| **JS/CSS (해시)** | 1년 | 파일명 변경 시 새로 로드 |
| **/static/** | 1년 | 정적 리소스 |
| **/api/*** | 캐싱 안함 | 동적 데이터 |

### 5. Vite 빌드 해시 확인

Vite는 자동으로 파일명에 해시를 추가:
```
dist/assets/index-XeY8W8gz.js  ← 해시: XeY8W8gz
dist/assets/index-DyB59xhB.css ← 해시: DyB59xhB
```

코드 변경 시 해시가 바뀌므로 브라우저가 자동으로 새 파일 다운로드!

## 앞으로는?

✅ **다음 배포부터는**:
- HTML은 캐싱 안하므로 즉시 반영
- JS/CSS 파일명 해시가 바뀌므로 자동 갱신
- 사용자가 새로고침 할 필요 없음!

