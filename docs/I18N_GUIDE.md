# i18n 운영 가이드

유어딜의 6 언어 (ko/en/ja/zh/es/fr) i18n 운영 가이드.

## 현재 상태
- **Master**: 한국어 (ko/translation.json) — 5,025 키
- **Sync**: 모든 다른 5 언어가 ko 와 동일 키 개수 (ko 값 fallback)
- **실제 번역률**: ko 100%, 나머지 ko fallback (글로벌 진출 시점에 진짜 번역)

## 영구 패턴

### 1. 새 한국어 텍스트는 항상 `t()` 함수 사용
```tsx
// ❌ 안 됨 (hardcode)
<button>저장</button>

// ✅ 좋음 (defaultValue 패턴)
<button>{t('common.save', { defaultValue: '저장' })}</button>
```

이유: defaultValue 가 있으면 ko 에 키 없어도 한국어 노출 → 점진 추가 가능.

### 2. 키 네이밍 규칙
- `common.*` — 모든 페이지 공통 (저장 / 취소 / 확인 등)
- `seller.*` — 셀러 대시보드
- `agency.*` — 에이전시 대시보드
- `admin.*` — 어드민
- `voucher.*` — 공구권
- `payment.*` — 결제
- `appointment.*` — 예약

### 3. 점진 sync 명령
```bash
# 누락 키 리포트
node scripts/i18n-sync.mjs

# 누락 키 ko fallback 으로 자동 채움
node scripts/i18n-sync.mjs fill

# 소스 코드에서 t() defaultValue 추출 + ko 에 누가 추가
node scripts/i18n-sync.mjs extract
```

## 글로벌 진출 시 전체 번역

### Option A: DeepL API (권장 — 가장 정확)
1. DeepL Pro 계약 (월 €5.49 / 50만 chars)
2. `scripts/translate-via-deepl.mjs` 작성 (별도 PR)
3. ko 의 모든 키를 각 언어로 일괄 번역
4. JSON 파일 자동 업데이트

### Option B: ChatGPT API (저렴)
1. OpenAI API key
2. ko translation.json 청크 단위 (500 키씩) ChatGPT 에 전달
3. 응답 JSON 머지

### Option C: 매뉴얼 (소량 핵심만)
- 핵심 100-200 키만 직접 번역
- 나머지는 ko fallback (영어권 사용자 일부 한국어 노출 감수)

## 자주 발생하는 실수

### ❌ `||` 연산자 fallback
```tsx
t('key') || '한국어'   // 잘못된 패턴
```

### ✅ `defaultValue` 옵션
```tsx
t('key', { defaultValue: '한국어' })   // 영구 패턴
```

## Pre-commit 자동 검증
- `scripts/check-guide-sync.sh` 에서 일부 영역 검증
- 새 페이지에 한국어 hardcode 가 많으면 warning

## 영구 룰 (CLAUDE.md)
- 모든 UI 텍스트는 t() 함수 사용
- defaultValue 패턴 필수 (|| 금지)
- 6 언어 sync 는 `node scripts/i18n-sync.mjs fill` 로 ko fallback 보장
