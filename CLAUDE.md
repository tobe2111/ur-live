# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## i18n (다국어) 필수 규칙

셀러 대시보드(`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`)를 수정할 때:

1. **모든 UI 텍스트**는 `t()` 함수를 사용해야 합니다. 하드코딩 한국어 금지.
2. 새로운 텍스트 추가 시 `public/locales/{ko,en,ja,zh,es,fr}/translation.json`의 **6개 언어** 모두에 키를 추가합니다.
3. 키 네이밍: `common.*` (공통 버튼/상태), `seller.*` (셀러 전용)
4. 예시:
   ```tsx
   // ❌ 하드코딩
   <button>저장</button>
   
   // ✅ i18n
   <button>{t('common.save')}</button>
   ```

## 다크 테마

- 유저 대면 페이지: 다크 테마 (`#020202` 배경, `#121212` 카드)
- 셀러/어드민 대시보드: 라이트 테마 (`#F4F5F7` 배경, `text-gray-900`)
- 쇼핑 페이지(`/browse`): 화이트 테마

## 인증

- Bearer 토큰 우선, 세션 쿠키 차선 (순서 중요)
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering (캐시 있으면 스피너 없이 렌더)

## DB 스키마

- 프로덕션 DB 컬럼명은 `src/shared/db/production-schema.ts` 참조
- `stock` (not `stock_quantity`), `is_active` (not `status`), `credit_amount` (not `seller_amount`)

## 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 15% 플랫폼 수수료 적용
- 최소 후원: 500딜
