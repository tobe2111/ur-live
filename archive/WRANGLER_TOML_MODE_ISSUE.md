# 🚨 긴급: Cloudflare Pages 바인딩 문제 해결

**날짜**: 2026-03-16  
**상태**: 🔴 **BLOCKER** - wrangler.toml 모드로 인한 바인딩 추가 불가

---

## 🎯 **문제 상황**

### 발견된 문제
```
Settings → Variables and Secrets → Bindings 페이지에서:

⚠️ "Bindings for this project are being managed through wrangler.toml"
   [Learn more]

→ [+ Add] 버튼이 비활성화됨 (클릭 안 됨)
→ 대시보드에서 바인딩 추가 불가능
```

### 근본 원인
- Cloudflare Pages 프로젝트가 **"wrangler.toml 관리 모드"**로 설정됨
- 이 모드에서는 대시보드 UI가 비활성화됨
- `wrangler.toml` 파일로만 바인딩을 관리해야 함
- **하지만**: Pages는 `wrangler.toml`의 바인딩을 제대로 적용하지 않음 (버그)

### 결과
```
✅ wrangler.toml에 D1 바인딩 정의됨
✅ Worker 코드 정상
✅ D1 Database 존재
❌ 런타임에 env.DB = undefined
❌ 모든 API 500 에러
```

---

## ✅ **해결 방법**

### **방법 1: wrangler.toml 모드 해제** (가장 확실!)

#### Step 1: "Learn more" 클릭
```
Settings → Bindings 페이지 상단 배너:
"Bindings for this project are being managed through wrangler.toml"
[Learn more] ← 클릭
```

#### Step 2: 설정 찾기
문서 또는 설정 페이지에서 다음 옵션 찾기:

**패턴 A**:
```
Binding management:
⚪ Use dashboard (UI)  ← 선택
⚪ Use wrangler.toml
```

**패턴 B**:
```
☑ Manage bindings via wrangler.toml
  ← 체크 해제
```

**패턴 C**:
```
Configuration source:
⚪ Dashboard  ← 선택
⚪ wrangler.toml file
```

#### Step 3: 저장 및 새로고침
```
[Save] 또는 [Update] 클릭
→ 페이지 새로고침 (F5)
→ [+ Add] 버튼 활성화 확인
```

#### Step 4: D1 바인딩 추가
이제 [+ Add] 버튼이 작동합니다:
```
1. [+ Add] 클릭
2. Binding type: D1 Database 선택
3. Variable name: DB
4. D1 database: toss-live-commerce-db
5. Environment: Production
6. [Add binding] 클릭
```

---

### **방법 2: Cloudflare 지원팀 문의** (빠른 해결)

wrangler.toml 모드를 해제하는 옵션을 못 찾겠다면:

#### Cloudflare Discord
```
https://discord.gg/cloudflaredev
#pages-help 채널에서 질문:

"My Pages project (ur-live) is stuck in 'wrangler.toml' binding mode.
The [+ Add] button is disabled. How do I switch to dashboard binding management?"
```

#### Cloudflare Support
```
https://dash.cloudflare.com/ → Help & Support
→ Create a ticket

제목: "Pages project binding mode change request"
내용: "Project 'ur-live' is in wrangler.toml binding mode.
       Need to switch to dashboard binding management.
       [+ Add] button is disabled."
```

---

### **방법 3: 프로젝트 재생성** (최후의 수단)

현재 프로젝트를 삭제하고 새로 만들되, **처음부터 대시보드 모드**로 생성:

#### Step 1: 프로젝트 백업
```bash
# 현재 배포 설정 백업
cd /home/user/webapp
git log --oneline -10 > backup/git-history.txt
cp wrangler.toml backup/wrangler.toml.bak
```

#### Step 2: 새 프로젝트 생성
```
Cloudflare 대시보드 → Workers & Pages
→ Create application
→ Pages
→ Connect to Git (또는 Direct Upload)
→ 프로젝트 이름: ur-live-v2
→ ⚠️ 설정 시 "Use wrangler.toml" 옵션 체크 해제!
```

#### Step 3: 바인딩 추가
```
새 프로젝트 → Settings → Functions
→ D1 database bindings
→ [+ Add]
→ Variable: DB, Database: toss-live-commerce-db
→ [Save]
```

#### Step 4: 배포
```bash
npx wrangler pages deploy dist/client --project-name=ur-live-v2
```

---

## 🔍 **디버깅 정보**

### 현재 설정 확인
```bash
cd /home/user/webapp

# wrangler.toml 확인
cat wrangler.toml | grep -A 5 "d1_databases"

# 출력:
[[d1_databases]]
binding = "DB"
database_name = "toss-live-commerce-db"
database_id = "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
```

### 배포 상태
```
✅ 최신 배포: https://cdbedc62.ur-live.pages.dev
✅ 파일 업로드: 성공
✅ Worker 번들: 577KB
❌ 바인딩: 적용 안 됨
```

### API 테스트 결과
```bash
curl https://live.ur-team.com/api/products?limit=3

{
  "success": false,
  "error": "Cannot read properties of undefined (reading 'prepare')"
}
# → env.DB = undefined
```

---

## 📋 **체크리스트**

### 시도한 방법들 ✅
- [x] wrangler.toml에 D1 바인딩 정의
- [x] _wrangler.toml 생성 및 배포
- [x] dist/client/에 설정 파일 포함
- [x] 여러 번 재배포

### 아직 시도 안 한 방법들 ⏳
- [ ] "Learn more" 클릭해서 wrangler.toml 모드 해제
- [ ] 대시보드 UI 모드로 전환
- [ ] Cloudflare 지원팀 문의
- [ ] 프로젝트 재생성 (최후의 수단)

---

## 🎯 **즉시 해야 할 일**

### **1순위**: "Learn more" 링크 클릭
```
Settings → Bindings 페이지:
"Bindings for this project are being managed through wrangler.toml"
[Learn more] ← 클릭

→ 문서 또는 설정 페이지에서 모드 전환 옵션 찾기
→ "Use dashboard" 또는 "UI management" 선택
→ 저장 → 새로고침
→ [+ Add] 버튼 활성화 확인
```

### **2순위**: Cloudflare Discord에 질문
```
https://discord.gg/cloudflaredev
#pages-help 채널

질문:
"My Pages project is in 'wrangler.toml binding mode' and the [+ Add]
button is disabled. How do I switch back to dashboard binding management?"
```

### **3순위**: Support Ticket
```
https://dash.cloudflare.com/ → Help & Support
→ "Binding management mode change request"
```

---

## 📚 **참고 자료**

### Cloudflare 문서
- [Pages Functions Bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [wrangler.toml Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Pages Configuration](https://developers.cloudflare.com/pages/configuration/)

### 관련 GitHub Issues
- [Pages binding not working with wrangler.toml](https://github.com/cloudflare/workers-sdk/issues)
- Search: "pages bindings wrangler.toml not applied"

---

## 🔧 **임시 해결책 (비추천)**

Worker를 별도로 배포하고 Pages와 연결:

```bash
# Worker 전용 배포 (비추천, 복잡함)
npx wrangler deploy src/worker/index.ts
```

하지만 이는 **Pages 아키텍처를 완전히 변경**하므로 권장하지 않습니다.

---

## ✅ **성공 시나리오**

```
"Learn more" 클릭
  ↓
wrangler.toml 모드 해제
  ↓
"Use dashboard" 선택
  ↓
저장 & 새로고침
  ↓
[+ Add] 버튼 활성화 ✅
  ↓
D1 바인딩 추가 (DB, toss-live-commerce-db)
  ↓
자동 재배포 (1-2분)
  ↓
✅ API 정상 작동!
✅ 프로덕션 복구 완료!
```

---

## 🎯 **핵심 메시지**

**문제**: 
- Cloudflare Pages가 wrangler.toml 모드에 갇혀있음
- [+ Add] 버튼 비활성화
- 바인딩 추가 불가능

**해결**: 
- "Learn more" 링크 클릭
- wrangler.toml 모드 해제
- 대시보드 UI 모드로 전환
- [+ Add] 버튼 활성화
- D1 바인딩 추가

**결과**: 
- 5분 안에 완전 해결
- 모든 API 정상 작동
- 프로덕션 완전 복구

---

**다음 액션**: Bindings 페이지의 "Learn more" 링크 클릭 → 설정 찾기 → 모드 전환

**작성**: 2026-03-16  
**우선순위**: 🔴 CRITICAL - BLOCKER
