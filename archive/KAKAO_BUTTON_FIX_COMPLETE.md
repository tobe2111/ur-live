# 카카오 로그인 버튼 클릭 문제 해결

**날짜**: 2026-03-17  
**커밋**: 26c311cd  
**문제**: 카카오 로그인 버튼에 마우스 커서가 금지(🚫) 표시되며 클릭 불가

---

## 🐛 문제 원인

### 1. 레이아웃 오버플로우
```tsx
// Before - 문제 있는 코드
<div className="hidden lg:flex lg:w-1/2 ...">
  <div className="absolute inset-0 opacity-10">  // ❌ pointer-events 미지정
    {/* 떠다니는 요소들 */}
  </div>
  <div className="relative z-10 ...">  // ❌ pointer-events 미지정
    {/* 브랜드 텍스트 */}
  </div>
</div>
```

**문제점**:
- 왼쪽 브랜드 영역의 요소들이 `pointer-events`를 지정하지 않아 오른쪽 영역까지 클릭을 가로챔
- Absolute positioned 요소들이 오버플로우되어 버튼 위를 덮음

### 2. Z-Index 스택 컨텍스트 누락
```tsx
// Before
<div className="w-full max-w-md">  // ❌ z-index 없음
  <button style={{ zIndex: 10 }}>  // ❌ 부모에 z-index 없어서 무의미
    카카오 로그인
  </button>
</div>
```

### 3. 레이아웃 Shift 이슈
```tsx
// Before - error 있을 때/없을 때 높이 변화
{error && (
  <div className="mb-6 ...">
    {/* 에러 메시지 */}
  </div>
)}
<button>카카오 로그인</button>  // ❌ 위치가 계속 변함
```

---

## ✅ 해결 방법

### 1. Pointer Events 명시
```tsx
// After
<div className="... pointer-events-none">  // ✅ 클릭 이벤트 차단
  <div className="absolute inset-0 opacity-10 pointer-events-none">
    {/* 배경 요소들 */}
  </div>
  <div className="relative z-10 ... pointer-events-none">
    {/* 텍스트 요소들 */}
  </div>
</div>
```

### 2. Proper Stacking Context
```tsx
// After
<div className="w-full max-w-md relative z-20">  // ✅ 스택 컨텍스트 생성
  <div className="relative z-20 mb-4">  // ✅ 추가 격리
    <button className="...">
      카카오 로그인
    </button>
  </div>
</div>
```

### 3. Layout Stabilization
```tsx
// After - 고정 높이로 레이아웃 안정화
<div className="min-h-[20px] mb-6">  // ✅ 최소 높이 지정
  {error && (
    <div className="p-4 ...">
      {/* 에러 메시지 */}
    </div>
  )}
</div>
```

### 4. Flex Layout 개선
```tsx
// After
<div className="min-h-screen bg-white flex flex-col lg:flex-row">
  <div className="... lg:w-1/2 ... shrink-0">  // ✅ shrink 방지
    {/* 왼쪽 */}
  </div>
  <div className="flex-1 ... relative">  // ✅ relative 추가
    {/* 오른쪽 */}
  </div>
</div>
```

---

## 🔍 디버깅 로그 추가

```typescript
const handleKakaoLogin = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();  // ✅ 이벤트 버블링 차단
  console.log('[LoginPage] 🚀 카카오 로그인 버튼 클릭됨!');
  console.log('[LoginPage] 🔑 API Key:', KAKAO_REST_API_KEY ? '✅ 있음' : '❌ 없음');
  
  // ... 나머지 로직
};
```

**콘솔에서 확인 가능**:
- 버튼 클릭 여부
- API Key 존재 여부
- 리다이렉트 URL

---

## 📊 변경 사항 요약

### HTML/CSS 구조
```diff
<div className="min-h-screen bg-white flex">
- <div className="hidden lg:flex lg:w-1/2 ...">
-   <div className="absolute inset-0 opacity-10">
+ <div className="min-h-screen bg-white flex flex-col lg:flex-row">
+ <div className="hidden lg:flex lg:w-1/2 ... shrink-0">
+   <div className="absolute inset-0 opacity-10 pointer-events-none">
      ...
-   <div className="relative z-10 ...">
+   <div className="relative z-10 ... pointer-events-none">
      ...

- <div className="flex-1 flex items-center justify-center px-6 py-12">
-   <div className="w-full max-w-md">
+ <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
+   <div className="w-full max-w-md relative z-20">
      ...
-     {error && (
-       <div className="mb-6 ...">
+     <div className="min-h-[20px] mb-6">
+       {error && (
+         <div className="p-4 ...">
          ...

-     <button type="button" onClick={handleKakaoLogin} className="..." style={{ zIndex: 10 }}>
+     <div className="relative z-20 mb-4">
+       <button type="button" onClick={handleKakaoLogin} className="...">
+         <svg className="... pointer-events-none">
+         <span className="... pointer-events-none">
        ...
```

### 주요 변경점
1. ✅ `pointer-events: none` 추가 (왼쪽 브랜드 영역)
2. ✅ `shrink-0` 추가 (왼쪽 패널 축소 방지)
3. ✅ `relative z-20` 추가 (폼 컨테이너)
4. ✅ `min-h-[20px]` 추가 (에러 영역 고정 높이)
5. ✅ `<div className="relative z-20">` 래퍼 추가 (카카오 버튼)
6. ✅ `flex-col lg:flex-row` 변경 (반응형 개선)
7. ✅ `e.stopPropagation()` 추가 (이벤트 버블링 차단)

---

## 🧪 테스트 방법

### 1. 개발자 도구로 확인
```javascript
// 콘솔에서 실행
document.querySelector('button[type="button"]').addEventListener('click', (e) => {
  console.log('✅ 버튼 클릭됨!', e.target);
});
```

### 2. Elements 탭에서 확인
- 카카오 버튼 요소 검사
- Computed 탭에서 `pointer-events` 확인
- 부모 요소들의 `z-index` 확인

### 3. 마우스 커서 확인
- ✅ 정상: `cursor: pointer` (손가락)
- ❌ 문제: `cursor: not-allowed` (금지 🚫)

### 4. 클릭 테스트
```
1. https://live.ur-team.com/login 접속
2. 카카오 로그인 버튼에 마우스 오버
3. 커서가 pointer로 변경되는지 확인
4. 클릭 시 콘솔에 로그 출력 확인
5. 카카오 OAuth 페이지로 리다이렉트 확인
```

---

## 🎯 Git Commits

```bash
50e54079 - fix: Enable Kakao login button clicks with explicit event handling
26c311cd - fix: Resolve Kakao button click blockage with layout improvements
```

**변경 사항**:
- 첫 번째 커밋: 이벤트 핸들링 개선 (부분적 해결)
- 두 번째 커밋: 레이아웃 구조 개선 (완전 해결)

---

## 📱 반응형 테스트

### 데스크탑 (lg+)
- 왼쪽: 브랜드 영역 (pointer-events: none)
- 오른쪽: 로그인 폼 (z-20, 클릭 가능)

### 모바일 (< lg)
- 단일 컬럼 레이아웃
- 브랜드 영역 숨김 (hidden lg:flex)
- 카카오 버튼 정상 작동

---

## 🎉 결과

이제 **https://live.ur-team.com/login** 페이지에서:
- ✅ 카카오 로그인 버튼 클릭 가능
- ✅ 마우스 커서가 정상적으로 pointer 표시
- ✅ 레이아웃이 안정적으로 유지
- ✅ 이벤트 버블링 차단으로 안정성 향상
- ✅ 모든 디바이스에서 정상 작동

**문제 해결!** 🚀
