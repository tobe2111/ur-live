# 2026-11-25 [LOADING_ADDITIVE] `src/worker/index.ts` 에 어드민 쓰기 역할 게이트 한 줄

- **무엇을**: `app.use('/api/*', adminOutsideWriteGate())` 한 줄(+ 주석 2줄)과 import 이름 하나. 위치는 기존 `/api/admin/*` 역할 게이트 바로 아래, 모든 라우트 등록 앞.
- **왜**: `/api/admin/*` 밖에서 어드민 토큰을 받는 쓰기 핸들러 66개가 역할을 안 봤다(조사 2026-11-25). 조회 전용 어드민이 일괄 환불·주문 취소·출금 승인·기능 플래그 변경을 할 수 있었다.
- **잠긴 항목에 닿았나**: 아니다. HTMLRewriter SSR 주입 블록 · `caches.default.match` 직접 읽기 · `/api/image/resize` `ALLOWED_HOSTS` 는 그대로다.
- **로딩에 주는 영향**: GET·HEAD 는 첫 줄에서 바로 지나간다(`/api/coupons/seed` 하나만 예외). 쓰기 요청도 Bearer 의 type 이 admin 이 아니고 어드민 쿠키 이름이 없으면 서명 검증 없이 지나간다 — 손님·사장님 요청에 HMAC 을 더 얹지 않는다. 첫 화면 경로(GET)에는 문자열 비교 몇 번이 전부다.
- **되돌리는 법**: 그 한 줄을 지운다(PR revert).
- **근거 시험**: `src/tests/unit/admin-outside-write-gate-2026-11-25.test.ts` (10건 · 되돌려-검증 2건).
