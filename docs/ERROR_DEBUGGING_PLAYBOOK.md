# 🚨 에러 대처 플레이북 (Claude 세션 절대 룰)

> **작성 배경**: 2026-05-23 Toss 결제 사건. 사용자 키 type 을 추측만으로 잘못 단정 → 일주일치 시간 + 신뢰 낭비. 같은 실수 두 번 안 만들기 위한 강제 절차.

## 🛑 절대 금지 (이거 어기면 사용자 신뢰 잃음)

1. **추측으로 fix 시도 금지** — "캐시일거다", "이 prefix 일거다" 같은 가정 위에 코드 변경 X
2. **"통일/단순화" 핑계로 dual-mode 제거 금지** — 기존 분기는 이유가 있음
3. **버전 v4 → v5 같은 큰 리팩토링 금지** — 작은 부분만 수정
4. **사용자에게 같은 에러 두 번 같은 답 금지** — 두 번째부터는 ground truth 수집

## ✅ 에러 보고 시 즉시 실행 순서 (BLOCKING - 다른 거 하지 말 것)

### Step 1: Ground truth 페이지/명령 즉시 생성 (5분)

코드 추측 전에 **실제 상태를 시각화하는 진단 도구**부터 만든다.

예시 — Toss 결제 사건의 `/toss-debug` 페이지:
- VITE env 키 값 (마스킹) + 감지 type
- server 응답 키 값 (마스킹) + 감지 type
- 두 키 일치 여부
- SDK 단계별 (`loadTossPayments` → `widgets()` → `setAmount` → `render*` → `requestPayment`) 결과 + raw 에러

**이 데이터 한 장 받으면 90% 추측 사라짐.**

진단 페이지 패턴:
```tsx
// src/pages/<Domain>DebugPage.tsx
export default function XxxDebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  function log(msg: string) { setLogs(p => [...p, `[${new Date().toISOString().slice(11,19)}] ${msg}`]) }

  useEffect(() => {
    log(`env: ${mask(envValue)}`)
    log(`server: ${mask(serverValue)}`)
    // ... 단계별 시도 + 결과 + raw 에러 로깅
  }, [])

  return <pre>{logs.join('\n')}</pre>
}
```

### Step 2: 사용자에게 데이터 요청 (한 번만)

진단 페이지 배포 후 사용자에게:
- "https://live.ur-team.com/<debug-route> 접속 후 화면 스크린샷 공유해주세요"
- 한 번만 요청. 받기 전엔 코드 안 만짐.

### Step 3: 에러 메시지 1:1 매칭

받은 SDK/API raw 에러 텍스트를 **단어 그대로** `node_modules/<sdk>/types/*.d.ts` 또는 SDK 소스에서 검색.
- 검색 안 되면 → SDK CDN 또는 공식 문서 (WebFetch)
- 한국어 에러 메시지는 의역 금지 — **정확한 한국어 그대로** grep

검색 결과로 어느 SDK 함수가 어느 조건에서 throw 하는지 확정.

### Step 4: 최소 수정 (가능하면 1 commit)

확정된 원인에 대해 **가능한 가장 작은 변경**:
- 새 파일 추가 X (가능하면)
- 기존 함수 시그니처 변경 X
- 1 commit = 1 원인 해결

## 📋 자주 발생하는 에러 카테고리별 가이드

### A. 결제 SDK 에러 (Toss / Stripe / etc)

| 증상 | 즉시 체크 |
|---|---|
| "결제위젯 연동 키" / "API 개별 연동 키" 등 키 type 에러 | `/toss-debug` (또는 동등) → VITE/server 키 prefix 확인 |
| 무한 로딩 | timeout (`Promise.race`) 8초 + raw 에러 노출 |
| variantKey 404 | 사용자에게 Toss 콘솔 변경 위젯명 물어보기 (추측 X) |

### B. 환경변수 미스매치

**의심 시 즉시**:
- Cloudflare Pages → Production tab vs Preview tab 분리 확인
- `VITE_*` (빌드 타임) vs `*` (런타임) 두 종류 모두 설정 여부 확인
- 사용자에게 "두 값 정확히 동일한가요?" 직접 질문

### C. /api/orders 등 500 에러

**즉시 stage 추적 패턴**:
```ts
let stage = 'init'
try {
  stage = 'auth'; ...
  stage = 'parse'; ...
  stage = 'db-insert'; ...
} catch (err) {
  return safeError(c, err, '...', `[orders:${stage}]`)
}
```
`safeError` 가 production 에서 `_debug` 200자 노출 → 다음 사용자 시도 후 정확한 stage 파악.

### D. UI 모바일 overflow

`flex` + `<input>` + `shrink-0` 버튼 패턴 일괄 점검:
```tsx
<div className="flex gap-2 w-full min-w-0">   ← min-w-0 필수
  <input className="flex-1 min-w-0 ..." />     ← min-w-0 필수
  <button className="shrink-0 ...">...</button>
</div>
```

## 🧠 사용자와의 소통 룰

1. **"이상적이고 영구적으로" 명령 받았을 때**: 진단 먼저, 그 다음 코드.
2. **사용자가 같은 에러 두 번째 보고**: 무조건 진단 페이지 만들기.
3. **사용자가 "내 환경 이미 다 됐는데?" 답변**: 진단 데이터 요청해서 검증.
4. **"통일/단순화" 제안 전**: 현재 동작하는 분기 이유 사용자에게 확인.
5. **commit 메시지에 "영구 fix" 쓰기 전**: 진단으로 검증된 케이스만.

## 📊 이번 사고 (2026-05-23) 의 핵심 lesson

| 제 행동 | 결과 | 교훈 |
|---|---|---|
| 에러 메시지 한국어를 잘못 해석 | widget 키 환경이라 단정 | 단어 그대로 SDK 소스 grep |
| 추측만으로 widgets() 통일 (v5) | gck 키 환경에서 silent fail | 기존 dual-mode 분기 보존 |
| 같은 추측 fix 5번 반복 | 사용자 시간 1시간+ 낭비 | 2번째 동일 에러 = 진단 페이지 작성 |
| /api/payments/client-key 왕복 제거 | env mismatch 위험 추가 | perf 핑계 X — 동작 안전성 최우선 |
| /toss-debug 페이지 만들기 너무 늦음 | 1시간 헛수고 | 사고 발생 즉시 (5분 내) 진단 도구 |

## 🎯 다음 사고 발생 시 첫 액션 (체크리스트)

- [ ] 사용자 신고 받음 → 추측 글쓰기 시작 전에 멈춤
- [ ] "이 에러를 정확히 진단할 데이터가 뭐지?" 자문
- [ ] 진단 페이지/명령 코드 작성 (10분 이내)
- [ ] 빌드 + push + 사용자에게 진단 데이터 요청
- [ ] 받은 데이터로 SDK 소스 검색 (의역 없이 단어 그대로)
- [ ] 확정된 원인에 최소 fix → 1 commit
- [ ] 사용자 검증 → "영구 fix" 라벨 부여

## 📎 관련 파일

- `src/pages/TossDebugPage.tsx` — 결제 진단 페이지 패턴 참조
- `src/lib/toss-key-type.ts` — 키 type 감지 (server/client 동일)
- `src/worker/utils/toss-gateway.ts` — server 측 키 type 검증
- `src/worker/utils/safe-error.ts` — production 에러 _debug 노출

---

**마지막 업데이트**: 2026-05-23 (Toss 결제 사건 직후)
**우선순위**: 모든 디버깅 작업 전 본 문서 1회 스캔 필수
