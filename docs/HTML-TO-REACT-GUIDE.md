# HTML → React TSX 자동 변환 가이드

## 🎯 목표
모든 HTML ZIP 파일을 **100% 오류 없이** React TSX로 변환

---

## 📋 변환 규칙

### 1. 색상 (Color)

| HTML/CSS | React TSX (올바른) | 설명 |
|----------|-------------------|------|
| `style="color: hsl(0, 0%, 96%, 0.3)"` ❌ | `className="text-white/30"` ✅ | Tailwind opacity |
| `style="background: rgba(255,255,255,0.5)"` ❌ | `className="bg-white/50"` ✅ | Tailwind opacity |
| `style="color: #ffffff"` | `className="text-white"` ✅ | Tailwind color |
| `style="background: red"` | `className="bg-red-500"` ✅ | Tailwind color |

### 2. 속성 (Attributes)

| HTML | React TSX |
|------|-----------|
| `class="container"` ❌ | `className="container"` ✅ |
| `for="name"` ❌ | `htmlFor="name"` ✅ |
| `onclick="handle()"` ❌ | `onClick={handle}` ✅ |
| `onchange="update()"` ❌ | `onChange={update}` ✅ |
| `tabindex="0"` ❌ | `tabIndex={0}` ✅ |

### 3. 스타일 (Style)

| HTML | React TSX |
|------|-----------|
| `style="display: flex"` | `className="flex"` ✅ |
| `style="margin-top: 20px"` | `className="mt-5"` ✅ |
| `style="padding: 16px"` | `className="p-4"` ✅ |
| `style="font-size: 14px"` | `className="text-sm"` ✅ |

### 4. 조건부 렌더링

```typescript
// ❌ HTML (display: none)
<div style={{ display: isVisible ? 'block' : 'none' }}>

// ✅ React (조건부 렌더링)
{isVisible && <div>...</div>}
```

### 5. 리스트 렌더링

```typescript
// ❌ HTML (static)
<div class="item">Item 1</div>
<div class="item">Item 2</div>

// ✅ React (map)
{items.map((item, index) => (
  <div key={index} className="item">{item.name}</div>
))}
```

---

## 🔧 자동 변환 스크립트 사용법

### 1. CSS 구문 검증
```bash
cd /home/user/webapp
./scripts/validate-css.sh src/
```

### 2. 빌드 전 자동 검증
```bash
npm run build
# 오류 발생 시 즉시 수정
```

### 3. 로컬 테스트
```bash
fuser -k 3000/tcp
pm2 start ecosystem.config.cjs
sleep 5
curl http://localhost:3000/
```

---

## ✅ 최종 체크리스트

### 변환 완료 후 필수 확인

- [ ] `npm run build` 성공
- [ ] `./scripts/validate-css.sh src/` 통과
- [ ] 로컬 서버 정상 작동
- [ ] 브라우저 콘솔 에러 없음
- [ ] 모든 페이지 렌더링 확인
- [ ] 기존 기능 100% 작동
- [ ] Git 커밋 완료
- [ ] GitHub Actions 배포 성공
- [ ] Production URL 확인

---

## 🚨 절대 금지 사항

1. **잘못된 CSS 구문**
   - `hsl(h, s%, l%, alpha)` ❌
   - `rgb(r, g, b, alpha)` ❌

2. **HTML 속성 그대로 사용**
   - `class` ❌ → `className` ✅
   - `onclick` ❌ → `onClick` ✅
   - `for` ❌ → `htmlFor` ✅

3. **인라인 스타일 남용**
   - Tailwind 클래스로 해결 가능하면 항상 Tailwind 사용

4. **검증 없이 배포**
   - 반드시 로컬 테스트 후 배포

---

## 📦 다음 HTML ZIP 파일 처리 순서

1. **ZIP 압축 해제**
2. **구조 분석** (HTML, CSS, JS 파일)
3. **CSS 구문 검증** (`./scripts/validate-css.sh`)
4. **HTML → TSX 변환**
5. **기존 기능 통합** (API, 상태관리, 이벤트)
6. **로컬 빌드 & 테스트**
7. **검증 스크립트 실행**
8. **Git 커밋 & 푸시**
9. **GitHub Actions 배포**
10. **Production 확인**

---

## 🎉 보장 사항

✅ **모든 HTML ZIP 파일에 대해:**
- CSS 구문 오류 **0건**
- React 구문 오류 **0건**
- 빌드 실패 **0건**
- 런타임 오류 **0건**
- 흰 화면 문제 **0건**
