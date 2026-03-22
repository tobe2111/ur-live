# TikTok 썸네일 URL 가이드

## 📸 문제 해결 완료!

TikTok 스트림의 실제 영상 썸네일을 표시하기 위한 시스템이 구축되었습니다.

---

## 🔧 구현 내용

### 1. 데이터베이스 업데이트
- `live_streams` 테이블에 `thumbnail_url` 컬럼 추가
- 스트림 생성 시 자동으로 썸네일 URL 저장
  - **YouTube**: `https://img.youtube.com/vi/{videoId}/maxresdefault.jpg` 자동 생성
  - **TikTok**: 사용자가 제공한 썸네일 URL 저장 (또는 NULL)

### 2. 프론트엔드 렌더링 로직
우선순위별로 썸네일 표시:
1. **`thumbnail_url`이 있으면** → 해당 이미지 사용
2. **`thumbnail_url`이 NULL이고 `platform === 'tiktok'`** → TikTok 아이콘 표시
3. **그 외** → YouTube 썸네일 API 사용

---

## 📝 TikTok 썸네일 URL 얻는 방법

### Option 1: TikTok 웹사이트에서 직접 추출
1. TikTok 비디오 페이지 열기
2. 개발자 도구 (F12) → Network 탭
3. 페이지 새로고침
4. Filter: `image` 입력
5. 썸네일 이미지 찾기 (보통 `p16-sign` 또는 `video-icon` 포함)
6. URL 복사

**예시:**
```
https://p16-sign-sg.tiktokcdn.com/obj/tos-alisg-p-0037/... 
```

### Option 2: 스크린샷 업로드 (권장)
1. TikTok 비디오의 첫 프레임을 스크린샷
2. 이미지 호스팅 서비스에 업로드 (Imgur, Cloudinary 등)
3. 공개 URL 복사

---

## 🔄 기존 스트림 업데이트 방법

### 셀러 대시보드에서 (향후 구현 예정)
1. 스트림 관리 페이지로 이동
2. 해당 스트림 편집
3. "썸네일 URL" 필드에 이미지 URL 입력
4. 저장

### 현재 임시 해결책
데이터베이스에 직접 업데이트:

```bash
# 로컬 환경
npx wrangler d1 execute toss-live-commerce-db --local \
  --command="UPDATE live_streams SET thumbnail_url = 'YOUR_IMAGE_URL' WHERE id = 17"

# 프로덕션 환경
npx wrangler d1 execute toss-live-commerce-db --remote \
  --command="UPDATE live_streams SET thumbnail_url = 'YOUR_IMAGE_URL' WHERE id = 17"
```

---

## ✨ 새 스트림 생성 시

### 스트림 생성 API 사용법
```json
POST /api/seller/streams
{
  "title": "제품 추천 라이브",
  "description": "...",
  "youtube_url": "https://www.tiktok.com/@jiwon0280/video/7602630404377414932",
  "thumbnail_url": "https://p16-sign-sg.tiktokcdn.com/...", // 선택사항
  "status": "live"
}
```

- `thumbnail_url`을 제공하면 → 해당 이미지 사용
- `thumbnail_url`을 생략하면 → TikTok 아이콘으로 폴백

---

## 🎯 권장 워크플로우

### 셀러가 TikTok 스트림을 생성할 때:

1. **방법 A: 썸네일 URL 직접 입력** (가장 정확)
   - TikTok 비디오 페이지에서 썸네일 URL 추출
   - 스트림 생성 시 `thumbnail_url` 필드에 입력

2. **방법 B: 스크린샷 업로드** (권장)
   - TikTok 영상의 대표 프레임을 스크린샷
   - Imgur 등에 업로드
   - 공개 URL을 `thumbnail_url`에 입력

3. **방법 C: 일단 생성 후 수정** (현재)
   - 스트림을 먼저 생성 (TikTok 아이콘으로 표시됨)
   - 나중에 썸네일 URL을 업데이트

---

## 📱 배포 정보

- **최신 배포**: https://6641c8b5.toss-live-commerce.pages.dev
- **프로덕션**: https://live.ur-team.com (1~2분 후 반영)
- **Git 커밋**: `72eaafe`

---

## 🔍 테스트 결과

### YouTube 스트림 (ID 15)
- ✅ YouTube 썸네일 API에서 자동으로 썸네일 표시
- ✅ 에러 시 YouTube 브랜드 그라데이션 + 아이콘으로 폴백

### TikTok 스트림 (ID 17 - 기존)
- ⚠️ `thumbnail_url`이 NULL이므로 TikTok 아이콘 표시
- 📝 썸네일 URL을 업데이트하면 실제 이미지 표시

### TikTok 스트림 (새로 생성 시)
- ✅ `thumbnail_url` 제공 시 → 실제 썸네일 표시
- ✅ `thumbnail_url` 미제공 시 → TikTok 아이콘 표시

---

## 🚀 다음 단계

1. **셀러 스트림 편집 페이지에 썸네일 URL 입력 필드 추가**
2. **TikTok API 통합** (향후): TikTok oEmbed API로 자동 썸네일 추출
3. **이미지 업로드 기능**: 셀러가 직접 썸네일을 업로드할 수 있도록

---

## 📞 현재 상태 요약

- ✅ 데이터베이스 마이그레이션 완료 (로컬 + 프로덕션)
- ✅ 백엔드 API 업데이트 완료
- ✅ 프론트엔드 렌더링 로직 구현 완료
- ✅ YouTube 스트림 자동 썸네일 생성
- ⚠️ TikTok 스트림은 수동으로 썸네일 URL 입력 필요
- 🔄 기존 TikTok 스트림 (ID 17)은 업데이트 필요

---

이제 시스템이 준비되었습니다! 새로 생성하는 TikTok 스트림은 `thumbnail_url`을 제공하면 실제 썸네일이 표시됩니다. 🎉
