# 2026-11-25 [LOADING_ADDITIVE] `src/worker/index.ts` 보안 헤더 `frame-src` 에 `blob:` 추가

- **무엇을**: `"frame-src 'self' "` → `"frame-src 'self' blob: "` (같은 줄, 줄 수 불변).
- **왜**: 어드민 "대외 소개서"(`/admin/proposals`)의 미리보기가 빈 화면이었다. PDF 를 Bearer 로 받아 blob 주소로 iframe 에 띄우는데(`useAutoProposal.ts`) 보안 헤더가 그 프레임을 막았다. 라이브 실측(2026-11-25): 콘솔에 `Framing 'blob:https://urdeal.kr/…' violates … frame-src`.
- **잠긴 항목에 닿았나**: 아니다. HTMLRewriter SSR 주입 블록 · `caches.default.match` 직접 읽기 · `/api/image/resize` `ALLOWED_HOSTS` 는 그대로다. `style-src` 도 건드리지 않았다(nonce 금지 규칙과 무관).
- **보안상 넓어지는 것**: blob 주소는 이 사이트의 스크립트만 만들 수 있다. 같은 헤더의 `worker-src` · `img-src` 는 이미 `blob:` 을 허용한다.
- **로딩에 주는 영향**: 없다(헤더 문자열 6글자).
- **되돌리는 법**: `blob: ` 을 지운다(PR revert).
- **근거 시험**: `src/tests/unit/admin-screens-auth-2026-11-25.test.tsx` (주입 `[admin-screens] 보안 헤더가 blob 프레임을 막는다`).
